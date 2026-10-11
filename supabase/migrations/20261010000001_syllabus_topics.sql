-- =============================================================================
-- 20261010000001_syllabus_topics.sql
-- Course syllabus: real catalog fields, a two-level topic tree (topic →
-- subtopic) with provenance, and rooms that cover several topics.
--
-- Change Request vs SPEC §3 ("קורס אינו מכיל סילבוס") — approved 2026-10-10,
-- see SPEC.md §3 / TASKS.md M8.
--
--   1. courses: description, credits, source_url (filled by catalog imports).
--   2. course_topics: parent_id (one level of nesting), description, source,
--      status. Position is unique among siblings, not per course.
--   3. Progress (enrollments.progress_percent) counts top-level topics only.
--   4. room_topics + set_room_topics(): a room links 0..n topics of its own
--      course; rooms.topic keeps a readable summary for the AI prompt and lists.
-- =============================================================================


-- =============================================================================
-- 1. Catalog fields
-- =============================================================================
ALTER TABLE public.courses
  ADD COLUMN description text CHECK (description IS NULL OR char_length(description) <= 4000),
  ADD COLUMN credits     numeric(4,1) CHECK (credits IS NULL OR credits BETWEEN 0 AND 40),
  ADD COLUMN source_url  text CHECK (source_url IS NULL OR char_length(source_url) <= 500);


-- =============================================================================
-- 2. Topic tree + provenance
-- =============================================================================
ALTER TABLE public.course_topics
  ADD COLUMN parent_id   uuid REFERENCES public.course_topics (id) ON DELETE CASCADE,
  ADD COLUMN description text CHECK (description IS NULL OR char_length(description) <= 1000),
  -- Where the topic came from:
  --   official_description — the institution's current course summary
  --   official_syllabus    — the institution's own (possibly older) syllabus
  --   equivalent_course    — the same standard course at another institution
  --   ai_draft / manual
  ADD COLUMN source      text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'official_syllabus', 'official_description',
                      'equivalent_course', 'ai_draft')),
  -- verified = taken as-is from the course's own institution or entered by an
  -- admin; draft = borrowed or generated, shown with its source.
  ADD COLUMN status      text NOT NULL DEFAULT 'verified'
    CHECK (status IN ('draft', 'verified')),
  -- Human-readable origin ("Technion 02340218 מבני נתונים 1") and its link.
  ADD COLUMN source_ref  text CHECK (source_ref IS NULL OR char_length(source_ref) <= 200),
  ADD COLUMN source_url  text CHECK (source_url IS NULL OR char_length(source_url) <= 500);

ALTER TABLE public.course_topics DROP CONSTRAINT course_topics_course_id_position_key;

-- Siblings are ordered by position: top-level topics per course, subtopics per parent.
CREATE UNIQUE INDEX course_topics_top_position_key
  ON public.course_topics (course_id, position) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX course_topics_sub_position_key
  ON public.course_topics (parent_id, position) WHERE parent_id IS NOT NULL;
CREATE INDEX course_topics_parent_id_idx ON public.course_topics (parent_id);

-- A subtopic belongs to the same course as its parent, and nesting stops at
-- one level (topic → subtopic) — exercises attach to either.
CREATE OR REPLACE FUNCTION public.check_course_topic_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_parent public.course_topics%ROWTYPE;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_parent FROM public.course_topics WHERE id = NEW.parent_id;
  IF v_parent.course_id IS DISTINCT FROM NEW.course_id THEN
    RAISE EXCEPTION 'TOPIC_PARENT_OTHER_COURSE' USING ERRCODE = '23514';
  END IF;
  IF v_parent.parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'TOPIC_TOO_DEEP' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_course_topic_parent() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER course_topics_check_parent
  BEFORE INSERT OR UPDATE OF parent_id, course_id ON public.course_topics
  FOR EACH ROW EXECUTE FUNCTION public.check_course_topic_parent();


