-- =============================================================================
-- Change Request (07.11.2026): "הזמנה ללמידה" without a shared course.
--
-- Until now an invitation needed the invitee to be enrolled in the room's
-- course (can_invite_to_room) and still enrolled when accepting
-- (accept_room_invitation, NOT_ALLOWED). Now any active student can be
-- invited to a room of one of the inviter's courses; accepting enrolls the
-- invitee in that course (or re-activates an archived enrollment) in the same
-- transaction as joining the room.
--
-- Unchanged: the inviter must be an active member of an active room and
-- actively enrolled in its course; 4 members max; 7-day expiry; the course
-- must be an active catalog course (the only kind a student can enroll in).
-- A super_admin is never invitable: room membership would show them message
-- content (SPEC: the admin sees metadata only).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.can_invite_to_room(p_room_id uuid, p_invitee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_invitee_id IS NOT NULL
     AND p_invitee_id <> auth.uid()
     AND public.can_post_in_room(p_room_id)
     AND EXISTS (
       SELECT 1
       FROM public.rooms r
       JOIN public.courses c
         ON c.id = r.course_id
        AND c.is_active
       JOIN public.enrollments inviter_e
         ON inviter_e.course_id = r.course_id
        AND inviter_e.user_id = auth.uid()
        AND inviter_e.status = 'active'
       JOIN public.profiles invitee_p
         ON invitee_p.id = p_invitee_id
        AND invitee_p.is_active
        AND invitee_p.role = 'student'
       WHERE r.id = p_room_id
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.room_members rm
       WHERE rm.room_id = p_room_id
         AND rm.user_id = p_invitee_id
         AND rm.left_at IS NULL
     )
     AND (
       SELECT count(*)
       FROM public.room_members rm
       WHERE rm.room_id = p_room_id
         AND rm.left_at IS NULL
     ) < 4;
$$;

-- Same as 20260913000004 except the enrollment step: an invitee who is not
-- (or no longer) enrolled is enrolled now, as long as the course is active.
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

  -- Not enrolled in the room's course: enroll now (active catalog course
  -- only, like the self-enrollment policy). A super_admin never gets here as
  -- an invitee (can_invite_to_room), but is refused anyway.
  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments e
     WHERE e.user_id = v_uid
       AND e.course_id = v_course_id
       AND e.status = 'active'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = v_course_id AND c.is_active
    ) OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.role <> 'student'
    ) THEN
      RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.enrollments (user_id, course_id, status)
    VALUES (v_uid, v_course_id, 'active')
    ON CONFLICT (user_id, course_id) DO UPDATE
      SET status = 'active';
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
