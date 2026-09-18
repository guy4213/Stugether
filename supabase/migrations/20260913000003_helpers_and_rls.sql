-- =============================================================================
-- 20260913000003_helpers_and_rls.sql
-- Helper functions, RLS (ENABLE + FORCE) and policies on every public table,
-- Realtime Authorization (realtime.messages) and the 'avatars' Storage bucket.
-- Source of truth: TECHNICAL_SPEC.md §4, §5, §11; SPEC.md §6.
--
-- Conventions
-- * Every helper is SECURITY DEFINER STABLE with search_path = '' and fully
--   schema-qualified references. DEFINER is required: a policy on room_members
--   that reads room_members would otherwise recurse.
-- * EXECUTE is revoked from PUBLIC/anon and granted to authenticated +
--   service_role only (policies evaluate functions with the caller's rights).
-- * auth.uid() is wrapped as (SELECT auth.uid()) in policies so it is evaluated
--   once per statement (initPlan) instead of once per row.
-- * A deactivated profile (is_active = false) is treated as having no access by
--   every room/course helper. The user can still read and update their own
--   profile row (so the app can show "account disabled").
-- * service_role and postgres bypass RLS (BYPASSRLS), so server-side AI writes
--   and SECURITY DEFINER RPCs are not affected by these policies.
-- =============================================================================


-- =============================================================================
-- 1. Helper functions
-- =============================================================================

-- Caller is an active super_admin.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
      AND p.is_active
  );
$$;

-- Caller is an ACTIVE member of the room (left_at IS NULL).
-- Deliberately does NOT check rooms.status: archived/closed rooms are
-- read-only, not hidden (TECHNICAL_SPEC §4.2).
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.room_members rm
    JOIN public.profiles p ON p.id = rm.user_id
    WHERE rm.room_id = p_room_id
      AND rm.user_id = auth.uid()
      AND rm.left_at IS NULL
      AND p.is_active
  );
$$;

