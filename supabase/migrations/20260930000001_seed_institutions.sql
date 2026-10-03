-- =============================================================================
-- 20260930000001_seed_institutions.sql
-- Production catalog bootstrap. supabase/seed.sql only runs locally, so a fresh
-- production project has no institutions: the profile's institution dropdown is
-- empty and dashboard redirects every new student back to /profile?welcome=1
-- (SPEC §4.1 — no institution = onboarding not finished).
--
-- Idempotent: institutions has no UNIQUE(name), so guard with NOT EXISTS.
-- Faculties/departments/courses are managed through the admin catalog panel.
-- =============================================================================
INSERT INTO public.institutions (name, city, is_active)
SELECT v.name, v.city, true
FROM (VALUES
  ('H.IT', NULL),
  ('מכללת אפקה', NULL),
  ('האוניברסיטה העברית', 'ירושלים'),
  ('אוניברסיטת בן־גוריון', 'באר שבע'),
  ('פסטדו', NULL)
) AS v (name, city)
WHERE NOT EXISTS (
  SELECT 1 FROM public.institutions i WHERE i.name = v.name
);
