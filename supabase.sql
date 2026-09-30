CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  DROP TABLE IF EXISTS public.announcements CASCADE;
  DROP TABLE IF EXISTS public.attendance CASCADE;
  DROP TABLE IF EXISTS public.activity_log CASCADE;
  DROP TABLE IF EXISTS public.events CASCADE;
  DROP TABLE IF EXISTS public.pending_tasks CASCADE;
END $$;

DO $$
DECLARE
  spec   text;
  type_name text;
  labels text[];
  label_list text;
BEGIN
  FOREACH spec IN ARRAY ARRAY[
    'course_type=long-term|short-term',
    'course_status=active|upcoming|full',
    'student_status=Active|Inactive|Pending',
    'gender_type=male|female|other',
    'teacher_status=Active|On Leave',
    'payment_status=Paid|Pending|Partial|Overdue',
    'certificate_status=Issued|Pending|Rejected|Processing|Requested',
    'certificate_type=Completion|Proficiency|Module',
    'video_status=Published|Draft|Processing',
    'transaction_type=income|expense',
    'qualification_type=B.Tech|M.Tech|MCA|M.Sc|PhD|Others',
    'specialization_type=Java|Python|Web Development|Database|Networking|MS-Office',
    'experience_range=0-1|1-3|3-5|5-10|10+',
    'eligibility_type=10th|12th|graduate|any'
  ] LOOP
    type_name := split_part(spec, '=', 1);
    labels   := string_to_array(split_part(spec, '=', 2), '|');

    IF EXISTS (
      SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE t.typname = type_name
         AND n.nspname = 'public'
    ) THEN
      CONTINUE;
    END IF;

    SELECT string_agg(quote_literal(v.val), ', ')
      INTO label_list
      FROM unnest(labels) AS v(val);

    EXECUTE format('CREATE TYPE public.%I AS ENUM (%s)', type_name, label_list);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE t.typname = 'payment_status' AND n.nspname = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE t.typname = 'payment_status'
       AND n.nspname = 'public'
       AND e.enumlabel = 'Rejected'
  ) THEN
    ALTER TYPE public.payment_status ADD VALUE 'Rejected';
  END IF;
END $$;

-- The institute's campuses. Every screen that groups by branch — the student
-- directory, the installments list, the finance breakdown, the analytics filters
-- reads this table, and every one of them was querying a table this script
-- never created. A database built from supabase.sql alone had no branches, so those
-- groupings silently collapsed to a single unnamed bucket.
--
-- Ids are fixed rather than generated so a re-run of the seed is idempotent and
-- so the sample campuses below are addressable before any row is inserted.
CREATE TABLE IF NOT EXISTS branches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT UNIQUE NOT NULL,
  tag         TEXT,
  address     TEXT NOT NULL DEFAULT '',
  city        TEXT NOT NULL DEFAULT '',
  note        TEXT,
  is_primary  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.branches IS
  'Institute campuses. Referenced by students.branch_id, teachers.branch_id, payments.branch_id and transactions.branch_id. Seeded with the three campuses in supabase-seed.sql.';

-- Which branch is the main one, at most one. The dashboard labels the head
-- office, and a second "primary" made that label depend on row order.
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_single_primary
  ON branches (is_primary) WHERE is_primary;