-- Caller may write into the room: active member AND room is 'active'.
CREATE OR REPLACE FUNCTION public.can_post_in_room(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_room_member(p_room_id)
     AND EXISTS (
       SELECT 1
       FROM public.rooms r
       WHERE r.id = p_room_id
         AND r.status = 'active'
     );
$$;

-- Caller and p_user_id share at least one course where BOTH enrollments are
-- 'active'. Used for the public mini profile (SPEC §6 #16).
CREATE OR REPLACE FUNCTION public.shares_course_with(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments mine
    JOIN public.enrollments theirs
      ON theirs.course_id = mine.course_id
    JOIN public.profiles me
      ON me.id = mine.user_id
    WHERE mine.user_id = auth.uid()
      AND mine.status = 'active'
      AND me.is_active
      AND theirs.user_id = p_user_id
      AND theirs.status = 'active'
  );
$$;

-- Caller is an ACTIVE member of a room in which p_user_id has (or had) a
-- membership row. Keeps sender names/avatars visible in room history after a
-- roommate left the room or archived/removed the shared course enrollment.
CREATE OR REPLACE FUNCTION public.shares_room_with(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.room_members mine
    JOIN public.profiles me
      ON me.id = mine.user_id
    JOIN public.room_members theirs
      ON theirs.room_id = mine.room_id
    WHERE mine.user_id = auth.uid()
      AND mine.left_at IS NULL
      AND me.is_active
      AND theirs.user_id = p_user_id
  );
$$;

-- Caller has ANY room_members row (active or left) for the room.
-- Used by the rooms SELECT policy to scope the creator branch to the INSERT
-- ... RETURNING check only: the owner row is added by an AFTER trigger, after
-- RETURNING is policy-checked. Once that row exists this is true forever, so a
-- creator who leaves the room loses access like any other ex-member.
-- (The rooms row itself is not read here: the row being inserted is not yet
-- visible to a STABLE function inside the same statement.)
CREATE OR REPLACE FUNCTION public.has_room_membership_row(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members rm
     WHERE rm.room_id = p_room_id
       AND rm.user_id = auth.uid()
  );
$$;

-- Caller has an active enrollment in the course (and an active profile).
-- Used by rooms INSERT and enrollments SELECT (avoids enrollments -> enrollments
-- policy recursion).
CREATE OR REPLACE FUNCTION public.is_enrolled_in_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.profiles p ON p.id = e.user_id
    WHERE e.user_id = auth.uid()
      AND e.course_id = p_course_id
      AND e.status = 'active'
      AND p.is_active
  );
$$;

-- Caller may invite p_invitee_id to p_room_id:
--   * caller can post in the room (active member, active room) and is still
--     actively enrolled in the room's course;
--   * invitee is not the caller, has an active profile and an active enrollment
--     in the room's course;
--   * invitee is not already an active member;
--   * the room is not already full (4 active members incl. creator).
-- Probing is limited to rooms the caller is in, whose course roster the caller
-- can already see, so it leaks nothing new.
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
       JOIN public.enrollments inviter_e
         ON inviter_e.course_id = r.course_id
        AND inviter_e.user_id = auth.uid()
        AND inviter_e.status = 'active'
       JOIN public.enrollments invitee_e
         ON invitee_e.course_id = r.course_id
        AND invitee_e.user_id = p_invitee_id
        AND invitee_e.status = 'active'
       JOIN public.profiles invitee_p
         ON invitee_p.id = p_invitee_id
        AND invitee_p.is_active
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

-- Realtime Authorization for private channels.
--   'room:<uuid>'  receive (SELECT)          -> active room member
--                  send presence (INSERT)    -> active room member
--                  send broadcast (INSERT)   -> can_post_in_room (read-only
--                                               rooms get no typing events)
--   'user:<uuid>'  receive (SELECT)          -> uuid = auth.uid()
--                  send (INSERT)             -> denied (server uses service_role)
--   anything else                            -> false
-- The uuid cast only happens after a strict regex match, so a malformed topic
-- returns false instead of raising invalid_text_representation.
CREATE OR REPLACE FUNCTION public.can_use_realtime_topic(
  p_topic     text,
  p_extension text,
  p_is_write  boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uuid_re constant text :=
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_topic IS NULL THEN
    RETURN false;
  END IF;

  IF pg_catalog.left(p_topic, 5) = 'room:' THEN
    IF pg_catalog.substr(p_topic, 6) !~ v_uuid_re THEN
      RETURN false;
    END IF;
    v_id := pg_catalog.substr(p_topic, 6)::uuid;

    IF NOT COALESCE(p_is_write, true) THEN
      RETURN public.is_room_member(v_id);
    END IF;

    IF p_extension = 'presence' THEN
      RETURN public.is_room_member(v_id);
    ELSIF p_extension = 'broadcast' THEN
      RETURN public.can_post_in_room(v_id);
    END IF;
    RETURN false;
  END IF;

  IF pg_catalog.left(p_topic, 5) = 'user:' THEN
    IF COALESCE(p_is_write, true) THEN
      RETURN false;
    END IF;
    IF pg_catalog.substr(p_topic, 6) !~ v_uuid_re THEN
      RETURN false;
    END IF;
    v_id := pg_catalog.substr(p_topic, 6)::uuid;
    RETURN v_id = auth.uid()
       AND EXISTS (
         SELECT 1 FROM public.profiles p
         WHERE p.id = v_id AND p.is_active
       );
  END IF;

  RETURN false;
END;
$$;

-- Grants: deliberate, no PUBLIC/anon.
REVOKE ALL ON FUNCTION public.is_super_admin()                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_room_member(uuid)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_post_in_room(uuid)                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_course_with(uuid)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_room_with(uuid)                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_room_membership_row(uuid)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_enrolled_in_course(uuid)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_invite_to_room(uuid, uuid)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_use_realtime_topic(text, text, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_super_admin()                         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid)                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_post_in_room(uuid)                   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_course_with(uuid)                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_room_with(uuid)                   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_room_membership_row(uuid)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_enrolled_in_course(uuid)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_invite_to_room(uuid, uuid)           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_use_realtime_topic(text, text, boolean) TO authenticated, service_role;


-- =============================================================================
-- 2. RLS: ENABLE + FORCE on every public table
-- =============================================================================
ALTER TABLE public.institutions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.departments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.courses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.enrollments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.rooms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms            FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.room_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.room_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invitations FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.ai_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_runs          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.app_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings     FORCE  ROW LEVEL SECURITY;

-- Defense in depth on table privileges (RLS is the primary control).
-- TRUNCATE / REFERENCES / TRIGGER are not governed by RLS: remove them.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON
  public.institutions, public.departments, public.courses, public.profiles,
  public.enrollments, public.rooms, public.room_members, public.room_invitations,
  public.messages, public.ai_runs, public.app_settings
FROM PUBLIC, anon, authenticated;

-- anon: read-only catalog, nothing else.
REVOKE INSERT, UPDATE, DELETE ON
  public.institutions, public.departments, public.courses
FROM anon;
REVOKE ALL ON
  public.profiles, public.enrollments, public.rooms, public.room_members,
  public.room_invitations, public.messages, public.ai_runs, public.app_settings
FROM anon;

-- authenticated: operations for which no user policy exists by design.
REVOKE UPDATE, DELETE ON public.messages         FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ai_runs  FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.room_members FROM authenticated;
REVOKE UPDATE, DELETE ON public.room_invitations FROM authenticated;
REVOKE INSERT, DELETE ON public.app_settings     FROM authenticated;
REVOKE INSERT, DELETE ON public.profiles         FROM authenticated;
REVOKE DELETE ON public.rooms                    FROM authenticated;


-- =============================================================================
-- 3. Policies — academic catalog
-- =============================================================================

-- institutions ---------------------------------------------------------------
CREATE POLICY institutions_select_anon
  ON public.institutions FOR SELECT TO anon
  USING (is_active);

CREATE POLICY institutions_select_authenticated
  ON public.institutions FOR SELECT TO authenticated
  USING (is_active OR (SELECT public.is_super_admin()));

CREATE POLICY institutions_insert_super_admin
  ON public.institutions FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

CREATE POLICY institutions_update_super_admin
  ON public.institutions FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

CREATE POLICY institutions_delete_super_admin
  ON public.institutions FOR DELETE TO authenticated
  USING ((SELECT public.is_super_admin()));

-- departments ----------------------------------------------------------------
CREATE POLICY departments_select_anon
  ON public.departments FOR SELECT TO anon
  USING (is_active);

CREATE POLICY departments_select_authenticated
  ON public.departments FOR SELECT TO authenticated
  USING (is_active OR (SELECT public.is_super_admin()));

CREATE POLICY departments_insert_super_admin
  ON public.departments FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

CREATE POLICY departments_update_super_admin
  ON public.departments FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

CREATE POLICY departments_delete_super_admin
  ON public.departments FOR DELETE TO authenticated
  USING ((SELECT public.is_super_admin()));

-- courses --------------------------------------------------------------------
CREATE POLICY courses_select_anon
  ON public.courses FOR SELECT TO anon
  USING (is_active);

CREATE POLICY courses_select_authenticated
  ON public.courses FOR SELECT TO authenticated
  USING (is_active OR (SELECT public.is_super_admin()));

CREATE POLICY courses_insert_super_admin
  ON public.courses FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

CREATE POLICY courses_update_super_admin
  ON public.courses FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

CREATE POLICY courses_delete_super_admin
  ON public.courses FOR DELETE TO authenticated
  USING ((SELECT public.is_super_admin()));


-- =============================================================================
-- 4. Policies — profiles & enrollments
-- =============================================================================

-- profiles -------------------------------------------------------------------
-- No INSERT (created by on_auth_user_created) and no DELETE (deactivation only).
-- The FULL row (bio, last_seen_at, role, is_active, ...) is readable only by
-- its owner and by a super_admin. RLS filters rows, not columns, so other
-- students read the limited public mini profile through public.public_profiles
-- (below) instead of this table (SPEC §4.8, §6 #16).
CREATE POLICY profiles_select_own_or_admin
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.is_super_admin())
  );

-- role / is_active / id / created_at are protected by the
-- profiles_guard_privileged_columns trigger (migration 000001).
CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_super_admin
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

-- public_profiles (view) -----------------------------------------------------
-- Public mini profile: name, avatar, institution, department, study year ONLY.
-- Visible for: self, super_admin, anyone sharing an active course enrollment,
-- and active roommates of a room the target is/was in (so room history keeps
-- sender names after a roommate leaves or drops the course).
-- The view runs with its owner's rights (it must bypass the own/admin-only
-- profiles policy) and applies its own row filter; security_barrier stops
-- caller-supplied predicates from being pushed below that filter.
CREATE VIEW public.public_profiles
WITH (security_barrier = true)
AS
  SELECT p.id,
         p.full_name,
         p.avatar_url,
         p.institution_id,
         p.department_id,
         p.study_year
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

