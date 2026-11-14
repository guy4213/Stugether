-- =============================================================================
-- Change Request 12.11.2026 — a room lives as long as its owner stays.
--
-- When the room's current owner (role = 'owner') leaves, the room and all of
-- its content (messages, AI runs, exercises, sessions, invitations, join
-- requests, notifications...) are deleted for good, in any status. The other
-- active members get a 'room_deleted' notification (room_id NULL — the room no
-- longer exists) and anyone inside the room gets a 'room_deleted' broadcast so
-- the client leaves the screen.
--
-- Unchanged on purpose:
--   * a regular member leaving — same as before (left_at, seat watchers);
--   * an admin deactivating the owner — still hands ownership off
--     (release_rooms_on_profile_deactivation -> handoff_room_ownership);
--   * rooms whose original creator left before this migration — kept.
--
-- Files in the 'room-files' bucket have no FK to rooms and storage.objects
-- cannot be deleted from SQL, so leave_room returns their paths and the
-- Server Action removes them through the Storage API (service role).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Notification type 'room_deleted' (category 'rooms', always delivered:
--    notification_enabled() falls through to true for unknown types).
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'room_invitation', 'room_opened', 'room_joined',
  'event_scheduled', 'course_recommendation', 'system',
  'room_join_request', 'room_join_decided',
  'session_proposed', 'session_scheduled',
  'direct_message',
  'room_deleted'
));

-- The generated category must know the new type: re-create it.
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
    WHEN 'room_deleted'      THEN 'rooms'
    WHEN 'direct_message'    THEN 'messages'
    WHEN 'system'            THEN 'system'
    ELSE 'courses'
  END
) STORED;


-- -----------------------------------------------------------------------------
-- 2. leave_room(p_room_id) -> jsonb
--    Regular member: sets own left_at (as before) -> {"room_deleted": false}.
--    Owner: notifies the other active members, broadcasts 'room_deleted' on
--    the room channel and deletes the room (FK cascade removes the rest)
--    -> {"room_deleted": true, "file_paths": [...]}.
--    The return type changes, so the function is dropped and re-created.
-- -----------------------------------------------------------------------------
DROP FUNCTION public.leave_room(uuid);

CREATE FUNCTION public.leave_room(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := public.require_active_caller();
  v_role  text;
  v_room  public.rooms%ROWTYPE;
  v_files text[];
BEGIN
  IF p_room_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  -- Same lock order as accept_room_invitation: room, then members.
  SELECT * INTO v_room FROM public.rooms r WHERE r.id = p_room_id FOR UPDATE;

  SELECT rm.role INTO v_role
    FROM public.room_members rm
   WHERE rm.room_id = p_room_id
     AND rm.user_id = v_uid
     AND rm.left_at IS NULL
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_A_MEMBER' USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------- owner --
  IF v_role = 'owner' THEN
    SELECT COALESCE(pg_catalog.array_agg(e.file_path), '{}')
      INTO v_files
      FROM public.room_exercises e
     WHERE e.room_id = p_room_id
       AND e.file_path IS NOT NULL;

    INSERT INTO public.notifications (user_id, type, actor_id, course_id, title, body)
    SELECT rm.user_id, 'room_deleted', v_uid, v_room.course_id,
           pg_catalog.left('החדר „' || v_room.name || '” נמחק', 200),
           'יוצר/ת החדר עזב/ה, ולכן החדר וכל התוכן שלו נמחקו.'
      FROM public.room_members rm
     WHERE rm.room_id = p_room_id
       AND rm.left_at IS NULL
       AND rm.user_id <> v_uid;

    -- Whoever is inside the room leaves the screen. Payload: the id only.
    PERFORM realtime.send(
      pg_catalog.jsonb_build_object('room_id', p_room_id),
      'room_deleted',
      'room:' || p_room_id::text,
      true
    );

    DELETE FROM public.rooms r WHERE r.id = p_room_id;

    RETURN pg_catalog.jsonb_build_object(
      'room_deleted', true,
      'file_paths', pg_catalog.to_jsonb(v_files)
    );
  END IF;

  -- --------------------------------------------------------------- member --
  UPDATE public.room_members rm
     SET left_at = GREATEST(pg_catalog.now(), rm.joined_at),
         role    = 'member'
   WHERE rm.room_id = p_room_id
     AND rm.user_id = v_uid;

  UPDATE public.room_invitations ri
     SET status = 'revoked', responded_at = pg_catalog.now()
   WHERE ri.room_id = p_room_id
     AND ri.inviter_id = v_uid
     AND ri.status = 'pending';

  RETURN pg_catalog.jsonb_build_object('room_deleted', false);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_room(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_room(uuid) TO authenticated;
