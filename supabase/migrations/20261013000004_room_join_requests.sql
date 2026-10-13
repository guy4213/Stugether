-- =============================================================================
-- 20261013000004_room_join_requests.sql
-- Change Request (13.10.2026): joining an open room that is in session ("live":
-- a message in the last 30 minutes, as lib/stats/live.ts) needs the room
-- creator's approval, so a running session is not interrupted. A quiet open
-- room is still joined directly.
--   1. room_join_requests + RLS (requester and room creator read; RPC writes).
--   2. request_room_join(room) → 'joined' | 'requested';
--      decide_room_join_request(request, approve) — creator only.
--   3. notifications: new types (join request / decision, and the study
--      session types used by 20261013000006) + request_id.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
CREATE TABLE public.room_join_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid        NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  decided_at  timestamptz,
  decided_by  uuid        REFERENCES public.profiles (id) ON DELETE SET NULL
);

-- One pending request per (room, user).
CREATE UNIQUE INDEX room_join_requests_one_pending
  ON public.room_join_requests (room_id, user_id) WHERE status = 'pending';
CREATE INDEX room_join_requests_room_pending_idx
  ON public.room_join_requests (room_id) WHERE status = 'pending';

ALTER TABLE public.room_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_join_requests FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.room_join_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.room_join_requests TO authenticated;

CREATE POLICY room_join_requests_select_party
  ON public.room_join_requests FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.rooms r
                WHERE r.id = room_id AND r.created_by = (SELECT auth.uid()))
    OR (SELECT public.is_super_admin())
  );
-- No INSERT/UPDATE/DELETE policies: request_room_join / decide_room_join_request.

-- In session = active and a message (or the room's creation) in the last 30
-- minutes. Mirrors LIVE_WINDOW_MS in lib/stats/live.ts.
CREATE OR REPLACE FUNCTION public.room_is_live(p_room public.rooms)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT p_room.status = 'active'
     AND COALESCE(p_room.last_message_at, p_room.created_at) > pg_catalog.now() - interval '30 minutes';
$$;

-- -----------------------------------------------------------------------------
-- 2. Notifications: new types + link to the request
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'room_invitation', 'room_opened', 'room_joined',
  'event_scheduled', 'course_recommendation', 'system',
  'room_join_request', 'room_join_decided',
  'session_proposed', 'session_scheduled'
));

-- The generated category must know the new types: re-create it.
ALTER TABLE public.notifications DROP COLUMN category;
ALTER TABLE public.notifications ADD COLUMN category text GENERATED ALWAYS AS (
  CASE type
    WHEN 'room_invitation'   THEN 'invitations'
    WHEN 'room_join_request' THEN 'invitations'
    WHEN 'room_opened'       THEN 'rooms'
    WHEN 'room_joined'       THEN 'rooms'
    WHEN 'room_join_decided' THEN 'rooms'
    WHEN 'session_proposed'  THEN 'rooms'
    WHEN 'session_scheduled' THEN 'rooms'
    WHEN 'system'            THEN 'system'
    ELSE 'courses'
  END
) STORED;

ALTER TABLE public.notifications
  ADD COLUMN request_id uuid REFERENCES public.room_join_requests (id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.notification_enabled(p_user_id uuid, p_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE p_type
           WHEN 'room_opened'           THEN COALESCE(np.live_rooms, true)
           WHEN 'room_invitation'       THEN COALESCE(np.messages_invites, true)
           WHEN 'room_joined'           THEN COALESCE(np.messages_invites, true)
           WHEN 'course_recommendation' THEN COALESCE(np.course_recs, false)
           WHEN 'system'                THEN COALESCE(np.system_updates, true)
           -- event_scheduled, join requests / decisions and study sessions:
           -- always (someone is waiting for an answer, or it is a schedule).
           ELSE true
         END
    FROM (SELECT 1) AS one
    LEFT JOIN public.notification_preferences np ON np.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.notification_enabled(uuid, text) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. RPCs
-- -----------------------------------------------------------------------------

-- Same checks and lock order as join_open_room. Returns 'joined' when the
-- caller is (now) a member, 'requested' when the creator must approve.
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

  IF NOT public.room_is_live(v_room) THEN
    PERFORM public.join_open_room(p_room_id);
    RETURN 'joined';
  END IF;

  -- Already waiting: no second request or notification.
  IF EXISTS (SELECT 1 FROM public.room_join_requests q
              WHERE q.room_id = p_room_id AND q.user_id = v_uid AND q.status = 'pending') THEN
    RETURN 'requested';
  END IF;

  INSERT INTO public.room_join_requests (room_id, user_id)
  VALUES (p_room_id, v_uid)
  RETURNING id INTO v_request_id;

  SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id = v_uid;
  INSERT INTO public.notifications
    (user_id, type, actor_id, course_id, room_id, request_id, title, body)
  VALUES
    (v_room.created_by, 'room_join_request', v_uid, v_room.course_id, p_room_id, v_request_id,
     'בקשת הצטרפות לחדר',
     pg_catalog.left(COALESCE(v_name, 'חבר/ת קורס') || ' מבקש/ת להצטרף לחדר „' || v_room.name || '”', 500));

  RETURN 'requested';
END;
$$;

REVOKE ALL ON FUNCTION public.request_room_join(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_room_join(uuid) TO authenticated;

-- The room creator approves or declines. Approval adds the member under the
-- same 4-member cap (room row locked first, like accept_room_invitation).
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
  IF v_room.created_by <> v_uid THEN
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

  -- The creator's "request" notification is answered.
  UPDATE public.notifications
     SET read_at = COALESCE(read_at, pg_catalog.now())
   WHERE request_id = p_request_id AND user_id = v_uid;

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

-- The requester may withdraw a pending request.
CREATE OR REPLACE FUNCTION public.cancel_room_join_request(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := public.require_active_caller();
BEGIN
  UPDATE public.room_join_requests
     SET status = 'cancelled', decided_at = pg_catalog.now(), decided_by = v_uid
   WHERE room_id = p_room_id AND user_id = v_uid AND status = 'pending';
  DELETE FROM public.notifications n
   WHERE n.type = 'room_join_request'
     AND n.request_id IN (SELECT q.id FROM public.room_join_requests q
                           WHERE q.room_id = p_room_id AND q.user_id = v_uid
                             AND q.status = 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_room_join_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_room_join_request(uuid) TO authenticated;
