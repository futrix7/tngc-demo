-- CSV migration for an existing database.
-- IMPORTANT: Do not upload "students data.csv" directly into public.students.
-- Its source headers are intentionally defined on public.student_legacy, where
-- the database trigger converts each row into students and removes the staging row.
-- In Supabase Studio, select public.student_legacy as the import destination.
-- Do not run this to load rows: use the app's Import CSV button or Supabase Studio.
-- Existing and future imported rows are converted automatically by database triggers.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.student_legacy') IS NULL THEN
    RAISE EXCEPTION 'Run supabase.sql first; public.student_legacy does not exist.';
  END IF;
  IF to_regclass('public.branches') IS NULL THEN
    RAISE EXCEPTION 'Run supabase.sql first; public.branches does not exist.';
  END IF;
  IF to_regclass('public.students') IS NULL THEN
    RAISE EXCEPTION 'Run supabase.sql first; public.students does not exist.';
  END IF;
  IF to_regclass('public.courses') IS NULL THEN
    RAISE EXCEPTION 'Run supabase.sql first; public.courses does not exist.';
  END IF;
  IF to_regclass('public.fees') IS NULL THEN
    RAISE EXCEPTION 'Run supabase.sql first; public.fees does not exist.';
  END IF;
  IF to_regprocedure('public.next_student_code(integer)') IS NULL THEN
    RAISE EXCEPTION 'Run the updated supabase.sql first; the student ID generator is missing.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE is_primary) THEN
    RAISE EXCEPTION 'Run supabase-seed.sql first; the primary branch does not exist.';
  END IF;
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Run supabase.sql first; public.is_admin() does not exist.';
  END IF;
END;
$$;

-- Legacy CSV rows have no enrollment-status field. Keep that value unset until
-- an administrator chooses one rather than applying the regular-student default.
ALTER TABLE public.students ALTER COLUMN status DROP NOT NULL;
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS is_legacy_import BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS legacy_original_id TEXT,
  ADD COLUMN IF NOT EXISTS legacy_course_label TEXT,
  ADD COLUMN IF NOT EXISTS legacy_branch_label TEXT,
  ADD COLUMN IF NOT EXISTS legacy_enrollment_time TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_legacy_original_id
  ON public.students (legacy_original_id)
  WHERE legacy_original_id IS NOT NULL;

-- These columns exactly match the headers in the supplied CSV. The normalized
-- columns above them remain the app's read model.
ALTER TABLE public.student_legacy
  ADD COLUMN IF NOT EXISTS first_name_s TEXT,
  ADD COLUMN IF NOT EXISTS sur_name_s TEXT,
  ADD COLUMN IF NOT EXISTS father_name_s TEXT,
  ADD COLUMN IF NOT EXISTS branch_s TEXT,
  ADD COLUMN IF NOT EXISTS mobile_no_s TEXT,
  ADD COLUMN IF NOT EXISTS long_s TEXT,
  ADD COLUMN IF NOT EXISTS short_s TEXT,
  ADD COLUMN IF NOT EXISTS time_s TEXT;

-- Older databases may still have UUID branch IDs. This staging table follows the
-- deployed branches.id type (text) and keeps existing UUID values as text.
ALTER TABLE public.student_legacy
  DROP CONSTRAINT IF EXISTS student_legacy_branch_id_fkey;
ALTER TABLE public.student_legacy
  ALTER COLUMN branch_id TYPE TEXT USING branch_id::text;
UPDATE public.student_legacy AS legacy
   SET branch_id = NULL
 WHERE branch_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.branches AS branch WHERE branch.id = legacy.branch_id
   );
ALTER TABLE public.student_legacy
  ADD CONSTRAINT student_legacy_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_legacy_original_id
  ON public.student_legacy (original_id);
DROP INDEX IF EXISTS public.idx_student_legacy_mobile;
DROP INDEX IF EXISTS public.idx_student_legacy_name;
DROP INDEX IF EXISTS public.idx_student_legacy_enrollment;

