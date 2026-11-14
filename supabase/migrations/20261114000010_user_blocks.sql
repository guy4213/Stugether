-- =============================================================================
-- Stugether — blocking a student (client QA 14.11.2026, Change Request).
--
-- Private messages stay open between any two students; a student who is
-- bothered blocks the other. A block (in either direction) means:
--   * no new private conversation and no new private message between the two;
--   * no friend request between the two (an existing friendship is removed);
--   * the two are hidden from each other's student lists (the app filters by
--     list_hidden_user_ids()).
-- Enforced with BEFORE INSERT triggers on the written tables, so every path
-- that writes them (open_conversation, send_direct_message,
-- send_friend_request) is covered without re-creating those functions.
-- =============================================================================

CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX user_blocks_blocked_idx ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks FORCE ROW LEVEL SECURITY;

-- I see only the blocks I made. Who blocked me is never readable as rows.
CREATE POLICY user_blocks_select_own
  ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = (SELECT auth.uid()));

REVOKE ALL ON public.user_blocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_blocks TO authenticated;

-- -----------------------------------------------------------------------------
-- is_blocked_between(a, b): a block in either direction.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_blocked_between(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks b
     WHERE (b.blocker_id = p_a AND b.blocked_id = p_b)
        OR (b.blocker_id = p_b AND b.blocked_id = p_a)
  );
$$;

REVOKE ALL ON FUNCTION public.is_blocked_between(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- block_user(p_user_id) / unblock_user(p_user_id). Students only; idempotent.
-- Blocking removes a friendship or a pending request between the two.
-- -----------------------------------------------------------------------------
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.role = 'student')
     OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id AND p.role = 'student')
  THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (v_uid, p_user_id)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.friendships f
   WHERE LEAST(f.requester_id, f.addressee_id) = LEAST(v_uid, p_user_id)
     AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(v_uid, p_user_id);

  -- Their unread friend request to me goes away with it.
  DELETE FROM public.notifications n
   WHERE n.user_id = v_uid AND n.actor_id = p_user_id
     AND n.type = 'friend_request' AND n.read_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := public.require_active_caller();
BEGIN
  DELETE FROM public.user_blocks b WHERE b.blocker_id = v_uid AND b.blocked_id = p_user_id;
END;
$$;

-- list_hidden_user_ids(): everyone I blocked or who blocked me — ids only,
-- for filtering student lists. (A student can infer a block from someone
-- missing; that is the accepted trade-off of "we don't see each other".)
CREATE OR REPLACE FUNCTION public.list_hidden_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT b.blocked_id FROM public.user_blocks b WHERE b.blocker_id = (SELECT auth.uid())
  UNION
  SELECT b.blocker_id FROM public.user_blocks b WHERE b.blocked_id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.block_user(uuid)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unblock_user(uuid)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_hidden_user_ids()   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_hidden_user_ids() TO authenticated;

-- -----------------------------------------------------------------------------
-- Enforcement triggers.
-- -----------------------------------------------------------------------------

-- A new private conversation (open_conversation's INSERT ... ON CONFLICT: a
-- BEFORE INSERT trigger fires before the conflict check, so reopening an
-- existing conversation with a blocked student is refused too).
CREATE OR REPLACE FUNCTION public.conversations_block_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.is_blocked_between(NEW.user_a_id, NEW.user_b_id) THEN
    RAISE EXCEPTION 'BLOCKED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER conversations_block_guard
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.conversations_block_guard();

-- A private message: the sender and the other participant.
CREATE OR REPLACE FUNCTION public.direct_messages_block_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_other uuid;
BEGIN
  SELECT CASE WHEN c.user_a_id = NEW.sender_id THEN c.user_b_id ELSE c.user_a_id END
    INTO v_other
    FROM public.conversations c WHERE c.id = NEW.conversation_id;
  IF v_other IS NOT NULL AND public.is_blocked_between(NEW.sender_id, v_other) THEN
    RAISE EXCEPTION 'BLOCKED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER direct_messages_block_guard
  BEFORE INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.direct_messages_block_guard();

-- A friend request (a new row, or a declined row turned into a fresh request).
CREATE OR REPLACE FUNCTION public.friendships_block_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('pending', 'accepted')
     AND public.is_blocked_between(NEW.requester_id, NEW.addressee_id) THEN
    RAISE EXCEPTION 'BLOCKED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER friendships_block_guard
  BEFORE INSERT OR UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.friendships_block_guard();

REVOKE ALL ON FUNCTION public.conversations_block_guard()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.direct_messages_block_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.friendships_block_guard()     FROM PUBLIC, anon, authenticated;
