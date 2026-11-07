-- =============================================================================
-- 20261107000001_direct_messages.sql
-- SPEC §5.1 (שלב 2): private 1:1 chat between two students, opened from a
-- student's card or profile. TECHNICAL_SPEC §3.6 data model:
--   1. conversations (ordered pair a < b), direct_messages, conversation_reads
--   2. RLS: participants only. No super_admin access (no message content for
--      admins, SPEC §4.9). Writes only through the RPCs below.
--   3. RPCs: open_conversation, send_direct_message, mark_conversation_read,
--      soft_delete_direct_message, list_my_conversations,
--      count_unread_direct_messages
--   4. In-site notification on a new message: notifications.type
--      'direct_message' (category 'messages'), at most ONE unread row per
--      conversation for the recipient (a new message replaces it). Gated by
--      the existing messages_invites preference.
--   5. Realtime: private topic 'dm:<conversation id>' for participants;
--      direct_messages and notifications join the supabase_realtime
--      publication (the chat screen and the in-site toast).
-- =============================================================================


-- =============================================================================
-- 1. Tables
-- =============================================================================
CREATE TABLE public.conversations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id       uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  user_b_id       uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- One row per pair, whoever opened it (TECHNICAL_SPEC §3.6).
  CONSTRAINT conversations_ordered_pair CHECK (user_a_id < user_b_id),
  CONSTRAINT conversations_pair_key UNIQUE (user_a_id, user_b_id)
);

-- user_a lookups use conversations_pair_key's leading column.
CREATE INDEX conversations_user_b_idx ON public.conversations (user_b_id);

CREATE TABLE public.direct_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  content         text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX direct_messages_conversation_created_id_idx
  ON public.direct_messages (conversation_id, created_at DESC, id DESC);
-- send_direct_message's per-sender rate limit.
CREATE INDEX direct_messages_sender_created_idx
  ON public.direct_messages (sender_id, created_at DESC);

CREATE TABLE public.conversation_reads (
  conversation_id uuid        NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  last_read_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages    FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reads FORCE  ROW LEVEL SECURITY;

-- Read-only for clients: every write goes through a SECURITY DEFINER RPC.
REVOKE ALL ON public.conversations      FROM PUBLIC, anon;
REVOKE ALL ON public.direct_messages    FROM PUBLIC, anon;
REVOKE ALL ON public.conversation_reads FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.conversations, public.direct_messages, public.conversation_reads
  FROM authenticated;
GRANT SELECT
  ON public.conversations, public.direct_messages, public.conversation_reads
  TO authenticated;


-- =============================================================================
-- 2. Helper + RLS
-- =============================================================================
-- Is the caller one of the two participants? SECURITY DEFINER so the
-- direct_messages policy (and the realtime topic check) does not depend on
-- the conversations policy.
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.conversations c
     WHERE c.id = p_conversation_id
       AND (SELECT auth.uid()) IN (c.user_a_id, c.user_b_id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_conversation_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid) TO authenticated, service_role;

CREATE POLICY conversations_select_participant
  ON public.conversations FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (user_a_id, user_b_id));

-- Same rule as room messages: a soft-deleted message is hidden from the other
-- participant entirely (not just flagged); the sender still sees it.
CREATE POLICY direct_messages_select_participant
  ON public.direct_messages FOR SELECT TO authenticated
  USING (
    public.is_conversation_member(conversation_id)
    AND (deleted_at IS NULL OR sender_id = (SELECT auth.uid()))
  );

CREATE POLICY conversation_reads_select_own
  ON public.conversation_reads FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- =============================================================================
-- 3. Notifications: 'direct_message' type, category 'messages', link column
-- =============================================================================
ALTER TABLE public.notifications
  ADD COLUMN conversation_id uuid REFERENCES public.conversations (id) ON DELETE CASCADE;

