-- =============================================================================
-- 20260923000002_favorites_progress_tests.sql
-- Phase B/C additions: course favorites, per-enrollment progress tracking,
-- dynamic course tests (replacing the static "Assignments" mock), and
-- extending public_profiles with city (needed for the match-percentage
-- feature — institution/study_year/department/faculty/city).
-- Self-contained: table DDL + RLS (ENABLE + FORCE) + policies together, since
-- prior migrations are already applied and immutable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- course_favorites — a student's "starred" courses on the catalog page.
-- -----------------------------------------------------------------------------
CREATE TABLE public.course_favorites (
  user_id    uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  course_id  uuid        NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX course_favorites_user_id_idx ON public.course_favorites (user_id);

ALTER TABLE public.course_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_favorites FORCE  ROW LEVEL SECURITY;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.course_favorites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.course_favorites FROM anon;

CREATE POLICY course_favorites_select_own
  ON public.course_favorites FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY course_favorites_insert_own
  ON public.course_favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY course_favorites_delete_own
  ON public.course_favorites FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- enrollments: per-course progress, for the analytics page ("completed
-- courses" instead of certificates, per-course progress bars). Covered by the
-- existing enrollments_update_own policy (own row, no column restriction).
-- -----------------------------------------------------------------------------
ALTER TABLE public.enrollments
  ADD COLUMN progress_percent smallint NOT NULL DEFAULT 0
    CHECK (progress_percent BETWEEN 0 AND 100),
  ADD COLUMN completed_at timestamptz;

-- -----------------------------------------------------------------------------
-- tests — dynamic, DB-driven items shown on the dashboard in place of the
-- static "Assignments" mock. Any actively-enrolled student may add one for
-- their course (a shared to-do, not a full exam/quiz engine — no question
-- bank or grading was requested).
-- -----------------------------------------------------------------------------
CREATE TABLE public.tests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid        NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  title       text        NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  description text        CHECK (description IS NULL OR char_length(description) <= 1000),
  due_at      timestamptz,
  created_by  uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tests_course_id_active_idx ON public.tests (course_id) WHERE is_active;

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests FORCE  ROW LEVEL SECURITY;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.tests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.tests FROM anon;

-- Visible to students actively enrolled in the course, or a super_admin.
CREATE POLICY tests_select_enrolled_or_admin
  ON public.tests FOR SELECT TO authenticated
  USING (
    public.is_enrolled_in_course(course_id)
    OR (SELECT public.is_super_admin())
  );

CREATE POLICY tests_insert_enrolled
  ON public.tests FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.is_enrolled_in_course(course_id)
  );

CREATE POLICY tests_update_own_or_admin
  ON public.tests FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR (SELECT public.is_super_admin()))
  WITH CHECK (created_by = (SELECT auth.uid()) OR (SELECT public.is_super_admin()));

CREATE POLICY tests_delete_own_or_admin
  ON public.tests FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR (SELECT public.is_super_admin()));

-- -----------------------------------------------------------------------------
-- public_profiles: add city (student's own reported city, see
-- 20260923000001_faculties_and_city.sql) so match-percentage scoring
-- (institution / study_year / department / faculty / city) can read it for
-- classmates, not just the caller's own profile.
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
         p.city
    FROM public.profiles p
   WHERE auth.uid() IS NOT NULL
     AND (
       p.id = auth.uid()
       OR public.is_super_admin()
       OR public.shares_course_with(p.id)
       OR public.shares_room_with(p.id)
     );

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profiles TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- count_active_rooms_by_course — the catalog page's "N active rooms" badge.
-- rooms_select_member_or_admin restricts SELECT on public.rooms to a room's
-- own members, so a plain query cannot count rooms a browsing student hasn't
-- joined yet. This RPC exposes only an aggregate count (never room identity,
-- topic or membership) for a set of courses, which is no more sensitive than
-- the already-public courses catalog itself.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_active_rooms_by_course(p_course_ids uuid[])
RETURNS TABLE (course_id uuid, room_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.course_id, count(*) AS room_count
    FROM public.rooms r
   WHERE r.course_id = ANY (p_course_ids)
     AND r.status = 'active'
   GROUP BY r.course_id;
$$;

REVOKE ALL ON FUNCTION public.count_active_rooms_by_course(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_active_rooms_by_course(uuid[]) TO authenticated, service_role;
