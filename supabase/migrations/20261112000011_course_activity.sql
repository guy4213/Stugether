-- =============================================================================
-- "כל הפעילות האחרונה" (client QA 12.11.2026, Change Request)
-- =============================================================================
-- The dashboard's "פעילות אחרונה" linked to /notifications, which are personal.
-- The client wants the activity around me: what happened in my courses. This
-- feed is METADATA ONLY — who did what, in which course / room, when; never
-- message content.
--
-- list_course_activity(p_limit, p_before) — newest first, keyset on `at`:
--   room_opened        an open room was opened in one of my active courses
--   session_scheduled  a study session was scheduled in a room I'm in
--   course_joined      a student enrolled in one of my active courses
--   friend_added       a friendship of mine was accepted
--   invited            I was invited to a room / I invited someone
-- Rows involving deactivated profiles are left out.

CREATE OR REPLACE FUNCTION public.list_course_activity(
  p_limit  integer DEFAULT 30,
  p_before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  kind         text,
  at           timestamptz,
  actor_id     uuid,
  actor_name   text,
  actor_avatar text,
  target_id    uuid,
  target_name  text,
  course_id    uuid,
  course_name  text,
  room_id      uuid,
  room_name    text,
  room_is_open boolean,
  room_members bigint,
  i_am_member  boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH me AS (
    SELECT auth.uid() AS id
  ),
  my_courses AS (
    SELECT e.course_id FROM public.enrollments e, me
     WHERE e.user_id = me.id AND e.status = 'active'
  ),
  my_rooms AS (
    SELECT rm.room_id FROM public.room_members rm, me
     WHERE rm.user_id = me.id AND rm.left_at IS NULL
  ),
  events AS (
    -- Open rooms opened in my courses.
    SELECT 'room_opened'::text AS kind, r.created_at AS at, r.created_by AS actor_id,
           NULL::uuid AS target_id, r.course_id, r.id AS room_id
      FROM public.rooms r
     WHERE r.is_open AND r.status = 'active'
       AND r.course_id IN (SELECT course_id FROM my_courses)
    UNION ALL
    -- Sessions scheduled in my rooms.
    SELECT 'session_scheduled', s.created_at, s.proposed_by, NULL, r.course_id, r.id
      FROM public.room_sessions s
      JOIN public.rooms r ON r.id = s.room_id
     WHERE s.status = 'scheduled'
       AND s.room_id IN (SELECT room_id FROM my_rooms)
    UNION ALL
    -- Classmates who joined my courses (not me).
    SELECT 'course_joined', e.created_at, e.user_id, NULL, e.course_id, NULL
      FROM public.enrollments e, me
     WHERE e.status = 'active' AND e.user_id <> me.id
       AND e.course_id IN (SELECT course_id FROM my_courses)
    UNION ALL
    -- My new friends.
    SELECT 'friend_added', f.responded_at,
           CASE WHEN f.requester_id = me.id THEN f.addressee_id ELSE f.requester_id END,
           NULL, NULL, NULL
      FROM public.friendships f, me
     WHERE f.status = 'accepted' AND f.responded_at IS NOT NULL
       AND me.id IN (f.requester_id, f.addressee_id)
    UNION ALL
    -- Invitations to me, and the ones I sent.
    SELECT 'invited', i.created_at, i.inviter_id, i.invitee_user_id, r.course_id, r.id
      FROM public.room_invitations i
      JOIN public.rooms r ON r.id = i.room_id, me
     WHERE me.id IN (i.inviter_id, i.invitee_user_id)
  )
  SELECT ev.kind,
         ev.at,
         ev.actor_id,
         a.full_name,
         a.avatar_url,
         ev.target_id,
         t.full_name,
         ev.course_id,
         c.name,
         ev.room_id,
         r.name,
         r.is_open,
         (SELECT pg_catalog.count(*) FROM public.room_members rm
           WHERE rm.room_id = ev.room_id AND rm.left_at IS NULL),
         ev.room_id IN (SELECT room_id FROM my_rooms)
    FROM events ev
    JOIN public.profiles a ON a.id = ev.actor_id AND a.is_active
    LEFT JOIN public.profiles t ON t.id = ev.target_id
    LEFT JOIN public.courses c ON c.id = ev.course_id
    LEFT JOIN public.rooms r ON r.id = ev.room_id
   WHERE auth.uid() IS NOT NULL
     AND ev.at IS NOT NULL
     AND (p_before IS NULL OR ev.at < p_before)
   ORDER BY ev.at DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.list_course_activity(integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_course_activity(integer, timestamptz) TO authenticated;
