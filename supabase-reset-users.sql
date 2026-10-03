-- WARNING: DESTRUCTIVE RESET FOR APP USER DATA ONLY
-- This removes all student/admin/teacher accounts and their linked app records.
-- It does NOT delete the course catalog or core institute setup.
-- Use only in a local/dev Supabase instance or a staging database where you intentionally want to wipe app users.

BEGIN;

-- Save account IDs before deleting profile rows, whose foreign keys may set
-- user_id to NULL or cascade into auth.users.
CREATE TEMP TABLE users_to_reset ON COMMIT DROP AS
SELECT user_id
FROM public.students
WHERE user_id IS NOT NULL
UNION
SELECT user_id
FROM public.admins
WHERE user_id IS NOT NULL
UNION
SELECT user_id
FROM public.teachers
WHERE user_id IS NOT NULL;

-- Remove app-owned user data. Student profiles and the CSV staging table are preserved.
DELETE FROM public.certificates;
DELETE FROM public.payments;
DELETE FROM public.fee_extras;
DELETE FROM public.fee_installments;
DELETE FROM public.fees;
DELETE FROM public.students;
DELETE FROM public.admins;
DELETE FROM public.teachers;

-- 2) Remove Supabase auth users created for the app
DELETE FROM auth.users
WHERE id IN (SELECT user_id FROM users_to_reset);

COMMIT;
