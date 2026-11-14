-- =============================================================================
-- Stugether — a Super Admin may also have friends, private chats and blocks
-- (client decision 14.11.2026, Change Request).
--
-- Until now friendships (20261112000010), private chats (20261107000001) and
-- blocks (20261114000010) were student-to-student only. From here on any
-- active account — student or super_admin — can send / receive a friend
-- request, open a private chat, and block / be blocked.
--
-- Privacy is unchanged: a super admin sees only conversations they are a
-- participant of (RLS on conversations / direct_messages is participant-only
-- and is not touched here). Room invitations still exclude super admins.
-- =============================================================================

-- Who may have friends: any active account.
CREATE OR REPLACE FUNCTION public.is_friendable(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_user_id AND p.is_active AND p.role IN ('student', 'super_admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_friendable(uuid) FROM PUBLIC, anon, authenticated;

-- open_conversation(p_other_user_id) — as in 20261107000001, but the two
-- sides may be any active accounts (student or super admin).
CREATE OR REPLACE FUNCTION public.open_conversation(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := public.require_active_caller();
  v_a   uuid;
  v_b   uuid;
  v_id  uuid;
BEGIN
  IF p_other_user_id IS NULL OR p_other_user_id = v_uid THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_friendable(v_uid) OR NOT public.is_friendable(p_other_user_id) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  v_a := LEAST(v_uid, p_other_user_id);
  v_b := GREATEST(v_uid, p_other_user_id);

  INSERT INTO public.conversations (user_a_id, user_b_id)
  VALUES (v_a, v_b)
  ON CONFLICT (user_a_id, user_b_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT c.id INTO v_id
      FROM public.conversations c
     WHERE c.user_a_id = v_a AND c.user_b_id = v_b;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.open_conversation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_conversation(uuid) TO authenticated;

-- block_user(p_user_id) — as in 20261114000010, for any active account.
CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := public.require_active_caller();
BEGIN
  IF p_user_id IS NULL OR p_user_id = v_uid THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_user_id AND p.role IN ('student', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (v_uid, p_user_id)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.friendships f
   WHERE LEAST(f.requester_id, f.addressee_id) = LEAST(v_uid, p_user_id)
     AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(v_uid, p_user_id);

  DELETE FROM public.notifications n
   WHERE n.user_id = v_uid AND n.actor_id = p_user_id
     AND n.type = 'friend_request' AND n.read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- A student must see who they are talking to: a super admin's public profile
-- (name, avatar, ...) becomes visible to the people the admin has a private
-- conversation or a friendship row with. Admins stay out of the student
-- directory (`listed` is still students only).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_social_link(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.conversations c
            WHERE c.user_a_id = LEAST((SELECT auth.uid()), p_user_id)
              AND c.user_b_id = GREATEST((SELECT auth.uid()), p_user_id)
         )
      OR EXISTS (
           SELECT 1 FROM public.friendships f
            WHERE LEAST(f.requester_id, f.addressee_id) = LEAST((SELECT auth.uid()), p_user_id)
              AND GREATEST(f.requester_id, f.addressee_id) = GREATEST((SELECT auth.uid()), p_user_id)
         );
$$;

REVOKE ALL ON FUNCTION public.has_social_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_social_link(uuid) TO authenticated;

-- Same columns as 20261027000001_onboarding.sql; one more visibility branch.
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
         (p.is_active AND p.role = 'student') AS listed,
         p.study_times,
         p.learning_styles
    FROM public.profiles p
   WHERE auth.uid() IS NOT NULL
     AND (
       p.id = auth.uid()
       OR public.is_super_admin()
       OR (p.is_active AND p.role = 'student')
       OR public.shares_room_with(p.id)
       OR (p.is_active AND p.role = 'super_admin' AND public.has_social_link(p.id))
     );

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profiles TO authenticated, service_role;
