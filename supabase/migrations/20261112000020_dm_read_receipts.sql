-- 20261112000020_dm_read_receipts.sql
-- Private chat: "נשלח / נקרא" under my last message (Change Request 12.11.2026,
-- SPEC §5.1). The read status is per conversation, not per message — the same
-- rule as rooms: the other participant's conversation_reads.last_read_at.
--
--   1. conversation_reads: either participant may read both rows of the
--      conversation (was: own row only). The row holds a timestamp, no content.
--   2. mark_conversation_read also broadcasts { user_id, last_read_at } on the
--      conversation's private channel dm:{id}, so the sender sees "נקרא" live.

-- =============================================================================
-- 1. RLS
-- =============================================================================
DROP POLICY IF EXISTS conversation_reads_select_own ON public.conversation_reads;

CREATE POLICY conversation_reads_select_participant
  ON public.conversation_reads FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id));


-- =============================================================================
-- 2. mark_conversation_read + 'read' broadcast
-- =============================================================================
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  uuid := public.require_active_caller();
  v_read timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
     WHERE c.id = p_conversation_id AND v_uid IN (c.user_a_id, c.user_b_id)
  ) THEN
    RAISE EXCEPTION 'NOT_A_MEMBER' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.conversation_reads (conversation_id, user_id, last_read_at)
  VALUES (p_conversation_id, v_uid, pg_catalog.now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET last_read_at = GREATEST(public.conversation_reads.last_read_at, EXCLUDED.last_read_at)
  RETURNING last_read_at INTO v_read;

  UPDATE public.notifications n
     SET read_at = pg_catalog.now()
   WHERE n.user_id = v_uid
     AND n.conversation_id = p_conversation_id
     AND n.read_at IS NULL;

  -- Who read and when. Never content.
  PERFORM realtime.send(
    pg_catalog.jsonb_build_object('user_id', v_uid, 'last_read_at', v_read),
    'read',
    'dm:' || p_conversation_id::text,
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