CREATE TABLE IF NOT EXISTS courses (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                  TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  short_name            TEXT NOT NULL,
  duration              TEXT NOT NULL,
  type                  course_type NOT NULL,
  description           TEXT NOT NULL,
  full_description      TEXT NOT NULL,
  topics                TEXT[] DEFAULT '{}',
  fees                  TEXT NOT NULL,

  fee_numeric           INTEGER NOT NULL DEFAULT 0,
  eligibility           TEXT NOT NULL,
  certification         TEXT NOT NULL,
  certification_body    TEXT NOT NULL,
  popular               BOOLEAN DEFAULT FALSE,
  highlights            TEXT[] DEFAULT '{}',
  career_opportunities  TEXT[] DEFAULT '{}',
  tools                 TEXT[] DEFAULT '{}',
  schedule              TEXT NOT NULL,
  batch_size            TEXT NOT NULL,
  rating                DECIMAL(2,1) DEFAULT 0,
  completion_rate       INTEGER DEFAULT 0,
  next_batch            TEXT,
  status                course_status DEFAULT 'active',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id                      TEXT PRIMARY KEY,
  user_id                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name               TEXT NOT NULL,
  email                   TEXT,
  phone                   TEXT NOT NULL,
  date_of_birth           DATE,
  gender                  gender_type,
  address                 TEXT,
  course_slug             TEXT REFERENCES courses(slug) ON DELETE SET NULL,
  enrollment_date         DATE DEFAULT CURRENT_DATE,
  batch_time              TEXT,
  status                  student_status DEFAULT 'Active',
  father_name             TEXT,
  father_phone            TEXT,
  mother_name             TEXT,
  alternate_phone         TEXT,
  profile_photo           TEXT,
  present_status          TEXT,
  full_name_as_signature  TEXT,
  branch_id               UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE students ALTER COLUMN email DROP NOT NULL;

-- Migrate linked student accounts once: Auth uses E.164 phone identifiers,
-- while the student table keeps the local 10-digit number used by the portal.
WITH raw_student_numbers AS (
  SELECT user_id, regexp_replace(phone, '[^0-9]', '', 'g') AS digits
    FROM students
   WHERE user_id IS NOT NULL
), normalized_student_numbers AS (
  SELECT user_id,
         CASE WHEN digits ~ '^91[0-9]{10}$' THEN right(digits, 10) ELSE digits END AS national_number
    FROM raw_student_numbers
), unique_student_numbers AS (
  SELECT user_id,
         national_number,
         count(*) OVER (PARTITION BY national_number) AS student_count
    FROM normalized_student_numbers
   WHERE national_number ~ '^[0-9]{10}$'
)
UPDATE auth.users AS auth_user
   SET phone = '+91' || student_number.national_number,
       phone_confirmed_at = COALESCE(auth_user.phone_confirmed_at, NOW()),
       encrypted_password = crypt(student_number.national_number, gen_salt('bf')),
       raw_user_meta_data = COALESCE(auth_user.raw_user_meta_data, '{}'::jsonb)
         || jsonb_build_object('phone', student_number.national_number),
       raw_app_meta_data = COALESCE(auth_user.raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('tngc_phone_password_migrated', true),
       updated_at = NOW()
  FROM unique_student_numbers AS student_number
 WHERE auth_user.id = student_number.user_id
   AND student_number.student_count = 1
   AND COALESCE(auth_user.raw_app_meta_data ->> 'tngc_phone_password_migrated', 'false') <> 'true'
   AND NOT EXISTS (
     SELECT 1
       FROM auth.users AS other_user
      WHERE other_user.id <> auth_user.id
        AND regexp_replace(COALESCE(other_user.phone, ''), '[^0-9]', '', 'g')
            IN (student_number.national_number, '91' || student_number.national_number)
   );

CREATE TABLE IF NOT EXISTS teachers (
  id             TEXT PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL,
  role           TEXT NOT NULL,
  subjects       TEXT[] DEFAULT '{}',
  experience     INTEGER DEFAULT 0,
  qualification  qualification_type,
  specialization specialization_type,
  salary         NUMERIC(10,2),
  status         teacher_status DEFAULT 'Active',
  profile_photo  TEXT,
  branch_id      UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  role           TEXT DEFAULT 'Administrator',
  bio            TEXT,
  profile_photo  TEXT,
  admin_code     TEXT,
  status         TEXT DEFAULT 'Active',
  notify_email   BOOLEAN DEFAULT TRUE,
  notify_sms     BOOLEAN DEFAULT FALSE,
  notify_whatsapp BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      TEXT REFERENCES students(id) ON DELETE CASCADE,
  course_slug     TEXT REFERENCES courses(slug) ON DELETE SET NULL,
  total_fee       NUMERIC(10,2) NOT NULL,
  paid_amount     NUMERIC(10,2) DEFAULT 0,
  pending_amount  NUMERIC(10,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fee_installments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_id      UUID REFERENCES fees(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  due_date    DATE NOT NULL,
  paid_date   DATE,
  status      TEXT DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending')),

  installment_no integer,

  verified_at   timestamptz,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fee_installments DROP CONSTRAINT IF EXISTS fee_installments_status_check;
ALTER TABLE fee_installments ADD CONSTRAINT fee_installments_status_check
  CHECK (status IN ('Paid', 'Pending', 'Partial'));

CREATE TABLE IF NOT EXISTS fee_extras (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_id      UUID REFERENCES fees(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  status      TEXT DEFAULT 'Paid',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  student_id    TEXT REFERENCES students(id) ON DELETE CASCADE,
  student_name  TEXT NOT NULL,
  course_slug   TEXT REFERENCES courses(slug) ON DELETE SET NULL,
  amount        NUMERIC(10,2) NOT NULL,
  payment_date  DATE NOT NULL,
  method        TEXT NOT NULL,
  status        payment_status DEFAULT 'Paid',
  receipt_no    TEXT,
  description   TEXT,

  installment_id uuid REFERENCES fee_installments(id) ON DELETE SET NULL,

  -- Which campus took the money. Nullable because an opening payment is written
  -- by record_fee_payment(), which reads the student rather than a form, and a
  -- student may not have a branch yet.
  branch_id   UUID REFERENCES branches(id) ON DELETE SET NULL,

  verified_at  timestamptz,
  verified_by  text,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificates (
  id             TEXT PRIMARY KEY,
  student_id     TEXT REFERENCES students(id) ON DELETE CASCADE,
  student_name   TEXT NOT NULL,
  course_slug    TEXT REFERENCES courses(slug) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  type           certificate_type NOT NULL,
  issued_date    DATE,
  credential_id  TEXT,
  issued_by      TEXT,
  status         certificate_status DEFAULT 'Pending',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  url           TEXT,
  course_slug   TEXT REFERENCES courses(slug) ON DELETE SET NULL,
  duration      TEXT,
  views         INTEGER DEFAULT 0,
  uploaded_by   TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  upload_date   DATE DEFAULT CURRENT_DATE,
  status        video_status DEFAULT 'Draft',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date         DATE NOT NULL,
  description  TEXT NOT NULL,
  category     TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  type         transaction_type NOT NULL,
  branch_id    UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faculty (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  role           TEXT NOT NULL,
  branch         TEXT,
  qualifications TEXT[] DEFAULT '{}',
  description    TEXT,
  is_founder     BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limit_log (
  id          BIGSERIAL PRIMARY KEY,
  scope       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.rate_limit_log IS
  'Throttling log for finance PIN and installment payment submission; authentication routes do not use it.';

ALTER TABLE students ADD COLUMN IF NOT EXISTS present_status         TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS full_name_as_signature TEXT;

-- branch_id was added to these tables after they were first created, and the
-- screens that read it (student directory, installments, finance breakdown,
-- analytics) were written against it. A database created before this block has
-- no such column, so every one of those queries failed outright rather than
-- returning nothing — hence the backfill here as well as in the CREATE TABLE
-- statements above.
ALTER TABLE students     ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE teachers     ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE payments     ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_course       ON students(course_slug);
CREATE INDEX IF NOT EXISTS idx_students_status       ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_name_trgm    ON students USING GIN (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_students_email_trgm   ON students USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_students_phone_trgm   ON students USING GIN (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_students_id_trgm      ON students USING GIN (id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_students_user_id      ON students(user_id);

CREATE INDEX IF NOT EXISTS idx_admins_user_id        ON admins(user_id);
CREATE INDEX IF NOT EXISTS idx_fees_student          ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student      ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date         ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_certificates_student  ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_videos_course         ON videos(course_slug);
CREATE INDEX IF NOT EXISTS idx_transactions_date     ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type     ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_scope  ON rate_limit_log(scope, created_at);

-- Branch is a filter on every list that groups by it, and there is no
-- alternative index path once the filter is applied.
CREATE INDEX IF NOT EXISTS idx_students_branch       ON students(branch_id);
CREATE INDEX IF NOT EXISTS idx_teachers_branch       ON teachers(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch       ON payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch   ON transactions(branch_id);

ALTER TABLE courses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE students          ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_installments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_extras        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches          ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()
     );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'True when the caller is authenticated and has a row in admins. SECURITY DEFINER so the lookup bypasses RLS and does not recurse.';

CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id FROM public.students s WHERE s.user_id = auth.uid() LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_student_id() IS
  'The student record id belonging to the caller, or NULL. Scopes student self-service policies.';

ALTER FUNCTION public.is_admin()          OWNER TO postgres;
ALTER FUNCTION public.current_student_id() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.is_admin()          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_student_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin()          TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_student_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  target_tables text[] := ARRAY[
    'courses', 'students', 'teachers', 'admins', 'fees',
    'certificates', 'videos'
  ];
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t
    );
  END LOOP;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.student_code_seq AS bigint START 1;
CREATE SEQUENCE IF NOT EXISTS public.payment_code_seq AS bigint START 1;

CREATE OR REPLACE FUNCTION public.next_student_code(p_year integer)
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT 'STU-' || p_year::text || '-' || LPAD(nextval('public.student_code_seq')::text, 3, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_payment_code(p_year integer)
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT 'PAY-' || p_year::text || '-' || LPAD(nextval('public.payment_code_seq')::text, 4, '0');
$$;

COMMENT ON FUNCTION public.next_student_code(integer) IS
  'Collision-free student id for the given year, e.g. STU-2026-001. Replaces the racy count(*)+1 in the browser.';
COMMENT ON FUNCTION public.next_payment_code(integer) IS
  'Collision-free payment id for the given year, e.g. PAY-2026-0001.';

REVOKE ALL ON FUNCTION public.next_student_code(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_payment_code(integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.next_student_code(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_payment_code(integer) TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.student_code_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.payment_code_seq TO service_role;

ALTER FUNCTION public.next_student_code(integer) OWNER TO postgres;
ALTER FUNCTION public.next_payment_code(integer) OWNER TO postgres;

DO $$
DECLARE
  v_max bigint;
BEGIN
  SELECT COALESCE(MAX(substring(id from '[0-9]+$')::bigint), 0)
    INTO v_max
    FROM public.students
   WHERE id ~ '^STU-[0-9]{4}-[0-9]+$';

  IF v_max > 0 THEN
    PERFORM setval('public.student_code_seq', v_max, true);
    RAISE NOTICE 'student_code_seq seeded to %', v_max;
  END IF;

  SELECT COALESCE(MAX(substring(id from '[0-9]+$')::bigint), 0)
    INTO v_max
    FROM public.payments
   WHERE id ~ '^PAY-[0-9]{4}-[0-9]+$';

  IF v_max > 0 THEN
    PERFORM setval('public.payment_code_seq', v_max, true);
    RAISE NOTICE 'payment_code_seq seeded to %', v_max;
  END IF;
END $$;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_non_negative;
ALTER TABLE payments ADD CONSTRAINT payments_amount_non_negative CHECK (amount >= 0);

ALTER TABLE fees DROP CONSTRAINT IF EXISTS fees_amounts_non_negative;
ALTER TABLE fees ADD CONSTRAINT fees_amounts_non_negative
  CHECK (total_fee >= 0 AND paid_amount >= 0 AND pending_amount >= 0);

-- Drops the total/count variant, which divided a fee into equal parts on its own.
DROP FUNCTION IF EXISTS public.create_fee_schedule(uuid, numeric, integer, date);

CREATE OR REPLACE FUNCTION public.create_fee_schedule(
  p_fee_id uuid,
  p_amounts numeric[],
  p_first_due date
)
RETURNS TABLE (installment_id uuid, seq_no integer, installment_amount numeric, due_on date)
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total numeric;
  v_count integer;
  v_sum numeric := 0;
  v_i integer;
  v_amount numeric;
  v_due date;
  v_new_id uuid;
BEGIN
  IF p_fee_id IS NULL THEN
    RAISE EXCEPTION 'a fee row is required to build a schedule' USING ERRCODE = '22023';
  END IF;

  SELECT f.total_fee INTO v_total FROM fees f WHERE f.id = p_fee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'that fee row does not exist' USING ERRCODE = '22023';
  END IF;

  -- Nothing owed means nothing to schedule, and a zero-amount installment would
  -- only ever show up as a row the student can never settle.
  IF v_total IS NULL OR v_total <= 0 THEN
    RETURN;
  END IF;

  -- With no amounts supplied the whole fee is a single line due now. That is the
  -- default a blank form means, not a split: nothing here divides the fee for
  -- the caller. Every part of a real split is a number somebody typed.
  v_count := COALESCE(array_length(p_amounts, 1), 0);

  IF v_count = 0 THEN
    p_amounts := ARRAY[v_total]::numeric[];
    v_count := 1;
  END IF;

  IF v_count > 3 THEN
    RAISE EXCEPTION 'a fee can be split into at most 3 installments' USING ERRCODE = '22023';
  END IF;

  FOREACH v_amount IN ARRAY p_amounts LOOP
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'every installment amount must be greater than zero' USING ERRCODE = '22023';
    END IF;

    v_sum := v_sum + v_amount;
  END LOOP;

  IF round(v_sum, 2) <> round(v_total, 2) THEN
    RAISE EXCEPTION 'installment amounts must add up to the course fee of %', v_total
      USING ERRCODE = '22023';
  END IF;

  FOR v_i IN 1..v_count LOOP
    v_amount := p_amounts[v_i];
    v_due := (COALESCE(p_first_due, CURRENT_DATE) + ((v_i - 1) || ' months')::interval)::date;

    INSERT INTO fee_installments (fee_id, label, amount, due_date, status, installment_no)
    VALUES (p_fee_id, 'Installment ' || v_i, v_amount, v_due, 'Pending', v_i)
    RETURNING id INTO v_new_id;

    installment_id := v_new_id;
    seq_no := v_i;
    installment_amount := v_amount;
    due_on := v_due;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.create_fee_schedule(uuid, numeric[], date) IS
  'Builds a fee schedule from amounts the caller chose, at most 3 of them, which must add up to the course fee. Nothing is divided for the caller: a blank amount list means one installment for the full fee. service_role only.';

REVOKE ALL ON FUNCTION public.create_fee_schedule(uuid, numeric[], date) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.register_student(
  uuid, text, text, text, text, text, text, text[], text, text, text, text,
  integer[], integer
);
DROP FUNCTION IF EXISTS public.register_student(
  uuid, text, text, text, text, text, text, text[], text, text, text, text,
  integer[], integer, numeric
);

DROP FUNCTION IF EXISTS public.register_student(
  uuid, text, text, text, text, text, text, text[], text, text, text, text,
  numeric[], numeric[], numeric
);

CREATE OR REPLACE FUNCTION public.register_student(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_father_name text,
  p_father_phone text,
  p_course_slugs text[],
  p_present_status text,
  p_signature text,
  p_payment_method text,
  p_payment_description text,
  p_installment_amounts numeric[] DEFAULT NULL,
  p_payment_amount numeric DEFAULT NULL,
  p_total_fee_override numeric DEFAULT NULL
)
RETURNS TABLE (student_id text, payment_id text, total_fee numeric)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_today date := CURRENT_DATE;
  v_student_id text;
  v_payment_id text;
  v_receipt text;
  v_fee_row uuid;
  v_course text;
  v_course_fee numeric;
  v_total numeric := 0;
  v_primary_course text;
  v_row record;
BEGIN
  IF p_course_slugs IS NULL OR array_length(p_course_slugs, 1) IS NULL THEN
    RAISE EXCEPTION 'at least one course must be selected' USING ERRCODE = '22023';
  END IF;

  IF p_total_fee_override IS NOT NULL
     AND (p_total_fee_override <= 0 OR array_length(p_course_slugs, 1) <> 1) THEN
    RAISE EXCEPTION 'a custom total fee must be positive and apply to exactly one course'
      USING ERRCODE = '22023';
  END IF;

  IF p_signature IS NULL OR p_full_name IS NULL
     OR btrim(p_signature) = ''
     OR lower(btrim(p_signature)) <> lower(btrim(p_full_name)) THEN
    RAISE EXCEPTION 'signature does not match the enrolled name' USING ERRCODE = '22023';
  END IF;

  -- A split can be short, uneven, or not used at all, but never long: three is
  -- the ceiling the institute works to and the one every screen states.
  IF p_installment_amounts IS NOT NULL
     AND array_length(p_installment_amounts, 1) > 3 THEN
    RAISE EXCEPTION 'a fee can be split into at most 3 installments' USING ERRCODE = '22023';
  END IF;

  v_primary_course := p_course_slugs[1];
  v_student_id := public.next_student_code(v_year);
  v_payment_id := public.next_payment_code(v_year);

  INSERT INTO students (
    id, user_id, full_name, email, phone, father_name, father_phone,
    course_slug, status, present_status, full_name_as_signature
  ) VALUES (
    v_student_id, p_user_id, p_full_name, p_email, p_phone, p_father_name,
    NULLIF(p_father_phone, ''), v_primary_course,
    'Active', p_present_status, p_signature
  );

  FOREACH v_course IN ARRAY p_course_slugs LOOP

    SELECT c.fee_numeric INTO v_course_fee FROM courses c WHERE c.slug = v_course;
    v_course_fee := COALESCE(v_course_fee, 0);
    IF p_total_fee_override IS NOT NULL THEN
      v_course_fee := p_total_fee_override;
    END IF;
    v_total := v_total + v_course_fee;

    INSERT INTO fees (student_id, course_slug, total_fee, paid_amount, pending_amount)
    VALUES (v_student_id, v_course, v_course_fee, 0, v_course_fee)
    RETURNING id INTO v_fee_row;

    -- The caller's own amounts, or a single line for the whole fee.
    PERFORM * FROM public.create_fee_schedule(v_fee_row, p_installment_amounts, v_today);
  END LOOP;

  IF p_payment_amount IS NOT NULL AND p_payment_amount > 0 THEN
    -- One figure, one course. With several courses there would be no way to say
    -- which one the money is for, so this is refused rather than quietly applied
    -- to the first.
    IF array_length(p_course_slugs, 1) > 1 THEN
      RAISE EXCEPTION 'an opening payment can be recorded for one course at a time'
        USING ERRCODE = '22023';
    END IF;

    v_receipt := public.next_payment_code(v_year);

    SELECT f.id INTO v_fee_row FROM fees f
     WHERE f.student_id = v_student_id AND f.course_slug = v_primary_course
     LIMIT 1;

    -- The caller's own figure. Which schedule lines it lands on is settled by
    -- record_fee_payment, and is bookkeeping for the progress display rather than
    -- a division of what was handed over.
    FOR v_row IN
      SELECT * FROM public.record_fee_payment(
        v_fee_row, p_payment_amount, p_payment_method,
        p_payment_description, 'Pending', v_receipt
      )
    LOOP
      -- The claim may add more rows if the figure crossed onto a later schedule
      -- line; the caller only needs one payment id back.
      v_payment_id := v_row.payment_id;
      EXIT;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_student_id, v_payment_id, v_total;
END;
$$;

COMMENT ON FUNCTION public.register_student(
  uuid, text, text, text, text, text, text[], text, text, text, text,
  numeric[], numeric, numeric
) IS
  'Creates a student, fee rows and schedules, and an optional Pending claim for a single amount handed over on day one. The schedule is at most 3 amounts of the caller''s own choosing; the payment is one figure of their own. Supports an admin-set total fee override for one course. service_role only.';

REVOKE ALL ON FUNCTION public.register_student(
  uuid, text, text, text, text, text, text[], text, text, text, text,
  numeric[], numeric, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_student(
  uuid, text, text, text, text, text, text[], text, text, text, text,
  numeric[], numeric, numeric
) TO service_role;

ALTER FUNCTION public.register_student(
  uuid, text, text, text, text, text, text[], text, text, text, text,
  numeric[], numeric, numeric
) OWNER TO postgres;

DROP FUNCTION IF EXISTS public.enroll_student_in_course(uuid, text);
DROP FUNCTION IF EXISTS public.enroll_student_in_course(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.enroll_student_in_course(uuid, text, numeric, numeric, text, text, text);
DROP FUNCTION IF EXISTS public.enroll_student_in_course(uuid, text, numeric, numeric[], numeric[], text, text, text);

CREATE OR REPLACE FUNCTION public.enroll_student_in_course(
  p_user_id uuid,
  p_course_slug text,
  p_total_fee_override numeric DEFAULT NULL,
  p_installment_amounts numeric[] DEFAULT NULL,
  p_payment_amount numeric DEFAULT NULL,
  p_payment_method text DEFAULT 'upi',
  p_payment_reference text DEFAULT '',
  p_verified_by text DEFAULT ''
)
RETURNS TABLE (fee_id uuid, course_slug text, total_fee numeric)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student students%ROWTYPE;
  v_course courses%ROWTYPE;
  v_fee_id uuid;
  v_total_fee numeric;
  v_receipt_no text;
BEGIN
  SELECT * INTO v_student
    FROM students
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no student record is linked to this account' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_course
    FROM courses
   WHERE slug = p_course_slug AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'course is not available for enrollment' USING ERRCODE = '22023';
  END IF;

  IF p_total_fee_override IS NOT NULL AND p_total_fee_override <= 0 THEN
    RAISE EXCEPTION 'custom course fee must be greater than zero' USING ERRCODE = '22023';
  END IF;

  IF p_installment_amounts IS NOT NULL
     AND array_length(p_installment_amounts, 1) > 3 THEN
    RAISE EXCEPTION 'a fee can be split into at most 3 installments' USING ERRCODE = '22023';
  END IF;

  IF p_payment_amount IS NOT NULL AND p_payment_amount <= 0 THEN
    RAISE EXCEPTION 'the amount collected must be greater than zero' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM fees f
     WHERE f.student_id = v_student.id AND f.course_slug = v_course.slug
  ) THEN
    RAISE EXCEPTION 'already enrolled in this course' USING ERRCODE = '22023';
  END IF;

  v_total_fee := COALESCE(p_total_fee_override, v_course.fee_numeric);

  IF p_payment_amount IS NOT NULL AND p_payment_amount > v_total_fee THEN
    RAISE EXCEPTION 'the amount collected cannot be more than the course fee'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO fees (student_id, course_slug, total_fee, paid_amount, pending_amount)
  VALUES (v_student.id, v_course.slug, v_total_fee, 0, v_total_fee)
  RETURNING id INTO v_fee_id;

  PERFORM * FROM public.create_fee_schedule(v_fee_id, p_installment_amounts, CURRENT_DATE);

  IF p_payment_amount IS NOT NULL THEN
    IF COALESCE(p_payment_method, '') NOT IN ('upi', 'cash', 'bank') THEN
      RAISE EXCEPTION 'choose a valid payment method' USING ERRCODE = '22023';
    END IF;

    v_receipt_no := public.next_payment_code(EXTRACT(YEAR FROM CURRENT_DATE)::integer);

    -- One figure, recorded as settled because an admin or a verified counter is
    -- the one enrolling here, unlike a student's own claim. The amount is exactly
    -- what was handed over; record_fee_payment settles it against the oldest
    -- schedule line first so each row keeps showing honest progress.
    PERFORM * FROM public.record_fee_payment(
      v_fee_id,
      p_payment_amount,
      p_payment_method,
      p_payment_reference,
      'Paid',
      v_receipt_no,
      p_verified_by
    );
  END IF;

  fee_id := v_fee_id;
  course_slug := v_course.slug;
  total_fee := v_total_fee;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.enroll_student_in_course(uuid, text, numeric, numeric[], numeric, text, text, text) IS
  'Adds an active course to an existing student, builds a schedule from the caller''s own amounts (at most 3, or one line for the whole fee), and optionally records one verified payment of their own choosing. service_role only.';

REVOKE ALL ON FUNCTION public.enroll_student_in_course(uuid, text, numeric, numeric[], numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_student_in_course(uuid, text, numeric, numeric[], numeric, text, text, text) TO service_role;
ALTER FUNCTION public.enroll_student_in_course(uuid, text, numeric, numeric[], numeric, text, text, text) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.guard_student_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id is assigned by the institute and cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'enrollment status is set by the institute and cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.course_slug IS DISTINCT FROM OLD.course_slug THEN
    RAISE EXCEPTION 'course assignment is managed by the institute and cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_student_columns() IS
  'Blocks students from editing institute-managed columns on their own record. Staff and service_role bypass.';

CREATE OR REPLACE FUNCTION public.guard_fee_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.total_fee IS DISTINCT FROM OLD.total_fee THEN
    RAISE EXCEPTION 'the fee amount is set by the institute and cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'a fee record cannot be transferred to another student'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_fee_columns() IS
  'Blocks a student from rewriting what they owe, or moving a fee row to another student.';

DROP TRIGGER IF EXISTS trg_guard_student_columns ON students;
CREATE TRIGGER trg_guard_student_columns BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION public.guard_student_columns();

DROP TRIGGER IF EXISTS trg_guard_fee_columns ON fees;
CREATE TRIGGER trg_guard_fee_columns BEFORE UPDATE ON fees
  FOR EACH ROW EXECUTE FUNCTION public.guard_fee_columns();

REVOKE ALL ON FUNCTION public.guard_student_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_fee_columns() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.guard_student_columns() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_fee_columns()     TO authenticated, service_role;

ALTER TABLE fee_installments ADD COLUMN IF NOT EXISTS installment_no integer;
ALTER TABLE fee_installments ADD COLUMN IF NOT EXISTS verified_at   timestamptz;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS installment_id uuid REFERENCES fee_installments(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at   timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by   text;

CREATE INDEX IF NOT EXISTS idx_installments_no   ON fee_installments(fee_id, installment_no);
CREATE INDEX IF NOT EXISTS idx_installments_student ON fee_installments(fee_id);
CREATE INDEX IF NOT EXISTS idx_payments_installment ON payments(installment_id);

UPDATE fee_installments fi
   SET installment_no = sub.n
  FROM (
    SELECT id,
           row_number() OVER (PARTITION BY fee_id ORDER BY due_date, created_at) AS n
      FROM fee_installments
  ) sub
 WHERE fi.id = sub.id
   AND fi.installment_no IS NULL;

UPDATE fee_installments
   SET label = 'Installment ' || installment_no
 WHERE installment_no IS NOT NULL
   AND label = 'Registration Fee';

UPDATE payments p
   SET receipt_no = p.id
 WHERE p.receipt_no IS NULL
   AND p.installment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_fee_delta(
  p_fee_id uuid,
  p_paid_delta numeric,
  p_pending_delta numeric
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fee fees%ROWTYPE;
BEGIN
  SELECT * INTO v_fee FROM fees WHERE id = p_fee_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fee record % does not exist', p_fee_id USING ERRCODE = '22023';
  END IF;

  UPDATE fees
     SET paid_amount    = GREATEST(0, COALESCE(paid_amount, 0) + p_paid_delta),
         pending_amount = GREATEST(0, COALESCE(pending_amount, 0) + p_pending_delta),
         updated_at     = NOW()
   WHERE id = p_fee_id;
END;
$$;

COMMENT ON FUNCTION public.apply_fee_delta(uuid, numeric, numeric) IS
  'Applies a signed paid/pending delta to one fee row under a row lock. service_role only.';

REVOKE ALL ON FUNCTION public.apply_fee_delta(uuid, numeric, numeric) FROM PUBLIC;

-- One place that turns "this much was handed over" into ledger rows. Every
-- caller — an opening payment at registration, one collected over the counter, a
-- claim the student files themselves — arrives with a single figure and leaves
-- with that same figure on the ledger.
--
-- p_payment_date exists because the admin's Record Payment sheet has always asked
-- for a date, and the only writer that honoured it was a raw browser-side INSERT
-- that skipped the schedule and the balance entirely. The date was real but the
-- payment behind it was not, so a backdated entry showed on no installment. The
-- date is now taken here, on the same transaction that settles the fee.
--
-- It is a separate function rather than an extra argument on record_fee_payment
-- below: adding a parameter would change that function's identity, and every
-- existing named-argument caller in the app depends on the seven-argument
-- signature resolving to it.
CREATE OR REPLACE FUNCTION public.record_fee_payment_at(
  p_fee_id uuid,
  p_amount numeric,
  p_method text,
  p_description text,
  p_status text,
  p_receipt_no text,
  p_verified_by text,
  p_payment_date date
)
RETURNS TABLE (payment_id text, installment_id uuid, installment_label text, amount numeric)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fee fees%ROWTYPE;
  v_inst fee_installments%ROWTYPE;
  v_name text;
  -- Taken from the student rather than from the caller. The finance page groups
  -- revenue by branch, and a payment with no branch on it silently drops out of
  -- that breakdown — which is what used to happen to every payment written here,
  -- because the column was only ever filled in by the browser.
  v_branch uuid;
  v_remaining numeric;
  v_available numeric;
  v_line_paid numeric;
  v_take numeric;
  v_new_id text;
  -- The date the receipt is booked against. Today unless the admin is backdating.
  v_when date;
  -- Cast once up front: payments.status is an enum, and the caller's 'Paid' or
  -- 'Pending' is validated above before it is ever written.
  v_status payment_status;
BEGIN
  IF p_fee_id IS NULL THEN
    RAISE EXCEPTION 'a fee record is required to record a payment' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'the amount paid must be greater than zero' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_status, '') NOT IN ('Paid', 'Pending') THEN
    RAISE EXCEPTION 'a payment can only be recorded as Pending or Paid' USING ERRCODE = '22023';
  END IF;

  v_status := p_status::payment_status;

  SELECT * INTO v_fee FROM fees WHERE id = p_fee_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'that fee record does not exist' USING ERRCODE = '22023';
  END IF;

  -- A payment cannot be dated in the future, and it cannot predate the fee it is
  -- paying. Either would put a received receipt outside the period the student was
  -- actually enrolled, and every report grouped by month would then count money
  -- that had not arrived — or count nothing at all, which is worse.
  v_when := COALESCE(p_payment_date, CURRENT_DATE);

  IF v_when > CURRENT_DATE THEN
    RAISE EXCEPTION 'a payment cannot be dated in the future' USING ERRCODE = '22023';
  END IF;

  IF v_fee.created_at IS NOT NULL AND v_when < v_fee.created_at::date THEN
    RAISE EXCEPTION 'a payment cannot predate the fee it is paying' USING ERRCODE = '22023';
  END IF;

  SELECT s.full_name, s.branch_id INTO v_name, v_branch FROM students s WHERE s.id = v_fee.student_id;

  -- What is genuinely still payable on this course: each line's own amount less
  -- what is already settled on it and less what is already claimed and waiting.
  -- Lines waiting on the institute are deliberately not counted, so a second
  -- claim can never be filed against money that has already been asked for once.
  SELECT COALESCE(SUM(
           GREATEST(
             fi.amount
             - COALESCE((SELECT SUM(p.amount) FROM payments p
                          WHERE p.installment_id = fi.id AND p.status = 'Paid'), 0)
             - COALESCE((SELECT SUM(p.amount) FROM payments p
                          WHERE p.installment_id = fi.id AND p.status = 'Pending'), 0),
             0
           )), 0)
    INTO v_available
    FROM fee_installments fi
   WHERE fi.fee_id = p_fee_id;

  IF round(p_amount, 2) > round(v_available, 2) THEN
    -- "₹0 is still payable" is true and useless. When the only thing standing in
    -- the way is a claim the institute has not looked at yet, say so: that is a
    -- review to do, not a figure to change, and mark_installment_paid() used to be
    -- the only place that explained it.
    IF v_available <= 0 AND EXISTS (
      SELECT 1
        FROM fee_installments fi
        JOIN payments p ON p.installment_id = fi.id
       WHERE fi.fee_id = p_fee_id
         AND p.status = 'Pending'
    ) THEN
      RAISE EXCEPTION 'a payment on this course is awaiting review. Approve or reject it in Payments first'
        USING ERRCODE = '22023';
    END IF;

    RAISE EXCEPTION 'the amount paid is more than the % still payable on this course', v_available
      USING ERRCODE = '22023';
  END IF;

  v_remaining := round(p_amount, 2);

  -- Oldest line first. This is bookkeeping, not a split: the caller handed over
  -- one number and that number is what lands on the ledger. The lines are only
  -- touched so each schedule row can keep showing honest progress, and because
  -- the amounts here came out of the caller's figure, not out of a division.
  FOR v_inst IN
    SELECT * FROM fee_installments
     WHERE fee_id = p_fee_id
     ORDER BY due_date, installment_no, id
     FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM payments p
       WHERE p.installment_id = v_inst.id AND p.status = 'Pending'
    );

    SELECT COALESCE(SUM(p.amount), 0) INTO v_line_paid
      FROM payments p
     WHERE p.installment_id = v_inst.id AND p.status = 'Paid';

    v_take := LEAST(ROUND(v_inst.amount - v_line_paid, 2), v_remaining);
    CONTINUE WHEN v_take <= 0;

    v_new_id := public.next_payment_code(EXTRACT(YEAR FROM v_when)::integer);

    INSERT INTO payments (
      id, student_id, student_name, course_slug, amount, payment_date,
      method, status, description, installment_id, receipt_no, branch_id,
      verified_at, verified_by
    ) VALUES (
      v_new_id, v_fee.student_id, v_name, v_fee.course_slug,
      v_take, v_when,
      COALESCE(NULLIF(p_method, ''), 'upi'),
      v_status, NULLIF(p_description, ''), v_inst.id,
      NULLIF(p_receipt_no, ''), v_branch,
      CASE WHEN v_status = 'Paid' THEN NOW() ELSE NULL END,
      NULLIF(p_verified_by, '')
    );

    v_remaining := round(v_remaining - v_take, 2);

    IF v_status = 'Paid' THEN
      v_line_paid := round(v_line_paid + v_take, 2);

      -- Table-qualified throughout: `amount` is also this function's own OUT
      -- column, so a bare reference here would be ambiguous rather than
      -- understood.
      --
      -- `paid_date` is the earlier of the two dates when there is one already on
      -- the line, so a backdated entry completes an installment that was partly
      -- settled earlier without moving the date the first money arrived.
      UPDATE fee_installments fi
         SET status      = CASE
                             WHEN v_line_paid >= ROUND(fi.amount, 2) THEN 'Paid'
                             ELSE 'Partial'
                           END,
             paid_date   = LEAST(COALESCE(fi.paid_date, v_when), v_when),
             verified_at = NOW()
       WHERE fi.id = v_inst.id;

      PERFORM public.apply_fee_delta(p_fee_id, v_take, -v_take);
    END IF;

    payment_id := v_new_id;
    installment_id := v_inst.id;
    installment_label := v_inst.label;
    amount := v_take;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.record_fee_payment_at(uuid, numeric, text, text, text, text, text, date) IS
  'Records one figure against a course fee on a given date, oldest schedule line first. The caller''s number is what lands on the ledger; lines are only attributed so schedule progress stays honest. Pending rows move no balance. service_role only.';

REVOKE ALL ON FUNCTION public.record_fee_payment_at(uuid, numeric, text, text, text, text, text, date) FROM PUBLIC;

-- The seven-argument form every existing caller uses: today's date, no exceptions.
-- Kept as its own signature rather than a defaulted argument on the function above,
-- because adding an argument would break the named-argument calls the app already
-- makes and changing their meaning.
CREATE OR REPLACE FUNCTION public.record_fee_payment(
  p_fee_id uuid,
  p_amount numeric,
  p_method text,
  p_description text,
  p_status text,
  p_receipt_no text,
  p_verified_by text DEFAULT NULL
)
RETURNS TABLE (payment_id text, installment_id uuid, installment_label text, amount numeric)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.record_fee_payment_at(
    p_fee_id, p_amount, p_method, p_description, p_status, p_receipt_no, p_verified_by, CURRENT_DATE
  );
$$;

COMMENT ON FUNCTION public.record_fee_payment(uuid, numeric, text, text, text, text, text) IS
  'Records one figure against a course fee dated today, oldest schedule line first. The caller''s number is what lands on the ledger; lines are only attributed so schedule progress stays honest. Pending rows move no balance. service_role only.';

REVOKE ALL ON FUNCTION public.record_fee_payment(uuid, numeric, text, text, text, text, text) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.submit_installment_payments(uuid, uuid[], text, text);
DROP FUNCTION IF EXISTS public.submit_installment_payments(uuid, uuid[], text, text, boolean);
DROP FUNCTION IF EXISTS public.submit_installment_payments(uuid, uuid[], text, text, boolean, numeric);
DROP FUNCTION IF EXISTS public.submit_installment_payments(uuid, uuid[], text, text, boolean, jsonb);
DROP FUNCTION IF EXISTS public.submit_installment_payments(uuid, uuid[], text, text, boolean, numeric, jsonb);
DROP FUNCTION IF EXISTS public.verify_installment_payments(text[], boolean, text);
DROP FUNCTION IF EXISTS public.unmark_installment(uuid, text);

-- The student's side of a payment, and deliberately the shortest function in this
-- file: one amount, one course, one claim. Nothing about the schedule is asked of
-- the student, because deciding how their own money is divided is not their job —
-- and the schedule already says when the rest is due.
CREATE OR REPLACE FUNCTION public.submit_fee_payment(
  p_user_id uuid,
  p_fee_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text
)
RETURNS TABLE (payment_id text, amount numeric, installment_label text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student students%ROWTYPE;
  v_fee fees%ROWTYPE;
  v_group text;
  v_row record;
BEGIN
  SELECT * INTO v_student FROM students WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no student record is linked to this account' USING ERRCODE = '22023';
  END IF;

  IF p_fee_id IS NULL THEN
    RAISE EXCEPTION 'choose a course to pay towards' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_fee FROM fees WHERE id = p_fee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'that fee record does not exist' USING ERRCODE = '22023';
  END IF;

  IF v_fee.student_id <> v_student.id THEN
    RAISE EXCEPTION 'that fee record belongs to another student' USING ERRCODE = '42501';
  END IF;

  -- One receipt number covers the whole claim even when it lands on more than
  -- one schedule line, so the student sees one claim and not two.
  v_group := public.next_payment_code(EXTRACT(YEAR FROM CURRENT_DATE)::integer);

  FOR v_row IN
    SELECT * FROM public.record_fee_payment(
      p_fee_id,
      p_amount,
      COALESCE(NULLIF(p_method, ''), 'upi'),
      COALESCE(NULLIF(p_reference, ''), 'Claimed by student, reference not supplied'),
      'Pending',
      v_group
    )
  LOOP
    payment_id := v_row.payment_id;
    amount := v_row.amount;
    installment_label := v_row.installment_label;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.submit_fee_payment(uuid, uuid, numeric, text, text) IS
  'Files a student''s claim for one amount against one course fee. The figure is entirely the student''s own and moves no balance until an admin verifies it. service_role only.';

REVOKE ALL ON FUNCTION public.submit_fee_payment(uuid, uuid, numeric, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.verify_installment_payments(
  p_payment_ids text[],
  p_approved boolean,
  p_verified_by text,
  p_note text DEFAULT ''
)
RETURNS TABLE (installment_id uuid, fee_id uuid, amount numeric, student_id text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pay payments%ROWTYPE;
  v_pid text;
  v_total numeric := 0;
  v_installment_paid numeric;
  v_note text;
BEGIN
  IF p_payment_ids IS NULL OR array_length(p_payment_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no payments were selected' USING ERRCODE = '22023';
  END IF;

  v_note := trim(COALESCE(p_note, ''));

  FOREACH v_pid IN ARRAY p_payment_ids LOOP
    SELECT * INTO v_pay FROM payments WHERE id = v_pid FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'payment % does not exist', v_pid USING ERRCODE = '22023';
    END IF;

    IF v_pay.status <> 'Pending' THEN
      RAISE EXCEPTION 'payment % has already been reviewed', v_pid USING ERRCODE = '22023';
    END IF;

    IF p_approved THEN
      UPDATE payments
         SET status      = 'Paid',
             verified_at = NOW(),
             verified_by = COALESCE(NULLIF(p_verified_by, ''), 'admin'),
             description = CASE
                             WHEN v_note = '' THEN v_pay.description
                             ELSE COALESCE(v_pay.description, '') || ' [verified: ' || v_note || ']'
                           END
       WHERE id = v_pid;

      IF v_pay.installment_id IS NOT NULL THEN
        SELECT COALESCE(SUM(p.amount), 0) INTO v_installment_paid
          FROM payments p
         WHERE p.installment_id = v_pay.installment_id AND p.status = 'Paid';

        UPDATE fee_installments fi
           SET status = CASE
                 WHEN v_installment_paid >= fi.amount THEN 'Paid'
                 ELSE 'Partial'
               END,
               paid_date = CURRENT_DATE,
               verified_at = NOW()
         WHERE fi.id = v_pay.installment_id;

        PERFORM public.apply_fee_delta(
          (SELECT fi.fee_id FROM fee_installments fi WHERE fi.id = v_pay.installment_id),
          v_pay.amount,
          -v_pay.amount
        );

        v_total := v_total + v_pay.amount;
        installment_id := v_pay.installment_id;
        fee_id := (SELECT fi.fee_id FROM fee_installments fi WHERE fi.id = v_pay.installment_id);
        amount := v_pay.amount;
        student_id := v_pay.student_id;
        RETURN NEXT;
      END IF;
    ELSE

      UPDATE payments
         SET status      = 'Rejected',
             description = COALESCE(description, '')
                           || ' [rejected'
                           || CASE WHEN v_note = '' THEN '' ELSE ': ' || v_note END
                           || ']',
             verified_at = NOW(),
             verified_by = COALESCE(NULLIF(p_verified_by, ''), 'admin')
       WHERE id = v_pid;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.verify_installment_payments(text[], boolean, text, text) IS
  'Confirms or rejects claimed installment payments, settling the linked installments and fee balances in the same transaction. service_role only.';

REVOKE ALL ON FUNCTION public.verify_installment_payments(text[], boolean, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.mark_installment_paid(
  p_installment_id uuid,
  p_method text,
  p_reference text
)
RETURNS TABLE (payment_id text, amount numeric)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inst fee_installments%ROWTYPE;
  v_fee fees%ROWTYPE;
  v_stud students%ROWTYPE;
  v_pid text;
  v_paid_sum numeric;
  v_balance numeric;
BEGIN
  SELECT * INTO v_inst FROM fee_installments WHERE id = p_installment_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'installment does not exist' USING ERRCODE = '22023';
  END IF;

  IF v_inst.status = 'Paid' THEN
    RAISE EXCEPTION '% has already been paid', v_inst.label USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM payments WHERE installment_id = v_inst.id AND status = 'Pending'
  ) THEN
    RAISE EXCEPTION '% has a student payment awaiting review. Approve or reject it in Payments first',
      v_inst.label USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0) INTO v_paid_sum
    FROM payments p WHERE p.installment_id = v_inst.id AND p.status = 'Paid';
  v_balance := GREATEST(v_inst.amount - v_paid_sum, 0);

  IF v_balance <= 0 THEN
    RAISE EXCEPTION '% has already been paid', v_inst.label USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_fee FROM fees WHERE id = v_inst.fee_id;
  SELECT * INTO v_stud FROM students WHERE id = v_fee.student_id;

  v_pid := public.next_payment_code(EXTRACT(YEAR FROM CURRENT_DATE)::integer);

  INSERT INTO payments (
    id, student_id, student_name, course_slug, amount, payment_date,
    method, status, description, installment_id, receipt_no, branch_id,
    verified_at, verified_by
  ) VALUES (
    v_pid, v_fee.student_id, v_stud.full_name, v_fee.course_slug, v_balance,
    CURRENT_DATE, COALESCE(NULLIF(p_method, ''), 'cash'), 'Paid',
    COALESCE(
      NULLIF(p_reference, ''),
      'Received at the institute — ' || v_inst.label
    ),
    v_inst.id, v_pid, v_stud.branch_id, NOW(), 'admin'
  );

  UPDATE fee_installments
     SET status = 'Paid', paid_date = CURRENT_DATE, verified_at = NOW()
   WHERE id = v_inst.id;

  PERFORM public.apply_fee_delta(v_inst.fee_id, v_balance, -v_balance);

  payment_id := v_pid;
  amount := v_balance;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.mark_installment_paid(uuid, text, text) IS
  'Records an over-the-counter payment and settles its installment and fee balance in one transaction. service_role only.';

REVOKE ALL ON FUNCTION public.mark_installment_paid(uuid, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.unmark_installment(
  p_installment_id uuid,
  p_reason text,
  p_unmarked_by text DEFAULT ''
)
RETURNS TABLE (fee_id uuid, amount numeric)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inst fee_installments%ROWTYPE;
  v_paid_sum numeric;
  v_reason text := trim(COALESCE(p_reason, ''));
BEGIN
  SELECT * INTO v_inst FROM fee_installments WHERE id = p_installment_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'installment does not exist' USING ERRCODE = '22023';
  END IF;

  IF v_inst.status NOT IN ('Paid', 'Partial') THEN
    RAISE EXCEPTION '% has no verified payment to reverse', v_inst.label USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0) INTO v_paid_sum
    FROM payments p
   WHERE p.installment_id = v_inst.id AND p.status = 'Paid';

  UPDATE payments
     SET status      = 'Rejected',
         verified_at = NOW(),
         description = COALESCE(description, '')
                       || ' [reversed'
                       || CASE WHEN v_reason = '' THEN '' ELSE ': ' || v_reason END
                       || ']',
         verified_by = COALESCE(NULLIF(p_unmarked_by, ''), 'admin')
   WHERE installment_id = v_inst.id AND status = 'Paid';

  UPDATE fee_installments
     SET status = 'Pending', paid_date = NULL, verified_at = NULL
   WHERE id = v_inst.id;

  PERFORM public.apply_fee_delta(
    v_inst.fee_id,
    -(CASE WHEN v_paid_sum > 0 THEN v_paid_sum ELSE v_inst.amount END),
    (CASE WHEN v_paid_sum > 0 THEN v_paid_sum ELSE v_inst.amount END)
  );

  fee_id := v_inst.fee_id;
  amount := v_inst.amount;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.unmark_installment(uuid, text, text) IS
  'Reverses a paid installment, rejecting its ledger entries and crediting the fee balance back. The reason is recorded on each reversed payment. service_role only.';

REVOKE ALL ON FUNCTION public.unmark_installment(uuid, text, text) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.replace_installment_plan(uuid, integer);

GRANT EXECUTE ON FUNCTION public.create_fee_schedule(uuid, numeric[], date)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_fee_delta(uuid, numeric, numeric)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_fee_payment(uuid, numeric, text, text, text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_fee_payment_at(uuid, numeric, text, text, text, text, text, date)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_fee_payment(uuid, uuid, numeric, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_installment_payments(text[], boolean, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_installment_paid(uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.unmark_installment(uuid, text, text)
  TO service_role;

ALTER FUNCTION public.create_fee_schedule(uuid, numeric[], date)            OWNER TO postgres;
ALTER FUNCTION public.apply_fee_delta(uuid, numeric, numeric)                     OWNER TO postgres;
ALTER FUNCTION public.record_fee_payment(uuid, numeric, text, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.record_fee_payment_at(uuid, numeric, text, text, text, text, text, date) OWNER TO postgres;
ALTER FUNCTION public.submit_fee_payment(uuid, uuid, numeric, text, text)         OWNER TO postgres;
ALTER FUNCTION public.verify_installment_payments(text[], boolean, text, text)      OWNER TO postgres;
ALTER FUNCTION public.mark_installment_paid(uuid, text, text)                      OWNER TO postgres;
ALTER FUNCTION public.unmark_installment(uuid, text, text) OWNER TO postgres;

DO $$
DECLARE
  t text;
  all_tables text[] := ARRAY[
    'courses', 'students', 'teachers', 'admins', 'fees',
    'fee_installments', 'fee_extras', 'payments',
    'certificates', 'videos', 'transactions',
    'faculty', 'rate_limit_log', 'branches'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

GRANT SELECT ON TABLE courses, faculty TO anon;

GRANT SELECT ON TABLE videos TO anon;

GRANT SELECT ON TABLE
  courses, students, teachers, admins, fees, fee_installments,
  fee_extras, payments, certificates, faculty,
  videos, transactions
TO authenticated;

GRANT INSERT ON TABLE payments, certificates TO authenticated;
GRANT UPDATE ON TABLE students, fees TO authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE
  courses, students, teachers, admins, fees, fee_installments,
  fee_extras, payments, certificates, videos,
  transactions, faculty
TO authenticated;

GRANT ALL ON TABLE
  courses, students, teachers, admins, fees, fee_installments,
  fee_extras, payments, certificates, videos,
  transactions, faculty, rate_limit_log
TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_log_id_seq TO service_role;

DO $$
DECLARE
  t text;
  stmt text;
  all_tables text[] := ARRAY[
    'courses', 'students', 'teachers', 'admins', 'fees',
    'fee_installments', 'fee_extras', 'payments',
    'certificates', 'videos', 'transactions',
    'faculty', 'rate_limit_log', 'branches'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP

    SELECT string_agg(
             format('DROP POLICY IF EXISTS %I ON public.%I;', policyname::text, tablename::text),
             ' '
           )
      INTO stmt
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t;

    IF stmt IS NOT NULL THEN
      EXECUTE stmt;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
  admin_only text[] := ARRAY[
    'teachers', 'transactions'
  ];
BEGIN
  FOREACH t IN ARRAY admin_only LOOP
    EXECUTE format(
      'CREATE POLICY "Admins full access" ON public.%I FOR ALL TO authenticated
         USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t
    );
  END LOOP;
END $$;

-- Branches are the institute's own campus list. Readable by anyone, because the
-- public course pages name the campus a course runs at; writable only by admins.
CREATE POLICY "Public read branches" ON branches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage branches" ON branches FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read courses" ON courses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage courses" ON courses FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read faculty" ON faculty FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage faculty" ON faculty FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DO $$
DECLARE
  policy_name text;
BEGIN
  IF to_regclass('public.announcements') IS NOT NULL THEN
    FOR policy_name IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'announcements'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.announcements', policy_name);
    END LOOP;
    EXECUTE 'REVOKE ALL ON TABLE public.announcements FROM anon, authenticated';
  END IF;
END $$;

CREATE POLICY "Public read published videos" ON videos FOR SELECT TO anon, authenticated
  USING (status = 'Published');
CREATE POLICY "Admins manage videos" ON videos FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins read own record" ON admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins full access" ON admins FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Students read own record" ON students FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Students update own record" ON students FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins full access" ON students FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Students read own fees" ON fees FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());
CREATE POLICY "Students update own fee balances" ON fees FOR UPDATE TO authenticated
  USING (student_id = public.current_student_id())
  WITH CHECK (student_id = public.current_student_id());
CREATE POLICY "Admins full access" ON fees FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Students read own installments" ON fee_installments FOR SELECT TO authenticated
  USING (fee_id IN (SELECT f.id FROM fees f WHERE f.student_id = public.current_student_id()));
CREATE POLICY "Admins full access" ON fee_installments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Students read own extras" ON fee_extras FOR SELECT TO authenticated
  USING (fee_id IN (SELECT f.id FROM fees f WHERE f.student_id = public.current_student_id()));
CREATE POLICY "Admins full access" ON fee_extras FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Students read own payments" ON payments FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

-- A student may file a claim. A claim is a claim: it has to arrive Pending, and
-- it must not carry the columns that mean a human has already looked at it.
--
-- The policy used to check only `student_id = current_student_id()`, which let a
-- signed-in student insert their own row with status = 'Paid' and an
-- installment_id of their own choosing. Every balance in the app is derived from
-- Paid payments linked to an installment, so that one insert marked an unpaid
-- installment settled on the fee page, the installments screen and the finance
-- revenue chart. The whole verification flow is built on the rule that only an
-- admin moves a balance, so the rule is now enforced at the row level rather
-- than only by the absence of a UI control.
--
-- The app does not use this policy for anything: /api/installments/submit calls
-- submit_fee_payment() with the service role, which additionally caps the figure
-- against what is genuinely still payable. This is the backstop for a request
-- that bypasses that route.
CREATE POLICY "Students file own payments" ON payments FOR INSERT TO authenticated
  WITH CHECK (
    student_id = public.current_student_id()
    AND status = 'Pending'
    AND verified_at IS NULL
    AND verified_by IS NULL
    AND amount > 0
    AND payment_date <= CURRENT_DATE
    AND (
      installment_id IS NULL
      OR EXISTS (
        SELECT 1
          FROM fee_installments fi
          JOIN fees f ON f.id = fi.fee_id
         WHERE fi.id = payments.installment_id
           AND f.student_id = public.current_student_id()
      )
    )
  );
CREATE POLICY "Admins full access" ON payments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DO $$
DECLARE
  policy_name text;
BEGIN
  IF to_regclass('public.attendance') IS NOT NULL THEN
    FOR policy_name IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'attendance'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.attendance', policy_name);
    END LOOP;
    EXECUTE 'REVOKE ALL ON TABLE public.attendance FROM anon, authenticated';
  END IF;
END $$;

CREATE POLICY "Students read own certificates" ON certificates FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());
CREATE POLICY "Students request own certificates" ON certificates FOR INSERT TO authenticated
  WITH CHECK (
    student_id = public.current_student_id()
    AND certificates.course_slug IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM fees f
       WHERE f.student_id = public.current_student_id()
         AND f.course_slug = certificates.course_slug
    )
    AND NOT EXISTS (
      SELECT 1
        FROM fees f
       WHERE f.student_id = public.current_student_id()
         AND f.course_slug = certificates.course_slug
         AND (
           COALESCE(f.pending_amount, 0) > 0
           OR NOT EXISTS (
             SELECT 1 FROM fee_installments fi WHERE fi.fee_id = f.id
           )
           OR EXISTS (
             SELECT 1
               FROM fee_installments fi
              WHERE fi.fee_id = f.id AND fi.status <> 'Paid'
           )
         )
    )
    AND NOT EXISTS (
      SELECT 1
        FROM certificates c
       WHERE c.student_id = public.current_student_id()
         AND c.course_slug = certificates.course_slug
         AND c.status IN ('Issued', 'Requested', 'Processing', 'Pending')
    )
  );
CREATE POLICY "Admins full access" ON certificates FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DO $$
DECLARE
  offenders text;
BEGIN

  SELECT string_agg(format('%I.%I (%I)', tablename::text, policyname::text, cmd::text), ', ')
    INTO offenders
    FROM pg_policies
   WHERE schemaname = 'public'
     AND 'anon' = ANY(roles)
     AND cmd::text IN ('ALL', 'INSERT', 'UPDATE', 'DELETE');

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Row level security check FAILED. The following policies grant write access to anon: %',
      offenders;
  END IF;

  RAISE NOTICE 'Row level security check passed: no anon write policies.';
END $$;

NOTIFY pgrst, 'reload schema';
