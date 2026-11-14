-- =============================================================================
-- Change Request (11.11.2026): Super Admin "שימוש" (usage) area — SPEC §4.9.
--
-- admin_usage_stats(p_days) returns, for the last p_days calendar days
-- (Asia/Jerusalem), COUNTS ONLY:
--   * daily[]        signups, active users, room messages, direct messages,
--                    rooms created, AI runs / failures / tokens per day;
--   * totals         the same over the whole period (active users = distinct
--                    over the period, not a sum of the days);
--   * top_courses[]  the 10 courses with the most activity;
--   * top_users[]    the 10 most active users (messages + DMs + AI runs);
--   * top_ai_users[] the 10 heaviest AI consumers by tokens.
--
-- Privacy (SPEC §2): no message or DM content is ever read or returned — only
-- row counts, timestamps, ids and names. Deleted messages are not counted.
-- "Active user" = sent a room message, sent a DM or asked the AI that day.
--
-- SECURITY DEFINER because messages / direct_messages have no super_admin
-- SELECT policy (the admin can never read them directly); the function checks
-- is_super_admin() itself, like admin_global_stats().
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_usage_stats(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tz       constant text := 'Asia/Jerusalem';
  v_days     int := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
  v_first    date;
  v_since    timestamptz;
  v_daily    jsonb;
  v_active   bigint;
  v_courses  jsonb;
  v_users    jsonb;
  v_ai_users jsonb;
BEGIN
  PERFORM public.require_active_caller();
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  v_first := (pg_catalog.now() AT TIME ZONE v_tz)::date - (v_days - 1);
  v_since := v_first::timestamp AT TIME ZONE v_tz;

  -- Per-day series (every day present, zero-filled).
  WITH days AS (
    SELECT gs::date AS day
      FROM pg_catalog.generate_series(
             v_first::timestamp, (v_first + (v_days - 1))::timestamp, interval '1 day'
           ) AS gs
  ),
  msg AS (
    SELECT (m.created_at AT TIME ZONE v_tz)::date AS day, m.sender_id AS uid
      FROM public.messages m
     WHERE m.created_at >= v_since AND m.sender_type = 'user' AND m.deleted_at IS NULL
  ),
  dm AS (
    SELECT (d.created_at AT TIME ZONE v_tz)::date AS day, d.sender_id AS uid
      FROM public.direct_messages d
     WHERE d.created_at >= v_since AND d.deleted_at IS NULL
  ),
  ai AS (
    SELECT (a.created_at AT TIME ZONE v_tz)::date AS day, a.requested_by AS uid,
           a.status, a.prompt_tokens, a.completion_tokens
      FROM public.ai_runs a
     WHERE a.created_at >= v_since
  ),
  actors AS (
    SELECT day, uid FROM msg
    UNION SELECT day, uid FROM dm
    UNION SELECT day, uid FROM ai
  ),
  signups AS (
    SELECT (p.created_at AT TIME ZONE v_tz)::date AS day, pg_catalog.count(*) AS n
      FROM public.profiles p
     WHERE p.created_at >= v_since
     GROUP BY 1
  ),
  rooms_new AS (
    SELECT (r.created_at AT TIME ZONE v_tz)::date AS day, pg_catalog.count(*) AS n
      FROM public.rooms r
     WHERE r.created_at >= v_since
     GROUP BY 1
  ),
  msg_d AS (SELECT day, pg_catalog.count(*) AS n FROM msg GROUP BY day),
  dm_d  AS (SELECT day, pg_catalog.count(*) AS n FROM dm GROUP BY day),
  act_d AS (SELECT day, pg_catalog.count(DISTINCT uid) AS n FROM actors GROUP BY day),
  ai_d  AS (
    SELECT day,
           pg_catalog.count(*) AS runs,
           pg_catalog.count(*) FILTER (WHERE status = 'failed') AS failed,
           COALESCE(pg_catalog.sum(prompt_tokens), 0) AS prompt_tokens,
           COALESCE(pg_catalog.sum(completion_tokens), 0) AS completion_tokens
      FROM ai
     GROUP BY day
  )
  SELECT pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'day',               days.day,
             'signups',           COALESCE(signups.n, 0),
             'active_users',      COALESCE(act_d.n, 0),
             'room_messages',     COALESCE(msg_d.n, 0),
             'direct_messages',   COALESCE(dm_d.n, 0),
             'rooms_created',     COALESCE(rooms_new.n, 0),
             'ai_runs',           COALESCE(ai_d.runs, 0),
             'ai_failed',         COALESCE(ai_d.failed, 0),
             'prompt_tokens',     COALESCE(ai_d.prompt_tokens, 0),
             'completion_tokens', COALESCE(ai_d.completion_tokens, 0)
           ) ORDER BY days.day
         )
    INTO v_daily
    FROM days
    LEFT JOIN signups   ON signups.day = days.day
    LEFT JOIN rooms_new ON rooms_new.day = days.day
    LEFT JOIN msg_d     ON msg_d.day = days.day
    LEFT JOIN dm_d      ON dm_d.day = days.day
    LEFT JOIN act_d     ON act_d.day = days.day
    LEFT JOIN ai_d      ON ai_d.day = days.day;

  -- Distinct active users over the whole period.
  SELECT pg_catalog.count(DISTINCT uid)
    INTO v_active
    FROM (
      SELECT m.sender_id AS uid FROM public.messages m
       WHERE m.created_at >= v_since AND m.sender_type = 'user' AND m.deleted_at IS NULL
      UNION
      SELECT d.sender_id FROM public.direct_messages d
       WHERE d.created_at >= v_since AND d.deleted_at IS NULL
      UNION
      SELECT a.requested_by FROM public.ai_runs a WHERE a.created_at >= v_since
    ) u;

  -- Top courses by activity in the period.
  WITH cm AS (
    SELECT r.course_id,
           pg_catalog.count(*) AS messages,
           pg_catalog.count(DISTINCT m.room_id) AS active_rooms
      FROM public.messages m
      JOIN public.rooms r ON r.id = m.room_id
     WHERE m.created_at >= v_since AND m.sender_type = 'user' AND m.deleted_at IS NULL
     GROUP BY r.course_id
  ),
  ca AS (
    SELECT r.course_id,
           pg_catalog.count(*) AS ai_runs,
           COALESCE(pg_catalog.sum(a.prompt_tokens), 0) AS prompt_tokens,
           COALESCE(pg_catalog.sum(a.completion_tokens), 0) AS completion_tokens
      FROM public.ai_runs a
      JOIN public.rooms r ON r.id = a.room_id
     WHERE a.created_at >= v_since
     GROUP BY r.course_id
  ),
  cr AS (
    SELECT r.course_id, pg_catalog.count(*) AS rooms_created
      FROM public.rooms r
     WHERE r.created_at >= v_since
     GROUP BY r.course_id
  ),
  ranked AS (
    SELECT c.id, c.name, c.code,
           COALESCE(cr.rooms_created, 0) AS rooms_created,
           COALESCE(cm.active_rooms, 0)  AS active_rooms,
           COALESCE(cm.messages, 0)      AS messages,
           COALESCE(ca.ai_runs, 0)       AS ai_runs,
           COALESCE(ca.prompt_tokens, 0) AS prompt_tokens,
           COALESCE(ca.completion_tokens, 0) AS completion_tokens
      FROM public.courses c
      LEFT JOIN cm ON cm.course_id = c.id
      LEFT JOIN ca ON ca.course_id = c.id
      LEFT JOIN cr ON cr.course_id = c.id
     WHERE cm.course_id IS NOT NULL OR ca.course_id IS NOT NULL OR cr.course_id IS NOT NULL
     ORDER BY COALESCE(cm.messages, 0) + COALESCE(ca.ai_runs, 0) + COALESCE(cr.rooms_created, 0) DESC,
              c.name
     LIMIT 10
  )
  SELECT COALESCE(
           pg_catalog.jsonb_agg(pg_catalog.to_jsonb(ranked) ORDER BY ranked.messages + ranked.ai_runs + ranked.rooms_created DESC, ranked.name),
           '[]'::jsonb
         )
    INTO v_courses
    FROM ranked;

  -- Most active users (room messages + DMs + AI runs) in the period.
  WITH um AS (
    SELECT m.sender_id AS uid, pg_catalog.count(*) AS n
      FROM public.messages m
     WHERE m.created_at >= v_since AND m.sender_type = 'user' AND m.deleted_at IS NULL
     GROUP BY 1
  ),
  ud AS (
    SELECT d.sender_id AS uid, pg_catalog.count(*) AS n
      FROM public.direct_messages d
     WHERE d.created_at >= v_since AND d.deleted_at IS NULL
     GROUP BY 1
  ),
  ua AS (
    SELECT a.requested_by AS uid,
           pg_catalog.count(*) AS runs,
           COALESCE(pg_catalog.sum(a.prompt_tokens), 0) AS prompt_tokens,
           COALESCE(pg_catalog.sum(a.completion_tokens), 0) AS completion_tokens
      FROM public.ai_runs a
     WHERE a.created_at >= v_since
     GROUP BY 1
  ),
  ranked AS (
    SELECT p.id, p.full_name,
           COALESCE(um.n, 0)    AS room_messages,
           COALESCE(ud.n, 0)    AS direct_messages,
           COALESCE(ua.runs, 0) AS ai_runs,
           COALESCE(ua.prompt_tokens, 0)     AS prompt_tokens,
           COALESCE(ua.completion_tokens, 0) AS completion_tokens
      FROM public.profiles p
      LEFT JOIN um ON um.uid = p.id
      LEFT JOIN ud ON ud.uid = p.id
      LEFT JOIN ua ON ua.uid = p.id
     WHERE um.uid IS NOT NULL OR ud.uid IS NOT NULL OR ua.uid IS NOT NULL
     ORDER BY COALESCE(um.n, 0) + COALESCE(ud.n, 0) + COALESCE(ua.runs, 0) DESC, p.full_name
     LIMIT 10
  )
  SELECT COALESCE(
           pg_catalog.jsonb_agg(pg_catalog.to_jsonb(ranked) ORDER BY ranked.room_messages + ranked.direct_messages + ranked.ai_runs DESC, ranked.full_name),
           '[]'::jsonb
         )
    INTO v_users
    FROM ranked;

  -- Heaviest AI consumers by tokens in the period.
  WITH ranked AS (
    SELECT p.id, p.full_name,
           pg_catalog.count(*) AS ai_runs,
           pg_catalog.count(*) FILTER (WHERE a.status = 'failed') AS ai_failed,
           COALESCE(pg_catalog.sum(a.prompt_tokens), 0)     AS prompt_tokens,
           COALESCE(pg_catalog.sum(a.completion_tokens), 0) AS completion_tokens
      FROM public.ai_runs a
      JOIN public.profiles p ON p.id = a.requested_by
     WHERE a.created_at >= v_since
     GROUP BY p.id, p.full_name
     ORDER BY COALESCE(pg_catalog.sum(a.prompt_tokens), 0)
              + COALESCE(pg_catalog.sum(a.completion_tokens), 0) DESC,
              pg_catalog.count(*) DESC, p.full_name
     LIMIT 10
  )
  SELECT COALESCE(
           pg_catalog.jsonb_agg(pg_catalog.to_jsonb(ranked) ORDER BY ranked.prompt_tokens + ranked.completion_tokens DESC, ranked.ai_runs DESC, ranked.full_name),
           '[]'::jsonb
         )
    INTO v_ai_users
    FROM ranked;

  RETURN pg_catalog.jsonb_build_object(
    'days',         v_days,
    'since',        v_since,
    'daily',        COALESCE(v_daily, '[]'::jsonb),
    'active_users', v_active,
    'top_courses',  v_courses,
    'top_users',    v_users,
    'top_ai_users', v_ai_users
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_usage_stats(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_usage_stats(int) TO authenticated;
