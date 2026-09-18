-- =============================================================================
-- 20260913000004_rpcs.sql
-- RPCs: AI run lock, invitations, soft delete, read state, membership, room
-- status, unread summary, pending invitations.
-- Source of truth: TECHNICAL_SPEC.md §3, §4, §6.3-6.4, §11; SPEC.md §4.5, §6.
--
-- Conventions
--   * Every function is SECURITY DEFINER with SET search_path = '' and fully
--     schema-qualified references. The owner (postgres) bypasses RLS, so every
--     function performs its own authorization using auth.uid().
--   * Business errors are raised with the error CODE as the exception MESSAGE
--     (e.g. 'ROOM_FULL'). Authorization failures use SQLSTATE 42501, business
--     rule failures use SQLSTATE P0001. Clients should match on message.
--   * EXECUTE is revoked from PUBLIC, anon and authenticated, then granted
--     deliberately: start_ai_run -> service_role only; everything else ->
--     authenticated. (Supabase default privileges grant EXECUTE on new public
--     functions to anon/authenticated directly, so revoking from PUBLIC alone
--     would not be enough.)
--   * Write RPCs called by users require the caller's profile to be active
--     (profiles.is_active). A deactivated user cannot mutate anything.
--
-- Error codes used
--   NOT_AUTHENTICATED       42501  no auth.uid()
--   NOT_ALLOWED             42501  caller lacks permission / inactive profile
--   NOT_A_MEMBER            42501  caller (or target) is not an active member
--   INVALID_ARGUMENT        22023  NULL / out-of-range argument
--   INVITATION_NOT_FOUND    P0001  no such invitation addressed to the caller
--   INVITATION_NOT_PENDING  P0001  invitation already accepted/declined/revoked
--   ROOM_NOT_ACTIVE         P0001  room is archived or closed
--   ROOM_FULL               P0001  room already has 4 active members
--   MESSAGE_NOT_DELETABLE   P0001  not own user message / older than 5 min / ...
--   CANNOT_REMOVE_SELF      P0001  owner tried to remove themself
--   ROOM_NOT_FOUND          P0001  (super admin only; others get NOT_ALLOWED)
--   INVALID_STATUS_TRANSITION P0001
--   ROOM_ARCHIVED_BY_ADMIN  42501  owner tried to reactivate an admin-archived room
--
-- INVITATION_EXPIRED handling (IMPORTANT for app code):
--   Raising an exception would roll back the "status = 'expired'" update, so
--   accept_room_invitation NEVER raises INVITATION_EXPIRED. Instead it returns
--   NULL. A NULL return value means INVITATION_EXPIRED, always:
--     - pending but expires_at <= now(): status is persisted as 'expired',
--       responded_at stays NULL, and the function returns NULL;
--     - status already 'expired': returns NULL (nothing to update).
--   A successful accept returns the room id (never NULL).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Internal: require an authenticated caller with an active profile.
-- SECURITY INVOKER on purpose: it is only called from inside the SECURITY
-- DEFINER RPCs below (so it runs as their owner). Nobody else may execute it.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.require_active_caller()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = v_uid AND p.is_active
  ) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.require_active_caller() FROM PUBLIC, anon, authenticated, service_role;


