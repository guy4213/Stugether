-- =============================================================================
-- 20261013000002_move_to_catalog_courses.sql
-- The catalog migrations (20261010000002-4) deactivated the starter courses,
-- but students were enrolled in some of them; RLS hides inactive courses, so
-- their dashboard broke. Everything a student had on a starter course moves
-- to the catalog course that replaced it: same department and name, or an
-- explicit pair where the name changed.
-- =============================================================================

CREATE TEMP TABLE _course_move (old_id uuid PRIMARY KEY, new_id uuid NOT NULL);

-- Same department + same name (the H.IT course with a code first).
INSERT INTO _course_move (old_id, new_id)
SELECT DISTINCT ON (o.id) o.id, n.id
  FROM public.courses o
  JOIN public.courses n
    ON n.department_id = o.department_id AND n.name = o.name AND n.is_active AND n.id <> o.id
 WHERE NOT o.is_active AND o.code IS NULL
 ORDER BY o.id, (n.code IS NULL), n.created_at;

-- Renamed in the real catalog.
INSERT INTO _course_move (old_id, new_id)
SELECT o.id, n.id
  FROM public.institutions i
  JOIN public.departments d ON d.institution_id = i.id AND d.name = 'מתמטיקה שימושית'
  JOIN public.courses o ON o.department_id = d.id AND o.code IS NULL AND NOT o.is_active
                       AND o.name = 'אלגברה ליניארית'
  JOIN public.courses n ON n.institution_id = i.id AND n.code = '21158' AND n.is_active
 WHERE i.name = 'H.IT'
ON CONFLICT (old_id) DO NOTHING;

-- Per-user rows: move unless the user already has one on the new course.
UPDATE public.enrollments e
   SET course_id = m.new_id
  FROM _course_move m
 WHERE e.course_id = m.old_id
   AND NOT EXISTS (SELECT 1 FROM public.enrollments x
                    WHERE x.user_id = e.user_id AND x.course_id = m.new_id);

UPDATE public.course_favorites f
   SET course_id = m.new_id
  FROM _course_move m
 WHERE f.course_id = m.old_id
   AND NOT EXISTS (SELECT 1 FROM public.course_favorites x
                    WHERE x.user_id = f.user_id AND x.course_id = m.new_id);

-- The old course's topics do not exist on the new one.
UPDATE public.study_availability a
   SET course_id = m.new_id, topic_id = NULL
  FROM _course_move m
 WHERE a.course_id = m.old_id
   AND NOT EXISTS (SELECT 1 FROM public.study_availability x
                    WHERE x.user_id = a.user_id AND x.course_id = m.new_id);

-- Shared rows.
UPDATE public.rooms r SET course_id = m.new_id FROM _course_move m WHERE r.course_id = m.old_id;
UPDATE public.tests t SET course_id = m.new_id FROM _course_move m WHERE t.course_id = m.old_id;
UPDATE public.notifications n SET course_id = m.new_id FROM _course_move m WHERE n.course_id = m.old_id;

-- Progress counts the course's own topics; nothing is marked on the new one.
UPDATE public.enrollments e
   SET progress_percent = 0, completed_at = NULL
  FROM _course_move m
 WHERE e.course_id = m.new_id
   AND NOT EXISTS (SELECT 1 FROM public.topic_progress tp
                     JOIN public.course_topics ct ON ct.id = tp.topic_id
                    WHERE tp.user_id = e.user_id AND ct.course_id = m.new_id);

DROP TABLE _course_move;
