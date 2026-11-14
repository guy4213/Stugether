-- =============================================================================
-- Friends (client QA 12.11.2026, Change Request)
-- =============================================================================
-- "הוספת חבר" on a student card sends a friend request; the other student
-- approves or declines it. Accepted friendships are listed on both profiles,
-- visible to every active student (like the rest of the public profile).
--
--   friendships             one row per pair (either direction), status
--                           pending -> accepted | declined
--   send_friend_request     request; if the other side already asked me, accept
--   respond_friend_request  the addressee accepts or declines
--   remove_friend           unfriend, or cancel a pending request between us
--
-- Every write is an RPC (no INSERT/UPDATE/DELETE policies). A Super Admin is
-- not a student: they can neither send nor receive requests.
-- New notification types: friend_request (to the addressee) and
-- friend_accepted (back to the requester), category 'invitations', following
-- the "messages & invitations" preference.
-- Runs after 20261112000003_owner_leave_deletes_room.sql, so the type list
-- and the category keep its 'room_deleted' type.

CREATE TABLE public.friendships (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  addressee_id uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (requester_id <> addressee_id)
);

-- One row per unordered pair.
CREATE UNIQUE INDEX friendships_pair_key
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX friendships_addressee_idx ON public.friendships (addressee_id, status);
CREATE INDEX friendships_requester_idx ON public.friendships (requester_id, status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.friendships FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.friendships FROM authenticated;
GRANT SELECT ON public.friendships TO authenticated;

-- Accepted friendships are public to active users; pending / declined rows
-- only to the two sides. A Super Admin sees every row (metadata only).
CREATE POLICY friendships_select
  ON public.friendships FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR requester_id = (SELECT auth.uid())
    OR addressee_id = (SELECT auth.uid())
    OR (
      status = 'accepted'
      AND EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_active
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Notifications: two new types.
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN friendship_id uuid REFERENCES public.friendships (id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'room_invitation', 'room_opened', 'room_joined',
  'event_scheduled', 'course_recommendation', 'system',
  'room_join_request', 'room_join_decided',
  'session_proposed', 'session_scheduled',
  'direct_message',
  'room_deleted',
  'friend_request', 'friend_accepted'
));

ALTER TABLE public.notifications DROP COLUMN category;
ALTER TABLE public.notifications ADD COLUMN category text GENERATED ALWAYS AS (
  CASE type
    WHEN 'room_invitation'   THEN 'invitations'
    WHEN 'room_join_request' THEN 'invitations'
    WHEN 'friend_request'    THEN 'invitations'
    WHEN 'friend_accepted'   THEN 'invitations'
    WHEN 'room_opened'       THEN 'rooms'
    WHEN 'room_joined'       THEN 'rooms'
    WHEN 'room_join_decided' THEN 'rooms'
    WHEN 'session_proposed'  THEN 'rooms'
    WHEN 'session_scheduled' THEN 'rooms'
    WHEN 'room_deleted'      THEN 'rooms'
    WHEN 'direct_message'    THEN 'messages'
    WHEN 'system'            THEN 'system'
    ELSE 'courses'
  END
) STORED;

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
           WHEN 'direct_message'        THEN COALESCE(np.messages_invites, true)
           WHEN 'friend_request'        THEN COALESCE(np.messages_invites, true)
           WHEN 'friend_accepted'       THEN COALESCE(np.messages_invites, true)
           WHEN 'course_recommendation' THEN COALESCE(np.course_recs, false)
           WHEN 'system'                THEN COALESCE(np.system_updates, true)
           ELSE true
         END
    FROM (SELECT 1) AS one
    LEFT JOIN public.notification_preferences np ON np.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.notification_enabled(uuid, text) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- An active student (not a Super Admin): who may have friends.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_friendable(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_user_id AND p.is_active AND p.role = 'student'
  );
$$;

REVOKE ALL ON FUNCTION public.is_friendable(uuid) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- send_friend_request(p_user_id) -> the friendship row.
-- Re-sending after a decline (by either side) starts a fresh request. If the
-- other student already has a pending request to me, it is accepted instead.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_friend_request(p_user_id uuid)
RETURNS public.friendships
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := public.require_active_caller();
  v_row   public.friendships%ROWTYPE;
  v_found boolean;
  v_name  text;
BEGIN
  IF p_user_id IS NULL OR p_user_id = v_uid THEN
    RAISE EXCEPTION 'INVALID_FRIEND' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_friendable(v_uid) OR NOT public.is_friendable(p_user_id) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  -- Spam guard: 30 requests a day per sender.
  IF (
    SELECT pg_catalog.count(*) FROM public.friendships f
     WHERE f.requester_id = v_uid AND f.created_at > pg_catalog.now() - interval '1 day'
  ) >= 30 THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM public.friendships f
   WHERE LEAST(f.requester_id, f.addressee_id) = LEAST(v_uid, p_user_id)
     AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(v_uid, p_user_id)
   FOR UPDATE;
  v_found := FOUND;

  SELECT COALESCE(NULLIF(p.full_name, ''), 'סטודנט/ית') INTO v_name
    FROM public.profiles p WHERE p.id = v_uid;

  IF v_found AND v_row.status = 'accepted' THEN
    RETURN v_row;
  END IF;

  -- They asked first: asking back = accepting.
  IF v_found AND v_row.status = 'pending' AND v_row.addressee_id = v_uid THEN
    UPDATE public.friendships f
       SET status = 'accepted', responded_at = pg_catalog.now()
     WHERE f.id = v_row.id
    RETURNING * INTO v_row;
    UPDATE public.notifications n SET read_at = pg_catalog.now()
     WHERE n.friendship_id = v_row.id AND n.user_id = v_uid AND n.read_at IS NULL;
    IF public.notification_enabled(v_row.requester_id, 'friend_accepted') THEN
      INSERT INTO public.notifications (user_id, type, actor_id, friendship_id, title)
      VALUES (v_row.requester_id, 'friend_accepted', v_uid, v_row.id,
              pg_catalog.left(v_name || ' אישר/ה את בקשת החברות שלך', 200));
    END IF;
    RETURN v_row;
  END IF;

  IF v_found AND v_row.status = 'pending' THEN
    RETURN v_row; -- already asked
  END IF;

  IF v_found THEN
    -- Declined earlier: a fresh request, from me.
    UPDATE public.friendships f
       SET requester_id = v_uid, addressee_id = p_user_id, status = 'pending',
           created_at = pg_catalog.now(), responded_at = NULL
     WHERE f.id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.friendships (requester_id, addressee_id)
    VALUES (v_uid, p_user_id)
    RETURNING * INTO v_row;
  END IF;

  IF public.notification_enabled(p_user_id, 'friend_request') THEN
    DELETE FROM public.notifications n
     WHERE n.friendship_id = v_row.id AND n.type = 'friend_request' AND n.read_at IS NULL;
    INSERT INTO public.notifications (user_id, type, actor_id, friendship_id, title, body)
    VALUES (p_user_id, 'friend_request', v_uid, v_row.id,
            pg_catalog.left(v_name || ' רוצה להוסיף אותך לחברים', 200),
            'אשרו כדי שתופיעו ברשימת החברים אחד של השני');
  END IF;

  RETURN v_row;
END;
$$;

-- -----------------------------------------------------------------------------
-- respond_friend_request(p_friendship_id, p_accept): the addressee only, on a
-- pending request.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_friend_request(p_friendship_id uuid, p_accept boolean)
RETURNS public.friendships
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  uuid := public.require_active_caller();
  v_row  public.friendships%ROWTYPE;
  v_name text;
BEGIN
  SELECT * INTO v_row FROM public.friendships f WHERE f.id = p_friendship_id FOR UPDATE;
  IF NOT FOUND OR v_row.addressee_id <> v_uid THEN
    RAISE EXCEPTION 'FRIEND_REQUEST_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'FRIEND_REQUEST_NOT_PENDING' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.friendships f
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
         responded_at = pg_catalog.now()
   WHERE f.id = p_friendship_id
  RETURNING * INTO v_row;

  UPDATE public.notifications n SET read_at = pg_catalog.now()
   WHERE n.friendship_id = v_row.id AND n.user_id = v_uid AND n.read_at IS NULL;

  IF p_accept AND public.notification_enabled(v_row.requester_id, 'friend_accepted') THEN
    SELECT COALESCE(NULLIF(p.full_name, ''), 'סטודנט/ית') INTO v_name
      FROM public.profiles p WHERE p.id = v_uid;
    INSERT INTO public.notifications (user_id, type, actor_id, friendship_id, title)
    VALUES (v_row.requester_id, 'friend_accepted', v_uid, v_row.id,
            pg_catalog.left(v_name || ' אישר/ה את בקשת החברות שלך', 200));
  END IF;

  RETURN v_row;
END;
$$;

-- -----------------------------------------------------------------------------
-- remove_friend(p_user_id): unfriend, or withdraw / dismiss a pending request
-- between us. Idempotent.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_friend(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := public.require_active_caller();
BEGIN
  DELETE FROM public.friendships f
   WHERE LEAST(f.requester_id, f.addressee_id) = LEAST(v_uid, p_user_id)
     AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(v_uid, p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.send_friend_request(uuid)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_friend_request(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_friend(uuid)                   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(uuid)                   TO authenticated;
