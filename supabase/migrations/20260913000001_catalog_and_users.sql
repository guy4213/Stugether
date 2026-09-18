-- =============================================================================
-- 20260913000001_catalog_and_users.sql
-- Academic catalog (institutions, departments, courses), profiles, enrollments.
-- Source of truth: TECHNICAL_SPEC.md §3.1-3.2, SPEC.md §6.
--
-- NOTE: RLS (ENABLE + FORCE), policies and helper functions are defined in
-- 20260913000003_helpers_and_rls.sql. Do not add them here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Generic updated_at trigger function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3.1 Academic catalog
-- -----------------------------------------------------------------------------
CREATE TABLE public.institutions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  city       text        CHECK (city IS NULL OR char_length(city) <= 100),
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.departments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid        NOT NULL REFERENCES public.institutions (id) ON DELETE RESTRICT,
  name           text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departments_institution_id_name_key UNIQUE (institution_id, name)
);

CREATE TABLE public.courses (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid        NOT NULL REFERENCES public.institutions (id) ON DELETE RESTRICT,
  department_id  uuid        REFERENCES public.departments (id) ON DELETE RESTRICT,
  code           text        CHECK (code IS NULL OR char_length(btrim(code)) BETWEEN 1 AND 50),
  name           text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  year_level     smallint    CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 10),
  semester       text        CHECK (semester IS NULL OR char_length(semester) <= 50),
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Partial unique: a UNIQUE INDEX (a table constraint cannot carry a WHERE).
CREATE UNIQUE INDEX courses_institution_id_code_key
  ON public.courses (institution_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX courses_institution_department_active_idx
  ON public.courses (institution_id, department_id)
  WHERE is_active;

CREATE INDEX departments_institution_id_idx
  ON public.departments (institution_id);

-- -----------------------------------------------------------------------------
-- 3.2 Users
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id             uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name      text        NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 120),
  -- avatar_url stores the Storage OBJECT PATH inside the 'avatars' bucket, never
  -- a full URL: '<profile id>/<file name>'. The client builds the public URL with
  -- supabase.storage.from('avatars').getPublicUrl(path). This prevents pointing
  -- classmates' browsers at an external host (tracking) or a javascript:/data:
  -- URI (XSS if ever rendered in an href).
  avatar_url     text        CONSTRAINT profiles_avatar_url_own_object_path CHECK (
                               avatar_url IS NULL
                               OR avatar_url ~ ('^' || id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$')
                             ),
  bio            text        CHECK (bio IS NULL OR char_length(bio) <= 1000),
  institution_id uuid        REFERENCES public.institutions (id) ON DELETE SET NULL,
  department_id  uuid        REFERENCES public.departments (id) ON DELETE SET NULL,
  study_year     smallint    CHECK (study_year IS NULL OR study_year BETWEEN 1 AND 10),
  role           text        NOT NULL DEFAULT 'student'
                             CHECK (role IN ('student', 'super_admin')),
  is_active      boolean     NOT NULL DEFAULT true,
  last_seen_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_institution_id_idx ON public.profiles (institution_id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.enrollments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  course_id  uuid        NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  status     text        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollments_user_id_course_id_key UNIQUE (user_id, course_id)
);

-- "Students in course" screen + invitee picker (hot queries).
CREATE INDEX enrollments_course_id_active_idx
  ON public.enrollments (course_id)
  WHERE status = 'active';

-- -----------------------------------------------------------------------------
-- Profile creation on sign-up: on_auth_user_created
-- role is ALWAYS 'student' regardless of metadata (never trust raw_user_meta_data
-- for privileges).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_full_name text;
BEGIN
  v_full_name := COALESCE(
    NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(pg_catalog.btrim(pg_catalog.split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
    'Student'
  );
  v_full_name := pg_catalog.left(v_full_name, 120);

  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (NEW.id, v_full_name, 'student', true)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Guard: role / is_active are privileged columns.
-- * A signed-in user (auth.uid() IS NOT NULL) who is not an active super_admin
--   cannot change role or is_active (on anyone, including themself).
-- * id and created_at are immutable for everyone.
-- * service_role / postgres (auth.uid() IS NULL) may change them (admin seeding).
-- * On INSERT by a signed-in non-admin, role/is_active are forced to defaults
--   (defense in depth; RLS should not allow profile INSERT anyway).
-- The super_admin check is inlined (reads profiles directly as definer) so this
-- migration does not depend on helper functions from migration 000003.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;  -- service_role / postgres / migrations
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.role = 'super_admin'
      AND p.is_active
  ) INTO v_is_admin;

  IF TG_OP = 'INSERT' THEN
    IF NOT v_is_admin THEN
      NEW.role := 'student';
      NEW.is_active := true;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'PROFILE_IMMUTABLE_COLUMN'
      USING ERRCODE = '42501', DETAIL = 'id and created_at cannot be changed';
  END IF;

  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active)
     AND NOT v_is_admin THEN
    RAISE EXCEPTION 'PROFILE_PRIVILEGED_COLUMN'
      USING ERRCODE = '42501', DETAIL = 'role and is_active can only be changed by a super_admin';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_privileged_columns() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER profiles_guard_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();
