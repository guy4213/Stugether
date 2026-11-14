-- =============================================================================
-- Super Admin: user details popup in "משתמשים" (CR 14.11.2026, SPEC §4.9)
--
-- admin_user_details(p_user_id) returns one user's account metadata for the
-- admin panel:
--   * profile basics, institution / department names;
--   * from auth.users: email, sign-up provider, last sign-in (the admin has no
--     access to auth.users otherwise);
--   * all-time activity COUNTS: room messages, private messages, AI runs /
--     failures / tokens, rooms created, accepted friends, last activity;
--   * enrollments (course name / code / status) and room memberships (room
--     name, status, role, joined / left) — the same metadata the rooms tab shows.
--
-- Privacy (SPEC §2): no message or DM content, and not WHO the user talks to
-- privately — only counts. Returns NULL for an unknown user.
-- SECURITY DEFINER for auth.users / messages / direct_messages; checks
-- is_super_admin() itself.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_user_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.require_active_caller();
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.jsonb_build_object(
           'id',              p.id,
           'full_name',       p.full_name,
           'avatar_url',      p.avatar_url,
           'bio',             p.bio,
           'city',            p.city,
           'study_year',      p.study_year,
           'role',            p.role,
           'is_active',       p.is_active,
           'onboarded_at',    p.onboarded_at,
           'created_at',      p.created_at,
           'last_seen_at',    p.last_seen_at,
           'institution',     i.name,
           'department',      d.name,
           'email',           u.email,
           'provider',        u.raw_app_meta_data ->> 'provider',
           'last_sign_in_at', u.last_sign_in_at,
           'stats', pg_catalog.jsonb_build_object(
             'room_messages', (SELECT pg_catalog.count(*) FROM public.messages m
                                WHERE m.sender_id = p.id AND m.sender_type = 'user'
                                  AND m.deleted_at IS NULL),
             'direct_messages', (SELECT pg_catalog.count(*) FROM public.direct_messages dm
                                  WHERE dm.sender_id = p.id AND dm.deleted_at IS NULL),
             'ai_runs',   (SELECT pg_catalog.count(*) FROM public.ai_runs a
                            WHERE a.requested_by = p.id),
             'ai_failed', (SELECT pg_catalog.count(*) FROM public.ai_runs a
                            WHERE a.requested_by = p.id AND a.status = 'failed'),
             'prompt_tokens', (SELECT COALESCE(pg_catalog.sum(a.prompt_tokens), 0)
                                FROM public.ai_runs a WHERE a.requested_by = p.id),
             'completion_tokens', (SELECT COALESCE(pg_catalog.sum(a.completion_tokens), 0)
                                    FROM public.ai_runs a WHERE a.requested_by = p.id),
             'rooms_created', (SELECT pg_catalog.count(*) FROM public.rooms r
                                WHERE r.created_by = p.id),
             'friends', (SELECT pg_catalog.count(*) FROM public.friendships f
                          WHERE f.status = 'accepted'
                            AND (f.requester_id = p.id OR f.addressee_id = p.id)),
             'last_activity_at', (SELECT pg_catalog.max(t) FROM (
                 SELECT pg_catalog.max(m.created_at) AS t FROM public.messages m
                  WHERE m.sender_id = p.id AND m.sender_type = 'user'
                 UNION ALL
                 SELECT pg_catalog.max(dm.created_at) FROM public.direct_messages dm
                  WHERE dm.sender_id = p.id
                 UNION ALL
                 SELECT pg_catalog.max(a.created_at) FROM public.ai_runs a
                  WHERE a.requested_by = p.id
               ) acts)
           ),
           'courses', COALESCE((
             SELECT pg_catalog.jsonb_agg(
                      pg_catalog.jsonb_build_object(
                        'id', c.id, 'name', c.name, 'code', c.code,
                        'status', e.status, 'enrolled_at', e.created_at
                      ) ORDER BY e.status, c.name)
               FROM public.enrollments e
               JOIN public.courses c ON c.id = e.course_id
              WHERE e.user_id = p.id
           ), '[]'::jsonb),
           'rooms', COALESCE((
             SELECT pg_catalog.jsonb_agg(
                      pg_catalog.jsonb_build_object(
                        'id', r.id, 'name', r.name, 'status', r.status,
                        'course', c.name, 'role', rm.role,
                        'joined_at', rm.joined_at, 'left_at', rm.left_at
                      ) ORDER BY rm.left_at IS NOT NULL, rm.joined_at DESC)
               FROM public.room_members rm
               JOIN public.rooms r   ON r.id = rm.room_id
               JOIN public.courses c ON c.id = r.course_id
              WHERE rm.user_id = p.id
           ), '[]'::jsonb)
         )
    INTO v_result
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.institutions i ON i.id = p.institution_id
    LEFT JOIN public.departments d  ON d.id = p.department_id
   WHERE p.id = p_user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_details(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_details(uuid) TO authenticated;