-- =============================================================================
-- 3. Progress counts top-level topics only
-- =============================================================================
CREATE OR REPLACE FUNCTION public.recompute_enrollment_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id   uuid;
  v_topic_id  uuid;
  v_course_id uuid;
  v_total     integer;
  v_mastered  integer;
  v_percent   smallint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id; v_topic_id := OLD.topic_id;
  ELSE
    v_user_id := NEW.user_id; v_topic_id := NEW.topic_id;
  END IF;

  SELECT ct.course_id INTO v_course_id FROM public.course_topics ct WHERE ct.id = v_topic_id;
  IF v_course_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT pg_catalog.count(*),
         pg_catalog.count(*) FILTER (WHERE tp.status = 'mastered')
    INTO v_total, v_mastered
    FROM public.course_topics ct
    LEFT JOIN public.topic_progress tp
      ON tp.topic_id = ct.id AND tp.user_id = v_user_id
   WHERE ct.course_id = v_course_id
     AND ct.parent_id IS NULL
     AND ct.is_active;

  IF v_total = 0 THEN
    RETURN NULL;
  END IF;

  v_percent := pg_catalog.round(v_mastered * 100.0 / v_total)::smallint;

  UPDATE public.enrollments e
     SET progress_percent = v_percent,
         completed_at = CASE
           WHEN v_percent = 100 THEN COALESCE(e.completed_at, pg_catalog.now())
           ELSE NULL
         END
   WHERE e.user_id = v_user_id
     AND e.course_id = v_course_id;

  RETURN NULL;
END;
$$;


-- =============================================================================
-- 4. Rooms with several topics
-- =============================================================================
CREATE TABLE public.room_topics (
  room_id    uuid        NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  topic_id   uuid        NOT NULL REFERENCES public.course_topics (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, topic_id)
);

CREATE INDEX room_topics_topic_id_idx ON public.room_topics (topic_id);

ALTER TABLE public.room_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_topics FORCE  ROW LEVEL SECURITY;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.room_topics FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.room_topics FROM anon;

-- Read like the room itself; writes only through set_room_topics().
CREATE POLICY room_topics_select_member_or_admin
  ON public.room_topics FOR SELECT TO authenticated
  USING (public.is_room_member(room_id) OR (SELECT public.is_super_admin()));

-- Replaces the room's topic set in one transaction and refreshes rooms.topic
-- (the text the AI prompt and room lists read). Only the active owner of an
-- active room; every topic must be an active topic of the room's course.
-- An empty array clears the links and leaves rooms.topic untouched.
--
-- Errors:
--   ROOM_NOT_FOUND        P0002
--   NOT_ROOM_OWNER        42501
--   ROOM_NOT_ACTIVE       42501
--   TOPIC_NOT_IN_COURSE   22023
--   TOO_MANY_TOPICS       22023  (more than 10)
CREATE OR REPLACE FUNCTION public.set_room_topics(p_room_id uuid, p_topic_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room   public.rooms%ROWTYPE;
  v_ids    uuid[] := COALESCE(
    (SELECT pg_catalog.array_agg(DISTINCT x) FROM pg_catalog.unnest(p_topic_ids) x WHERE x IS NOT NULL),
    '{}'::uuid[]
  );
  v_valid  integer;
  v_titles text;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.room_members rm
     WHERE rm.room_id = p_room_id
       AND rm.user_id = auth.uid()
       AND rm.role = 'owner'
       AND rm.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'NOT_ROOM_OWNER' USING ERRCODE = '42501';
  END IF;

  IF v_room.status <> 'active' THEN
    RAISE EXCEPTION 'ROOM_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;

  IF pg_catalog.cardinality(v_ids) > 10 THEN
    RAISE EXCEPTION 'TOO_MANY_TOPICS' USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.count(*) INTO v_valid
    FROM public.course_topics ct
   WHERE ct.id = ANY (v_ids)
     AND ct.course_id = v_room.course_id
     AND ct.is_active;
  IF v_valid <> pg_catalog.cardinality(v_ids) THEN
    RAISE EXCEPTION 'TOPIC_NOT_IN_COURSE' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.room_topics WHERE room_id = p_room_id AND NOT (topic_id = ANY (v_ids));
  INSERT INTO public.room_topics (room_id, topic_id)
  SELECT p_room_id, x FROM pg_catalog.unnest(v_ids) x
  ON CONFLICT DO NOTHING;

  IF pg_catalog.cardinality(v_ids) > 0 THEN
    -- Syllabus order: parent position first, then the subtopic's own position.
    SELECT pg_catalog.left(pg_catalog.string_agg(ct.title, ', ' ORDER BY
             COALESCE(p.position, ct.position), (ct.parent_id IS NOT NULL), ct.position), 500)
      INTO v_titles
      FROM public.course_topics ct
      LEFT JOIN public.course_topics p ON p.id = ct.parent_id
     WHERE ct.id = ANY (v_ids);
    UPDATE public.rooms SET topic = v_titles WHERE id = p_room_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_room_topics(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_room_topics(uuid, uuid[]) TO authenticated;
