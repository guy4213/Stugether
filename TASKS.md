# TASKS — Stugether

**Roadmap חי.** מתעדכן בסוף כל שלב.
**תקציב:** שלב 1 = 70 שעות · שלב 2 = 22 שעות. **אילוץ קשיח.**

| מצב       | סימון |
| --------- | ----- |
| טרם התחיל | `[ ]` |
| בוצע      | `[x]` |
| חסום      | `[!]` |

---

## התקדמות

| Milestone                 | שעות   | מצב                                             |
| ------------------------- | ------ | ----------------------------------------------- |
| מסמכים                    | —      | ✅ הושלם                                        |
| M0 Foundation             | 6.25   | 🟡 כמעט — חסר `supabase start` (Docker)         |
| M1 DB + Auth + Onboarding | 11.5   | 🟡 DB הושלם ונבדק · Auth + Onboarding לא התחילו |
| M2 Dashboard & Courses    | 7      |                                                 |
| M3 Invitations            | 6.5    |                                                 |
| M4 Room Realtime          | 10     |                                                 |
| M5 AI in Room             | 12     |                                                 |
| M6 Profile & Super Admin  | 7.75   |                                                 |
| M7 QA & Launch            | 9      |                                                 |
| **שלב 1**                 | **70** |                                                 |
| S1-S5 שלב 2               | 22     |                                                 |

**נוצל עד כה: 0 / 70**

---

## שלב 0 — מסמכים

- [x] `SPEC.md`
- [x] `TECHNICAL_SPEC.md`
- [x] `TASKS.md`
- [x] `PHASE3.md`

---

## M0 — Foundation · 6.25ש׳

- [x] **1.5ש׳** — Next.js (App Router) + TypeScript + Tailwind · `dir="rtl"` ב-`<html>` · פונט Heebo דרך `next/font`
- [x] **1.5ש׳** — shadcn/ui + Radix · **RTL audit**: Dropdown, Popover, Select, Dialog, Toast
- [!] **1.5ש׳** — `supabase init && supabase start` · clients (browser / server / admin) · **שלד הגבולות**: `lib/repositories/`, `hooks/useRoomChannel.ts`, `lib/storage/`
- [x] **0.5ש׳** — Sentry (client + server)
- [x] **0.75ש׳** — ESLint + Prettier + GitHub Actions (lint, typecheck, build) · **`no-restricted-imports`** שחוסם ייבוא Supabase client מ-`components/` ומ-`app/**/page.tsx`
- [x] **0.5ש׳** — `.env.example` (שמות בלבד) + README setup

**הערות M0:**

- `supabase init` ✅ · clients ✅ · שלד הגבולות ✅ · **`supabase start` חסום — Docker לא מותקן במכונה**
- RTL: shadcn הותקן עם `rtl: true`. ה-audit של הקוד תקין (`start-`/`rtl:` variants). נוסף `DirectionProvider` ו-`dir` ל-Toaster. **בדיקה ויזואלית ידנית ב-`/dev/rtl` עדיין לא בוצעה**
- כלל הגבולות נבדק: import של `@/lib/supabase/*` מתוך `components/` נכשל ב-lint
- Next.js 16.3.5 · Tailwind 4 · React 19.2 · Sentry 10 (פעיל רק כשיש DSN)
- **לאמת:** תוכנית Vercel של הלקוח — Hobby מוגבל ל-`maxDuration=60`

---

## M1 — DB + Auth + Onboarding · 11.5ש׳

- [x] **3ש׳** — Migrations: כל סכמת שלב 1 + RPCs
  - [x] קטלוג: `institutions`, `departments`, `courses`
  - [x] משתמשים: `profiles` (+ trigger `on_auth_user_created`, נעילת `role`), `enrollments`
  - [x] חדרים: `rooms`, `room_members`, `room_invitations`
  - [x] הודעות: `messages` + CHECK constraints
  - [x] AI: `ai_runs` (**`created_at` NOT NULL**) + `ai_runs_one_active_per_room` + `app_settings`
  - [x] RPC `start_ai_run` — טרנזקציה אחת
  - [x] RPC `accept_room_invitation` — נעילה + קיבולת + תוקף
  - [x] RPC `soft_delete_message`
  - [x] RPC `get_unread_summary`
