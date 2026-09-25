-- =============================================================================
-- 20260924000001_course_student_counts.sql
-- Catalog cards show "N students" per course (courses mockup). The
-- enrollments_select_own_admin_or_same_course policy only exposes rosters of
-- courses the caller is enrolled in, so a browsing student can't count other
-- courses' enrollments directly. Like count_active_rooms_by_course, this
-- exposes an aggregate only — never who is enrolled.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.count_active_students_by_course(p_course_ids uuid[])
RETURNS TABLE (course_id uuid, student_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT e.course_id, count(*) AS student_count
    FROM public.enrollments e
    JOIN public.profiles p ON p.id = e.user_id
   WHERE e.course_id = ANY (p_course_ids)
     AND e.status = 'active'
     AND p.is_active
   GROUP BY e.course_id;
$$;

REVOKE ALL ON FUNCTION public.count_active_students_by_course(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_active_students_by_course(uuid[]) TO authenticated, service_role;
