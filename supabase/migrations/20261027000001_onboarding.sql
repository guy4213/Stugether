-- =============================================================================
-- 20261027000001_onboarding.sql
-- Change Request (27.10.2026, approved by the client): signup is email +
-- password or Google only, followed by an onboarding wizard (SPEC §4.1).
--   1. profiles: onboarded_at (the wizard was completed — replaces the
--      "no institution yet" inference), preferred study times and learning
--      styles (match score inputs, SPEC §4.8).
--   2. Existing students who already picked an institution, and super admins,
--      count as onboarded.
--   3. public_profiles: exposes study_times / learning_styles.
--   4. complete_onboarding: the wizard's answers + course enrollments in one
--      transaction.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN onboarded_at    timestamptz,
  ADD COLUMN study_times     text[] NOT NULL DEFAULT '{}'
    CONSTRAINT profiles_study_times_check
    CHECK (study_times <@ ARRAY['morning', 'noon', 'evening', 'night']::text[]),
  ADD COLUMN learning_styles text[] NOT NULL DEFAULT '{}'
    CONSTRAINT profiles_learning_styles_check
    CHECK (
      cardinality(learning_styles) <= 3
      AND learning_styles <@ ARRAY[
        'summaries', 'exercises', 'group', 'explanations',
        'discussions', 'sample_exams', 'pairs', 'memorization'
      ]::text[]
    );

-- -----------------------------------------------------------------------------
-- 2. Backfill: nobody who finished the old onboarding goes through the wizard.
-- -----------------------------------------------------------------------------
UPDATE public.profiles
   SET onboarded_at = created_at
 WHERE onboarded_at IS NULL
   AND (institution_id IS NOT NULL OR role = 'super_admin');

-- -----------------------------------------------------------------------------
-- 3. public_profiles (as in 20261021000001 §5; new columns go last: CREATE OR
--    REPLACE VIEW can only append). onboarded_at stays private.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true)
AS
  SELECT p.id,
         p.full_name,
         p.avatar_url,
         p.institution_id,
         p.department_id,
         p.study_year,
         p.city,
         p.last_seen_at,
         p.track,
         p.semester,
         p.hobbies,
         (p.is_active AND p.role = 'student') AS listed,
         p.study_times,
         p.learning_styles
    FROM public.profiles p
   WHERE auth.uid() IS NOT NULL
     AND (
       p.id = auth.uid()
       OR public.is_super_admin()
       OR (p.is_active AND p.role = 'student')
       OR public.shares_room_with(p.id)
     );

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profiles TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. complete_onboarding -> number of courses enrolled
-- Conventions as in 20260913000004_rpcs.sql. Error codes:
--   ALREADY_ONBOARDED    P0001  the caller finished the wizard before
--   INVALID_ARGUMENT     22023  missing / out-of-range answer
--   INVALID_DEPARTMENT   P0001  department inactive or not in the institution
--   INVALID_COURSES      P0001  no courses, too many, or one that is inactive /
--                               in another institution
-- Hobby VALUES are validated by the app (lib/constants/profile-options.ts, like
-- the profile form); the database checks the count.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_full_name       text,
  p_institution_id  uuid,
  p_department_id   uuid,
  p_study_year      smallint,
  p_semester        smallint,
  p_track           text,
  p_hobbies         text[],
  p_study_times     text[],
  p_learning_styles text[],
  p_course_ids      uuid[]
)
RETURNS int
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       uuid := public.require_active_caller();
  v_name      text := pg_catalog.btrim(COALESCE(p_full_name, ''));
  v_courses   uuid[];
  v_valid     int;
  v_enrolled  int;
BEGIN
  -- Lock the caller's row: two concurrent submits finish once.
  PERFORM 1 FROM public.profiles p
   WHERE p.id = v_uid AND p.onboarded_at IS NULL
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ALREADY_ONBOARDED' USING ERRCODE = 'P0001';
  END IF;

  IF pg_catalog.char_length(v_name) NOT BETWEEN 1 AND 120
     OR p_institution_id IS NULL
     OR p_department_id IS NULL
     OR p_study_year IS NULL OR p_study_year NOT BETWEEN 1 AND 10
     OR p_semester IS NULL OR p_semester NOT BETWEEN 1 AND 3
     OR p_track IS NULL OR p_track NOT IN ('day', 'evening')
     OR COALESCE(cardinality(p_hobbies), 0) <> 3
     OR (SELECT count(DISTINCT h) FROM pg_catalog.unnest(p_hobbies) AS h) <> 3
     OR COALESCE(cardinality(p_study_times), 0) < 1
     OR COALESCE(cardinality(p_learning_styles), 0) <> 3
     OR (SELECT count(DISTINCT s) FROM pg_catalog.unnest(p_learning_styles) AS s) <> 3
  THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.departments d
     WHERE d.id = p_department_id
       AND d.institution_id = p_institution_id
       AND d.is_active
  ) OR NOT EXISTS (
    SELECT 1 FROM public.institutions i
     WHERE i.id = p_institution_id AND i.is_active
  ) THEN
    RAISE EXCEPTION 'INVALID_DEPARTMENT' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT c), '{}') INTO v_courses
    FROM pg_catalog.unnest(p_course_ids) AS c
   WHERE c IS NOT NULL;

  SELECT count(*) INTO v_valid
    FROM public.courses c
   WHERE c.id = ANY (v_courses)
     AND c.institution_id = p_institution_id
     AND c.is_active;

  IF cardinality(v_courses) NOT BETWEEN 1 AND 30 OR v_valid <> cardinality(v_courses) THEN
    RAISE EXCEPTION 'INVALID_COURSES' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
     SET full_name       = v_name,
         institution_id  = p_institution_id,
         department_id   = p_department_id,
         study_year      = p_study_year,
         semester        = p_semester,
         track           = p_track,
         hobbies         = p_hobbies,
         study_times     = (SELECT array_agg(DISTINCT t) FROM pg_catalog.unnest(p_study_times) AS t),
         learning_styles = p_learning_styles,
         onboarded_at    = pg_catalog.now()
   WHERE id = v_uid;

  INSERT INTO public.enrollments (user_id, course_id)
  SELECT v_uid, c FROM pg_catalog.unnest(v_courses) AS c
  ON CONFLICT (user_id, course_id) DO NOTHING;

  GET DIAGNOSTICS v_enrolled = ROW_COUNT;
  RETURN v_enrolled;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding(
  text, uuid, uuid, smallint, smallint, text, text[], text[], text[], uuid[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(
  text, uuid, uuid, smallint, smallint, text, text[], text[], text[], uuid[]
) TO authenticated;
