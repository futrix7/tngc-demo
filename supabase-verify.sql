-- Post-migration checks. Every query here is expected to return ZERO rows (or,
-- where a result is the point, the exact shape shown). Run it in the Supabase SQL
-- editor after applying supabase.sql.

-- ---------------------------------------------------------------------------
-- 1. A student record carries the data the app now selects by name.
-- ---------------------------------------------------------------------------
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'students'
AND column_name IN ('present_status', 'full_name_as_signature');

-- ---------------------------------------------------------------------------
-- 2. RLS is on for every table. Anything returned is unprotected.
-- ---------------------------------------------------------------------------
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
AND NOT c.relrowsecurity;

-- ---------------------------------------------------------------------------
-- 3. The branches table and its branch_id columns exist.
--
--    The app read `branches` and `branch_id` on nearly every admin screen, and
--    the canonical migration created neither: a payment's branch breakdown came
--    out empty and the branch pickers in the expense and teacher sheets had
--    nothing to select. All four columns must be uuid, and nullable with ON
--    DELETE SET NULL so removing a campus cannot cascade away a student.
-- ---------------------------------------------------------------------------
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'branches')
    OR (column_name = 'branch_id'
        AND table_name IN ('students', 'teachers', 'payments', 'transactions'))
  )
ORDER BY table_name, column_name;

-- Exactly one primary campus, enforced by a unique partial index rather than by
-- an application check.
SELECT count(*) AS primary_branch_count
FROM branches WHERE is_primary;

-- No branch_id points at a campus that does not exist. Any row here is a write
-- that slipped past the foreign key (or a campus that was deleted by hand).
SELECT 'students' AS table_name, id, branch_id FROM students
  WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = students.branch_id)
UNION ALL
SELECT 'payments', id, branch_id FROM payments
  WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = payments.branch_id)
UNION ALL
SELECT 'teachers', id, branch_id FROM teachers
  WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = teachers.branch_id);

-- ---------------------------------------------------------------------------
-- 4. anon holds no write privilege on any table.
-- ---------------------------------------------------------------------------
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER');

-- ---------------------------------------------------------------------------
-- 5. No policy grants anon anything at all.
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND 'anon' = ANY(roles);

-- ---------------------------------------------------------------------------
-- 6. A student can file a claim, and only a claim.
--
--    `Students file own payments` is the INSERT path. It must permit a Pending,
--    unverified row of the student's own and nothing else: the policy used to
--    accept status='Paid', which let any signed-in student mark an unpaid
--    installment settled everywhere with one request. Expect exactly this one
--    row, and expect the qual to mention 'Pending' and 'verified_at'.
-- ---------------------------------------------------------------------------
SELECT policyname, cmd, roles::text, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'payments';

-- ---------------------------------------------------------------------------
-- 7. rate_limit_log is locked down, or the brute-force guard is decorative.
-- ---------------------------------------------------------------------------
SELECT count(*) FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'rate_limit_log';

-- ---------------------------------------------------------------------------
-- 8. The payment-writing functions exist with the expected signatures.
--
--    record_fee_payment and record_fee_payment_at are deliberately two
--    signatures, not one with a defaulted argument: every existing caller passes
--    the seven named arguments, and adding an eighth would have changed what
--    they resolve to. Both should appear here.
-- ---------------------------------------------------------------------------
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
AND p.proname IN ('enroll_student_in_course','submit_fee_payment','verify_installment_payments',
'mark_installment_paid','unmark_installment',
'create_fee_schedule','apply_fee_delta','record_fee_payment','record_fee_payment_at')
ORDER BY p.proname, args;

-- ---------------------------------------------------------------------------
-- 9. Neither anon nor authenticated may execute any of them.
-- ---------------------------------------------------------------------------
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'enroll_student_in_course',
    'submit_fee_payment',
    'record_fee_payment',
    'record_fee_payment_at',
    'verify_installment_payments',
    'mark_installment_paid',
    'unmark_installment'
  )
ORDER BY p.proname;

-- ---------------------------------------------------------------------------
-- 10. The payment_status enum, including 'Rejected'.
-- ---------------------------------------------------------------------------
SELECT e.enumlabel FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname = 'payment_status' ORDER BY e.enumsortorder;

-- ---------------------------------------------------------------------------
-- 11. Every schedule adds up to the fee it covers. Any row here is a fee whose
--     balance cannot be reconciled against its own installments.
-- ---------------------------------------------------------------------------
SELECT f.id, f.total_fee, f.paid_amount, f.pending_amount,
    SUM(fi.amount) AS scheduled
FROM fees f JOIN fee_installments fi ON fi.fee_id = f.id
GROUP BY f.id, f.total_fee, f.paid_amount, f.pending_amount
HAVING SUM(fi.amount) <> f.total_fee;

-- ---------------------------------------------------------------------------
-- 12. paid_amount agrees with the ledger.
--
--     This is the check the raw browser-side INSERT in the old Record Payment
--     sheet broke on every save: a payments row existed while fees.paid_amount
--     never moved, so the student kept being shown money they had handed over.
--     The join runs through the installment, because that is the only link from a
--     payment to the fee it pays. Expected to return nothing.
-- ---------------------------------------------------------------------------
SELECT f.id, f.paid_amount, COALESCE(SUM(p.amount), 0) AS ledger_paid
FROM fees f
LEFT JOIN fee_installments fi ON fi.fee_id = f.id
LEFT JOIN payments p ON p.installment_id = fi.id AND p.status = 'Paid'
GROUP BY f.id, f.paid_amount
HAVING round(f.paid_amount, 2) <> round(COALESCE(SUM(p.amount), 0), 2);

-- ---------------------------------------------------------------------------
-- 13. No installment is left 'Paid' with money still owing, or 'Pending' with the
--     money already collected. A part payment is 'Partial', so a 'Pending' line
--     carrying Paid rows is a stale status that a screen would report as unpaid.
-- ---------------------------------------------------------------------------
SELECT fi.id, fi.label, fi.status, fi.amount,
       COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'Paid'), 0) AS paid
FROM fee_installments fi
LEFT JOIN payments p ON p.installment_id = fi.id
GROUP BY fi.id, fi.label, fi.status, fi.amount
HAVING (fi.status = 'Pending'  AND COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'Paid'), 0) > 0)
    OR (fi.status = 'Paid'
        AND COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'Paid'), 0) < fi.amount);
