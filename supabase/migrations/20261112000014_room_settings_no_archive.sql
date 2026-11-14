-- =============================================================================
-- Study room: no more archiving; room settings (client QA 12.11.2026, CR)
-- =============================================================================
-- 1. "תמחק את פיצ'ר הארכוב חדר": a room is 'active' or 'closed'. Closing
--    (read-only, final) stays. Existing archived rooms become closed — they
--    were read-only already. archived_at / archived_by / archived_by_admin
--    keep describing the moment / who made the room read-only (closing).
-- 2. Room settings dialog: the owner can open / close the room to classmates
--    after creating it — update_room gains p_is_open.
-- Everything else checks `status <> 'active'` / `= 'active'` and is unchanged.

-- -----------------------------------------------------------------------------
-- 1. Status: active | closed
-- -----------------------------------------------------------------------------
UPDATE public.rooms SET status = 'closed' WHERE status = 'archived';

ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('active', 'closed'));

COMMENT ON COLUMN public.rooms.archived_at IS
  'When the room became read-only (closed). Name kept from the removed archive status.';
COMMENT ON COLUMN public.rooms.archived_by IS 'Who closed the room.';
COMMENT ON COLUMN public.rooms.archived_by_admin IS 'True when a super_admin closed the room.';

-- set_room_status(p_room_id, p_status) — active owner or super admin.
-- The only transition left is active -> closed (final). Same status = no-op.
-- Closing revokes the room's pending invitations (as before).
CREATE OR REPLACE FUNCTION public.set_room_status(p_room_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      uuid := public.require_active_caller();
  v_is_admin boolean;
  v_current  text;
BEGIN
  IF p_room_id IS NULL OR p_status IS NULL OR p_status NOT IN ('active', 'closed') THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  v_is_admin := EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = v_uid AND p.role = 'super_admin' AND p.is_active
  );

  SELECT r.status INTO v_current
    FROM public.rooms r
   WHERE r.id = p_room_id
     FOR UPDATE;

  IF NOT FOUND THEN
    IF v_is_admin THEN
      RAISE EXCEPTION 'ROOM_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_admin AND NOT EXISTS (
    SELECT 1 FROM public.room_members rm
     WHERE rm.room_id = p_room_id
       AND rm.user_id = v_uid
       AND rm.role = 'owner'
       AND rm.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  IF v_current = p_status THEN
    RETURN;
  END IF;

  IF NOT (v_current = 'active' AND p_status = 'closed') THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION' USING ERRCODE = 'P0001';
  END IF;

  -- archived_by / archived_by_admin: the rooms_track_status_change trigger.
  UPDATE public.rooms r
     SET status = 'closed',
         archived_at = COALESCE(r.archived_at, pg_catalog.now())
   WHERE r.id = p_room_id;

  UPDATE public.room_invitations ri
     SET status = 'revoked', responded_at = pg_catalog.now()
   WHERE ri.room_id = p_room_id
     AND ri.status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.set_room_status(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_room_status(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. update_room(..., p_is_open): open / close the room to classmates.
--    New signature, so the old one is dropped first. Same rules: NULL = keep;
--    owner of an active room, or a super_admin.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_room(uuid, text, text, boolean);

CREATE FUNCTION public.update_room(
  p_room_id    uuid,
  p_name       text    DEFAULT NULL,
  p_topic      text    DEFAULT NULL,
  p_ai_enabled boolean DEFAULT NULL,
  p_is_open    boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      uuid := public.require_active_caller();
  v_is_admin boolean;
  v_status   text;
BEGIN
  IF p_room_id IS NULL
     OR (p_name IS NOT NULL AND pg_catalog.char_length(pg_catalog.btrim(p_name)) NOT BETWEEN 1 AND 100)
     OR (p_topic IS NOT NULL AND pg_catalog.char_length(p_topic) > 500) THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  v_is_admin := EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = v_uid AND p.role = 'super_admin' AND p.is_active
  );

  SELECT r.status INTO v_status
    FROM public.rooms r
   WHERE r.id = p_room_id
     FOR UPDATE;

  IF NOT FOUND THEN
    IF v_is_admin THEN
      RAISE EXCEPTION 'ROOM_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_admin THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.room_members rm
       WHERE rm.room_id = p_room_id
         AND rm.user_id = v_uid
         AND rm.role = 'owner'
         AND rm.left_at IS NULL
    ) THEN
      RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
    END IF;

    IF v_status <> 'active' THEN
      RAISE EXCEPTION 'ROOM_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.rooms r
     SET name       = COALESCE(pg_catalog.btrim(p_name), r.name),
         topic      = CASE
                        WHEN p_topic IS NULL THEN r.topic
                        WHEN pg_catalog.btrim(p_topic) = '' THEN NULL
                        ELSE p_topic
                      END,
         ai_enabled = COALESCE(p_ai_enabled, r.ai_enabled),
         is_open    = COALESCE(p_is_open, r.is_open)
   WHERE r.id = p_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_room(uuid, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_room(uuid, text, text, boolean, boolean) TO authenticated;
