-- =============================================================================
-- supabase/seed.sql — local development / test fixtures (run by `supabase db reset`)
--
-- Runs as postgres after all migrations. auth.uid() is NULL here, so the
-- profile guard trigger allows setting role = 'super_admin'.
--
-- ALL PASSWORDS: Password123!
--
-- USERS (auth.users.id = profiles.id)
--   00000000-0000-0000-0000-0000000000a1  noa@stugether.test      נועה כהן       student  (CS, year 2)
--   00000000-0000-0000-0000-0000000000a2  itai@stugether.test     איתי לוי       student  (CS, year 2)
--   00000000-0000-0000-0000-0000000000a3  maya@stugether.test     מאיה פרץ       student  (CS, year 2)
--   00000000-0000-0000-0000-0000000000a4  yonatan@stugether.test  יונתן מזרחי    student  (CS, year 3)
--   00000000-0000-0000-0000-0000000000a5  shira@stugether.test    שירה אברהם     student  (Math/Stat, year 1)
--   00000000-0000-0000-0000-0000000000ad  admin@stugether.test    מנהל המערכת    super_admin (no enrollments)
--
-- CATALOG
--   institution  00000000-0000-0000-0001-000000000001  המכללה האקדמית לדוגמה
--   department   00000000-0000-0000-0002-000000000001  מדעי המחשב
--   department   00000000-0000-0000-0002-000000000002  מתמטיקה וסטטיסטיקה
--   course       00000000-0000-0000-0003-000000000001  CS-101   מבוא למדעי המחשב
--   course       00000000-0000-0000-0003-000000000002  CS-201   מבני נתונים
--   course       00000000-0000-0000-0003-000000000003  CS-305   אלגוריתמים
--   course       00000000-0000-0000-0003-000000000004  MATH-110 חשבון דיפרנציאלי ואינטגרלי 1
--   course       00000000-0000-0000-0003-000000000005  STAT-120 מבוא להסתברות
--
-- ENROLLMENTS (status active unless noted)
--   CS-101   : a3, a4
--   CS-201   : a1, a2, a3, a4, a5
--   CS-305   : a4
--   MATH-110 : a1, a2, a5
--   STAT-120 : a5, a3 (ARCHIVED)
--
-- ROOMS
--   00000000-0000-0000-0005-000000000001  ACTIVE   CS-201  "הכנה למבחן — עצים"  owner a1; members a2, a3 (3 active)
--   00000000-0000-0000-0005-000000000002  ARCHIVED MATH-110 "תרגול גבולות"       owner a2; member a5 (2 active, read-only)
--
-- MESSAGES (room 1)
--   ...0006-000000000001  a1 user
--   ...0006-000000000002  a2 user
--   ...0006-000000000003  a3 user (trigger of AI run)
--   ...0006-000000000004  AI  complete (ai_run_id = ...0008-000000000001)
--   ...0006-000000000005  a1 user
-- MESSAGES (room 2, ~30 days ago)
--   ...0006-000000000011 .. ...0006-000000000013
--
-- AI RUNS
--   00000000-0000-0000-0008-000000000001  room 1, requested_by a3, succeeded
--
-- INVITATIONS
--   00000000-0000-0000-0007-000000000001  room 1, a1 -> a4, pending, expires in 6 days  (PENDING, acceptable)
--   00000000-0000-0000-0007-000000000002  room 1, a1 -> a5, status 'pending' but expires_at in the past (EXPIRED)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Catalog
-- -----------------------------------------------------------------------------
INSERT INTO public.institutions (id, name, city, is_active) VALUES
  ('00000000-0000-0000-0001-000000000001', 'המכללה האקדמית לדוגמה', 'תל אביב', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (id, institution_id, name, is_active) VALUES
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', 'מדעי המחשב', true),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000001', 'מתמטיקה וסטטיסטיקה', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.courses (id, institution_id, department_id, code, name, year_level, semester, is_active) VALUES
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 'CS-101',   'מבוא למדעי המחשב',                  1, 'סמסטר א׳', true),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 'CS-201',   'מבני נתונים',                       2, 'סמסטר א׳', true),
  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 'CS-305',   'אלגוריתמים',                        3, 'סמסטר ב׳', true),
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000002', 'MATH-110', 'חשבון דיפרנציאלי ואינטגרלי 1',      1, 'סמסטר א׳', true),
  ('00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000002', 'STAT-120', 'מבוא להסתברות',                     1, 'סמסטר ב׳', true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Auth users (+ identities). on_auth_user_created creates the profiles.
-- Token columns set to '' (GoTrue fails to scan NULL into string on sign-in).
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('Password123!', extensions.gen_salt('bf')),
  now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name),
  now() - interval '60 days',
  now() - interval '60 days'