-- send_direct_message replaces the recipient's unread row for a conversation.
CREATE INDEX notifications_unread_conversation_idx
  ON public.notifications (user_id, conversation_id)
  WHERE conversation_id IS NOT NULL AND read_at IS NULL;

ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'room_invitation', 'room_opened', 'room_joined',
  'event_scheduled', 'course_recommendation', 'system',
  'room_join_request', 'room_join_decided',
  'session_proposed', 'session_scheduled',
  'direct_message'
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
    WHEN 'direct_message'    THEN 'messages'
    WHEN 'system'            THEN 'system'
    ELSE 'courses'
  END
) STORED;

-- 'direct_message' follows the "messages & invitations" toggle.
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
           WHEN 'course_recommendation' THEN COALESCE(np.course_recs, false)
           WHEN 'system'                THEN COALESCE(np.system_updates, true)
           -- event_scheduled, join requests / decisions and study sessions:
           -- always (someone is waiting for an answer, or it is a schedule).
           ELSE true
         END
    FROM (SELECT 1) AS one
    LEFT JOIN public.notification_preferences np ON np.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.notification_enabled(uuid, text) FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- 4. RPCs
-- =============================================================================

-- open_conversation(p_other_user_id) — the conversation between the caller and
-- another active student, created on first use. Idempotent from both sides.
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

  -- Student-to-student only (a super admin has no private chats).
  IF NOT EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.role = 'student'
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
        WHERE p.id = p_other_user_id AND p.is_active AND p.role = 'student'
     ) THEN
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


-- send_direct_message(p_conversation_id, p_content) — one transaction: the
-- message, the conversation's last_message_at, the sender's own read mark and
-- the recipient's in-site notification. Returns the new row.
CREATE OR REPLACE FUNCTION public.send_direct_message(p_conversation_id uuid, p_content text)
RETURNS public.direct_messages
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     uuid := public.require_active_caller();
  v_content text := pg_catalog.btrim(COALESCE(p_content, ''));
  v_conv    public.conversations%ROWTYPE;
  v_other   uuid;
  v_name    text;
  v_preview text;
  v_msg     public.direct_messages%ROWTYPE;
BEGIN
  IF pg_catalog.char_length(v_content) = 0 OR pg_catalog.char_length(v_content) > 4000 THEN
    RAISE EXCEPTION 'INVALID_CONTENT' USING ERRCODE = '22023';
  END IF;

  -- Row lock: sends in one conversation are serialized (ordering of
  -- last_message_at and the notification replace below).
  SELECT * INTO v_conv FROM public.conversations c WHERE c.id = p_conversation_id FOR UPDATE;
  IF NOT FOUND OR v_uid NOT IN (v_conv.user_a_id, v_conv.user_b_id) THEN
    RAISE EXCEPTION 'NOT_A_MEMBER' USING ERRCODE = '42501';
  END IF;

  v_other := CASE WHEN v_conv.user_a_id = v_uid THEN v_conv.user_b_id ELSE v_conv.user_a_id END;

  -- A deactivated account keeps its history but gets no new messages.
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_other AND p.is_active) THEN
    RAISE EXCEPTION 'RECIPIENT_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;

  -- Spam guard: 30 messages a minute per sender, across conversations.
  IF (
    SELECT pg_catalog.count(*)
      FROM public.direct_messages d
     WHERE d.sender_id = v_uid
       AND d.created_at > pg_catalog.now() - interval '1 minute'
  ) >= 30 THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.direct_messages (conversation_id, sender_id, content)
  VALUES (p_conversation_id, v_uid, v_content)
  RETURNING * INTO v_msg;

  UPDATE public.conversations c
     SET last_message_at = v_msg.created_at
   WHERE c.id = p_conversation_id;

  -- My own message never counts as unread for me.
  INSERT INTO public.conversation_reads (conversation_id, user_id, last_read_at)
  VALUES (p_conversation_id, v_uid, v_msg.created_at)
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET last_read_at = GREATEST(public.conversation_reads.last_read_at, EXCLUDED.last_read_at);

  -- In-site notification: one unread row per conversation. Replace (DELETE +
  -- INSERT, not UPDATE) so the realtime toast only has to listen to INSERT.
  IF public.notification_enabled(v_other, 'direct_message') THEN
    SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id = v_uid;
    v_preview := CASE
                   WHEN pg_catalog.char_length(v_content) > 140
                     THEN pg_catalog.left(v_content, 139) || '…'
                   ELSE v_content
                 END;

    DELETE FROM public.notifications n
     WHERE n.user_id = v_other
       AND n.conversation_id = p_conversation_id
       AND n.type = 'direct_message'
       AND n.read_at IS NULL;

    INSERT INTO public.notifications (user_id, type, actor_id, conversation_id, title, body)
    VALUES (
      v_other,
      'direct_message',
      v_uid,
      p_conversation_id,
      pg_catalog.left(COALESCE(NULLIF(v_name, ''), 'סטודנט/ית') || ' שלח/ה לך הודעה', 200),
      v_preview
    );
  END IF;

  RETURN v_msg;
