-- =============================================================================
-- 20260923000001_faculties_and_city.sql
-- Adds a faculty tier between institution and department (institution ->
-- faculty -> department), and a student-reported city on profiles.
--
-- Unlike 20260913000001/000003, this migration is self-contained: table DDL,
-- indexes and RLS (ENABLE + FORCE) + policies all live here, since prior
-- migrations are already applied and immutable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- faculties: mirrors public.departments exactly.
-- -----------------------------------------------------------------------------
CREATE TABLE public.faculties (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid        NOT NULL REFERENCES public.institutions (id) ON DELETE RESTRICT,
  name           text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT faculties_institution_id_name_key UNIQUE (institution_id, name)
);

CREATE INDEX faculties_institution_id_idx ON public.faculties (institution_id);

-- New tier: institution -> faculty -> department. Nullable: existing/legacy
-- departments (incl. seed data) predate faculties and are not forced to
-- backfill immediately.
ALTER TABLE public.departments
  ADD COLUMN faculty_id uuid REFERENCES public.faculties (id) ON DELETE SET NULL;

CREATE INDEX departments_faculty_id_idx ON public.departments (faculty_id);

-- Student's own reported city (independent of institutions.city — a student
-- may live in a different city than their institution). Free text validated
-- against a curated list in the app layer (lib/constants/cities.ts), not a
-- DB enum, so the list can grow without a migration.
ALTER TABLE public.profiles
  ADD COLUMN city text CHECK (city IS NULL OR char_length(city) <= 100);

-- -----------------------------------------------------------------------------
-- RLS: ENABLE + FORCE on faculties, same shape as departments (migration
-- 20260913000003 §2-3). public.is_super_admin() already exists.
-- -----------------------------------------------------------------------------
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties FORCE  ROW LEVEL SECURITY;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.faculties FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.faculties FROM anon;

CREATE POLICY faculties_select_anon
  ON public.faculties FOR SELECT TO anon
  USING (is_active);

CREATE POLICY faculties_select_authenticated
  ON public.faculties FOR SELECT TO authenticated
  USING (is_active OR (SELECT public.is_super_admin()));

CREATE POLICY faculties_insert_super_admin
  ON public.faculties FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

CREATE POLICY faculties_update_super_admin
  ON public.faculties FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

CREATE POLICY faculties_delete_super_admin
  ON public.faculties FOR DELETE TO authenticated
  USING ((SELECT public.is_super_admin()));
