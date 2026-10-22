-- =============================================================================
-- 20261021000001_qa_fixes.sql
-- Fixes from the QA pass on the 13.10.2026 changes (docs/QA-2026-10-13.md).
--   1. join_open_room is internal: calling it directly skipped the approval
--      for a room in session. request_room_join is the only entry point.
--   2. Join requests belong to the room's current owner (not rooms.created_by,
--      which stays after the creator leaves). Approval re-checks that the
--      requester is still active and enrolled. A declined requester waits 10
--      minutes before asking again. A room with no owner is joined directly.
--   3. A room that stops being active (archived / closed) cancels its pending
--      join requests and its open study sessions.
--   4. Study sessions: one open session per room (a scheduled one that has not
--      ended, or one proposal). Only the proposer or the owner replaces a
--      proposal. Owner instead of creator, RSVP / cancel only in an active
--      room, no votes on past times, NULL times are BAD_OPTIONS.
--   5. public_profiles: roommates stay visible (names in room history after a
--      deactivation, as before 20261013000003); `listed` marks who belongs in
--      the student directory (active students only, never super admins).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. join_open_room: internal only
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.join_open_room(uuid) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Helper: the caller is the room's active owner.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_room_owner(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members rm
     WHERE rm.room_id = p_room_id
       AND rm.user_id = (SELECT auth.uid())
       AND rm.role = 'owner'
       AND rm.left_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_room_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_room_owner(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Join requests: owner, eligibility, cooldown
-- -----------------------------------------------------------------------------
DROP POLICY room_join_requests_select_party ON public.room_join_requests;
CREATE POLICY room_join_requests_select_party
  ON public.room_join_requests FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_room_owner(room_id))
    OR (SELECT public.is_super_admin())
  );

CREATE OR REPLACE FUNCTION public.request_room_join(p_room_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid          uuid := public.require_active_caller();
  v_room         public.rooms%ROWTYPE;
  v_owner        uuid;
  v_active_count bigint;
  v_request_id   uuid;
  v_name         text;
BEGIN
  IF p_room_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_room FROM public.rooms r WHERE r.id = p_room_id FOR UPDATE;

  IF NOT FOUND OR NOT v_room.is_open OR NOT public.is_enrolled_in_course(v_room.course_id) THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_room.status <> 'active' THEN
    RAISE EXCEPTION 'ROOM_NOT_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.room_members rm
              WHERE rm.room_id = p_room_id AND rm.user_id = v_uid AND rm.left_at IS NULL) THEN
    RETURN 'joined';
  END IF;

  SELECT pg_catalog.count(*) INTO v_active_count
    FROM public.room_members rm WHERE rm.room_id = p_room_id AND rm.left_at IS NULL;
  IF v_active_count >= 4 THEN
    RAISE EXCEPTION 'ROOM_FULL' USING ERRCODE = 'P0001';
  END IF;

  SELECT rm.user_id INTO v_owner
    FROM public.room_members rm
   WHERE rm.room_id = p_room_id AND rm.role = 'owner' AND rm.left_at IS NULL;

  -- Quiet, or nobody to ask: join directly.
  IF NOT public.room_is_live(v_room) OR v_owner IS NULL THEN
    PERFORM public.join_open_room(p_room_id);
    RETURN 'joined';
  END IF;

  -- Already waiting: no second request or notification.
  IF EXISTS (SELECT 1 FROM public.room_join_requests q
              WHERE q.room_id = p_room_id AND q.user_id = v_uid AND q.status = 'pending') THEN
    RETURN 'requested';
  END IF;

  -- Just declined: no new request (and notification) for a while.
  IF EXISTS (SELECT 1 FROM public.room_join_requests q
              WHERE q.room_id = p_room_id AND q.user_id = v_uid AND q.status = 'declined'
                AND q.decided_at > pg_catalog.now() - interval '10 minutes') THEN
    RAISE EXCEPTION 'REQUEST_DECLINED_RECENTLY' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.room_join_requests (room_id, user_id)
  VALUES (p_room_id, v_uid)
  RETURNING id INTO v_request_id;

  SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id = v_uid;
  INSERT INTO public.notifications
    (user_id, type, actor_id, course_id, room_id, request_id, title, body)
  VALUES
    (v_owner, 'room_join_request', v_uid, v_room.course_id, p_room_id, v_request_id,
     'בקשת הצטרפות לחדר',
     pg_catalog.left(COALESCE(v_name, 'חבר/ת קורס') || ' מבקש/ת להצטרף לחדר „' || v_room.name || '”', 500));

  RETURN 'requested';
END;
$$;