END;
$$;

REVOKE ALL ON FUNCTION public.send_direct_message(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text) TO authenticated;


-- mark_conversation_read(p_conversation_id) — own last_read_at = now(), and
-- the conversation's unread in-site notification is marked read with it.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := public.require_active_caller();
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
  DO UPDATE SET last_read_at = GREATEST(public.conversation_reads.last_read_at, EXCLUDED.last_read_at);

  UPDATE public.notifications n
     SET read_at = pg_catalog.now()
   WHERE n.user_id = v_uid
     AND n.conversation_id = p_conversation_id
     AND n.read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;


-- soft_delete_direct_message(p_message_id) — own message, within 5 minutes,
-- still a participant (SPEC: no editing, self-delete within 5 minutes). Any
-- failure -> MESSAGE_NOT_DELETABLE (no detail, no probing of other ids).
CREATE OR REPLACE FUNCTION public.soft_delete_direct_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     uuid := public.require_active_caller();
  v_conv_id uuid;
  v_created timestamptz;
  v_conv    public.conversations%ROWTYPE;
  v_other   uuid;
BEGIN
  UPDATE public.direct_messages d
     SET deleted_at = pg_catalog.now()
   WHERE d.id = p_message_id
     AND d.sender_id = v_uid
     AND d.deleted_at IS NULL
     AND d.created_at > pg_catalog.now() - interval '5 minutes'
     AND EXISTS (
       SELECT 1 FROM public.conversations c
        WHERE c.id = d.conversation_id AND v_uid IN (c.user_a_id, c.user_b_id)
     )
  RETURNING d.conversation_id, d.created_at INTO v_conv_id, v_created;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MESSAGE_NOT_DELETABLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_conv FROM public.conversations c WHERE c.id = v_conv_id;
  v_other := CASE WHEN v_conv.user_a_id = v_uid THEN v_conv.user_b_id ELSE v_conv.user_a_id END;

  -- The recipient's unread notification previews the latest message. If that
  -- was this one, drop the preview so the deleted text doesn't linger there.
  IF NOT EXISTS (
    SELECT 1 FROM public.direct_messages d
     WHERE d.conversation_id = v_conv_id
       AND d.sender_id = v_uid
       AND d.deleted_at IS NULL
       AND d.created_at > v_created
  ) THEN
    UPDATE public.notifications n
       SET body = 'ההודעה נמחקה'
     WHERE n.user_id = v_other
       AND n.conversation_id = v_conv_id
       AND n.type = 'direct_message'
       AND n.read_at IS NULL;
  END IF;

  -- The other participant's RLS now hides the row, so no postgres_changes
  -- UPDATE reaches them: tell the conversation's private channel instead.
  -- Id only, never content.
  PERFORM realtime.send(
    pg_catalog.jsonb_build_object('id', p_message_id, 'conversation_id', v_conv_id),
    'message_deleted',
    'dm:' || v_conv_id::text,
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_direct_message(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_direct_message(uuid) TO authenticated;


-- list_my_conversations() — the "הודעות" inbox: conversations that have at
-- least one message, newest first, with a preview and my unread count.
-- SECURITY INVOKER: RLS limits it to my own conversations.
CREATE OR REPLACE FUNCTION public.list_my_conversations()
RETURNS TABLE (
  conversation_id        uuid,
  other_user_id          uuid,
  last_message_at        timestamptz,
  last_message_content   text,
  last_message_sender_id uuid,
  unread_count           bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT c.id,
         CASE WHEN c.user_a_id = (SELECT auth.uid()) THEN c.user_b_id ELSE c.user_a_id END,
         c.last_message_at,
         lm.content,
         lm.sender_id,
         (
           SELECT pg_catalog.count(*)
             FROM public.direct_messages d
            WHERE d.conversation_id = c.id
              AND d.sender_id <> (SELECT auth.uid())
              AND d.deleted_at IS NULL
              AND d.created_at > COALESCE(r.last_read_at, '-infinity'::timestamptz)
         )
    FROM public.conversations c
    LEFT JOIN public.conversation_reads r
      ON r.conversation_id = c.id AND r.user_id = (SELECT auth.uid())
    LEFT JOIN LATERAL (
      SELECT d.content, d.sender_id
        FROM public.direct_messages d
       WHERE d.conversation_id = c.id AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC, d.id DESC
       LIMIT 1
    ) lm ON true
   WHERE (SELECT auth.uid()) IN (c.user_a_id, c.user_b_id)
     AND c.last_message_at IS NOT NULL
   ORDER BY c.last_message_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_my_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_conversations() TO authenticated;


-- count_unread_direct_messages() — the badge on the top nav's messages icon:
-- how many conversations have messages I haven't read.
CREATE OR REPLACE FUNCTION public.count_unread_direct_messages()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.count(DISTINCT c.id)
    FROM public.conversations c
    JOIN public.direct_messages d ON d.conversation_id = c.id
    LEFT JOIN public.conversation_reads r
      ON r.conversation_id = c.id AND r.user_id = (SELECT auth.uid())
   WHERE (SELECT auth.uid()) IN (c.user_a_id, c.user_b_id)
     AND d.sender_id <> (SELECT auth.uid())
     AND d.deleted_at IS NULL
     AND d.created_at > COALESCE(r.last_read_at, '-infinity'::timestamptz);
$$;

REVOKE ALL ON FUNCTION public.count_unread_direct_messages() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_unread_direct_messages() TO authenticated;


-- =============================================================================
-- 5. Realtime
-- =============================================================================
-- Same as 20260913000003 plus the 'dm:<uuid>' topic (TECHNICAL_SPEC §5):
--   'dm:<uuid>'  receive / presence / broadcast -> conversation participant
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

  IF pg_catalog.left(p_topic, 3) = 'dm:' THEN
    IF pg_catalog.substr(p_topic, 4) !~ v_uuid_re THEN
      RETURN false;
    END IF;
    v_id := pg_catalog.substr(p_topic, 4)::uuid;

    IF COALESCE(p_is_write, true)
       AND COALESCE(p_extension, '') NOT IN ('presence', 'broadcast') THEN
      RETURN false;
    END IF;
    RETURN public.is_conversation_member(v_id)
       AND EXISTS (
         SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_active
       );
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

REVOKE ALL ON FUNCTION public.can_use_realtime_topic(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_realtime_topic(text, text, boolean) TO authenticated, service_role;

-- Postgres Changes for the chat screen (direct_messages INSERT) and the
-- in-site toast (notifications INSERT). Realtime applies each table's SELECT
-- policy per subscriber. Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;