-- enrollments ----------------------------------------------------------------
-- Classmate visibility is scoped to the shared course: a user sees the ACTIVE
-- enrollment rows of courses they are themselves actively enrolled in (the
-- "students in course" roster), not a classmate's other courses.
CREATE POLICY enrollments_select_own_admin_or_same_course
  ON public.enrollments FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_super_admin())
    OR (status = 'active' AND public.is_enrolled_in_course(course_id))
  );

-- Self-enrollment only into an active catalog course, by an active profile.
CREATE POLICY enrollments_insert_own_active_course
  ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_active
    )
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.is_active
    )
  );

-- Own rows (archive / re-activate). Re-activating requires an active course.
CREATE POLICY enrollments_update_own
  ON public.enrollments FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      status <> 'active'
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_id AND c.is_active
      )
    )
  );

CREATE POLICY enrollments_delete_own
  ON public.enrollments FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- =============================================================================
-- 5. Policies — rooms, members, invitations
-- =============================================================================

-- rooms ----------------------------------------------------------------------
-- Spec §4.3: is_room_member(id) OR is_super_admin(). The creator branch exists
-- only so INSERT ... RETURNING (supabase-js .insert().select()) works: the
-- owner membership row is added by an AFTER trigger, after RETURNING is
-- checked. It is true only while the caller has NO room_members row for the
-- room, i.e. during that INSERT; afterwards a creator who left sees nothing.
CREATE POLICY rooms_select_member_or_admin
  ON public.rooms FOR SELECT TO authenticated
  USING (
    public.is_room_member(id)
    OR (SELECT public.is_super_admin())
    OR (created_by = (SELECT auth.uid()) AND NOT public.has_room_membership_row(id))
  );

