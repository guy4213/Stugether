-- =============================================================================
-- "חדרים פעילים עכשיו" (client QA 12.11.2026)
-- =============================================================================
-- A room used to count as "live" only for 30 minutes after its last message
-- (or its creation), so freshly opened rooms with nobody typing yet dropped
-- out of the "פעילים עכשיו" filter. A room is now also live while one of its
-- members is online (profiles.last_seen_at within 5 minutes, the app's
-- presence heartbeat window).
--
-- list_open_rooms gains two columns: online_members (active members seen in
-- the last 5 minutes, the caller excluded) and creator_avatar (the card
-- showed the creator without a photo). The return type changes, so the
-- function is dropped and re-created; grants are re-applied.

DROP FUNCTION IF EXISTS public.list_open_rooms(uuid[]);

CREATE FUNCTION public.list_open_rooms(p_course_ids uuid[])
RETURNS TABLE (
  room_id         uuid,
  course_id       uuid,
  name            text,
  topic           text,
  created_by      uuid,
  creator_name    text,
  member_count    bigint,
  is_member       boolean,
  last_message_at timestamptz,
  created_at      timestamptz,
  creator_avatar  text,
  online_members  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.id,
         r.course_id,
         r.name,
         r.topic,
         r.created_by,
         p.full_name,
         (SELECT pg_catalog.count(*) FROM public.room_members rm
           WHERE rm.room_id = r.id AND rm.left_at IS NULL),
         EXISTS (SELECT 1 FROM public.room_members rm
                  WHERE rm.room_id = r.id AND rm.user_id = auth.uid() AND rm.left_at IS NULL),
         r.last_message_at,
         r.created_at,
         p.avatar_url,
         (SELECT pg_catalog.count(*)
            FROM public.room_members rm
            JOIN public.profiles mp ON mp.id = rm.user_id
           WHERE rm.room_id = r.id
             AND rm.left_at IS NULL
             AND rm.user_id IS DISTINCT FROM auth.uid()
             AND mp.last_seen_at > now() - interval '5 minutes')
    FROM public.rooms r
    JOIN public.profiles p ON p.id = r.created_by
   WHERE r.course_id = ANY (p_course_ids)
     AND r.is_open
     AND r.status = 'active'
     AND public.is_enrolled_in_course(r.course_id)
   ORDER BY COALESCE(r.last_message_at, r.created_at) DESC;
$$;

REVOKE ALL ON FUNCTION public.list_open_rooms(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_open_rooms(uuid[]) TO authenticated;