FROM (VALUES
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'noa@stugether.test',     'נועה כהן'),
  ('00000000-0000-0000-0000-0000000000a2'::uuid, 'itai@stugether.test',    'איתי לוי'),
  ('00000000-0000-0000-0000-0000000000a3'::uuid, 'maya@stugether.test',    'מאיה פרץ'),
  ('00000000-0000-0000-0000-0000000000a4'::uuid, 'yonatan@stugether.test', 'יונתן מזרחי'),
  ('00000000-0000-0000-0000-0000000000a5'::uuid, 'shira@stugether.test',   'שירה אברהם'),
  ('00000000-0000-0000-0000-0000000000ad'::uuid, 'admin@stugether.test',   'מנהל המערכת')
) AS u (id, email, full_name)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
SELECT
  u.id,
  u.id,
  u.id::text,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(),
  u.created_at,
  u.created_at
FROM auth.users u
WHERE u.id IN (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a2',
  '00000000-0000-0000-0000-0000000000a3',
  '00000000-0000-0000-0000-0000000000a4',
  '00000000-0000-0000-0000-0000000000a5',
  '00000000-0000-0000-0000-0000000000ad'
)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Profiles: fill in academic details; promote the admin.
-- -----------------------------------------------------------------------------
UPDATE public.profiles p
   SET institution_id = '00000000-0000-0000-0001-000000000001',
       department_id  = v.department_id,
       study_year     = v.study_year,
       bio            = v.bio,
       last_seen_at   = now() - interval '1 hour'
  FROM (VALUES
    ('00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, 2::smallint, 'אוהבת מבני נתונים וקפה שחור.'),
    ('00000000-0000-0000-0000-0000000000a2'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, 2::smallint, NULL),
    ('00000000-0000-0000-0000-0000000000a3'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, 2::smallint, 'מחפשת שותפים ללמידה לקראת המבחנים.'),
    ('00000000-0000-0000-0000-0000000000a4'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, 3::smallint, NULL),
    ('00000000-0000-0000-0000-0000000000a5'::uuid, '00000000-0000-0000-0002-000000000002'::uuid, 1::smallint, NULL)
  ) AS v (id, department_id, study_year, bio)
 WHERE p.id = v.id;

UPDATE public.profiles
   SET role = 'super_admin',
       institution_id = '00000000-0000-0000-0001-000000000001'
 WHERE id = '00000000-0000-0000-0000-0000000000ad';

-- -----------------------------------------------------------------------------
-- Enrollments
-- -----------------------------------------------------------------------------
INSERT INTO public.enrollments (user_id, course_id, status) VALUES
  -- CS-101
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0003-000000000001', 'active'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0003-000000000001', 'active'),
  -- CS-201 (active room + invitations)
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0003-000000000002', 'active'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0003-000000000002', 'active'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0003-000000000002', 'active'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0003-000000000002', 'active'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0003-000000000002', 'active'),
  -- CS-305
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0003-000000000003', 'active'),
  -- MATH-110 (archived room)
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0003-000000000004', 'active'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0003-000000000004', 'active'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0003-000000000004', 'active'),
  -- STAT-120
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0003-000000000005', 'active'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0003-000000000005', 'archived')
ON CONFLICT (user_id, course_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Rooms (rooms_add_owner_member trigger inserts the creator as 'owner')
-- -----------------------------------------------------------------------------
INSERT INTO public.rooms (id, course_id, created_by, name, topic, status, ai_enabled, created_at, archived_at) VALUES
  ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0000-0000000000a1',
   'הכנה למבחן — עצים', 'עצי חיפוש בינאריים, AVL ועצי ערימה', 'active', true,
   now() - interval '3 days', NULL),
  ('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0000-0000000000a2',
   'תרגול גבולות', 'גבולות של פונקציות וכלל לופיטל', 'archived', true,
   now() - interval '35 days', now() - interval '20 days')
ON CONFLICT (id) DO NOTHING;

-- Align the trigger-created owner rows with the room history.
UPDATE public.room_members
   SET joined_at = now() - interval '3 days', last_read_at = now() - interval '10 minutes'
 WHERE room_id = '00000000-0000-0000-0005-000000000001'
   AND user_id = '00000000-0000-0000-0000-0000000000a1';

UPDATE public.room_members
   SET joined_at = now() - interval '35 days', last_read_at = now() - interval '29 days'
 WHERE room_id = '00000000-0000-0000-0005-000000000002'
   AND user_id = '00000000-0000-0000-0000-0000000000a2';

