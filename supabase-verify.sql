SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'students'
AND column_name IN ('present_status', 'full_name_as_signature');

SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
AND NOT c.relrowsecurity;

SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER');

SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND 'anon' = ANY(roles);

SELECT count(*) FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'rate_limit_log';

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
AND p.proname IN ('enroll_student_in_course','submit_installment_payments','verify_installment_payments',
'mark_installment_paid','unmark_installment',
'create_fee_schedule','apply_fee_delta')
ORDER BY p.proname, args;

SELECT p.proname, r.rname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN LATERAL unnest(p.proacl) acl ON true
JOIN pg_roles r ON r.oid = acl.grantee
WHERE n.nspname = 'public' AND r.rname IN ('anon','authenticated')
AND p.proname IN ('enroll_student_in_course','submit_installment_payments','verify_installment_payments',
'mark_installment_paid','unmark_installment');

SELECT e.enumlabel FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname = 'payment_status' ORDER BY e.enumsortorder;

SELECT f.id, f.total_fee, f.paid_amount, f.pending_amount,
SUM(fi.amount) AS scheduled
FROM fees f JOIN fee_installments fi ON fi.fee_id = f.id
GROUP BY f.id, f.total_fee, f.paid_amount, f.pending_amount
HAVING SUM(fi.amount) <> f.total_fee;