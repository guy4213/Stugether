-- =============================================================================
-- 20261030000001_room_exercises.sql
-- Change Request (30.10.2026, Figma "חדר למידה"): the room becomes a study
-- space — a shared exercise in the middle (text and/or an uploaded image /
-- PDF), a shared whiteboard, and voice / video / screen sharing.
--   * room_exercises: members read; writes go through add_room_exercise()
--     (active room only). It joins supabase_realtime so a new exercise
--     reaches the other members on the room's existing channel.
--   * 'room-files' bucket (private): '<room_id>/<file>'; members of the room
--     read, members of an ACTIVE room upload.
--   * Whiteboard strokes and WebRTC signaling ride the room's private
--     broadcast channel (can_use_realtime_topic already limits broadcast to
--     can_post_in_room) — nothing is stored, so no table for them.
-- =============================================================================

CREATE TABLE public.room_exercises (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid        NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  created_by uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title      text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  content    text        CHECK (content IS NULL OR char_length(content) BETWEEN 1 AND 20000),
  file_path  text        CHECK (file_path IS NULL OR file_path LIKE room_id::text || '/%'),
  file_name  text        CHECK (file_name IS NULL OR char_length(file_name) BETWEEN 1 AND 200),
  file_type  text        CHECK (file_type IS NULL OR file_type IN
                           ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (content IS NOT NULL OR file_path IS NOT NULL),
  CHECK ((file_path IS NULL) = (file_type IS NULL))
);
CREATE INDEX room_exercises_room_idx ON public.room_exercises (room_id, created_at);

ALTER TABLE public.room_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_exercises FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.room_exercises FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.room_exercises TO authenticated;

-- Members only — a super_admin sees no room content (SPEC §6 #21).
CREATE POLICY room_exercises_select_member ON public.room_exercises
  FOR SELECT TO authenticated USING (public.is_room_member(room_id));

CREATE OR REPLACE FUNCTION public.add_room_exercise(
  p_room_id uuid, p_title text, p_content text,
  p_file_path text DEFAULT NULL, p_file_name text DEFAULT NULL, p_file_type text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     uuid := public.require_active_caller();
  v_title   text := pg_catalog.btrim(p_title);
  v_content text := NULLIF(pg_catalog.btrim(p_content), '');
  v_path    text := NULLIF(pg_catalog.btrim(p_file_path), '');
  v_id      uuid;
BEGIN
  IF p_room_id IS NULL OR v_title IS NULL OR v_title = ''
     OR (v_content IS NULL AND v_path IS NULL) THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_post_in_room(p_room_id) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  -- The file must be one the caller uploaded into this room's folder.
  IF v_path IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM storage.objects o
     WHERE o.bucket_id = 'room-files' AND o.name = v_path AND o.owner = v_uid
  ) THEN
    RAISE EXCEPTION 'FILE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.room_exercises
    (room_id, created_by, title, content, file_path, file_name, file_type)
  VALUES (p_room_id, v_uid, v_title, v_content, v_path,
          CASE WHEN v_path IS NOT NULL THEN NULLIF(pg_catalog.btrim(p_file_name), '') END,
          CASE WHEN v_path IS NOT NULL THEN p_file_type END)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_room_exercise(uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_room_exercise(uuid, text, text, text, text, text)
  TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'room_exercises'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_exercises;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Storage: 'room-files' (private, 10 MB, images + PDF)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'room-files',
  'room-files',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- '<room_id>/...' → the room id, or NULL for a malformed path (no cast error).
CREATE OR REPLACE FUNCTION public.room_file_room_id(p_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN pg_catalog.split_part(p_name, '/', 1)
         ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN pg_catalog.split_part(p_name, '/', 1)::uuid
  END;
$$;
REVOKE ALL ON FUNCTION public.room_file_room_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.room_file_room_id(text) TO authenticated, service_role;

CREATE POLICY room_files_select_member
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'room-files'
    AND public.is_room_member(public.room_file_room_id(name))
  );

CREATE POLICY room_files_insert_member
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'room-files'
    AND public.can_post_in_room(public.room_file_room_id(name))
  );