REVOKE ALL ON FUNCTION public.request_room_join(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_room_join(uuid) TO authenticated;

-- The room's owner approves or declines. Returns 'approved' | 'declined', or
-- 'unavailable' when the requester is no longer active / enrolled (the
-- request is then cancelled).
CREATE OR REPLACE FUNCTION public.decide_room_join_request(p_request_id uuid, p_approve boolean)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid          uuid := public.require_active_caller();
  v_req          public.room_join_requests%ROWTYPE;
  v_room         public.rooms%ROWTYPE;
  v_active_count bigint;
BEGIN
  IF p_request_id IS NULL OR p_approve IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  SELECT q.* INTO v_req FROM public.room_join_requests q WHERE q.id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_room FROM public.rooms r WHERE r.id = v_req.room_id FOR UPDATE;
  IF NOT public.is_room_owner(v_room.id) OR v_req.user_id = v_uid THEN
    RAISE EXCEPTION 'NOT_ROOM_OWNER' USING ERRCODE = 'P0001';
  END IF;

  SELECT q.* INTO v_req FROM public.room_join_requests q WHERE q.id = p_request_id FOR UPDATE;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'REQUEST_NOT_PENDING' USING ERRCODE = 'P0001';
  END IF;

  IF p_approve THEN
    IF v_room.status <> 'active' THEN
      RAISE EXCEPTION 'ROOM_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;

    -- Same bar as joining: an active student, actively enrolled in the
    -- room's (active) course.
    IF NOT EXISTS (
      SELECT 1
        FROM public.profiles p
        JOIN public.enrollments e ON e.user_id = p.id
                                 AND e.course_id = v_room.course_id
                                 AND e.status = 'active'
        JOIN public.courses c     ON c.id = v_room.course_id AND c.is_active
       WHERE p.id = v_req.user_id AND p.is_active
    ) THEN
      UPDATE public.room_join_requests
         SET status = 'cancelled', decided_at = pg_catalog.now(), decided_by = v_uid
       WHERE id = p_request_id;
      DELETE FROM public.notifications
       WHERE request_id = p_request_id AND type = 'room_join_request';
      RETURN 'unavailable';
    END IF;

    SELECT pg_catalog.count(*) INTO v_active_count
      FROM public.room_members rm WHERE rm.room_id = v_room.id AND rm.left_at IS NULL;
    IF v_active_count >= 4 THEN
      RAISE EXCEPTION 'ROOM_FULL' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.room_members (room_id, user_id, role, joined_at, left_at, last_read_at)
    VALUES (v_room.id, v_req.user_id, 'member', pg_catalog.now(), NULL, pg_catalog.now())
    ON CONFLICT (room_id, user_id) DO UPDATE
      SET role = 'member', joined_at = pg_catalog.now(), left_at = NULL,
          last_read_at = pg_catalog.now();
  END IF;

  UPDATE public.room_join_requests
     SET status     = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
         decided_at = pg_catalog.now(),
         decided_by = v_uid
   WHERE id = p_request_id;

  -- The "request" notification is answered (also a previous owner's copy).
  UPDATE public.notifications
     SET read_at = COALESCE(read_at, pg_catalog.now())
   WHERE request_id = p_request_id AND type = 'room_join_request';

  INSERT INTO public.notifications (user_id, type, actor_id, course_id, room_id, request_id, title, body)
  VALUES
    (v_req.user_id, 'room_join_decided', v_uid, v_room.course_id, v_room.id, p_request_id,
     CASE WHEN p_approve THEN 'הבקשה שלך אושרה' ELSE 'הבקשה שלך נדחתה' END,
     pg_catalog.left(
       CASE WHEN p_approve THEN 'אפשר להיכנס לחדר „' || v_room.name || '”'
            ELSE 'יוצר/ת החדר „' || v_room.name || '” לא אישר/ה כרגע את ההצטרפות' END, 500));

  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'declined' END;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_room_join_request(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_room_join_request(uuid, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. A room leaving 'active' drops what was waiting on it
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rooms_release_on_read_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.notifications n
   WHERE n.type = 'room_join_request'
     AND n.request_id IN (SELECT q.id FROM public.room_join_requests q
                           WHERE q.room_id = NEW.id AND q.status = 'pending');
  UPDATE public.room_join_requests
     SET status = 'cancelled', decided_at = pg_catalog.now()
   WHERE room_id = NEW.id AND status = 'pending';

  DELETE FROM public.notifications n
   WHERE n.read_at IS NULL
     AND n.session_id IN (SELECT s.id FROM public.room_sessions s
                           WHERE s.room_id = NEW.id AND s.status <> 'cancelled');
  UPDATE public.room_sessions s
     SET status = 'cancelled'
   WHERE s.room_id = NEW.id
     AND (s.status = 'proposed'
          OR (s.status = 'scheduled'
              AND s.starts_at + s.duration_min * interval '1 minute' > pg_catalog.now()));
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.rooms_release_on_read_only() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rooms_release_on_read_only
  AFTER UPDATE OF status ON public.rooms
  FOR EACH ROW
  WHEN (OLD.status = 'active' AND NEW.status <> 'active')
  EXECUTE FUNCTION public.rooms_release_on_read_only();

-- -----------------------------------------------------------------------------
-- 4. Study sessions
-- -----------------------------------------------------------------------------

-- Propose 1-5 future times. A single time is scheduled right away. One open
-- session per room: refused while a scheduled one has not ended; an open
-- proposal is replaced only by its proposer or the owner (votes and unread
-- notifications go with it).
CREATE OR REPLACE FUNCTION public.propose_room_session(
  p_room_id uuid, p_options timestamptz[], p_duration_min integer, p_note text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     uuid := public.require_active_caller();
  v_session uuid;
  v_count   integer;
  v_room    text;
  v_open_by uuid;
BEGIN
  IF p_room_id IS NULL OR p_options IS NULL OR p_duration_min IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_post_in_room(p_room_id) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.count(DISTINCT t) INTO v_count FROM pg_catalog.unnest(p_options) t;
  IF v_count < 1 OR v_count > 5 OR pg_catalog.array_position(p_options, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'BAD_OPTIONS' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.unnest(p_options) t WHERE t <= pg_catalog.now()) THEN
    RAISE EXCEPTION 'OPTION_IN_PAST' USING ERRCODE = 'P0001';
  END IF;

  -- Serialize planning in this room.
  PERFORM 1 FROM public.rooms r WHERE r.id = p_room_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.room_sessions s
              WHERE s.room_id = p_room_id AND s.status = 'scheduled'
                AND s.starts_at + s.duration_min * interval '1 minute' > pg_catalog.now()) THEN
    RAISE EXCEPTION 'SESSION_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  -- A proposal whose times all passed is stale: anyone may replace it.
  SELECT s.proposed_by INTO v_open_by
    FROM public.room_sessions s
   WHERE s.room_id = p_room_id AND s.status = 'proposed'
     AND EXISTS (SELECT 1 FROM public.room_session_options o
                  WHERE o.session_id = s.id AND o.starts_at > pg_catalog.now())
   LIMIT 1;
  IF v_open_by IS NOT NULL AND v_open_by <> v_uid AND NOT public.is_room_owner(p_room_id) THEN
    RAISE EXCEPTION 'PROPOSAL_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.notifications n
   WHERE n.read_at IS NULL
     AND n.session_id IN (SELECT s.id FROM public.room_sessions s
                           WHERE s.room_id = p_room_id AND s.status = 'proposed');
  UPDATE public.room_sessions SET status = 'cancelled'
   WHERE room_id = p_room_id AND status = 'proposed';

  INSERT INTO public.room_sessions (room_id, proposed_by, status, starts_at, duration_min, note)
  VALUES (p_room_id, v_uid,
          CASE WHEN v_count = 1 THEN 'scheduled' ELSE 'proposed' END,
          CASE WHEN v_count = 1 THEN p_options[1] END,
          p_duration_min, NULLIF(pg_catalog.btrim(p_note), ''))
  RETURNING id INTO v_session;

  INSERT INTO public.room_session_options (session_id, starts_at)
  SELECT DISTINCT v_session, t FROM pg_catalog.unnest(p_options) t;

  -- The proposer can make every time they offered, and comes.
  INSERT INTO public.room_session_votes (option_id, user_id)
  SELECT o.id, v_uid FROM public.room_session_options o WHERE o.session_id = v_session;
  INSERT INTO public.room_session_rsvps (session_id, user_id, response)
  VALUES (v_session, v_uid, 'accepted');

  SELECT r.name INTO v_room FROM public.rooms r WHERE r.id = p_room_id;
  IF v_count = 1 THEN
    PERFORM public.notify_room_session(v_session, 'session_scheduled', v_uid,
      'נקבע מפגש לימוד', '„' || v_room || '” · ' || public.session_time_label(p_options[1]));
  ELSE
    PERFORM public.notify_room_session(v_session, 'session_proposed', v_uid,
      'הצעה למפגש לימוד נוסף', 'בחרו מועדים שמתאימים לכם בחדר „' || v_room || '”');
  END IF;

  RETURN v_session;
END;
$$;
REVOKE ALL ON FUNCTION public.propose_room_session(uuid, timestamptz[], integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.propose_room_session(uuid, timestamptz[], integer, text) TO authenticated;

-- Toggle my vote on a proposed time (not on a time that has passed).
CREATE OR REPLACE FUNCTION public.vote_room_session(p_option_id uuid, p_vote boolean)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    uuid := public.require_active_caller();
  v_room   uuid;
  v_status text;
  v_at     timestamptz;
BEGIN
  SELECT s.room_id, s.status, o.starts_at INTO v_room, v_status, v_at
    FROM public.room_session_options o JOIN public.room_sessions s ON s.id = o.session_id
   WHERE o.id = p_option_id;
  IF NOT FOUND OR NOT public.can_post_in_room(v_room) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'proposed' THEN
    RAISE EXCEPTION 'SESSION_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;
  IF p_vote THEN
    IF v_at <= pg_catalog.now() THEN
      RAISE EXCEPTION 'OPTION_IN_PAST' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.room_session_votes (option_id, user_id) VALUES (p_option_id, v_uid)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.room_session_votes WHERE option_id = p_option_id AND user_id = v_uid;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.vote_room_session(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vote_room_session(uuid, boolean) TO authenticated;

-- The proposer or the room's owner picks the final time. Everyone who voted
-- for it is counted as coming.
CREATE OR REPLACE FUNCTION public.schedule_room_session(p_option_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  uuid := public.require_active_caller();
  v_s    public.room_sessions%ROWTYPE;
  v_at   timestamptz;
  v_room text;
BEGIN
  SELECT o.starts_at INTO v_at FROM public.room_session_options o WHERE o.id = p_option_id;
  SELECT s.* INTO v_s FROM public.room_sessions s
    JOIN public.room_session_options o ON o.session_id = s.id
   WHERE o.id = p_option_id
     FOR UPDATE OF s;
  IF NOT FOUND OR NOT public.can_post_in_room(v_s.room_id) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  IF v_uid <> v_s.proposed_by AND NOT public.is_room_owner(v_s.room_id) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  IF v_s.status <> 'proposed' THEN
    RAISE EXCEPTION 'SESSION_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;
  IF v_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'OPTION_IN_PAST' USING ERRCODE = 'P0001';
  END IF;

  SELECT r.name INTO v_room FROM public.rooms r WHERE r.id = v_s.room_id;
  UPDATE public.room_sessions SET status = 'scheduled', starts_at = v_at WHERE id = v_s.id;
  INSERT INTO public.room_session_rsvps (session_id, user_id, response)
  SELECT v_s.id, v.user_id, 'accepted' FROM public.room_session_votes v WHERE v.option_id = p_option_id
  ON CONFLICT (session_id, user_id) DO NOTHING;

  PERFORM public.notify_room_session(v_s.id, 'session_scheduled', v_uid,
    'נקבע מפגש לימוד', '„' || v_room || '” · ' || public.session_time_label(v_at));
END;
$$;
REVOKE ALL ON FUNCTION public.schedule_room_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_room_session(uuid) TO authenticated;

-- Accept / decline a scheduled session (active rooms only).
CREATE OR REPLACE FUNCTION public.rsvp_room_session(p_session_id uuid, p_response text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := public.require_active_caller();
  v_s   public.room_sessions%ROWTYPE;
BEGIN
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_s FROM public.room_sessions s WHERE s.id = p_session_id;
  IF NOT FOUND OR NOT public.can_post_in_room(v_s.room_id) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  IF v_s.status <> 'scheduled' OR v_s.starts_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'SESSION_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.room_session_rsvps (session_id, user_id, response)
  VALUES (p_session_id, v_uid, p_response)
  ON CONFLICT (session_id, user_id) DO UPDATE
    SET response = EXCLUDED.response, updated_at = pg_catalog.now();
END;
$$;
REVOKE ALL ON FUNCTION public.rsvp_room_session(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rsvp_room_session(uuid, text) TO authenticated;

-- The proposer or the room's owner cancels (active rooms only; leaving
-- 'active' already cancels open sessions).
CREATE OR REPLACE FUNCTION public.cancel_room_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := public.require_active_caller();
  v_s   public.room_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_s FROM public.room_sessions s WHERE s.id = p_session_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_post_in_room(v_s.room_id)
     OR (v_uid <> v_s.proposed_by AND NOT public.is_room_owner(v_s.room_id)) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  IF v_s.status = 'cancelled' THEN
    RAISE EXCEPTION 'SESSION_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.room_sessions SET status = 'cancelled' WHERE id = p_session_id;
  DELETE FROM public.notifications WHERE session_id = p_session_id AND read_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_room_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_room_session(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. public_profiles: roommates visible again; `listed` for the directory
-- -----------------------------------------------------------------------------
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
         p.hobbies,
         (p.is_active AND p.role = 'student') AS listed
    FROM public.profiles p
   WHERE auth.uid() IS NOT NULL
     AND (
       p.id = auth.uid()
       OR public.is_super_admin()
       OR (p.is_active AND p.role = 'student')
       OR public.shares_room_with(p.id)
     );

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profiles TO authenticated, service_role;
