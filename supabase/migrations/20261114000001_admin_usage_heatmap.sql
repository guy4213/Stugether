-- =============================================================================
-- Super Admin "שימוש": when do students study? (CR 14.11.2026, SPEC §4.9)
--
-- admin_usage_heatmap(p_days) counts actions in the last p_days calendar days
-- (Asia/Jerusalem) per weekday x hour: room messages sent by users, direct
-- messages and AI runs. Returns only non-empty cells as
--   [{ "dow": 0-6 (0 = Sunday), "hour": 0-23, "n": count }, ...]
--
-- Privacy (SPEC §2): counts only — no content, no user ids. Deleted messages
-- are not counted (same rules as admin_usage_stats). SECURITY DEFINER because
-- the admin has no SELECT on messages / direct_messages; the function checks
-- is_super_admin() itself.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_usage_heatmap(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tz     constant text := 'Asia/Jerusalem';
  v_days   int := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
  v_since  timestamptz;
  v_result jsonb;
BEGIN
  PERFORM public.require_active_caller();
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  v_since := (((pg_catalog.now() AT TIME ZONE v_tz)::date - (v_days - 1))::timestamp)
             AT TIME ZONE v_tz;

  WITH actions AS (
    SELECT m.created_at AT TIME ZONE v_tz AS local_ts
      FROM public.messages m
     WHERE m.created_at >= v_since AND m.sender_type = 'user' AND m.deleted_at IS NULL
    UNION ALL
    SELECT d.created_at AT TIME ZONE v_tz
      FROM public.direct_messages d
     WHERE d.created_at >= v_since AND d.deleted_at IS NULL
    UNION ALL
    SELECT a.created_at AT TIME ZONE v_tz
      FROM public.ai_runs a
     WHERE a.created_at >= v_since
  ),
  cells AS (
    SELECT pg_catalog.date_part('dow', local_ts)::int  AS dow,
           pg_catalog.date_part('hour', local_ts)::int AS hour,
           pg_catalog.count(*)                         AS n
      FROM actions
     GROUP BY 1, 2
  )
  SELECT COALESCE(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object('dow', cells.dow, 'hour', cells.hour, 'n', cells.n)
             ORDER BY cells.dow, cells.hour
           ),
           '[]'::jsonb
         )
    INTO v_result
    FROM cells;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_usage_heatmap(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_usage_heatmap(int) TO authenticated;