CREATE POLICY rooms_insert_enrolled_creator
  ON public.rooms FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND status = 'active'
    AND archived_at IS NULL
    AND archived_by IS NULL
    AND NOT archived_by_admin
    AND last_message_at IS NULL
    AND public.is_enrolled_in_course(course_id)
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.is_active
    )
  );

-- No owner UPDATE policy: status changes go through set_room_status(), and
-- rename / topic / AI toggle through update_room() (migration 000004), so an
-- owner can never touch created_by, course_id, last_message_at, archived_*.
CREATE POLICY rooms_update_super_admin
  ON public.rooms FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

-- room_members ---------------------------------------------------------------
-- No user INSERT/UPDATE/DELETE: join/leave/remove/mark-read are RPCs.
CREATE POLICY room_members_select_member_or_admin
  ON public.room_members FOR SELECT TO authenticated
  USING (
    public.is_room_member(room_id)
    OR (SELECT public.is_super_admin())
  );

-- room_invitations -----------------------------------------------------------
CREATE POLICY room_invitations_select_party_or_member
  ON public.room_invitations FOR SELECT TO authenticated
  USING (
    inviter_id = (SELECT auth.uid())
    OR invitee_user_id = (SELECT auth.uid())
    OR public.is_room_member(room_id)
  );

