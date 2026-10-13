-- =============================================================================
-- 20261013000006_room_sessions.sql
-- Change Request (13.10.2026): plan a future study session with the same
-- group ("רוצים ללמוד שוב ביחד?").
--   A member proposes 1-5 times; members vote; the proposer or the room
--   creator picks the final time (one time = scheduled at once). Members then
--   accept or decline. Calendar export + reminder come from an .ics file with
--   an alarm (app/api/rooms/[id]/sessions/[sid]/ics) — no cron.
--   All writes are RPCs; members of the room read.
-- =============================================================================

CREATE TABLE public.room_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      uuid        NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  proposed_by  uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'proposed'
                           CHECK (status IN ('proposed', 'scheduled', 'cancelled')),
  starts_at    timestamptz,
  duration_min smallint    NOT NULL DEFAULT 60 CHECK (duration_min BETWEEN 15 AND 480),
  note         text        CHECK (note IS NULL OR char_length(note) <= 200),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'scheduled' OR starts_at IS NOT NULL)
);
CREATE INDEX room_sessions_room_idx ON public.room_sessions (room_id, status, starts_at);

CREATE TABLE public.room_session_options (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid        NOT NULL REFERENCES public.room_sessions (id) ON DELETE CASCADE,
  starts_at  timestamptz NOT NULL,
  UNIQUE (session_id, starts_at)
);

CREATE TABLE public.room_session_votes (
  option_id  uuid        NOT NULL REFERENCES public.room_session_options (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (option_id, user_id)
);

CREATE TABLE public.room_session_rsvps (
  session_id uuid        NOT NULL REFERENCES public.room_sessions (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  response   text        NOT NULL CHECK (response IN ('accepted', 'declined')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

ALTER TABLE public.room_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_sessions        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.room_session_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_session_options FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.room_session_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_session_votes   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.room_session_rsvps   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_session_rsvps   FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.room_sessions, public.room_session_options,
              public.room_session_votes, public.room_session_rsvps
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.room_sessions, public.room_session_options,
                public.room_session_votes, public.room_session_rsvps
  TO authenticated;

CREATE POLICY room_sessions_select_member ON public.room_sessions
  FOR SELECT TO authenticated USING (public.is_room_member(room_id));
CREATE POLICY room_session_options_select_member ON public.room_session_options
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.room_sessions s WHERE s.id = session_id AND public.is_room_member(s.room_id)));
CREATE POLICY room_session_votes_select_member ON public.room_session_votes
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.room_session_options o JOIN public.room_sessions s ON s.id = o.session_id
     WHERE o.id = option_id AND public.is_room_member(s.room_id)));
CREATE POLICY room_session_rsvps_select_member ON public.room_session_rsvps
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.room_sessions s WHERE s.id = session_id AND public.is_room_member(s.room_id)));

ALTER TABLE public.notifications
  ADD COLUMN session_id uuid REFERENCES public.room_sessions (id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- Internal: notify every active member but the actor.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_room_session(
  p_session_id uuid, p_type text, p_actor uuid, p_title text, p_body text)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.notifications (user_id, type, actor_id, course_id, room_id, session_id, title, body)
  SELECT rm.user_id, p_type, p_actor, r.course_id, r.id, p_session_id, p_title, pg_catalog.left(p_body, 500)
    FROM public.room_sessions s
    JOIN public.rooms r ON r.id = s.room_id
    JOIN public.room_members rm ON rm.room_id = r.id AND rm.left_at IS NULL
   WHERE s.id = p_session_id AND rm.user_id <> p_actor;
$$;
REVOKE ALL ON FUNCTION public.notify_room_session(uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- Israel-time label for notification bodies, e.g. "יום ג׳ 14.10 בשעה 18:00".
CREATE OR REPLACE FUNCTION public.session_time_label(p_at timestamptz)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.to_char(p_at AT TIME ZONE 'Asia/Jerusalem', 'DD.MM') || ' בשעה '
      || pg_catalog.to_char(p_at AT TIME ZONE 'Asia/Jerusalem', 'HH24:MI');
$$;

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------

-- Propose 1-5 future times. A single time is scheduled right away. A newer
-- proposal replaces an open one (still being voted on) in the same room.
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
BEGIN
  IF p_room_id IS NULL OR p_options IS NULL OR p_duration_min IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_post_in_room(p_room_id) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.count(DISTINCT t) INTO v_count FROM pg_catalog.unnest(p_options) t;
  IF v_count < 1 OR v_count > 5 THEN
    RAISE EXCEPTION 'BAD_OPTIONS' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.unnest(p_options) t WHERE t <= pg_catalog.now()) THEN
    RAISE EXCEPTION 'OPTION_IN_PAST' USING ERRCODE = 'P0001';
  END IF;

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

-- Toggle my vote on a proposed time.
CREATE OR REPLACE FUNCTION public.vote_room_session(p_option_id uuid, p_vote boolean)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  uuid := public.require_active_caller();
  v_room uuid;
  v_status text;
BEGIN
  SELECT s.room_id, s.status INTO v_room, v_status
    FROM public.room_session_options o JOIN public.room_sessions s ON s.id = o.session_id
   WHERE o.id = p_option_id;
  IF NOT FOUND OR NOT public.can_post_in_room(v_room) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'proposed' THEN
    RAISE EXCEPTION 'SESSION_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;
  IF p_vote THEN
    INSERT INTO public.room_session_votes (option_id, user_id) VALUES (p_option_id, v_uid)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.room_session_votes WHERE option_id = p_option_id AND user_id = v_uid;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.vote_room_session(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vote_room_session(uuid, boolean) TO authenticated;

-- The proposer or the room creator picks the final time. Everyone who voted
-- for it is counted as coming.
CREATE OR REPLACE FUNCTION public.schedule_room_session(p_option_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := public.require_active_caller();
  v_s   public.room_sessions%ROWTYPE;
  v_at  timestamptz;
  v_room text;
  v_creator uuid;
BEGIN
  SELECT o.starts_at INTO v_at FROM public.room_session_options o WHERE o.id = p_option_id;
  SELECT s.* INTO v_s FROM public.room_sessions s
    JOIN public.room_session_options o ON o.session_id = s.id
   WHERE o.id = p_option_id
     FOR UPDATE OF s;
  IF NOT FOUND OR NOT public.can_post_in_room(v_s.room_id) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  SELECT r.created_by, r.name INTO v_creator, v_room FROM public.rooms r WHERE r.id = v_s.room_id;
  IF v_uid <> v_s.proposed_by AND v_uid <> v_creator THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  IF v_s.status <> 'proposed' THEN
    RAISE EXCEPTION 'SESSION_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;
  IF v_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'OPTION_IN_PAST' USING ERRCODE = 'P0001';
  END IF;

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

-- Accept / decline a scheduled session.
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
  IF NOT FOUND OR NOT public.is_room_member(v_s.room_id) THEN
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

-- The proposer or the room creator cancels.
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
  IF NOT FOUND OR NOT public.is_room_member(v_s.room_id)
     OR (v_uid <> v_s.proposed_by
         AND v_uid <> (SELECT r.created_by FROM public.rooms r WHERE r.id = v_s.room_id)) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  UPDATE public.room_sessions SET status = 'cancelled' WHERE id = p_session_id;
  DELETE FROM public.notifications WHERE session_id = p_session_id AND read_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_room_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_room_session(uuid) TO authenticated;