- [x] **3ש׳** — RLS
  - [x] `ENABLE` + `FORCE` על כל הטבלאות
  - [x] `is_room_member` · **`can_post_in_room`** · `is_super_admin` (כולן `SECURITY DEFINER`)
  - [x] Policies לכל הטבלאות לפי `TECHNICAL_SPEC.md` §4.3
  - [x] **Realtime Authorization** על `realtime.messages`
  - [x] Storage bucket `avatars` + policy לפי prefix
- [x] **0.75ש׳** — Seed: מוסד אחד, 2 מחלקות, 5 קורסים, 5 סטודנטים, super admin אחד
- [x] **1.25ש׳** — בדיקות RLS 1-10
- [x] **נוסף** — בדיקות 11-16 (הזמנות, AI, stale, אטומיות) ברמת ה-DB + בדיקות ל-fixes מה-review. **39/39 עוברות** (`npm run db:test`)
- [x] **נוסף** — RPCs: `decline/revoke_room_invitation`, `get_pending_invitations`, `mark_room_read`, `leave_room`, `remove_room_member`, `set_room_status`, `update_room`, `admin_room_stats`, `admin_global_stats` · view `public_profiles`. פירוט: `TECHNICAL_SPEC.md` §12
- [ ] **2ש׳** — Auth: הרשמה, התחברות, התנתקות, אימות מייל, middleware, עברית
- [ ] **1.5ש׳** — Onboarding: מוסד → מחלקה → שנה → רישום לקורסים

---

**הערות M1 (DB):**