-- A fresh pending invitation only; expiry cannot be pushed past 7 days.
-- No UPDATE/DELETE: accept/decline/revoke/expire are RPCs.
CREATE POLICY room_invitations_insert_member
  ON public.room_invitations FOR INSERT TO authenticated
  WITH CHECK (
    inviter_id = (SELECT auth.uid())
    AND status = 'pending'
    AND responded_at IS NULL
    AND expires_at > now()
    AND expires_at <= now() + interval '7 days'
    AND public.can_invite_to_room(room_id, invitee_user_id)
  );


-- =============================================================================
-- 6. Policies — messages, AI, settings
-- =============================================================================

-- messages -------------------------------------------------------------------
-- SELECT: active members, INCLUDING archived/closed rooms (history stays).
-- There is intentionally NO super_admin SELECT (SPEC §6 #21).
-- A soft-deleted message (deleted_at set) stays visible ONLY to its sender:
-- content is immutable (TECH §6.3), so hiding the row is what makes the delete
-- real for everyone else, including the postgres_changes UPDATE payload.
-- Other members learn about the deletion from the 'message_deleted' broadcast
-- (payload: message id only) sent by soft_delete_message() on 'room:<id>'.
CREATE POLICY messages_select_member
  ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_room_member(room_id)
    AND (deleted_at IS NULL OR sender_id = (SELECT auth.uid()))
  );

-- INSERT: a plain, complete user message by the caller into a room they can
-- post in. created_at must be the server transaction time (no back/forward
-- dating to manipulate ordering or unread counts) — clients must omit it.
-- NO UPDATE and NO DELETE policy: soft delete via soft_delete_message() RPC;
-- AI streaming updates via service_role.
CREATE POLICY messages_insert_user_in_active_room
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND sender_type = 'user'
    AND status = 'complete'
    AND ai_run_id IS NULL
    AND deleted_at IS NULL
    AND created_at = now()
    AND public.can_post_in_room(room_id)
  );

-- ai_runs --------------------------------------------------------------------
-- No user writes (start_ai_run / service_role only).
CREATE POLICY ai_runs_select_member_or_admin
  ON public.ai_runs FOR SELECT TO authenticated
  USING (
    public.is_room_member(room_id)
    OR (SELECT public.is_super_admin())
  );

-- app_settings ---------------------------------------------------------------
CREATE POLICY app_settings_select_authenticated
  ON public.app_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY app_settings_update_super_admin
  ON public.app_settings FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));


-- =============================================================================
-- 7. Realtime Authorization (private channels)
-- Without these, Broadcast and Presence are open to any signed-in user who
-- guesses a room UUID (TECHNICAL_SPEC §4.4). SELECT = receive/join,
-- INSERT = send broadcast / track presence.
-- =============================================================================
CREATE POLICY realtime_topic_receive
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    public.can_use_realtime_topic((SELECT realtime.topic()), extension, false)
  );

CREATE POLICY realtime_topic_send
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    public.can_use_realtime_topic((SELECT realtime.topic()), extension, true)
  );


-- Postgres Changes (TECHNICAL_SPEC §5): room chats subscribe to INSERT/UPDATE
-- on public.messages, which only fires for tables in the supabase_realtime
-- publication. Realtime applies the messages SELECT policy to each change.
-- Idempotent: safe to run on a project where the table was already added.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END
$$;


-- =============================================================================
-- 8. Storage: 'avatars' bucket
-- Public bucket: images are served through the public URL (no SELECT policy is
-- needed for that). Writes, and API listing/reads, are limited to the caller's
-- own folder '<auth.uid()>/'.
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY avatars_select_own_folder
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY avatars_insert_own_folder
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY avatars_update_own_folder
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY avatars_delete_own_folder
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
