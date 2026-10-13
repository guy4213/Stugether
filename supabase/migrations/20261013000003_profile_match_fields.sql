-- =============================================================================
-- 20261013000003_profile_match_fields.sql
-- Change Request (13.10.2026, approved by the client): a student directory
-- ("סטודנטים") and a match percentage between students.
--   1. profiles: study track, current semester and hobbies — inputs of the
--      match score and shown on a student's profile.
--   2. public_profiles: every active student is visible to every signed-in
--      user (was: only course-mates / roommates). Super admins are not listed.
--      bio, role and is_active stay private.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN track    text     CHECK (track IN ('day', 'evening', 'mixed', 'online')),
  ADD COLUMN semester smallint CHECK (semester BETWEEN 1 AND 3),
  ADD COLUMN hobbies  text[]   NOT NULL DEFAULT '{}'
    CHECK (cardinality(hobbies) <= 8);

-- New columns go last: CREATE OR REPLACE VIEW can only append.
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
         p.hobbies
    FROM public.profiles p
   WHERE auth.uid() IS NOT NULL
     AND (
       p.id = auth.uid()
       OR public.is_super_admin()
       OR (p.is_active AND p.role = 'student')
     );

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profiles TO authenticated, service_role;
