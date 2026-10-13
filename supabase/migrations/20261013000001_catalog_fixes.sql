-- =============================================================================
-- 20261013000001_catalog_fixes.sql
-- Corrections to the generated catalog (20261010000002/3):
--   1. H.IT's M.Sc. in computer science was imported into the B.Sc. degree
--      (the handbook's "פריסה לפי סמסטרים" accordion is the same for both).
--      Its courses are deactivated at H.IT and in the departments that copy
--      H.IT's CS degree.
--   2. Text that is not a course topic: the prerequisites note of 21151 and
--      the closing sentence of 21410's description, at H.IT and in copies.
-- Rows are deactivated, not deleted, so enrollments and progress survive.
-- scripts/catalog/hit.mjs and lib/topics.mjs are fixed for the next import.
-- =============================================================================

-- 1. M.Sc. courses.
UPDATE public.courses c
   SET is_active = false
  FROM public.institutions i
 WHERE i.id = c.institution_id
   AND i.name = 'H.IT'
   AND c.code IN ('66003', '66004', '66501', '66504', '66505');

UPDATE public.courses c
   SET is_active = false
  FROM public.departments d
  JOIN public.institutions i ON i.id = d.institution_id
 WHERE c.department_id = d.id
   AND c.code IS NULL
   AND c.name IN ('אלגוריתמים מתקדמים', 'מתמטיקה מתקדמת', 'פרוייקט', 'סמינריון', 'תזה')
   AND (i.name, d.name) IN (
         ('מכללת אפקה', 'מדעי המחשב'),
         ('מכללת אפקה', 'הנדסת תוכנה'),
         ('מכללת אפקה', 'הנדסת מערכות מידע'),
         ('מכללת אפקה', 'מדעי הנתונים ובינה מלאכותית'),
         ('האוניברסיטה העברית', 'מדעי המחשב וההנדסה'),
         ('אוניברסיטת בן־גוריון', 'מדעי המחשב'),
         ('אוניברסיטת בן־גוריון', 'הנדסת תוכנה ומערכות מידע'));

-- 2. Non-topics (subtopics go with their parent).
WITH junk AS (
  SELECT ct.id
    FROM public.course_topics ct
    JOIN public.courses c ON c.id = ct.course_id
    LEFT JOIN public.institutions i ON i.id = c.institution_id AND i.name = 'H.IT'
   WHERE ct.parent_id IS NULL
     AND ((i.id IS NOT NULL AND c.code = '21151')
          OR ct.source_ref LIKE 'H.IT 21151 %')
     AND (ct.title = 'מקצועות קדם' OR ct.title LIKE 'הקדם לא יופעל%')
  UNION ALL
  SELECT ct.id
    FROM public.course_topics ct
    JOIN public.courses c ON c.id = ct.course_id
    LEFT JOIN public.institutions i ON i.id = c.institution_id AND i.name = 'H.IT'
   WHERE ct.parent_id IS NULL
     AND ((i.id IS NOT NULL AND c.code = '21410')
          OR ct.source_ref LIKE 'H.IT 21410 %')
     AND ct.title IN ('ואת התיאוריה שלהן', 'ויבינו את מגבלותיהן', 'מדע-נתונים',
                      'למידת מכונה וכו', 'ולמחקר מתקדם בתחום')
)
UPDATE public.course_topics ct
   SET is_active = false
 WHERE ct.id IN (SELECT id FROM junk)
    OR ct.parent_id IN (SELECT id FROM junk);