-- -----------------------------------------------------------------------------
-- Internal: if the room has no active owner, promote the longest-standing
-- active member (joined_at, then user_id) whose PROFILE is active. Returns the
-- new owner id, or NULL (an owner still exists / nobody eligible).
-- The caller must already hold the room row lock.
-- SECURITY INVOKER; only called from SECURITY DEFINER code below. Nobody else
-- may execute it.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handoff_room_ownership(p_room_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
DECLARE
  v_new_owner uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.room_members rm
     WHERE rm.room_id = p_room_id
       AND rm.role = 'owner'
       AND rm.left_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  SELECT rm.user_id INTO v_new_owner
    FROM public.room_members rm
    JOIN public.profiles p ON p.id = rm.user_id
   WHERE rm.room_id = p_room_id
     AND rm.left_at IS NULL
     AND p.is_active
   ORDER BY rm.joined_at ASC, rm.user_id ASC
   LIMIT 1;

  IF v_new_owner IS NOT NULL THEN
    UPDATE public.room_members rm
       SET role = 'owner'
     WHERE rm.room_id = p_room_id
       AND rm.user_id = v_new_owner;
  END IF;

  RETURN v_new_owner;
END;
$$;

REVOKE ALL ON FUNCTION public.handoff_room_ownership(uuid) FROM PUBLIC, anon, authenticated, service_role;


-- =============================================================================
-- 1. start_ai_run — single transaction (TECHNICAL_SPEC §6.3)
--    Called by the server with the service-role client only.
--    Returns jsonb {run_id, placeholder_message_id, ai_status}
--    ai_status IN ('started','busy','rate_limited','disabled').
-- =============================================================================
CREATE OR REPLACE FUNCTION public.start_ai_run(
  p_room_id              uuid,
  p_trigger_message_id   uuid,
  p_requested_by         uuid,
  p_user_limit_per_hour  int,
  p_room_limit_per_hour  int
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room_status     text;
  v_room_ai_enabled boolean;
  v_app_ai_enabled  boolean;
  v_user_runs       bigint;
  v_room_runs       bigint;
  v_run_id          uuid;
  v_message_id      uuid;
  v_constraint      text;
BEGIN
  IF p_room_id IS NULL OR p_trigger_message_id IS NULL OR p_requested_by IS NULL
     OR p_user_limit_per_hour IS NULL OR p_room_limit_per_hour IS NULL
     OR p_user_limit_per_hour < 0 OR p_room_limit_per_hour < 0 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  -- Serialize start_ai_run per room. NO KEY UPDATE does not conflict with the
  -- KEY SHARE lock taken by FK checks, so message inserts are not blocked by
  -- it (only the brief last_message_at trigger update waits).
  SELECT r.status, r.ai_enabled
    INTO v_room_status, v_room_ai_enabled
    FROM public.rooms r
   WHERE r.id = p_room_id
     FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  -- Requester must be able to post in the room: active profile, active
  -- membership, room active. (Equivalent of can_post_in_room for a user id
  -- that is not auth.uid(), since this runs under service_role.)
  IF v_room_status <> 'active'
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
        WHERE p.id = p_requested_by AND p.is_active
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.room_members rm
        WHERE rm.room_id = p_room_id
          AND rm.user_id = p_requested_by
          AND rm.left_at IS NULL
     ) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  -- Trigger message must be the requester's own, live, user message in this room.
  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
     WHERE m.id = p_trigger_message_id
       AND m.room_id = p_room_id
       AND m.sender_id = p_requested_by
       AND m.sender_type = 'user'
       AND m.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  -- 1. Lazy stale check — against created_at (a queued run has started_at NULL).
  UPDATE public.ai_runs ar
     SET status        = 'failed',
         error_code    = 'stale',
         error_message = COALESCE(ar.error_message, 'Run exceeded 90 seconds without finishing'),
         finished_at   = pg_catalog.now()
   WHERE ar.room_id = p_room_id
     AND ar.status IN ('queued', 'running')
     AND ar.created_at < pg_catalog.now() - interval '90 seconds';

  -- Placeholder messages of stale runs must not stay "streaming" forever.
  UPDATE public.messages m
     SET status = 'failed'
    FROM public.ai_runs ar
   WHERE m.ai_run_id = ar.id
     AND m.room_id = p_room_id
     AND m.status = 'streaming'
     AND ar.room_id = p_room_id
     AND ar.status = 'failed'
     AND ar.error_code = 'stale';

  -- 2. AI enabled (global AND room). Missing settings row = disabled.
  SELECT s.ai_enabled INTO v_app_ai_enabled
    FROM public.app_settings s
   WHERE s.id = 1;

  IF NOT COALESCE(v_app_ai_enabled, false) OR NOT v_room_ai_enabled THEN
    RETURN pg_catalog.jsonb_build_object(
      'run_id', NULL, 'placeholder_message_id', NULL, 'ai_status', 'disabled');
  END IF;

  -- 3. Rate limit — every run created in the last hour counts, whatever its status.
  SELECT pg_catalog.count(*) INTO v_user_runs
    FROM public.ai_runs ar
   WHERE ar.requested_by = p_requested_by
     AND ar.created_at > pg_catalog.now() - interval '1 hour';

  SELECT pg_catalog.count(*) INTO v_room_runs
    FROM public.ai_runs ar
   WHERE ar.room_id = p_room_id
     AND ar.created_at > pg_catalog.now() - interval '1 hour';

  IF v_user_runs >= p_user_limit_per_hour OR v_room_runs >= p_room_limit_per_hour THEN
    RETURN pg_catalog.jsonb_build_object(
      'run_id', NULL, 'placeholder_message_id', NULL, 'ai_status', 'rate_limited');
  END IF;

  -- 4. Acquire the lock: one active run per room (partial unique index).
  --    The sub-block's implicit savepoint rolls back only this INSERT.
  BEGIN
    INSERT INTO public.ai_runs (room_id, trigger_message_id, requested_by, status)
    VALUES (p_room_id, p_trigger_message_id, p_requested_by, 'queued')
    RETURNING id INTO v_run_id;
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint = 'ai_runs_one_active_per_room' THEN
        RETURN pg_catalog.jsonb_build_object(
          'run_id', NULL, 'placeholder_message_id', NULL, 'ai_status', 'busy');
      END IF;
      RAISE;
  END;

  -- 5. Placeholder AI message. Deliberately OUTSIDE the sub-block: if it fails,
  --    the whole transaction (including the ai_runs row) rolls back, so there is
  --    never an active run without a placeholder or an orphan placeholder.
  INSERT INTO public.messages (room_id, sender_id, sender_type, content, status, ai_run_id)
  VALUES (p_room_id, NULL, 'ai', '', 'streaming', v_run_id)
  RETURNING id INTO v_message_id;

  -- 6.
  RETURN pg_catalog.jsonb_build_object(
    'run_id', v_run_id,
    'placeholder_message_id', v_message_id,
    'ai_status', 'started');
END;
$$;

REVOKE ALL ON FUNCTION public.start_ai_run(uuid, uuid, uuid, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_ai_run(uuid, uuid, uuid, int, int) TO service_role;


-- =============================================================================
-- 2. accept_room_invitation(p_invitation_id) -> room id, or NULL = EXPIRED
-- =============================================================================
CREATE OR REPLACE FUNCTION public.accept_room_invitation(p_invitation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid          uuid := public.require_active_caller();
  v_room_id      uuid;
  v_inv          public.room_invitations%ROWTYPE;
  v_room_status  text;
  v_course_id    uuid;
  v_active_count bigint;
BEGIN
  IF p_invitation_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  -- Find the room without locking; invitations addressed to someone else are
  -- reported as not found (do not leak their existence).
  SELECT ri.room_id INTO v_room_id
    FROM public.room_invitations ri
   WHERE ri.id = p_invitation_id
     AND ri.invitee_user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- Lock order: room first, then invitation. Concurrent accepts for the same
  -- room serialize here, so the capacity count below is race-free.
  SELECT r.status, r.course_id INTO v_room_status, v_course_id
    FROM public.rooms r
   WHERE r.id = v_room_id
     FOR UPDATE;

  -- Re-read the invitation under lock (it may have changed while waiting).
  SELECT * INTO v_inv
    FROM public.room_invitations ri
   WHERE ri.id = p_invitation_id
     AND ri.invitee_user_id = v_uid
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.status = 'expired' THEN
    RETURN NULL;  -- INVITATION_EXPIRED
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'INVITATION_NOT_PENDING' USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.expires_at <= pg_catalog.now() THEN
    UPDATE public.room_invitations
       SET status = 'expired'
     WHERE id = v_inv.id;
    RETURN NULL;  -- INVITATION_EXPIRED (update persists because we do not raise)
  END IF;

  IF v_room_status <> 'active' THEN
    RAISE EXCEPTION 'ROOM_NOT_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  -- Invitee must still be actively enrolled in the room's course.
  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments e
     WHERE e.user_id = v_uid
       AND e.course_id = v_course_id
       AND e.status = 'active'
  ) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  -- Already an active member: just close the invitation.
  IF NOT EXISTS (
    SELECT 1 FROM public.room_members rm
     WHERE rm.room_id = v_room_id AND rm.user_id = v_uid AND rm.left_at IS NULL
  ) THEN
    SELECT pg_catalog.count(*) INTO v_active_count
      FROM public.room_members rm
     WHERE rm.room_id = v_room_id
       AND rm.left_at IS NULL;

    IF v_active_count >= 4 THEN
      RAISE EXCEPTION 'ROOM_FULL' USING ERRCODE = 'P0001';
    END IF;

    -- Re-activate a previous membership row (left / removed) or insert a new one.
    INSERT INTO public.room_members (room_id, user_id, role, joined_at, left_at, last_read_at)
    VALUES (v_room_id, v_uid, 'member', pg_catalog.now(), NULL, pg_catalog.now())
    ON CONFLICT (room_id, user_id) DO UPDATE
      SET role         = 'member',
          joined_at    = pg_catalog.now(),
          left_at      = NULL,
          last_read_at = pg_catalog.now();
  END IF;

  UPDATE public.room_invitations
     SET status = 'accepted',
         responded_at = pg_catalog.now()
   WHERE id = v_inv.id;

  RETURN v_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_room_invitation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_room_invitation(uuid) TO authenticated;


-- =============================================================================
-- 3. decline_room_invitation(p_invitation_id) — invitee only, pending only.
--    A pending invitation that is already past expires_at is marked 'expired'
--    (not 'declined') and the call succeeds silently: the invitee's goal —
--    the invitation is gone — is achieved either way.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.decline_room_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := public.require_active_caller();
  v_inv public.room_invitations%ROWTYPE;
BEGIN
  IF p_invitation_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_inv
    FROM public.room_invitations ri
   WHERE ri.id = p_invitation_id
     AND ri.invitee_user_id = v_uid
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'INVITATION_NOT_PENDING' USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.expires_at <= pg_catalog.now() THEN
    UPDATE public.room_invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN;
  END IF;

  UPDATE public.room_invitations
     SET status = 'declined',
         responded_at = pg_catalog.now()
   WHERE id = v_inv.id;
END;
$$;

REVOKE ALL ON FUNCTION public.decline_room_invitation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decline_room_invitation(uuid) TO authenticated;


-- =============================================================================
-- 4. revoke_room_invitation(p_invitation_id) — inviter only, pending only.
--    Invitations not sent by the caller are reported as not found.
--    responded_at records when the invitation reached its terminal state.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.revoke_room_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := public.require_active_caller();
  v_inv public.room_invitations%ROWTYPE;
BEGIN
  IF p_invitation_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_inv
    FROM public.room_invitations ri
   WHERE ri.id = p_invitation_id
     AND ri.inviter_id = v_uid
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'INVITATION_NOT_PENDING' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.room_invitations
     SET status = 'revoked',
         responded_at = pg_catalog.now()
   WHERE id = v_inv.id;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_room_invitation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_room_invitation(uuid) TO authenticated;


-- =============================================================================
-- 5. soft_delete_message(p_message_id) — own user message, within 5 minutes,
--    caller can still post in the room (active member, room active).
--    Writes deleted_at ONLY. Any failure -> MESSAGE_NOT_DELETABLE (no detail,
--    so it cannot be used to probe other rooms' message ids).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.soft_delete_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     uuid := public.require_active_caller();
  v_room_id uuid;
BEGIN
  UPDATE public.messages m
     SET deleted_at = pg_catalog.now()
   WHERE m.id = p_message_id
     AND m.sender_id = v_uid
     AND m.sender_type = 'user'
     AND m.deleted_at IS NULL
     AND m.created_at > pg_catalog.now() - interval '5 minutes'
     AND EXISTS (
       SELECT 1
         FROM public.room_members rm
         JOIN public.rooms r ON r.id = rm.room_id
        WHERE rm.room_id = m.room_id
          AND rm.user_id = v_uid
          AND rm.left_at IS NULL
          AND r.status = 'active'
     )
  RETURNING m.room_id INTO v_room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MESSAGE_NOT_DELETABLE' USING ERRCODE = 'P0001';
  END IF;

  -- After the delete, other members can no longer SELECT the row (messages
  -- SELECT hides deleted rows from everyone but the sender), so the
  -- postgres_changes UPDATE is not delivered to them. Tell the room on its
  -- private channel instead; the payload carries the id only, never content.
  PERFORM realtime.send(
    pg_catalog.jsonb_build_object('id', p_message_id, 'room_id', v_room_id),
    'message_deleted',
    'room:' || v_room_id::text,
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_message(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_message(uuid) TO authenticated;


-- =============================================================================
-- 6. mark_room_read(p_room_id) — own last_read_at = now(), active membership.
--    Allowed in archived/closed rooms too (read-only, not hidden).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.mark_room_read(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := public.require_active_caller();
BEGIN
  UPDATE public.room_members rm
     SET last_read_at = GREATEST(COALESCE(rm.last_read_at, pg_catalog.now()), pg_catalog.now())
   WHERE rm.room_id = p_room_id
     AND rm.user_id = v_uid
     AND rm.left_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_A_MEMBER' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_room_read(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_room_read(uuid) TO authenticated;


-- =============================================================================
-- 7. leave_room(p_room_id) — sets own left_at. Allowed in any room status.
--    If the owner leaves, the longest-standing active member (joined_at, then
--    user_id as tie-breaker) becomes owner; if none remain the room is ownerless.
--    The leaver's role is reset to 'member' so a later re-join does not
--    restore ownership. Pending invitations the leaver sent for this room are
--    revoked (they must not keep admitting people on their behalf).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.leave_room(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       uuid := public.require_active_caller();
  v_role      text;
BEGIN
  IF p_room_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  -- Same lock order as accept_room_invitation: room, then members.
  PERFORM 1 FROM public.rooms r WHERE r.id = p_room_id FOR UPDATE;

  SELECT rm.role INTO v_role
    FROM public.room_members rm
   WHERE rm.room_id = p_room_id
     AND rm.user_id = v_uid
     AND rm.left_at IS NULL
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_A_MEMBER' USING ERRCODE = '42501';
  END IF;

  UPDATE public.room_members rm
     SET left_at = GREATEST(pg_catalog.now(), rm.joined_at),
         role    = 'member'
   WHERE rm.room_id = p_room_id
     AND rm.user_id = v_uid;

  IF v_role = 'owner' THEN
    PERFORM public.handoff_room_ownership(p_room_id);
  END IF;

  UPDATE public.room_invitations ri
     SET status = 'revoked', responded_at = pg_catalog.now()
   WHERE ri.room_id = p_room_id
     AND ri.inviter_id = v_uid
     AND ri.status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.leave_room(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_room(uuid) TO authenticated;


-- =============================================================================
-- 8. remove_room_member(p_room_id, p_user_id) — active owner only, cannot
--    remove self, room must be active (archived/closed rooms are read-only).
--    Pending invitations sent by the removed member for this room are revoked.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.remove_room_member(p_room_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid         uuid := public.require_active_caller();
  v_room_status text;
BEGIN
  IF p_room_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  SELECT r.status INTO v_room_status
    FROM public.rooms r
   WHERE r.id = p_room_id
     FOR UPDATE;

  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.room_members rm
     WHERE rm.room_id = p_room_id
       AND rm.user_id = v_uid
       AND rm.role = 'owner'
       AND rm.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = v_uid THEN
    RAISE EXCEPTION 'CANNOT_REMOVE_SELF' USING ERRCODE = 'P0001';
  END IF;

  IF v_room_status <> 'active' THEN
    RAISE EXCEPTION 'ROOM_NOT_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.room_members rm
     SET left_at = GREATEST(pg_catalog.now(), rm.joined_at),
         role    = 'member'
   WHERE rm.room_id = p_room_id
     AND rm.user_id = p_user_id
     AND rm.left_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_A_MEMBER' USING ERRCODE = '42501';
  END IF;

  UPDATE public.room_invitations ri
     SET status = 'revoked', responded_at = pg_catalog.now()
   WHERE ri.room_id = p_room_id
     AND ri.inviter_id = p_user_id
     AND ri.status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.remove_room_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_room_member(uuid, uuid) TO authenticated;


-- =============================================================================
-- 9. set_room_status(p_room_id, p_status) — active owner or super admin.
--    Transitions: active->archived, active->closed, archived->active,
--    archived->closed. closed is terminal. Same status = no-op.
--    archived_at: ->archived sets now(); ->active clears it; ->closed keeps an
--    existing archived_at or sets now() (the moment the room became read-only).
--    Closing a room revokes its pending invitations.
--    archived->active: a super_admin always; an owner only when the room was
--    NOT archived by a super_admin (ROOM_ARCHIVED_BY_ADMIN) and the owner is
--    still actively enrolled in the room's active course (NOT_ALLOWED).
-- =============================================================================
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
  IF p_room_id IS NULL OR p_status IS NULL
     OR p_status NOT IN ('active', 'archived', 'closed') THEN
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

  IF NOT (
       (v_current = 'active'   AND p_status IN ('archived', 'closed'))
    OR (v_current = 'archived' AND p_status IN ('active', 'closed'))
  ) THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION' USING ERRCODE = 'P0001';
  END IF;

  -- Reactivation by an owner (spec is silent; most secure option):
  --   * never for a room a super_admin archived (admin moderation stands);
  --   * the owner must still be actively enrolled in the room's course and
  --     the course must be active (same bar as creating the room).
  IF p_status = 'active' AND NOT v_is_admin THEN
    IF EXISTS (
      SELECT 1 FROM public.rooms r
       WHERE r.id = p_room_id AND r.archived_by_admin
    ) THEN
      RAISE EXCEPTION 'ROOM_ARCHIVED_BY_ADMIN' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public.rooms r
        JOIN public.courses c     ON c.id = r.course_id AND c.is_active
        JOIN public.enrollments e ON e.course_id = r.course_id
                                 AND e.user_id = v_uid
                                 AND e.status = 'active'
       WHERE r.id = p_room_id
    ) THEN
      RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- archived_by / archived_by_admin are maintained by the
  -- rooms_track_status_change trigger (migration 000002).
  UPDATE public.rooms r
     SET status = p_status,
         archived_at = CASE p_status
                         WHEN 'archived' THEN pg_catalog.now()
                         WHEN 'active'   THEN NULL
                         ELSE COALESCE(r.archived_at, pg_catalog.now())
                       END
   WHERE r.id = p_room_id;

  IF p_status = 'closed' THEN
    UPDATE public.room_invitations ri
       SET status = 'revoked', responded_at = pg_catalog.now()
     WHERE ri.room_id = p_room_id
       AND ri.status = 'pending';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_room_status(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_room_status(uuid, text) TO authenticated;


-- =============================================================================
-- 10. get_unread_summary() — one row per room where the caller is an active
--     member (archived/closed included). Counts live messages newer than
--     last_read_at that the caller did not send (AI/system messages count).
--     Only ever returns the caller's own data.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_unread_summary()
RETURNS TABLE (room_id uuid, unread_count bigint, last_message_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT rm.room_id,
         (
           SELECT pg_catalog.count(*)
             FROM public.messages m
            WHERE m.room_id = rm.room_id
              AND m.deleted_at IS NULL
              AND m.created_at > COALESCE(rm.last_read_at, '-infinity'::timestamptz)
              AND m.sender_id IS DISTINCT FROM auth.uid()
         ) AS unread_count,
         r.last_message_at
    FROM public.room_members rm
    JOIN public.rooms r ON r.id = rm.room_id
   WHERE auth.uid() IS NOT NULL
     AND rm.user_id = auth.uid()
     AND rm.left_at IS NULL
   ORDER BY r.last_message_at DESC NULLS LAST, rm.room_id;
$$;

REVOKE ALL ON FUNCTION public.get_unread_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_summary() TO authenticated;


-- =============================================================================
-- 11. get_pending_invitations() — the caller's invitations that are really
--     pending: status = 'pending' AND expires_at > now() (no cron, so both
--     conditions are required), and only for rooms that are still active
--     (an invitation to an archived room cannot be accepted anyway).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_invitations()
RETURNS TABLE (
  id                 uuid,
  room_id            uuid,
  room_name          text,
  room_topic         text,
  course_id          uuid,
  course_name        text,
  course_code        text,
  inviter_id         uuid,
  inviter_name       text,
  inviter_avatar_url text,
  expires_at         timestamptz,
  created_at         timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ri.id,
         ri.room_id,
         r.name,
         r.topic,
         c.id,
         c.name,
         c.code,
         ri.inviter_id,
         p.full_name,
         p.avatar_url,
         ri.expires_at,
         ri.created_at
    FROM public.room_invitations ri
    JOIN public.rooms    r ON r.id = ri.room_id
    JOIN public.courses  c ON c.id = r.course_id
    JOIN public.profiles p ON p.id = ri.inviter_id
   WHERE auth.uid() IS NOT NULL
     AND ri.invitee_user_id = auth.uid()
     AND ri.status = 'pending'
     AND ri.expires_at > pg_catalog.now()
     AND r.status = 'active'
   ORDER BY ri.created_at DESC, ri.id;
$$;

REVOKE ALL ON FUNCTION public.get_pending_invitations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_invitations() TO authenticated;


-- =============================================================================
-- 12. Lazy expiry on re-invite (trigger, not callable).
--     There is no cron, so an expired invitation keeps status 'pending' until
--     someone tries to accept/decline it. The partial unique index
--     room_invitations_one_pending_per_invitee would then block a NEW invitation
--     to the same user for that room forever. Before inserting, mark any
--     pending-but-expired invitation for the same (room, invitee) as 'expired'.
--     Only rows that are genuinely past expires_at are touched. RLS WITH CHECK
--     on the new row runs after BEFORE triggers; if it fails, the statement
--     errors and this update is rolled back with it (no side effect).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.expire_stale_invitations_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.room_invitations ri
     SET status = 'expired'
   WHERE ri.room_id = NEW.room_id
     AND ri.invitee_user_id = NEW.invitee_user_id
     AND ri.status = 'pending'
     AND ri.expires_at <= pg_catalog.now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_invitations_before_insert() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER room_invitations_expire_stale_before_insert
  BEFORE INSERT ON public.room_invitations
  FOR EACH ROW EXECUTE FUNCTION public.expire_stale_invitations_before_insert();


-- =============================================================================
-- 13. update_room(p_room_id, p_name, p_topic, p_ai_enabled)
--     TECHNICAL_SPEC §4.3 rooms UPDATE: owner OR super_admin. Only name, topic
--     and ai_enabled can change here (status: set_room_status).
--       * NULL argument = leave that column unchanged;
--       * p_topic that is blank after trimming clears the topic (NULL).
--     Owner: active owner membership, room must be 'active' (archived/closed
--     rooms are read-only). Super admin: any room (metadata management).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_room(
  p_room_id    uuid,
  p_name       text    DEFAULT NULL,
  p_topic      text    DEFAULT NULL,
  p_ai_enabled boolean DEFAULT NULL
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
         ai_enabled = COALESCE(p_ai_enabled, r.ai_enabled)
   WHERE r.id = p_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_room(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_room(uuid, text, text, boolean) TO authenticated;


-- =============================================================================
-- 14. Admin statistics — aggregates ONLY, never message content
--     (SPEC §2, §4.9; §6 #21). messages has no super_admin SELECT policy, so
--     these SECURITY DEFINER functions are the admin's only path to counts.
--     Both require an active super_admin caller (NOT_ALLOWED otherwise).
--     Soft-deleted messages are not counted.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_room_stats()
RETURNS TABLE (
  room_id         uuid,
  member_count    bigint,
  message_count   bigint,
  last_message_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.require_active_caller();
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT r.id,
         (SELECT pg_catalog.count(*) FROM public.room_members rm
           WHERE rm.room_id = r.id AND rm.left_at IS NULL),
         (SELECT pg_catalog.count(*) FROM public.messages m
           WHERE m.room_id = r.id AND m.deleted_at IS NULL),
         r.last_message_at
    FROM public.rooms r
   ORDER BY r.last_message_at DESC NULLS LAST, r.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_room_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_room_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_global_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.require_active_caller();
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'users_total',     (SELECT pg_catalog.count(*) FROM public.profiles),
    'users_active_7d', (SELECT pg_catalog.count(*) FROM public.profiles p
                         WHERE p.last_seen_at > pg_catalog.now() - interval '7 days'),
    'rooms_total',     (SELECT pg_catalog.count(*) FROM public.rooms),
    'rooms_active',    (SELECT pg_catalog.count(*) FROM public.rooms r WHERE r.status = 'active'),
    'messages_total',  (SELECT pg_catalog.count(*) FROM public.messages m WHERE m.deleted_at IS NULL),
    'ai_runs_total',   (SELECT pg_catalog.count(*) FROM public.ai_runs),
    'ai_runs_failed',  (SELECT pg_catalog.count(*) FROM public.ai_runs ar WHERE ar.status = 'failed')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_global_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_global_stats() TO authenticated;


-- =============================================================================
-- 15. Deactivation releases rooms (trigger, not callable).
--     When a profile goes is_active true -> false (super_admin action), the
--     user stops occupying seats and ownership:
--       * every active membership gets left_at (role reset to 'member');
--       * rooms they owned are handed to the longest-standing active member
--         with an active profile (handoff_room_ownership);
--       * pending invitations they sent or received are revoked.
--     Reactivation does NOT restore memberships: the user must be re-invited
--     (so no room can exceed 4 active members when a user is reactivated).
--     Lock order: room row, then members (same as accept/leave).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.release_rooms_on_profile_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room record;
BEGIN
  FOR v_room IN
    SELECT rm.room_id, rm.role
      FROM public.room_members rm
     WHERE rm.user_id = NEW.id
       AND rm.left_at IS NULL
     ORDER BY rm.room_id
  LOOP
    PERFORM 1 FROM public.rooms r WHERE r.id = v_room.room_id FOR UPDATE;

    UPDATE public.room_members rm
       SET left_at = GREATEST(pg_catalog.now(), rm.joined_at),
           role    = 'member'
     WHERE rm.room_id = v_room.room_id
       AND rm.user_id = NEW.id
       AND rm.left_at IS NULL;

    IF v_room.role = 'owner' THEN
      PERFORM public.handoff_room_ownership(v_room.room_id);
    END IF;
  END LOOP;

  UPDATE public.room_invitations ri
     SET status = 'revoked', responded_at = pg_catalog.now()
   WHERE ri.status = 'pending'
     AND (ri.inviter_id = NEW.id OR ri.invitee_user_id = NEW.id);

  RETURN NULL;  -- AFTER trigger
END;
$$;

REVOKE ALL ON FUNCTION public.release_rooms_on_profile_deactivation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER profiles_release_rooms_on_deactivation
  AFTER UPDATE OF is_active ON public.profiles
  FOR EACH ROW
  WHEN (OLD.is_active AND NOT NEW.is_active)
  EXECUTE FUNCTION public.release_rooms_on_profile_deactivation();