-- Keep a temporary link while converting; the durable source ID is stored on
-- students so staging rows can be removed without making re-imports duplicate.
ALTER TABLE public.student_legacy
  ADD COLUMN IF NOT EXISTS student_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.student_legacy'::regclass
       AND conname = 'student_legacy_student_id_fkey'
  ) THEN
    ALTER TABLE public.student_legacy
      ADD CONSTRAINT student_legacy_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_legacy_student_id
  ON public.student_legacy (student_id)
  WHERE student_id IS NOT NULL;
UPDATE public.students AS student
   SET is_legacy_import = TRUE,
       legacy_original_id = COALESCE(student.legacy_original_id, legacy.original_id),
       legacy_course_label = COALESCE(
         student.legacy_course_label,
         NULLIF(concat_ws(' / ', legacy.long_course, legacy.short_course), '')
       ),
       legacy_branch_label = COALESCE(
         student.legacy_branch_label,
         CASE WHEN student.branch_id IS NULL THEN legacy.raw_branch_s END
       ),
       legacy_enrollment_time = COALESCE(student.legacy_enrollment_time, legacy.enrollment_time)
  FROM public.student_legacy AS legacy
 WHERE legacy.student_id = student.id
   AND (
     student.is_legacy_import = FALSE
     OR student.legacy_original_id IS NULL
     OR student.legacy_course_label IS NULL
     OR student.legacy_branch_label IS NULL
     OR student.legacy_enrollment_time IS NULL
   );

-- A source course is historical data, not an active enrollment. Keep the
-- original label separately and clear auto-matched slugs unless a real fee
-- record already exists for that course. This one-time migration is an
-- institute-level correction, so briefly disable only the student-edit guard;
-- the surrounding transaction restores it if any part of the migration fails.
ALTER TABLE public.students DISABLE TRIGGER trg_guard_student_columns;

UPDATE public.students AS student
   SET legacy_course_label = COALESCE(student.legacy_course_label, course.name),
       course_slug = NULL
  FROM public.courses AS course
 WHERE student.is_legacy_import
   AND student.course_slug = course.slug
   AND NOT EXISTS (
     SELECT 1
       FROM public.fees AS fee
      WHERE fee.student_id = student.id
        AND fee.course_slug = student.course_slug
   );

ALTER TABLE public.students ENABLE TRIGGER trg_guard_student_columns;

CREATE INDEX IF NOT EXISTS idx_students_legacy_import
  ON public.students (is_legacy_import);

CREATE OR REPLACE FUNCTION public.normalize_student_legacy_csv_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  branch_value TEXT;
  date_value TEXT;
  time_value TEXT;