- נבנה ב-workflow של 10 agents: סכמה → RLS/RPCs/seed/harness במקביל → אינטגרציה → בדיקות → review אבטחה + התאמה לספק → תיקונים
- ה-review מצא 13 בעיות ותוקנו, בהן: `messages` לא היה ב-publication של Realtime (הצ'אט לא היה מתעדכן), פרופיל מלא נחשף לחברים לכיתה, בעל חדר יכול היה לבטל ארכוב של אדמין, תוכן הודעה מחוקה נשאר גלוי
- **הבדיקות רצות ב-PGlite ולא ב-Supabase** — Docker לא מותקן

---

## M2 — Dashboard & Courses · 7ש׳

- [ ] **3ש׳** — דשבורד: חדרים פעילים (עם badge unread) · הקורסים שלי · הזמנות ממתינות (**מסונן לפי `expires_at`**) · כניסה מהירה
- [ ] **1.5ש׳** — "הקורסים שלי": רשימה, הוספה מהקטלוג, הסרה
- [ ] **2.5ש׳** — מסך קורס: פרטים + רשימת הסטודנטים הרשומים + מעבר לפרופיל ציבורי

---

## M3 — Invitations · 6.5ש׳

- [ ] **2.5ש׳** — בחירת 1-3 סטודנטים מרשימת הקורס + שליחת הזמנות
- [ ] **1.75ש׳** — חיבור `accept_room_invitation` + דחייה + ביטול ע"י המזמין
- [ ] **1.25ש׳** — הזמנות ממתינות בדשבורד + realtime על `user:{id}`
- [ ] **1ש׳** — יצירת חדר + ולידציות
- [ ] בדיקות 11-12 (concurrency אישורים, תוקף)

---

## M4 — Room Realtime · 10ש׳

- [ ] **3ש׳** — Layout + רשימת הודעות · keyset pagination · בועות RTL
- [ ] **1.5ש׳** — שליחת הודעה + optimistic UI (uuid בקליינט)
- [ ] **2.5ש׳** — `useRoomChannel`: postgres_changes INSERT/UPDATE + reconciliation
- [ ] **1.25ש׳** — Presence
- [ ] **1.75ש׳** — `last_read_at` + badge unread + `soft_delete_message` ב-UI

> M4 בונה את הרכיבים שעליהם מסתמך צ'אט 1:1 בשלב 2. **רשימת ההודעות, ה-hook וה-pagination חייבים לצאת גנריים** — אחרת S2 יעלה 16ש׳ במקום 10.

---

## M5 — AI in Room ⭐ · 12ש׳

- [ ] **2.5ש׳** — Gemini client · system prompt · context builder (N הודעות + תקרת tokens)
- [ ] **3.25ש׳** — `POST /api/rooms/[id]/messages`: זיהוי trigger, קריאה ל-`start_ai_run`, `after()`, `maxDuration=60`
- [ ] **1.75ש׳** — צבירת stream + UPDATE סופי + **`onChunk` hook (no-op)**
- [ ] **2ש׳** — שגיאות: שמירת טקסט חלקי + "(נקטע)", `status='failed'`, כפתור "נסה שוב"
- [ ] **1.25ש׳** — Rate limiting (בתוך ה-RPC) + UX
- [ ] **1.25ש׳** — רינדור הודעת AI: markdown, סגנון נבדל, "העוזר כותב…"
- [ ] בדיקות 13-16 (concurrency AI, stale `running` ו-`queued`, אטומיות)

---

## M6 — Profile & Super Admin · 7.75ש׳

- [ ] **2.5ש׳** — פרופיל: צפייה/עריכה + avatar דרך `lib/storage/` + הגדרות
- [ ] **0.5ש׳** — פרופיל ציבורי מצומצם
- [ ] **1.25ש׳** — אדמין: משתמשים (רשימה, חיפוש, סינון, השבתה)
- [ ] **2ש׳** — אדמין: קטלוג CRUD (מוסדות, מחלקות, קורסים)
- [ ] **0.75ש׳** — אדמין: חדרים (רשימה, מטא, ארכוב) — **בלי תוכן הודעות**
- [ ] **0.75ש׳** — אדמין: `ai_system_prompt` + `ai_enabled` + סיכום צריכה + כשלונות אחרונים

---

## M7 — QA & Launch · 9ש׳

- [ ] **2.5ש׳** — Responsive: desktop, tablet, mobile
- [ ] **2ש׳** — בדיקות פונקציונליות מקצה לקצה
- [ ] **1.5ש׳** — בדיקות הרשאות ומקרי קצה (חזרה על 1-16)
- [ ] **2ש׳** — תיקוני באגים
- [ ] **1ש׳** — Production: Supabase prod, Vercel, דומיין, env, Sentry, smoke test, מסירה
- [ ] בדיקה 17 — אין סודות ב-bundle

### אופציונלי — לא בתוך 70

- [ ] **+4ש׳** — שדרוג streaming ל-chunks ב-Broadcast (מילוי `onChunk` + subscriber). **Change Request.**

---

## ניהול התקציב

**אין buffer.** 70 השעות מוקצות במלואן.

**Cut list — בסדר הזה, אם יש חריגה:**

| #   | מה נחתך              | חוסך   | מה מפסידים                    |
| --- | -------------------- | ------ | ----------------------------- |
| 1   | Presence בחדר        | 1.25ש׳ | לא רואים מי מחובר             |
| 2   | Realtime על הזמנות   | 1.25ש׳ | הזמנה מופיעה ברענון ולא מיד   |
| 3   | פרופיל ציבורי מצומצם | 0.5ש׳  | אין מעבר לפרופיל מרשימת הקורס |
| 4   | אדמין / חדרים        | 0.75ש׳ | אין ניהול חדרים בפאנל         |

**נוהל:** חריגה מדווחת ללקוח **ברגע שהיא מתגלה**, לא בסוף. כל חיתוך עובר ל-`PHASE3.md`.

---

## שלב 2 · 22ש׳

### S1 — Web Push spike · 3ש׳

- [ ] **3ש׳** — spike קצוב לפי `TECHNICAL_SPEC.md` §9. **חוסם את S4.**

### S2 — צ'אט 1:1 · 10ש׳

- [ ] **1.5ש׳** — Migrations + RLS: `conversations`, `direct_messages`, `conversation_reads`
- [ ] **2.5ש׳** — רשימת שיחות + פתיחת שיחה (חיפוש משתמש)
- [ ] **4ש׳** — מסך צ'אט + realtime + היסטוריה + pagination
- [ ] **1.5ש׳** — שליחה + optimistic

> 10ש׳ ולא 16 **מותנה בשימוש חוזר ברכיבי M4.**

### S3 — Unread counters · 2.5ש׳

- [ ] **2.5ש׳** — `get_unread_summary()` מורחב + badges בדשבורד, בניווט ובחדרים

### S4 — Web Push · 5ש׳

- [ ] **5ש׳** — VAPID, service worker, subscribe UI, שליחה על הודעה חדשה, ניקוי 410
- [ ] חסום עד ש-S1 מסתיים בהצלחה

### S5 — QA & Deploy · 1.5ש׳

- [ ] **1.5ש׳**

---

## ⏸️ נעצר כאן — מה נשאר (13.09.2026)

### לסגור לפני שממשיכים ל-Auth

- [ ] **להתקין Docker Desktop** — חוסם את כל השאר ברשימה
- [ ] `npm run db:start` + `npm run db:reset` — לוודא שה-migrations וה-seed עולים על Supabase האמיתי. הסיכון העיקרי: ב-Supabase `postgres` אינו superuser, והפקודות על `realtime.messages` ו-`storage` עלולות להיכשל
- [ ] התחברות עם משתמש seed (`Password123!`) — מאמת את מבנה `auth.users` / `auth.identities`
- [ ] בדיקת concurrency אמיתית בשני חיבורים: #11 (שני אישורים לחדר עם 3) ו-#13 (שני `@AI` במקביל)
- [ ] Realtime אמיתי: הודעה מופיעה אצל חבר אחר; לא-חבר לא מצליח להצטרף ל-`room:<id>`
- [ ] `npx supabase gen types typescript --local > lib/database.types.ts`
- [ ] `npm run lint` + `npm run format:check` + `npm run typecheck` — **לא הורצו אחרי הוספת קבצי ה-DB והבדיקות**
- [ ] לבדוק בעין את `/dev/rtl` (5 הבדיקות בראש הדף)
- [ ] commit — **שום דבר עוד לא ב-git**

### התאמות באפליקציה שנובעות מה-DB (לזכור ב-M1-M6)

- [ ] `lib/storage/index.ts` — `uploadAvatar` מחזיר URL, אבל ה-DB מצפה לנתיב `<id>/<file>` ב-`avatar_url`
- [ ] פרופילים של אחרים — לקרוא מ-`public_profiles`, לא מ-`profiles`
- [ ] insert של הודעה — **בלי** `created_at`
- [ ] route ה-AI — `start_ai_run` דרך `createAdminClient()`, אחרי אימות המשתמש
- [ ] broadcast `message_deleted` אחרי `soft_delete_message` (ה-DB מוכן, האפליקציה לא)

### החלטות DB שדורשות אישור

- [ ] משתמש מושבת שחוזר לפעילות **לא** חוזר אוטומטית לחדרים — צריך הזמנה מחדש
- [ ] חבר שעזב חדר מאבד גישה להיסטוריה שלו
- [ ] תוכנית Vercel של הלקוח (Hobby = `maxDuration` 60 שניות)

### הבא בתוכנית

**M1 — Auth + Onboarding** (3.5ש׳): הרשמה, התחברות, middleware, בחירת מוסד/מחלקה/שנה ורישום לקורסים.

---

## יומן

| תאריך      | שלב     | שעות | הערות                                                                                           |
| ---------- | ------- | ---- | ----------------------------------------------------------------------------------------------- |
| 11.09.2026 | מסמכים  | —    | `SPEC`, `TECHNICAL_SPEC`, `TASKS`, `PHASE3` נכתבו                                               |
| 13.09.2026 | M0      | —    | scaffold, RTL, shadcn, Sentry, CI, גבולות. חסר Docker ל-`supabase start`                        |
| 13.09.2026 | M1 (DB) | —    | 4 migrations, seed, 15 RPCs, RLS מלא, 39/39 בדיקות ב-PGlite. review: 13 תיקונים. נעצר לפני Auth |
