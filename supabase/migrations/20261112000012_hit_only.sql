-- =============================================================================
-- H.I.T only (client QA 12.11.2026, Change Request)
-- =============================================================================
-- "בתור התחלה בכל האתר שם המוסד היחידי שצריך להיות זה H.I.T": the launch is
-- for one institution. Every other catalog institution is deactivated (not
-- deleted — their catalogs stay for later), and H.IT is shown as "H.I.T".
--
-- listInstitutions() lists active institutions only, so the signup wizard
-- skips the institution question when one is left, and the student filters
-- hide the institution select. complete_onboarding already rejects inactive
-- institutions. Students already registered elsewhere keep their profile.
--
-- Migrations before this one join on the literal 'H.IT'; new ones must use
-- 'H.I.T'. (The local seed's sample institution is test data and stays.)

UPDATE public.institutions
   SET is_active = false
 WHERE name <> 'H.IT'
   -- supabase/seed.sql's sample institution (local test data only).
   AND id <> '00000000-0000-0000-0001-000000000001';

UPDATE public.institutions
   SET name = 'H.I.T'
 WHERE name = 'H.IT';
