-- =============================================================================
-- 20261003000001_course_catalog_counts.sql
-- One aggregate per institution for the catalog and the dashboard's course
-- recommendations: active students + active rooms for each active course.
-- count_active_students_by_course / count_active_rooms_by_course take course
-- ids, so callers had to fetch the course list first and then count — a
-- second sequential round trip on every page view. Keyed by institution, this
-- runs in parallel with the course list itself.
--
-- Exposes the same aggregates as those two RPCs (counts only — never who is
-- enrolled or which rooms exist), with the same filters.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.course_catalog_counts(p_institution_id uuid)
RETURNS TABLE (course_id uuid, student_count bigint, room_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id AS course_id,
         (SELECT count(*)
            FROM public.enrollments e
            JOIN public.profiles p ON p.id = e.user_id
           WHERE e.course_id = c.id
             AND e.status = 'active'
             AND p.is_active) AS student_count,
         (SELECT count(*)
            FROM public.rooms r
           WHERE r.course_id = c.id
             AND r.status = 'active') AS room_count
    FROM public.courses c
   WHERE c.institution_id = p_institution_id
     AND c.is_active;
$$;

REVOKE ALL ON FUNCTION public.course_catalog_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.course_catalog_counts(uuid) TO authenticated, service_role;
