-- =============================================================================
-- 20260913000002_rooms_messages_ai.sql
-- Rooms, room members, invitations, messages, AI runs, app settings.
-- Source of truth: TECHNICAL_SPEC.md §3.3-3.5, §6.8, SPEC.md §6.
--
-- NOTE: RLS (ENABLE + FORCE), policies, helper functions and RPCs live in
-- 20260913000003_helpers_and_rls.sql / 20260913000004_rpcs.sql.
-- Room capacity (2-4 incl. creator) cannot be a CHECK; enforced in RPCs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.3 Rooms
-- -----------------------------------------------------------------------------
CREATE TABLE public.rooms (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid        NOT NULL REFERENCES public.courses (id) ON DELETE RESTRICT,
  created_by      uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  name            text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  topic           text        CHECK (topic IS NULL OR char_length(topic) <= 500),
  status          text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'archived', 'closed')),
  ai_enabled      boolean     NOT NULL DEFAULT true,
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz,
  -- Who made the room read-only (archived/closed). Maintained by the
  -- rooms_track_status_change trigger, never by clients.
  archived_by       uuid      REFERENCES public.profiles (id) ON DELETE SET NULL,
  -- true when a super_admin archived/closed the room: only a super_admin may
  -- reactivate it (an owner must not undo admin moderation).
  archived_by_admin boolean   NOT NULL DEFAULT false
);

CREATE INDEX rooms_course_id_status_idx
  ON public.rooms (course_id, status);

CREATE INDEX rooms_last_message_at_idx
  ON public.rooms (last_message_at DESC NULLS LAST);

CREATE INDEX rooms_created_by_idx
  ON public.rooms (created_by);

CREATE TABLE public.room_members (
  room_id      uuid        NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role         text        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  left_at      timestamptz,
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, user_id),
  CONSTRAINT room_members_left_after_joined CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE INDEX room_members_user_id_active_idx
  ON public.room_members (user_id)
  WHERE left_at IS NULL;

CREATE TABLE public.room_invitations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid        NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  inviter_id      uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  invitee_user_id uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  responded_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_invitations_not_self CHECK (inviter_id <> invitee_user_id)
);

CREATE UNIQUE INDEX room_invitations_one_pending_per_invitee
  ON public.room_invitations (room_id, invitee_user_id)
  WHERE status = 'pending';

CREATE INDEX room_invitations_invitee_pending_idx
  ON public.room_invitations (invitee_user_id, status)
  WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- 3.4 Messages
-- id is generated client-side (optimistic UI / realtime dedup); default kept.
-- -----------------------------------------------------------------------------
CREATE TABLE public.messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid        NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  sender_id   uuid        REFERENCES public.profiles (id) ON DELETE RESTRICT,
  sender_type text        NOT NULL CHECK (sender_type IN ('user', 'ai', 'system')),
  content     text        NOT NULL DEFAULT '' CHECK (char_length(content) <= 32000),
  status      text        NOT NULL DEFAULT 'complete'
                          CHECK (status IN ('complete', 'streaming', 'failed')),
  ai_run_id   uuid,       -- FK to ai_runs added below (cycle)
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,

  CONSTRAINT messages_user_has_sender  CHECK (sender_type <> 'user' OR sender_id IS NOT NULL),
  CONSTRAINT messages_ai_has_no_sender CHECK (sender_type <> 'ai'   OR sender_id IS NULL),
  -- Only AI messages can be streaming/failed; user/system messages are always complete.
  CONSTRAINT messages_status_only_ai   CHECK (sender_type = 'ai' OR status = 'complete'),
  -- ai_run_id only on AI messages.
  CONSTRAINT messages_ai_run_only_ai   CHECK (ai_run_id IS NULL OR sender_type = 'ai'),
  CONSTRAINT messages_metadata_object  CHECK (jsonb_typeof(metadata) = 'object')
);

-- Keyset pagination on (created_at, id); also serves unread counts.
CREATE INDEX messages_room_created_id_idx
  ON public.messages (room_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX messages_ai_run_id_idx
  ON public.messages (ai_run_id)
  WHERE ai_run_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3.5 AI
-- -----------------------------------------------------------------------------
CREATE TABLE public.ai_runs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id               uuid        NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  trigger_message_id    uuid,       -- FK to messages added below (cycle)
  requested_by          uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  status                text        NOT NULL DEFAULT 'queued'
                                    CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  model                 text,
  prompt_tokens         int         CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens     int         CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  context_message_count int         CHECK (context_message_count IS NULL OR context_message_count >= 0),
  error_code            text,
  error_message         text,
  -- Critical: stale check runs against created_at (a queued run has started_at NULL).
  created_at            timestamptz NOT NULL DEFAULT now(),
  started_at            timestamptz,
  finished_at           timestamptz
);

