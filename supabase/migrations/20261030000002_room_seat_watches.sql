-- =============================================================================
-- 20261030000002_room_seat_watches.sql
-- Change Request (30.10.2026, Figma "חדרי לימוד"): "עדכנו כשמתפנה" on a full
-- open room. A classmate of the course asks to hear when a seat opens; when a
-- member leaves, each watcher gets a "room_opened" notification (its row
-- already offers "הצטרפות") and the watch is used up.
-- =============================================================================

CREATE TABLE public.room_seat_watches (
  room_id    uuid        NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX room_seat_watches_user_idx ON public.room_seat_watches (user_id);

ALTER TABLE public.room_seat_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_seat_watches FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.room_seat_watches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.room_seat_watches TO authenticated;

CREATE POLICY room_seat_watches_select_own ON public.room_seat_watches
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- Watch (p_watch = true) or stop watching an open room of one of my courses.
CREATE OR REPLACE FUNCTION public.watch_room_seat(p_room_id uuid, p_watch boolean)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  uuid := public.require_active_caller();
  v_room public.rooms%ROWTYPE;
BEGIN
  IF p_room_id IS NULL OR p_watch IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;
  IF NOT p_watch THEN
    DELETE FROM public.room_seat_watches WHERE room_id = p_room_id AND user_id = v_uid;
    RETURN;
  END IF;

  SELECT * INTO v_room FROM public.rooms r WHERE r.id = p_room_id;
  IF NOT FOUND OR NOT v_room.is_open OR v_room.status <> 'active'
     OR NOT public.is_enrolled_in_course(v_room.course_id) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.room_members rm
              WHERE rm.room_id = p_room_id AND rm.user_id = v_uid AND rm.left_at IS NULL) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.room_seat_watches (room_id, user_id)
  VALUES (p_room_id, v_uid)
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.watch_room_seat(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.watch_room_seat(uuid, boolean) TO authenticated;

-- A member left (left_at set): tell the watchers, once.
CREATE OR REPLACE FUNCTION public.notify_room_seat_watchers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM public.rooms r WHERE r.id = NEW.room_id;
  IF NOT FOUND OR v_room.status <> 'active' OR NOT v_room.is_open THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, course_id, room_id, title, body)
  SELECT w.user_id, 'room_opened', v_room.course_id, v_room.id,
         'התפנה מקום בחדר', '„' || v_room.name || '” — אפשר להצטרף עכשיו'
    FROM public.room_seat_watches w
   WHERE w.room_id = NEW.room_id
     AND w.user_id <> NEW.user_id
     AND public.notification_enabled(w.user_id, 'room_opened');

  DELETE FROM public.room_seat_watches WHERE room_id = NEW.room_id;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_room_seat_watchers() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER room_members_notify_seat_watchers
  AFTER UPDATE OF left_at ON public.room_members
  FOR EACH ROW
  WHEN (OLD.left_at IS NULL AND NEW.left_at IS NOT NULL)
  EXECUTE FUNCTION public.notify_room_seat_watchers();
