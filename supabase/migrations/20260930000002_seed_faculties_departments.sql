-- =============================================================================
-- 20260930000002_seed_faculties_departments.sql
-- Starter faculties + departments for the institutions added in
-- 20260930000001, so the profile's faculty/department dropdowns are usable on a
-- fresh production project. This is a generic starting set, not an official
-- catalog — edit or extend it from the admin catalog panel.
--
-- Built from each institution's public site (hit.ac.il, afeka.ac.il, huji.ac.il,
-- bgu.ac.il). Idempotent: ON CONFLICT on the (institution_id, name) unique keys.
-- =============================================================================
-- Fix the institution name if the previous migration already ran with the old one.
UPDATE public.institutions SET name = 'מכללת אפקה' WHERE name = 'מכללת הפקה';

DO $$
DECLARE
  r record;
  v_institution_id uuid;
  v_faculty_id uuid;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- H.IT (hit.ac.il) — Holon Institute of Technology
    ('H.IT', 'הפקולטה להנדסת חשמל ואלקטרוניקה', 'הנדסת חשמל ואלקטרוניקה'),
    ('H.IT', 'הפקולטה למדעים', 'מדעי המחשב'),
    ('H.IT', 'הפקולטה למדעים', 'מתמטיקה שימושית'),
    ('H.IT', 'הפקולטה לעיצוב', 'עיצוב תעשייתי'),
    ('H.IT', 'הפקולטה לעיצוב', 'עיצוב פנים'),
    ('H.IT', 'הפקולטה לעיצוב', 'עיצוב תקשורת חזותית'),
    ('H.IT', 'הפקולטה להנדסת תעשייה וניהול טכנולוגיה', 'הנדסת תעשייה וניהול טכנולוגיה'),
    ('H.IT', 'הפקולטה לטכנולוגיות למידה', 'טכנולוגיות למידה'),
    ('H.IT', 'המחלקה לטכנולוגיות רפואיות דיגיטליות', 'טכנולוגיות רפואיות דיגיטליות'),
    -- Afeka (afeka.ac.il) — no faculty tier on their site, programs only
    ('מכללת אפקה', 'המחלקות האקדמיות', 'הנדסה רפואית'),
    ('מכללת אפקה', 'המחלקות האקדמיות', 'הנדסת חשמל'),
    ('מכללת אפקה', 'המחלקות האקדמיות', 'הנדסת מכונות'),
    ('מכללת אפקה', 'המחלקות האקדמיות', 'הנדסת תעשייה וניהול'),
    ('מכללת אפקה', 'המחלקות האקדמיות', 'הנדסת מערכות מידע'),
    ('מכללת אפקה', 'המחלקות האקדמיות', 'הנדסת תוכנה'),
    ('מכללת אפקה', 'המחלקות האקדמיות', 'מדעי המחשב'),
    ('מכללת אפקה', 'המחלקות האקדמיות', 'מדעי הנתונים ובינה מלאכותית'),
    -- Hebrew University (huji.ac.il)
    ('האוניברסיטה העברית', 'הפקולטה למתמטיקה ולמדעים', 'מדעי המחשב וההנדסה'),
    ('האוניברסיטה העברית', 'הפקולטה למתמטיקה ולמדעים', 'מתמטיקה'),
    ('האוניברסיטה העברית', 'הפקולטה למתמטיקה ולמדעים', 'פיזיקה'),
    ('האוניברסיטה העברית', 'הפקולטה למתמטיקה ולמדעים', 'מדעי החיים'),
    ('האוניברסיטה העברית', 'הפקולטה למדעי הרוח', 'היסטוריה'),
    ('האוניברסיטה העברית', 'הפקולטה למדעי החברה', 'פסיכולוגיה'),
    ('האוניברסיטה העברית', 'הפקולטה למדעי החברה', 'כלכלה'),
    ('האוניברסיטה העברית', 'הפקולטה למשפטים', 'משפטים'),
    ('האוניברסיטה העברית', 'בית הספר לעסקים', 'מנהל עסקים'),
    ('האוניברסיטה העברית', 'בית הספר לחינוך', 'חינוך'),
    ('האוניברסיטה העברית', 'הפקולטה לרפואה', 'רפואה'),
    -- Ben-Gurion University (bgu.ac.il)
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי הטבע', 'מדעי המחשב'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי הטבע', 'מתמטיקה'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי הטבע', 'פיזיקה'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי הטבע', 'כימיה'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי הטבע', 'מדעי החיים'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי ההנדסה', 'הנדסת תוכנה ומערכות מידע'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי ההנדסה', 'הנדסת חשמל ומחשבים'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי ההנדסה', 'הנדסת מכונות'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי ההנדסה', 'הנדסת תעשייה וניהול'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי הרוח והחברה', 'פסיכולוגיה'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי הרוח והחברה', 'כלכלה'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי הרוח והחברה', 'מדע המדינה וממשל'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי הרוח והחברה', 'סוציולוגיה ואנתרופולוגיה'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי הרוח והחברה', 'חינוך'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה לניהול ע״ש גילפורד גלייזר', 'ניהול'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי הבריאות', 'רפואה'),
    ('אוניברסיטת בן־גוריון', 'הפקולטה למדעי הבריאות', 'סיעוד'),
    -- No public information found for this institution; placeholder only.
    ('פסטדו', 'כללי', 'כללי')
  ) AS c (institution, faculty, department)
  LOOP
    SELECT id INTO v_institution_id FROM public.institutions WHERE name = r.institution LIMIT 1;
    CONTINUE WHEN v_institution_id IS NULL;

    INSERT INTO public.faculties (institution_id, name)
    VALUES (v_institution_id, r.faculty)
    ON CONFLICT (institution_id, name) DO NOTHING;

    SELECT id INTO v_faculty_id
    FROM public.faculties
    WHERE institution_id = v_institution_id AND name = r.faculty;

    INSERT INTO public.departments (institution_id, faculty_id, name)
    VALUES (v_institution_id, v_faculty_id, r.department)
    ON CONFLICT (institution_id, name) DO NOTHING;
  END LOOP;
END
$$;
