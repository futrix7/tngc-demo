CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    'attendance_status=Present|Absent|Late|Leave',
    'certificate_status=Issued|Pending|Rejected|Processing|Requested',
    'certificate_type=Completion|Proficiency|Module',
    'video_status=Published|Draft|Processing',
    'announcement_priority=high|medium|low',
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

CREATE TABLE IF NOT EXISTS branches (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tag         TEXT,
  address     TEXT NOT NULL,
  city        TEXT NOT NULL,
  note        TEXT,
  is_primary  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

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
  email                   TEXT NOT NULL,
  phone                   TEXT NOT NULL,
  date_of_birth           DATE,
  gender                  gender_type,
  address                 TEXT,
  branch_id               TEXT REFERENCES branches(id) ON DELETE SET NULL,
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
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teachers (
  id             TEXT PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL,
  role           TEXT NOT NULL,
  branch_id      TEXT REFERENCES branches(id) ON DELETE SET NULL,
  subjects       TEXT[] DEFAULT '{}',
  experience     INTEGER DEFAULT 0,
  qualification  qualification_type,
  specialization specialization_type,
  salary         NUMERIC(10,2),
  status         teacher_status DEFAULT 'Active',
  profile_photo  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  branch_id      TEXT REFERENCES branches(id) ON DELETE SET NULL,
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

  branch_id     TEXT REFERENCES branches(id) ON DELETE SET NULL,

  installment_id uuid REFERENCES fee_installments(id) ON DELETE SET NULL,

  verified_at  timestamptz,
  verified_by  text,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   TEXT REFERENCES students(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  time_in      TIME,
  time_out     TIME,
  hours        DECIMAL(3,1) DEFAULT 0,
  status       attendance_status NOT NULL,
  course_slug  TEXT REFERENCES courses(slug) ON DELETE SET NULL,
  branch_id    TEXT REFERENCES branches(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
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
  branch_id      TEXT REFERENCES branches(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS announcements (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  priority        announcement_priority DEFAULT 'medium',
  target          TEXT DEFAULT 'All Students',
  author_id       TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  author_name     TEXT,
  published_date  DATE DEFAULT CURRENT_DATE,
  pinned          BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date         DATE NOT NULL,
  description  TEXT NOT NULL,
  category     TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  type         transaction_type NOT NULL,
  branch_id    TEXT REFERENCES branches(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID REFERENCES admins(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  type        TEXT NOT NULL,
  timestamp   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  date        DATE NOT NULL,
  type        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_tasks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task        TEXT NOT NULL,
  priority    TEXT DEFAULT 'medium',
  completed   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
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

ALTER TABLE payments ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL;

ALTER TABLE students ADD COLUMN IF NOT EXISTS present_status         TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS full_name_as_signature TEXT;

UPDATE payments p
   SET branch_id = s.branch_id
  FROM students s
 WHERE s.id = p.student_id
   AND p.branch_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_students_branch       ON students(branch_id);
CREATE INDEX IF NOT EXISTS idx_students_course       ON students(course_slug);
CREATE INDEX IF NOT EXISTS idx_students_status       ON students(status);

CREATE INDEX IF NOT EXISTS idx_students_user_id      ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_branch       ON teachers(branch_id);

CREATE INDEX IF NOT EXISTS idx_admins_user_id        ON admins(user_id);
CREATE INDEX IF NOT EXISTS idx_fees_student          ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student      ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date         ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_branch       ON payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student    ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date       ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_certificates_student  ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_videos_course         ON videos(course_slug);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned  ON announcements(pinned);
CREATE INDEX IF NOT EXISTS idx_transactions_date     ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type     ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_scope  ON rate_limit_log(scope, created_at);

ALTER TABLE branches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE students          ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_installments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_extras        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance        ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_log    ENABLE ROW LEVEL SECURITY;

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
    'branches', 'courses', 'students', 'teachers', 'admins', 'fees',
    'certificates', 'announcements', 'videos'
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

CREATE OR REPLACE FUNCTION public.create_fee_schedule(
  p_fee_id uuid,
  p_total numeric,
  p_count integer,
  p_first_due date
)
RETURNS TABLE (installment_id uuid, seq_no integer, installment_amount numeric, due_on date)
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base numeric(10,2);
  v_i integer;
  v_amount numeric(10,2);
  v_due date;
  v_new_id uuid;
BEGIN
  IF p_count IS NULL OR p_count < 1 OR p_count > 12 THEN
    RAISE EXCEPTION 'installment count must be between 1 and 12' USING ERRCODE = '22023';
  END IF;

  IF p_total IS NULL OR p_total < 0 THEN
    RAISE EXCEPTION 'fee total cannot be negative' USING ERRCODE = '22023';
  END IF;

  v_base := floor(p_total / p_count)::numeric(10,2);

  FOR v_i IN 1..p_count LOOP

    v_amount := CASE
      WHEN v_i = p_count THEN p_total - (v_base * (p_count - 1))
      ELSE v_base
    END;

    v_due := (p_first_due + ((v_i - 1) || ' months')::interval)::date;

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

COMMENT ON FUNCTION public.create_fee_schedule(uuid, numeric, integer, date) IS
  'Splits a course fee into dated installments whose amounts sum to exactly the total. service_role only.';

REVOKE ALL ON FUNCTION public.create_fee_schedule(uuid, numeric, integer, date) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.register_student(
  uuid, text, text, text, text, text, text, text[], text, text, text, text,
  integer[], integer
);

CREATE OR REPLACE FUNCTION public.register_student(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_father_name text,
  p_father_phone text,
  p_branch_id text,
  p_course_slugs text[],
  p_present_status text,
  p_signature text,
  p_payment_method text,
  p_payment_description text,
  p_paid_installment_nos integer[] DEFAULT ARRAY[1]::integer[],
  p_installment_count integer DEFAULT 3,
  p_custom_payment_amount numeric DEFAULT NULL
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
  v_count integer := COALESCE(p_installment_count, 3);
  v_custom_remaining numeric;
  v_payment_amount numeric;
  v_sched record;
  v_inst record;
  v_no integer;
  v_nos integer[];
BEGIN
  IF p_course_slugs IS NULL OR array_length(p_course_slugs, 1) IS NULL THEN
    RAISE EXCEPTION 'at least one course must be selected' USING ERRCODE = '22023';
  END IF;

  IF p_signature IS NULL OR p_full_name IS NULL
     OR btrim(p_signature) = ''
     OR lower(btrim(p_signature)) <> lower(btrim(p_full_name)) THEN
    RAISE EXCEPTION 'signature does not match the enrolled name' USING ERRCODE = '22023';
  END IF;

  v_primary_course := p_course_slugs[1];
  v_student_id := public.next_student_code(v_year);
  v_payment_id := public.next_payment_code(v_year);

  INSERT INTO students (
    id, user_id, full_name, email, phone, father_name, father_phone,
    branch_id, course_slug, status, present_status, full_name_as_signature
  ) VALUES (
    v_student_id, p_user_id, p_full_name, p_email, p_phone, p_father_name,
    NULLIF(p_father_phone, ''), NULLIF(p_branch_id, ''), v_primary_course,
    'Active', p_present_status, p_signature
  );

  FOREACH v_course IN ARRAY p_course_slugs LOOP

    SELECT c.fee_numeric INTO v_course_fee FROM courses c WHERE c.slug = v_course;
    v_course_fee := COALESCE(v_course_fee, 0);
    v_total := v_total + v_course_fee;

    INSERT INTO fees (student_id, course_slug, total_fee, paid_amount, pending_amount)
    VALUES (v_student_id, v_course, v_course_fee, 0, v_course_fee)
    RETURNING id INTO v_fee_row;

    PERFORM * FROM public.create_fee_schedule(v_fee_row, v_course_fee, v_count, v_today);
  END LOOP;

    IF p_custom_payment_amount IS NOT NULL
      AND (p_custom_payment_amount <= 0 OR p_custom_payment_amount > v_total) THEN
     RAISE EXCEPTION 'custom payment must be greater than zero and no more than the total fee'
      USING ERRCODE = '22023';
    END IF;

    IF p_custom_payment_amount IS NOT NULL
      OR (COALESCE(p_paid_installment_nos, ARRAY[1]::integer[]) IS NOT NULL
        AND array_length(p_paid_installment_nos, 1) IS NOT NULL) THEN
    v_receipt := public.next_payment_code(v_year);
  END IF;

  SELECT COALESCE(
           (SELECT array_agg(DISTINCT n ORDER BY n)
              FROM unnest(p_paid_installment_nos) AS n
             WHERE n BETWEEN 1 AND v_count),
           ARRAY[]::integer[]
         )
    INTO v_nos;

  IF p_custom_payment_amount IS NOT NULL THEN
    v_custom_remaining := p_custom_payment_amount;

    FOREACH v_course IN ARRAY p_course_slugs LOOP
      SELECT f.id INTO v_fee_row FROM fees f
       WHERE f.student_id = v_student_id AND f.course_slug = v_course
       LIMIT 1;

      FOR v_inst IN
        SELECT fi.id, fi.amount
          FROM fee_installments fi
         WHERE fi.fee_id = v_fee_row
           AND fi.amount > 0
         ORDER BY fi.installment_no
      LOOP
        EXIT WHEN v_custom_remaining <= 0;
        v_payment_amount := LEAST(v_inst.amount, v_custom_remaining);
        v_payment_id := public.next_payment_code(v_year);

        INSERT INTO payments (
          id, student_id, student_name, course_slug, amount, payment_date,
          method, status, description, branch_id, installment_id, receipt_no
        ) VALUES (
          v_payment_id, v_student_id, p_full_name, v_course, v_payment_amount, v_today,
          COALESCE(NULLIF(p_payment_method, ''), 'upi'), 'Pending',
          p_payment_description,
          NULLIF(p_branch_id, ''),
          v_inst.id,
          v_receipt
        );

        v_custom_remaining := v_custom_remaining - v_payment_amount;
      END LOOP;
    END LOOP;
  ELSE
    FOREACH v_course IN ARRAY p_course_slugs LOOP
      SELECT f.id INTO v_fee_row FROM fees f
       WHERE f.student_id = v_student_id AND f.course_slug = v_course
       LIMIT 1;

      IF v_fee_row IS NULL THEN
        CONTINUE;
      END IF;

      FOREACH v_no IN ARRAY v_nos LOOP
        SELECT fi.id, fi.amount INTO v_inst FROM fee_installments fi
         WHERE fi.fee_id = v_fee_row AND fi.installment_no = v_no
         LIMIT 1;

        IF v_inst.id IS NULL THEN
          CONTINUE;
        END IF;

        v_payment_id := public.next_payment_code(v_year);

        INSERT INTO payments (
          id, student_id, student_name, course_slug, amount, payment_date,
          method, status, description, branch_id, installment_id, receipt_no
        ) VALUES (
          v_payment_id, v_student_id, p_full_name, v_course, v_inst.amount, v_today,
          COALESCE(NULLIF(p_payment_method, ''), 'upi'), 'Pending',
          p_payment_description,
          NULLIF(p_branch_id, ''),
          v_inst.id,
          v_receipt
        );
      END LOOP;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_student_id, v_payment_id, v_total;
END;
$$;

COMMENT ON FUNCTION public.register_student(
  uuid, text, text, text, text, text, text, text[], text, text, text, text,
  integer[], integer, numeric
) IS
  'Creates a student, fee rows and schedules, and Pending payment claims for chosen installments or a custom amount allocated across the schedule. Prices courses from courses.fee_numeric. service_role only.';

REVOKE ALL ON FUNCTION public.register_student(
  uuid, text, text, text, text, text, text, text[], text, text, text, text,
  integer[], integer, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_student(
  uuid, text, text, text, text, text, text, text[], text, text, text, text,
  integer[], integer, numeric
) TO service_role;

ALTER FUNCTION public.register_student(
  uuid, text, text, text, text, text, text, text[], text, text, text, text,
  integer[], integer, numeric
) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.enroll_student_in_course(
  p_user_id uuid,
  p_course_slug text
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

  IF EXISTS (
    SELECT 1 FROM fees f
     WHERE f.student_id = v_student.id AND f.course_slug = v_course.slug
  ) THEN
    RAISE EXCEPTION 'already enrolled in this course' USING ERRCODE = '22023';
  END IF;

  INSERT INTO fees (student_id, course_slug, total_fee, paid_amount, pending_amount)
  VALUES (v_student.id, v_course.slug, v_course.fee_numeric, 0, v_course.fee_numeric)
  RETURNING id INTO v_fee_id;

  PERFORM * FROM public.create_fee_schedule(v_fee_id, v_course.fee_numeric, 3, CURRENT_DATE);

  fee_id := v_fee_id;
  course_slug := v_course.slug;
  total_fee := v_course.fee_numeric;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.enroll_student_in_course(uuid, text) IS
  'Adds an active course to an existing student and creates its fee plus three-installment schedule atomically. service_role only.';

REVOKE ALL ON FUNCTION public.enroll_student_in_course(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_student_in_course(uuid, text) TO service_role;
ALTER FUNCTION public.enroll_student_in_course(uuid, text) OWNER TO postgres;

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

  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
    RAISE EXCEPTION 'branch assignment is managed by the institute and cannot be changed'
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

DROP FUNCTION IF EXISTS public.submit_installment_payments(uuid, uuid[], text, text);
DROP FUNCTION IF EXISTS public.verify_installment_payments(text[], boolean, text);
DROP FUNCTION IF EXISTS public.unmark_installment(uuid, text);

CREATE OR REPLACE FUNCTION public.submit_installment_payments(
  p_user_id uuid,
  p_installment_ids uuid[],
  p_method text,
  p_reference text,
  p_pay_all boolean DEFAULT false
)
RETURNS TABLE (payment_id text, amount numeric, installment_label text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student students%ROWTYPE;
  v_inst fee_installments%ROWTYPE;
  v_id uuid;
  v_total numeric := 0;
  v_group text;
  v_paid numeric;
  v_balance numeric;
BEGIN
  SELECT * INTO v_student FROM students WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no student record is linked to this account' USING ERRCODE = '22023';
  END IF;

  IF p_installment_ids IS NULL OR array_length(p_installment_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'choose at least one installment' USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE(p_pay_all, false) AND (
    SELECT COUNT(DISTINCT fi.installment_no)
      FROM fee_installments fi
     WHERE fi.id = ANY(p_installment_ids)
  ) > 3 THEN
    RAISE EXCEPTION 'at most three installment numbers can be paid in one go' USING ERRCODE = '22023';
  END IF;

  v_group := public.next_payment_code(EXTRACT(YEAR FROM CURRENT_DATE)::integer);

  FOREACH v_id IN ARRAY (
    SELECT array_agg(DISTINCT x) FROM unnest(p_installment_ids) AS x
  ) LOOP
    SELECT * INTO v_inst FROM fee_installments WHERE id = v_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'installment % does not exist', v_id USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM fees WHERE id = v_inst.fee_id AND student_id = v_student.id) THEN
      RAISE EXCEPTION 'installment % does not belong to this student', v_id USING ERRCODE = '42501';
    END IF;

    IF v_inst.status = 'Paid' THEN
      RAISE EXCEPTION '% has already been paid', v_inst.label USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(SUM(p.amount), 0) INTO v_paid
      FROM payments p
     WHERE p.installment_id = v_inst.id AND p.status = 'Paid';
    v_balance := GREATEST(v_inst.amount - v_paid, 0);

    IF v_balance <= 0 THEN
      RAISE EXCEPTION '% has already been paid', v_inst.label USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1 FROM payments
       WHERE installment_id = v_inst.id AND status = 'Pending'
    ) THEN
      RAISE EXCEPTION '% is already awaiting verification', v_inst.label USING ERRCODE = '22023';
    END IF;

    v_total := v_total + v_balance;

    INSERT INTO payments (
      id, student_id, student_name, course_slug, amount, payment_date,
      method, status, description, branch_id, installment_id, receipt_no
    )
    SELECT public.next_payment_code(EXTRACT(YEAR FROM CURRENT_DATE)::integer),
           v_student.id,
           v_student.full_name,
           f.course_slug,
           v_balance,
           CURRENT_DATE,
           COALESCE(NULLIF(p_method, ''), 'upi'),
           'Pending',
           COALESCE(NULLIF(p_reference, ''), 'Claimed by student, reference not supplied'),
           v_student.branch_id,
           v_inst.id,
           v_group
      FROM fees f
     WHERE f.id = v_inst.fee_id
    RETURNING id INTO payment_id;

    installment_label := v_inst.label;
    amount := v_balance;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.submit_installment_payments(uuid, uuid[], text, text, boolean) IS
  'Files one Pending payment per chosen installment for the calling student. Moves no balance. service_role only.';

REVOKE ALL ON FUNCTION public.submit_installment_payments(uuid, uuid[], text, text, boolean) FROM PUBLIC;

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
    method, status, description, branch_id, installment_id, receipt_no,
    verified_at, verified_by
  ) VALUES (
    v_pid, v_fee.student_id, v_stud.full_name, v_fee.course_slug, v_balance,
    CURRENT_DATE, COALESCE(NULLIF(p_method, ''), 'cash'), 'Paid',
    COALESCE(
      NULLIF(p_reference, ''),
      'Received at the institute — ' || v_inst.label
    ),
    v_stud.branch_id, v_inst.id, v_pid, NOW(), 'admin'
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

GRANT EXECUTE ON FUNCTION public.create_fee_schedule(uuid, numeric, integer, date)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_fee_delta(uuid, numeric, numeric)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_installment_payments(uuid, uuid[], text, text, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_installment_payments(text[], boolean, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_installment_paid(uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.unmark_installment(uuid, text, text)
  TO service_role;

ALTER FUNCTION public.create_fee_schedule(uuid, numeric, integer, date)            OWNER TO postgres;
ALTER FUNCTION public.apply_fee_delta(uuid, numeric, numeric)                     OWNER TO postgres;
ALTER FUNCTION public.submit_installment_payments(uuid, uuid[], text, text, boolean) OWNER TO postgres;
ALTER FUNCTION public.verify_installment_payments(text[], boolean, text, text)      OWNER TO postgres;
ALTER FUNCTION public.mark_installment_paid(uuid, text, text)                      OWNER TO postgres;
ALTER FUNCTION public.unmark_installment(uuid, text, text) OWNER TO postgres;

DO $$
DECLARE
  t text;
  all_tables text[] := ARRAY[
    'branches', 'courses', 'students', 'teachers', 'admins', 'fees',
    'fee_installments', 'fee_extras', 'payments', 'attendance',
    'certificates', 'videos', 'announcements', 'transactions',
    'activity_log', 'events', 'pending_tasks', 'faculty', 'rate_limit_log'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

GRANT SELECT ON TABLE branches, courses, announcements, faculty TO anon;

GRANT SELECT ON TABLE videos TO anon;

GRANT SELECT ON TABLE
  branches, courses, students, teachers, admins, fees, fee_installments,
  fee_extras, payments, attendance, certificates, announcements, faculty,
  videos, transactions, events, pending_tasks
TO authenticated;

GRANT INSERT ON TABLE payments, certificates TO authenticated;
GRANT UPDATE ON TABLE students, fees TO authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE
  branches, courses, students, teachers, admins, fees, fee_installments,
  fee_extras, payments, attendance, certificates, videos, announcements,
  transactions, activity_log, events, pending_tasks, faculty
TO authenticated;

GRANT ALL ON TABLE
  branches, courses, students, teachers, admins, fees, fee_installments,
  fee_extras, payments, attendance, certificates, videos, announcements,
  transactions, activity_log, events, pending_tasks, faculty, rate_limit_log
TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_log_id_seq TO service_role;

DO $$
DECLARE
  t text;
  stmt text;
  all_tables text[] := ARRAY[
    'branches', 'courses', 'students', 'teachers', 'admins', 'fees',
    'fee_installments', 'fee_extras', 'payments', 'attendance',
    'certificates', 'videos', 'announcements', 'transactions',
    'activity_log', 'events', 'pending_tasks', 'faculty', 'rate_limit_log'
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
    'teachers', 'transactions', 'activity_log', 'events', 'pending_tasks'
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

CREATE POLICY "Public read branches" ON branches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage branches" ON branches FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read courses" ON courses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage courses" ON courses FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read faculty" ON faculty FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage faculty" ON faculty FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public read announcements" ON announcements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage announcements" ON announcements FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

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
CREATE POLICY "Students file own payments" ON payments FOR INSERT TO authenticated
  WITH CHECK (student_id = public.current_student_id());
CREATE POLICY "Admins full access" ON payments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Students read own attendance" ON attendance FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());
CREATE POLICY "Admins full access" ON attendance FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

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
