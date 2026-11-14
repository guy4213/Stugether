-- =============================================================================
-- Super Admin: show each user's email in the "משתמשים" list (CR 14.11.2026,
-- SPEC §4.9) — telling apart users with near-identical names.
--
-- admin_user_emails(p_user_ids) returns (user_id, email) for the given ids.
-- The admin has no access to auth.users otherwise; SECURITY DEFINER and the
-- function checks is_super_admin() itself. Email only — nothing else from
-- auth.users. At most 2000 ids per call.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_user_emails(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.require_active_caller();
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.cardinality(p_user_ids) > 2000 THEN
    RAISE EXCEPTION 'TOO_MANY_IDS' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
    SELECT u.id, u.email::text
      FROM auth.users u
     WHERE u.id = ANY (p_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_emails(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(uuid[]) TO authenticated;