-- The lock: one active AI run per room, enforced by the DB.
CREATE UNIQUE INDEX ai_runs_one_active_per_room
  ON public.ai_runs (room_id)
  WHERE status IN ('queued', 'running');

-- Rate limit per user (last hour).
CREATE INDEX ai_runs_requested_by_created_at_idx
  ON public.ai_runs (requested_by, created_at DESC);

-- Rate limit per room (last hour) + stale check.
CREATE INDEX ai_runs_room_id_created_at_idx
  ON public.ai_runs (room_id, created_at DESC);

-- Admin dashboard: recent failures.
CREATE INDEX ai_runs_failed_created_at_idx
  ON public.ai_runs (created_at DESC)
  WHERE status = 'failed';

CREATE INDEX ai_runs_trigger_message_id_idx
  ON public.ai_runs (trigger_message_id)
  WHERE trigger_message_id IS NOT NULL;

-- Break the messages <-> ai_runs FK cycle.
ALTER TABLE public.messages
  ADD CONSTRAINT messages_ai_run_id_fkey
  FOREIGN KEY (ai_run_id) REFERENCES public.ai_runs (id) ON DELETE SET NULL;

ALTER TABLE public.ai_runs
  ADD CONSTRAINT ai_runs_trigger_message_id_fkey
  FOREIGN KEY (trigger_message_id) REFERENCES public.messages (id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- app_settings (singleton row)
-- -----------------------------------------------------------------------------
CREATE TABLE public.app_settings (
  id               smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ai_system_prompt text        NOT NULL CHECK (char_length(btrim(ai_system_prompt)) BETWEEN 1 AND 20000),
  ai_enabled       boolean     NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid        REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE TRIGGER app_settings_set_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (id, ai_system_prompt, ai_enabled)
VALUES (
  1,
  $prompt$אתה שותף למידה בחדר לימוד קבוצתי של 2 עד 4 סטודנטים בקורס "{course_name}".
נושא החדר: {room_topic}. המשתתפים: {participant_names}.

- ענה בעברית, אלא אם פנו אליך בבירור בשפה אחרת.
- יש כמה דוברים בשיחה. פנה אליהם בשם כשזה רלוונטי, ושים לב כשהם חלוקים.
- הנחה והסבר. אל תמסור פתרון מלא למטלה מוערכת — עזור להם להגיע אליו.
- ענה קצר. זו שיחה, לא מאמר. אם צריך הרחבה, שאל אם רוצים.
- אם אינך בטוח, אמור זאת. אל תמציא מקורות, נוסחאות או עובדות.
- הישאר בנושא הקורס.$prompt$,
  true
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Trigger: creator becomes the 'owner' active member atomically.
-- SECURITY DEFINER: users have no direct INSERT path for owner rows.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.room_members (room_id, user_id, role, joined_at, last_read_at)
  VALUES (NEW.id, NEW.created_by, 'owner', pg_catalog.now(), pg_catalog.now())
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET role = 'owner', left_at = NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_room() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rooms_add_owner_member
  AFTER INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_room();

-- -----------------------------------------------------------------------------
-- Trigger: track who archived/closed a room.
-- * INSERT: archived_by / archived_by_admin are forced to NULL / false.
-- * UPDATE that changes status:
--     -> 'active'             clears archived_by / archived_by_admin
--     -> 'archived'/'closed'  archived_by = auth.uid(); archived_by_admin = the
--                             caller is an active super_admin. Moving an
--                             admin-archived room to 'closed' keeps the admin flag.
-- * UPDATE that does not change status: the two columns cannot be changed by a
--   signed-in caller (service_role / postgres, auth.uid() IS NULL, may).
-- The super_admin check is inlined so this migration has no dependency on 000003.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_room_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.archived_by := NULL;
    NEW.archived_by_admin := false;
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    IF v_uid IS NOT NULL THEN
      NEW.archived_by := OLD.archived_by;
      NEW.archived_by_admin := OLD.archived_by_admin;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'active' THEN
    NEW.archived_by := NULL;
    NEW.archived_by_admin := false;
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = v_uid AND p.role = 'super_admin' AND p.is_active
  ) INTO v_is_admin;

  NEW.archived_by := v_uid;
  NEW.archived_by_admin := COALESCE(v_is_admin, false)
                           OR (OLD.status <> 'active' AND OLD.archived_by_admin);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.track_room_status_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rooms_track_status_change
  BEFORE INSERT OR UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.track_room_status_change();

-- -----------------------------------------------------------------------------
-- Trigger: bump rooms.last_message_at on every new message.
-- SECURITY DEFINER: message senders have no UPDATE rights on rooms.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.rooms r
     SET last_message_at = GREATEST(COALESCE(r.last_message_at, NEW.created_at), NEW.created_at)
   WHERE r.id = NEW.room_id;
  RETURN NULL;  -- AFTER trigger
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_message() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER messages_touch_room_last_message_at
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();