INSERT INTO public.room_members (room_id, user_id, role, joined_at, left_at, last_read_at) VALUES
  ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0000-0000000000a2', 'member',
   now() - interval '3 days', NULL, now() - interval '2 hours'),
  ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0000-0000000000a3', 'member',
   now() - interval '2 days', NULL, now() - interval '1 day'),
  ('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0000-0000000000a5', 'member',
   now() - interval '34 days', NULL, now() - interval '29 days')
ON CONFLICT (room_id, user_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Messages + AI run (active room)
-- Order: trigger message -> ai_run -> AI message (FK cycle).
-- -----------------------------------------------------------------------------
INSERT INTO public.messages (id, room_id, sender_id, sender_type, content, status, created_at) VALUES
  ('00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0000-0000000000a1',
   'user', 'היי! פתחתי חדר לקראת המבחן במבני נתונים. נתחיל מעצי AVL?', 'complete', now() - interval '3 hours'),
  ('00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0000-0000000000a2',
   'user', 'סגור. אני עדיין מתבלבל בין רוטציה ימנית לשמאלית.', 'complete', now() - interval '2 hours 50 minutes'),
  ('00000000-0000-0000-0006-000000000003', '00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0000-0000000000a3',
   'user', 'אולי נבקש מה-AI להסביר מתי עושים רוטציה כפולה?', 'complete', now() - interval '2 hours 45 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ai_runs (
  id, room_id, trigger_message_id, requested_by, status, model,
  prompt_tokens, completion_tokens, context_message_count,
  created_at, started_at, finished_at
) VALUES (
  '00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0005-000000000001',
  '00000000-0000-0000-0006-000000000003', '00000000-0000-0000-0000-0000000000a3',
  'succeeded', 'seed-fixture',
  850, 160, 3,
  now() - interval '2 hours 45 minutes',
  now() - interval '2 hours 45 minutes',
  now() - interval '2 hours 44 minutes'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.messages (id, room_id, sender_id, sender_type, content, status, ai_run_id, created_at) VALUES
  ('00000000-0000-0000-0006-000000000004', '00000000-0000-0000-0005-000000000001', NULL,
   'ai', 'שאלה טובה, מאיה. רוטציה כפולה נדרשת כשחוסר האיזון הוא "בזיגזג": למשל הצומת לא מאוזן לשמאל, אבל הבן השמאלי שלו כבד דווקא מימין (מקרה LR). במקרה כזה עושים קודם רוטציה שמאלית על הבן, ואז רוטציה ימנית על הצומת. איתי, רוצה לנסות לשרטט דוגמה עם המספרים 30, 10, 20?',
   'complete', '00000000-0000-0000-0008-000000000001', now() - interval '2 hours 44 minutes'),
  ('00000000-0000-0000-0006-000000000005', '00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0000-0000000000a1',
   'user', 'מעולה, זה עשה לי סדר. ננסה את הדוגמה ונעלה פתרון.', 'complete', NULL, now() - interval '2 hours 30 minutes')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Messages (archived room — history, read-only)
-- -----------------------------------------------------------------------------
INSERT INTO public.messages (id, room_id, sender_id, sender_type, content, status, created_at) VALUES
  ('00000000-0000-0000-0006-000000000011', '00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0000-0000000000a2',
   'user', 'מישהי פתרה את תרגיל 4 בגיליון גבולות?', 'complete', now() - interval '30 days'),
  ('00000000-0000-0000-0006-000000000012', '00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0000-0000000000a5',
   'user', 'כן, צריך להשתמש בלופיטל פעמיים. אחרי הגזירה השנייה מקבלים 1/2.', 'complete', now() - interval '30 days' + interval '15 minutes'),
  ('00000000-0000-0000-0006-000000000013', '00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0000-0000000000a2',
   'user', 'תודה! אני סוגר את החדר אחרי הבוחן.', 'complete', now() - interval '29 days')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Invitations (active room)
--   #1 pending, valid          (a1 -> a4)
--   #2 pending but expired     (a1 -> a5): expires_at in the past. Left with
--      status 'pending' on purpose so tests exercise the "expires_at > now()"
--      read filter and accept_room_invitation's INVITATION_EXPIRED path.
-- -----------------------------------------------------------------------------
INSERT INTO public.room_invitations (id, room_id, inviter_id, invitee_user_id, status, expires_at, created_at) VALUES
  ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0005-000000000001',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a4',
   'pending', now() + interval '6 days', now() - interval '1 day'),
  ('00000000-0000-0000-0007-000000000002', '00000000-0000-0000-0005-000000000001',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a5',
   'pending', now() - interval '1 day', now() - interval '8 days')
ON CONFLICT (id) DO NOTHING;
