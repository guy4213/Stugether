-- =============================================================================
-- 20260925000001_mockup_features.sql
-- Data behind the "StuGether Dashboard" mockup screens:
--   1. notifications + notification_preferences (typed, read/unread, per-user
--      toggles) — replaces "pending invitations" as the only notification kind
--   2. open rooms: rooms.is_open, list_open_rooms(), join_open_room()
--   3. course_topics + topic_progress, which now drive enrollments.progress_percent
--   4. study_availability ("available to study now")
--   5. tests.kind (test / workshop / study_session) + event_registrations
-- Self-contained: DDL + RLS (ENABLE + FORCE) + policies + functions together.
-- =============================================================================


-- =============================================================================
-- 1. Notifications
-- =============================================================================
CREATE TABLE public.notifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  type          text        NOT NULL CHECK (type IN (
                  'room_invitation', 'room_opened', 'room_joined',
                  'event_scheduled', 'course_recommendation', 'system'
                )),
  -- The filter tabs on the notifications page. Client asked for "rooms"
  -- instead of "groups" and no "lessons", so the categories follow the data.
  category      text        GENERATED ALWAYS AS (
                  CASE type
                    WHEN 'room_invitation' THEN 'invitations'
                    WHEN 'room_opened'     THEN 'rooms'
                    WHEN 'room_joined'     THEN 'rooms'
                    WHEN 'system'          THEN 'system'
                    ELSE 'courses'
                  END
                ) STORED,
  actor_id      uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  course_id     uuid        REFERENCES public.courses (id) ON DELETE CASCADE,
  room_id       uuid        REFERENCES public.rooms (id) ON DELETE CASCADE,
  invitation_id uuid        REFERENCES public.room_invitations (id) ON DELETE CASCADE,
  event_id      uuid        REFERENCES public.tests (id) ON DELETE CASCADE,
  title         text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body          text        CHECK (body IS NULL OR char_length(body) <= 500),
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE  ROW LEVEL SECURITY;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.notifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.notifications FROM anon;

CREATE POLICY notifications_select_own
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Users never insert/update directly: rows come from the triggers below, and
-- read state goes through mark_notifications_read(). A super_admin may post
-- 'system' announcements.
CREATE POLICY notifications_insert_super_admin_system
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()) AND type = 'system');