BEGIN
  IF NEW.first_name_s IS NULL
     AND NEW.sur_name_s IS NULL
     AND NEW.father_name_s IS NULL
     AND NEW.branch_s IS NULL
     AND NEW.mobile_no_s IS NULL
     AND NEW.long_s IS NULL
     AND NEW.short_s IS NULL
     AND NEW.time_s IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.original_id := COALESCE(NEW.original_id, NEW.id::text);
  NEW.first_name := NULLIF(btrim(NEW.first_name_s), '');
  NEW.sur_name := NULLIF(btrim(NEW.sur_name_s), '');
  NEW.father_name := NULLIF(btrim(NEW.father_name_s), '');
  NEW.mobile_no := NULLIF(btrim(NEW.mobile_no_s), '');
  NEW.long_course := NULLIF(btrim(NEW.long_s), '');
  NEW.short_course := NULLIF(btrim(NEW.short_s), '');
  NEW.raw_branch_s := NULLIF(btrim(NEW.branch_s), '');
  NEW.raw_long_s := NULLIF(btrim(NEW.long_s), '');
  NEW.raw_short_s := NULLIF(btrim(NEW.short_s), '');

  branch_value := NULLIF(btrim(NEW.branch_s), '');
  IF branch_value IS NOT NULL THEN
    SELECT branch.id
      INTO NEW.branch_id
      FROM public.branches AS branch
     WHERE lower(branch.name) = lower(branch_value)
        OR lower(COALESCE(branch.tag, '')) = lower(branch_value)
        OR (branch_value = '1' AND branch.is_primary)
     ORDER BY branch.is_primary DESC
     LIMIT 1;
  END IF;

  date_value := split_part(btrim(NEW.time_s), ' ', 1);
  time_value := split_part(btrim(NEW.time_s), ' ', 2);
  IF NULLIF(btrim(NEW.time_s), '') IS NULL THEN
    NEW.enrollment_time := NULL;
  ELSIF btrim(NEW.time_s) ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4} [0-9]{2}:[0-9]{2}$' THEN
    NEW.enrollment_time := make_timestamptz(
      split_part(date_value, '-', 3)::integer,
      split_part(date_value, '-', 2)::integer,
      split_part(date_value, '-', 1)::integer,
      split_part(time_value, ':', 1)::integer,
      split_part(time_value, ':', 2)::integer,
      0,
      'Asia/Kolkata'
    );
  ELSE
    RAISE EXCEPTION 'Invalid legacy student time value: %', NEW.time_s;
  END IF;

  PERFORM setval(
    pg_get_serial_sequence('public.student_legacy', 'id'),
    GREATEST(
      NEW.id,
      COALESCE((SELECT MAX(existing.id) FROM public.student_legacy AS existing), 0)
    ),
    true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_student_legacy_csv_row ON public.student_legacy;
CREATE TRIGGER normalize_student_legacy_csv_row
  BEFORE INSERT OR UPDATE OF first_name_s, sur_name_s, father_name_s, branch_s,
    mobile_no_s, long_s, short_s, time_s
  ON public.student_legacy
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_student_legacy_csv_row();

ALTER TABLE public.student_legacy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read student_legacy" ON public.student_legacy;
CREATE POLICY "Admins read student_legacy" ON public.student_legacy
  FOR SELECT TO authenticated USING (public.is_admin());

GRANT SELECT ON TABLE public.student_legacy TO authenticated;
GRANT ALL ON TABLE public.student_legacy TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.student_legacy_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.convert_one_legacy_student(p_legacy_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  legacy_row public.student_legacy%ROWTYPE;
  new_student_id TEXT;
  enrollment_year INTEGER;
  existing_student_id TEXT;
BEGIN
  SELECT *
    INTO legacy_row
    FROM public.student_legacy
   WHERE id = p_legacy_id
     AND student_id IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF legacy_row.original_id IS NOT NULL THEN
    SELECT student.id
      INTO existing_student_id
      FROM public.students AS student
     WHERE student.legacy_original_id = legacy_row.original_id
     LIMIT 1;

    IF existing_student_id IS NOT NULL THEN
      UPDATE public.student_legacy
         SET student_id = existing_student_id
       WHERE id = legacy_row.id;
      RETURN TRUE;
    END IF;
  END IF;

  enrollment_year := CASE
    WHEN legacy_row.enrollment_time IS NULL THEN EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    ELSE EXTRACT(YEAR FROM timezone('Asia/Kolkata', legacy_row.enrollment_time))::INTEGER
  END;

  LOOP
    new_student_id := public.next_student_code(enrollment_year);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.students AS student WHERE student.id = new_student_id
    );
  END LOOP;

  INSERT INTO public.students (
    id,
    full_name,
    phone,
    father_name,
    branch_id,
    course_slug,
    enrollment_date,
    status,
    is_legacy_import,
    legacy_original_id,
    legacy_course_label,
    legacy_branch_label,
    legacy_enrollment_time
  )
  VALUES (
    new_student_id,
    COALESCE(
      NULLIF(btrim(concat_ws(' ', NULLIF(btrim(legacy_row.first_name), ''),
                                  NULLIF(btrim(legacy_row.sur_name), ''))), ''),
      ''
    ),
    COALESCE(legacy_row.mobile_no, ''),
    NULLIF(btrim(legacy_row.father_name), ''),
    legacy_row.branch_id,
    NULL,
    CASE
      WHEN legacy_row.enrollment_time IS NULL THEN NULL
      ELSE timezone('Asia/Kolkata', legacy_row.enrollment_time)::DATE
    END,
    NULL,
    TRUE,
    legacy_row.original_id,
    NULLIF(concat_ws(' / ', legacy_row.long_course, legacy_row.short_course), ''),
    CASE
      WHEN legacy_row.branch_id IS NULL
        THEN COALESCE(legacy_row.raw_branch_s, legacy_row.branch_s)
    END,
    legacy_row.enrollment_time
  );

  UPDATE public.student_legacy
     SET student_id = new_student_id
   WHERE id = legacy_row.id
     AND student_id IS NULL;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_legacy_students()
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  legacy_id BIGINT;
  converted_count INTEGER := 0;
BEGIN
  FOR legacy_id IN
    SELECT id
      FROM public.student_legacy
     WHERE student_id IS NULL
     ORDER BY id
  LOOP
    IF public.convert_one_legacy_student(legacy_id) THEN
      converted_count := converted_count + 1;
    END IF;
  END LOOP;

  RETURN converted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_convert_legacy_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.convert_one_legacy_student(NEW.id) THEN
    RAISE EXCEPTION 'Legacy student row % was not converted.', NEW.id;
  END IF;

  DELETE FROM public.student_legacy
   WHERE id = NEW.id
     AND student_id IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Converted legacy student staging row % could not be removed.', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_convert_legacy_student ON public.student_legacy;
CREATE TRIGGER auto_convert_legacy_student
  AFTER INSERT OR UPDATE
  ON public.student_legacy
  FOR EACH ROW
  WHEN (NEW.student_id IS NULL)
  EXECUTE FUNCTION public.auto_convert_legacy_student();

REVOKE ALL ON FUNCTION public.convert_one_legacy_student(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.convert_legacy_students() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_convert_legacy_student() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.convert_one_legacy_student(BIGINT) OWNER TO postgres;
ALTER FUNCTION public.convert_legacy_students() OWNER TO postgres;
ALTER FUNCTION public.auto_convert_legacy_student() OWNER TO postgres;

-- Backfill existing staging rows once, then remove their duplicate CSV data.
-- Future imports convert and delete each row in the same database transaction.
SELECT public.convert_legacy_students();
DELETE FROM public.student_legacy
 WHERE student_id IS NOT NULL;

COMMENT ON TABLE public.student_legacy IS
  'Temporary CSV staging for legacy student conversion. Rows are removed after successful conversion.';

-- Remove only known obsolete import tables when they are empty. Preserve any
-- table containing data rather than deleting it during a schema migration.
DO $$
DECLARE
  obsolete_table TEXT;
  row_count BIGINT;
BEGIN
  FOREACH obsolete_table IN ARRAY ARRAY[
    'student_import_id_map',
    'student_import_stage',
    'student_legacy_csv_import'
  ] LOOP
    IF to_regclass(format('public.%I', obsolete_table)) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', obsolete_table)
        INTO row_count;
      IF row_count = 0 THEN
        BEGIN
          EXECUTE format('DROP TABLE public.%I', obsolete_table);
          RAISE NOTICE 'Removed empty obsolete table public.%', obsolete_table;
        EXCEPTION
          WHEN dependent_objects_still_exist THEN
            RAISE NOTICE 'Kept public.% because another database object depends on it.', obsolete_table;
        END;
      ELSE
        RAISE NOTICE 'Kept public.% because it contains % rows.', obsolete_table, row_count;
      END IF;
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