CREATE POLICY notifications_delete_own
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- notification_preferences — the four toggles on the notifications page.
-- No row = all defaults (see public.notification_enabled()).
-- -----------------------------------------------------------------------------
CREATE TABLE public.notification_preferences (
  user_id          uuid        PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  live_rooms       boolean     NOT NULL DEFAULT true,   -- a classmate opened an open room
  messages_invites boolean     NOT NULL DEFAULT true,   -- invitations, someone joined your room
  course_recs      boolean     NOT NULL DEFAULT false,  -- course recommendations
  system_updates   boolean     NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences FORCE  ROW LEVEL SECURITY;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.notification_preferences FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.notification_preferences FROM anon;

CREATE POLICY notification_preferences_select_own
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY notification_preferences_insert_own
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY notification_preferences_update_own
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TRIGGER notification_preferences_set_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Internal: does p_user_id want notifications of p_type? Missing row = defaults.
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
           ELSE true  -- event_scheduled: always (it is course schedule info)
         END
    FROM (SELECT 1) AS one
    LEFT JOIN public.notification_preferences np ON np.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.notification_enabled(uuid, text) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- mark_notifications_read(p_ids) — NULL marks everything. Returns rows updated.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := public.require_active_caller();
  v_count integer;
BEGIN
  UPDATE public.notifications n
     SET read_at = pg_catalog.now()
   WHERE n.user_id = v_uid
     AND n.read_at IS NULL
     AND (p_ids IS NULL OR n.id = ANY (p_ids));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;

-- -----------------------------------------------------------------------------
-- get_notification_summary(p_since) — per-category totals for the caller's
-- tabs and the "this week" card. p_since NULL = all time.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_notification_summary(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (category text, total bigint, unread bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT n.category,
         pg_catalog.count(*) AS total,
         pg_catalog.count(*) FILTER (WHERE n.read_at IS NULL) AS unread
    FROM public.notifications n
   WHERE n.user_id = auth.uid()
     AND (p_since IS NULL OR n.created_at >= p_since)
   GROUP BY n.category;
$$;

REVOKE ALL ON FUNCTION public.get_notification_summary(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_notification_summary(timestamptz) TO authenticated;


-- =============================================================================
-- 2. Open rooms
-- =============================================================================
-- An open room can be joined by any classmate (up to the 4-seat cap) without
-- an invitation, and its opening is announced to the course.
ALTER TABLE public.rooms ADD COLUMN is_open boolean NOT NULL DEFAULT false;

-- list_open_rooms — rooms_select_member_or_admin hides rooms from non-members,
-- so browsing open rooms goes through this narrow, enrollment-scoped view.
CREATE OR REPLACE FUNCTION public.list_open_rooms(p_course_ids uuid[])
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
  created_at      timestamptz
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
         r.created_at
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

-- join_open_room — same capacity rule and lock order as accept_room_invitation.
CREATE OR REPLACE FUNCTION public.join_open_room(p_room_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid          uuid := public.require_active_caller();
  v_room         public.rooms%ROWTYPE;
  v_active_count bigint;
BEGIN
  IF p_room_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_room FROM public.rooms r WHERE r.id = p_room_id FOR UPDATE;

  -- Not open / not enrolled are reported as not found (no existence leak).
  IF NOT FOUND OR NOT v_room.is_open OR NOT public.is_enrolled_in_course(v_room.course_id) THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_room.status <> 'active' THEN
    RAISE EXCEPTION 'ROOM_NOT_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.room_members rm
     WHERE rm.room_id = p_room_id AND rm.user_id = v_uid AND rm.left_at IS NULL
  ) THEN
    RETURN p_room_id;
  END IF;

  SELECT pg_catalog.count(*) INTO v_active_count
    FROM public.room_members rm
   WHERE rm.room_id = p_room_id AND rm.left_at IS NULL;

  IF v_active_count >= 4 THEN
    RAISE EXCEPTION 'ROOM_FULL' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.room_members (room_id, user_id, role, joined_at, left_at, last_read_at)
  VALUES (p_room_id, v_uid, 'member', pg_catalog.now(), NULL, pg_catalog.now())
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET role         = 'member',
        joined_at    = pg_catalog.now(),
        left_at      = NULL,
        last_read_at = pg_catalog.now();

  RETURN p_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_open_room(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_open_room(uuid) TO authenticated;


-- =============================================================================
-- 3. Course topics + per-user topic progress
-- =============================================================================
CREATE TABLE public.course_topics (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid        NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  position   smallint    NOT NULL CHECK (position >= 1),
  title      text        NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, position)
);

ALTER TABLE public.course_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_topics FORCE  ROW LEVEL SECURITY;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.course_topics FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.course_topics FROM anon;

-- Same shape as the catalog: readable by any signed-in user, admin-managed.
CREATE POLICY course_topics_select_authenticated
  ON public.course_topics FOR SELECT TO authenticated
  USING (is_active OR (SELECT public.is_super_admin()));

CREATE POLICY course_topics_insert_super_admin
  ON public.course_topics FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

CREATE POLICY course_topics_update_super_admin
  ON public.course_topics FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

CREATE POLICY course_topics_delete_super_admin
  ON public.course_topics FOR DELETE TO authenticated
  USING ((SELECT public.is_super_admin()));

CREATE TABLE public.topic_progress (
  user_id    uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  topic_id   uuid        NOT NULL REFERENCES public.course_topics (id) ON DELETE CASCADE,
  status     text        NOT NULL CHECK (status IN ('in_progress', 'mastered')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

CREATE INDEX topic_progress_topic_id_idx ON public.topic_progress (topic_id);

ALTER TABLE public.topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_progress FORCE  ROW LEVEL SECURITY;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.topic_progress FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.topic_progress FROM anon;

-- Internal: the course a topic belongs to (course_topics is readable anyway).
CREATE OR REPLACE FUNCTION public.topic_course_id(p_topic_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ct.course_id FROM public.course_topics ct WHERE ct.id = p_topic_id;
$$;

REVOKE ALL ON FUNCTION public.topic_course_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.topic_course_id(uuid) TO authenticated;

CREATE POLICY topic_progress_select_own
  ON public.topic_progress FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY topic_progress_insert_own_enrolled
  ON public.topic_progress FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_enrolled_in_course(public.topic_course_id(topic_id))
  );

CREATE POLICY topic_progress_update_own_enrolled
  ON public.topic_progress FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_enrolled_in_course(public.topic_course_id(topic_id))
  );

CREATE POLICY topic_progress_delete_own
  ON public.topic_progress FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- enrollments.progress_percent = mastered / active topics. Courses without
-- topics keep whatever progress_percent they had (nothing to derive from).
CREATE OR REPLACE FUNCTION public.recompute_enrollment_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id   uuid;
  v_topic_id  uuid;
  v_course_id uuid;
  v_total     integer;
  v_mastered  integer;
  v_percent   smallint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id; v_topic_id := OLD.topic_id;
  ELSE
    v_user_id := NEW.user_id; v_topic_id := NEW.topic_id;
  END IF;

  SELECT ct.course_id INTO v_course_id FROM public.course_topics ct WHERE ct.id = v_topic_id;
  IF v_course_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT pg_catalog.count(*),
         pg_catalog.count(*) FILTER (WHERE tp.status = 'mastered')
    INTO v_total, v_mastered
    FROM public.course_topics ct
    LEFT JOIN public.topic_progress tp
      ON tp.topic_id = ct.id AND tp.user_id = v_user_id
   WHERE ct.course_id = v_course_id
     AND ct.is_active;

  IF v_total = 0 THEN
    RETURN NULL;
  END IF;

  v_percent := pg_catalog.round(v_mastered * 100.0 / v_total)::smallint;

  UPDATE public.enrollments e
     SET progress_percent = v_percent,
         completed_at = CASE
           WHEN v_percent = 100 THEN COALESCE(e.completed_at, pg_catalog.now())
           ELSE NULL
         END
   WHERE e.user_id = v_user_id
     AND e.course_id = v_course_id;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_enrollment_progress() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER topic_progress_recompute_enrollment
  AFTER INSERT OR UPDATE OR DELETE ON public.topic_progress
  FOR EACH ROW EXECUTE FUNCTION public.recompute_enrollment_progress();


-- =============================================================================
-- 4. "Available to study now"
-- =============================================================================
CREATE TABLE public.study_availability (
  user_id          uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  course_id        uuid        NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  mode             text        NOT NULL CHECK (mode IN ('online', 'campus')),
  duration_minutes smallint    NOT NULL CHECK (duration_minutes IN (30, 60, 90, 120)),
  activity         text        NOT NULL CHECK (activity IN ('summaries', 'exercises', 'review', 'exam_prep')),
  topic_id         uuid        REFERENCES public.course_topics (id) ON DELETE SET NULL,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX study_availability_course_idx ON public.study_availability (course_id, expires_at);

ALTER TABLE public.study_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_availability FORCE  ROW LEVEL SECURITY;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.study_availability FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.study_availability FROM anon;

-- Own row always; classmates only while it has not expired.
CREATE POLICY study_availability_select_own_or_classmate
  ON public.study_availability FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (expires_at > now() AND public.is_enrolled_in_course(course_id))
  );

CREATE POLICY study_availability_insert_own_enrolled
  ON public.study_availability FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_enrolled_in_course(course_id)
    AND expires_at <= now() + interval '3 hours'
  );

CREATE POLICY study_availability_update_own_enrolled
  ON public.study_availability FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_enrolled_in_course(course_id)
    AND expires_at <= now() + interval '3 hours'
  );

CREATE POLICY study_availability_delete_own
  ON public.study_availability FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- =============================================================================
-- 5. Course events: tests.kind + registrations
-- =============================================================================
ALTER TABLE public.tests
  ADD COLUMN kind text NOT NULL DEFAULT 'test'
    CHECK (kind IN ('test', 'workshop', 'study_session')),
  ADD COLUMN location text CHECK (location IS NULL OR char_length(location) <= 200);

CREATE TABLE public.event_registrations (
  event_id   uuid        NOT NULL REFERENCES public.tests (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX event_registrations_user_idx ON public.event_registrations (user_id);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations FORCE  ROW LEVEL SECURITY;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.event_registrations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.event_registrations FROM anon;

-- Internal: the course an event belongs to (bypasses tests RLS only to
-- resolve the id; the enrollment check is what grants access).
CREATE OR REPLACE FUNCTION public.event_course_id(p_event_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.course_id FROM public.tests t WHERE t.id = p_event_id AND t.is_active;
$$;

REVOKE ALL ON FUNCTION public.event_course_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_course_id(uuid) TO authenticated;

CREATE POLICY event_registrations_select_enrolled
  ON public.event_registrations FOR SELECT TO authenticated
  USING (public.is_enrolled_in_course(public.event_course_id(event_id)));

CREATE POLICY event_registrations_insert_own_enrolled
  ON public.event_registrations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_enrolled_in_course(public.event_course_id(event_id))
  );

CREATE POLICY event_registrations_delete_own
  ON public.event_registrations FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- =============================================================================
-- 6. Notification triggers
-- All SECURITY DEFINER; each respects notification_enabled(). Names in the
-- text are snapshots (a notification is a record of what happened).
-- =============================================================================

-- room_invitations INSERT -> invitee.
CREATE OR REPLACE FUNCTION public.notify_room_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inviter text;
  v_room    text;
  v_course  uuid;
BEGIN
  IF NEW.status <> 'pending' OR NEW.expires_at <= pg_catalog.now() THEN
    RETURN NULL;
  END IF;
  IF NOT public.notification_enabled(NEW.invitee_user_id, 'room_invitation') THEN
    RETURN NULL;
  END IF;

  SELECT p.full_name INTO v_inviter FROM public.profiles p WHERE p.id = NEW.inviter_id;
  SELECT r.name, r.course_id INTO v_room, v_course FROM public.rooms r WHERE r.id = NEW.room_id;

  INSERT INTO public.notifications
    (user_id, type, actor_id, course_id, room_id, invitation_id, title, body, created_at)
  VALUES
    (NEW.invitee_user_id, 'room_invitation', NEW.inviter_id, v_course, NEW.room_id, NEW.id,
     'הזמנה לחדר לימוד',
     pg_catalog.left(COALESCE(v_inviter, 'חבר/ת קורס') || ' הזמין/ה אותך לחדר „' || COALESCE(v_room, '') || '”', 500),
     NEW.created_at);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_room_invitation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER room_invitations_notify
  AFTER INSERT ON public.room_invitations
  FOR EACH ROW EXECUTE FUNCTION public.notify_room_invitation();

-- rooms INSERT (open rooms only) -> everyone actively enrolled in the course.
CREATE OR REPLACE FUNCTION public.notify_room_opened()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor  text;
  v_course text;
BEGIN
  IF NOT NEW.is_open OR NEW.status <> 'active' THEN
    RETURN NULL;
  END IF;

  SELECT p.full_name INTO v_actor FROM public.profiles p WHERE p.id = NEW.created_by;
  SELECT c.name INTO v_course FROM public.courses c WHERE c.id = NEW.course_id;

  INSERT INTO public.notifications
    (user_id, type, actor_id, course_id, room_id, title, body, created_at)
  SELECT e.user_id, 'room_opened', NEW.created_by, NEW.course_id, NEW.id,
         pg_catalog.left(COALESCE(v_actor, 'חבר/ת קורס') || ' פתח/ה חדר ב' || COALESCE(v_course, 'קורס'), 200),
         pg_catalog.left(NEW.name, 500),
         NEW.created_at
    FROM public.enrollments e
    JOIN public.profiles p ON p.id = e.user_id AND p.is_active
   WHERE e.course_id = NEW.course_id
     AND e.status = 'active'
     AND e.user_id <> NEW.created_by
     AND public.notification_enabled(e.user_id, 'room_opened');
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_room_opened() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rooms_notify_opened
  AFTER INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.notify_room_opened();

-- room_members joined (new row, or a left member re-activated) -> the other
-- active members. The owner row added at room creation is not announced.
CREATE OR REPLACE FUNCTION public.notify_room_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor  text;
  v_room   text;
  v_course uuid;
BEGIN
  SELECT p.full_name INTO v_actor FROM public.profiles p WHERE p.id = NEW.user_id;
  SELECT r.name, r.course_id INTO v_room, v_course FROM public.rooms r WHERE r.id = NEW.room_id;

  INSERT INTO public.notifications
    (user_id, type, actor_id, course_id, room_id, title, body, created_at)
  SELECT rm.user_id, 'room_joined', NEW.user_id, v_course, NEW.room_id,
         pg_catalog.left(COALESCE(v_actor, 'חבר/ת קורס') || ' הצטרף/ה לחדר', 200),
         pg_catalog.left(COALESCE(v_room, ''), 500),
         NEW.joined_at
    FROM public.room_members rm
   WHERE rm.room_id = NEW.room_id
     AND rm.user_id <> NEW.user_id
     AND rm.left_at IS NULL
     AND public.notification_enabled(rm.user_id, 'room_joined');
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_room_joined() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER room_members_notify_joined_insert
  AFTER INSERT ON public.room_members
  FOR EACH ROW
  WHEN (NEW.role <> 'owner' AND NEW.left_at IS NULL)
  EXECUTE FUNCTION public.notify_room_joined();

CREATE TRIGGER room_members_notify_joined_rejoin
  AFTER UPDATE OF left_at ON public.room_members
  FOR EACH ROW
  WHEN (OLD.left_at IS NOT NULL AND NEW.left_at IS NULL)
  EXECUTE FUNCTION public.notify_room_joined();

-- tests INSERT -> everyone actively enrolled in the course except the creator.
CREATE OR REPLACE FUNCTION public.notify_event_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course text;
  v_title  text;
BEGIN
  IF NOT NEW.is_active THEN
    RETURN NULL;
  END IF;

  SELECT c.name INTO v_course FROM public.courses c WHERE c.id = NEW.course_id;
  v_title := CASE NEW.kind
    WHEN 'workshop'      THEN 'סדנה חדשה נקבעה'
    WHEN 'study_session' THEN 'מפגש לימוד נקבע'
    ELSE 'מבחן חדש נוסף'
  END;

  INSERT INTO public.notifications
    (user_id, type, actor_id, course_id, event_id, title, body, created_at)
  SELECT e.user_id, 'event_scheduled', NEW.created_by, NEW.course_id, NEW.id,
         v_title,
         pg_catalog.left(NEW.title || ' · ' || COALESCE(v_course, ''), 500),
         NEW.created_at
    FROM public.enrollments e
    JOIN public.profiles p ON p.id = e.user_id AND p.is_active
   WHERE e.course_id = NEW.course_id
     AND e.status = 'active'
     AND e.user_id <> NEW.created_by
     AND public.notification_enabled(e.user_id, 'event_scheduled');
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_event_scheduled() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tests_notify_scheduled
  AFTER INSERT ON public.tests
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_scheduled();

-- Backfill: existing, still-valid pending invitations become notifications.
INSERT INTO public.notifications
  (user_id, type, actor_id, course_id, room_id, invitation_id, title, body, created_at)
SELECT ri.invitee_user_id, 'room_invitation', ri.inviter_id, r.course_id, ri.room_id, ri.id,
       'הזמנה לחדר לימוד',
       pg_catalog.left(COALESCE(p.full_name, 'חבר/ת קורס') || ' הזמין/ה אותך לחדר „' || r.name || '”', 500),
       ri.created_at
  FROM public.room_invitations ri
  JOIN public.rooms r ON r.id = ri.room_id
  LEFT JOIN public.profiles p ON p.id = ri.inviter_id
 WHERE ri.status = 'pending'
   AND ri.expires_at > now();


-- =============================================================================
-- 7. public_profiles: add last_seen_at for the "online / not connected" status
--    in course member lists. Visibility rules are unchanged (self, admin,
--    course-mates, roommates).
-- =============================================================================
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
         p.last_seen_at
    FROM public.profiles p
   WHERE auth.uid() IS NOT NULL
     AND (
       p.id = auth.uid()
       OR public.is_super_admin()
       OR public.shares_course_with(p.id)
       OR public.shares_room_with(p.id)
     );

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profiles TO authenticated, service_role;
