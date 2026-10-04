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

| Milestone                 | שעות   | מצב                                                                                      |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| מסמכים                    | —      | ✅ הושלם                                                                                 |
| M0 Foundation             | 6.25   | ✅ הושלם — Docker + `supabase start` עובדים                                              |
| M1 DB + Auth + Onboarding | 11.5   | ✅ הושלם — migrations+seed עולים על Supabase אמיתי · onboarding: הרשמה → פרופיל → קורסים |
| M2 Dashboard & Courses    | 7      | ✅ הושלם — דשבורד (כולל החדרים שלי + unread, הזמנות, חדר חדש), קטלוג, עמוד קורס          |
| M3 Invitations            | 6.5    | ✅ הושלם — הזמנת 1-3 מתוך החדר, אישור/דחייה בדשבורד ובהתראות, ביטול ע"י המזמין           |
| M4 Room Realtime          | 10     | ✅ הושלם — realtime, Presence, מחיקה עצמית, keyset pagination, סטטוס נקרא                |
| M5 AI in Room             | 12     | ✅ הושלם — "שאל את העוזר", markdown, "העוזר כותב…", "נסה שוב", הודעות busy/מגבלה         |
| M6 Profile & Super Admin  | 7.75   | ✅ הושלם — פרופיל + פאנל `/admin`: סקירה, משתמשים, קטלוג, חדרים (מטא בלבד), AI           |
| M7 QA & Launch            | 9      | 🟡 E2E על stack אמיתי: 43/43 + concurrency #11/#13 · חסר: בדיקה ויזואלית, Production     |
| **שלב 1**                 | **70** |                                                                                          |
| S1-S5 שלב 2               | 22     |                                                                                          |

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
- [x] **backend** — `lib/auth/actions.ts` (signUp/signIn/signOut/resendVerificationEmail, שגיאות בעברית) · `proxy.ts` + `lib/supabase/middleware.ts` (רענון session — שים לב: Next 16.3.5 בפרויקט הזה קורא לזה `proxy.ts` ולא `middleware.ts`) · `app/auth/callback/route.ts`
- [x] **~1ש׳ נותר** — מסכי הרשמה/התחברות בפועל (טפסים שקוראים ל-actions למעלה) — פרונטאנד
- [x] **1.5ש׳** — Onboarding: מוסד → מחלקה → שנה → רישום לקורסים (UI). ה-repositories שזה נשען עליהם כבר קיימים: `catalog.ts`, `profiles.updateOwnProfile`, `enrollments.ts`

---

**הערות M1 (DB):**

- נבנה ב-workflow של 10 agents: סכמה → RLS/RPCs/seed/harness במקביל → אינטגרציה → בדיקות → review אבטחה + התאמה לספק → תיקונים
- ה-review מצא 13 בעיות ותוקנו, בהן: `messages` לא היה ב-publication של Realtime (הצ'אט לא היה מתעדכן), פרופיל מלא נחשף לחברים לכיתה, בעל חדר יכול היה לבטל ארכוב של אדמין, תוכן הודעה מחוקה נשאר גלוי
- **הבדיקות רצות ב-PGlite ולא ב-Supabase** — Docker לא מותקן

---

## ✅ ליבת הבקאנד — נבנתה (18.09.2026)

חוצה את M1/M3/M4/M5/M6: כל שכבת השרת שאינה תלויה במסכים. **לא UI, לא Docker.**

| קובץ/תיקייה                                                                           | מה יש                                                                                                            |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `proxy.ts` + `lib/supabase/middleware.ts`                                             | רענון session בכל בקשה                                                                                           |
| `lib/auth/actions.ts`                                                                 | signUp/signIn/signOut/resendVerificationEmail, שגיאות בעברית, **הגנה מפני email enumeration**                    |
| `app/auth/callback/route.ts`                                                          | אימות מייל                                                                                                       |
| `lib/repositories/{catalog,profiles,enrollments,rooms,invitations,messages,admin}.ts` | עטיפה טיפוסית סביב כל ה-RPCs וה-SELECTs. **חתימה אחידה:** כל פונקציה מקבלת client כפרמטר ראשון (לא בונה אחד לבד) |
| `lib/storage/index.ts`                                                                | **באג מ-M1 תוקן** — `uploadAvatar` מחזיר נתיב, לא URL                                                            |
| `lib/ai/gemini.ts`                                                                    | לקוח Gemini עם streaming, דרך `@google/genai`                                                                    |
| `lib/ai/context.ts`                                                                   | בניית ה-prompt: system prompt מ-`app_settings`, שם קורס/חדר/משתתפים, N הודעות אחרונות עם קיצוץ לפי תקרת tokens   |
| `app/api/rooms/[id]/messages/route.ts`                                                | ה-route היחיד: הכנסת הודעה → זיהוי `@AI` → `start_ai_run` → תשובה מיידית → `after()` מריץ את Gemini ברקע         |

**איך זה נבנה:** תזמור ידני עם Agent (כלי ה-Workflow מנוטרל בסשן) — Auth ו-Repositories במקביל → AI Core (תלוי בחוזה של ה-repositories) → אינטגרציה (lint/typecheck/build על הכול ביחד) → סקירת אבטחה אדוורסרית.

**תוצאות:**

- `lint` + `typecheck` + `build` **נקיים לגמרי**, כולל build מלא עם env מדומה
- סקירת אבטחה: **ממצא אחד, חומרה נמוכה** — הודעת השגיאה בהרשמה חשפה אם מייל כבר רשום במערכת (email enumeration). **תוקן ואומת** (`signUp` מחזיר תשובה זהה בין אם המייל קיים ובין אם לא)
- כל שאר הנתיבים שנבדקו (`start_ai_run`, הרשאות אדמין, refresh token, avatar upload, redirect ב-callback) — **ללא ממצאים**

**מה נשאר פתוח מהבנייה הזו:**

- `after()` מ-`next/server` **אומת שקיים ועובד** בגרסת ה-Next הזו (נבדק מול `node_modules/next`, לא הונח) — אין fallback, לא היה צריך
- `GEMINI_MODEL` ברירת מחדל: `gemini-2.5-flash`. מגבלות קצב ברירת מחדל: 30/שעה למשתמש, 60/שעה לחדר — ב-`.env.example`
- **לא נבדק על Gemini אמיתי** — אין `GEMINI_API_KEY`. הקוד עבר typecheck ובדיקות סטטיות בלבד
- **לא נבדק על Supabase אמיתי** — עדיין אין Docker. אותה מגבלה כמו ב-DB
- `app/api/rooms/[id]/messages/route.ts` הוא ה-route האחד שקיים. שאר ה-repositories (הזמנות, פרופיל, קטלוג, אדמין) **כתובים אבל לא מחוברים לשום route/UI עדיין**

---

## M2 — Dashboard & Courses · 7ש׳

- [x] **3ש׳** — דשבורד: חדרים פעילים (עם badge unread) · הקורסים שלי · הזמנות ממתינות (**מסונן לפי `expires_at`**) · כניסה מהירה
- [x] **1.5ש׳** — "הקורסים שלי": רשימה, הוספה מהקטלוג, הסרה
- [x] **2.5ש׳** — מסך קורס: פרטים + רשימת הסטודנטים הרשומים + מעבר לפרופיל ציבורי

---

## M3 — Invitations · 6.5ש׳

- [x] **2.5ש׳** — בחירת 1-3 סטודנטים מרשימת הקורס + שליחת הזמנות
- [x] **1.75ש׳** — חיבור `accept_room_invitation` + דחייה + ביטול ע"י המזמין
- [x] **1.25ש׳** — הזמנות ממתינות בדשבורד + realtime על `user:{id}` — **בלי realtime** (מופיעות ברענון; Cut list #2)
- [x] **1ש׳** — יצירת חדר + ולידציות
- [x] בדיקות 11-12 (concurrency אישורים, תוקף)

---

## M4 — Room Realtime · 10ש׳

- [x] **3ש׳** — Layout + רשימת הודעות · keyset pagination · בועות RTL
- [x] **1.5ש׳** — שליחת הודעה + optimistic UI (uuid בקליינט) — ההודעה נכנסת לרשימה מתשובת ה-route (לא uuid מהקליינט)
- [x] **2.5ש׳** — `useRoomChannel`: postgres_changes INSERT/UPDATE + reconciliation
- [x] **1.25ש׳** — Presence
- [x] **1.75ש׳** — `last_read_at` + badge unread + `soft_delete_message` ב-UI

> M4 בונה את הרכיבים שעליהם מסתמך צ'אט 1:1 בשלב 2. **רשימת ההודעות, ה-hook וה-pagination חייבים לצאת גנריים** — אחרת S2 יעלה 16ש׳ במקום 10.

---

## M5 — AI in Room ⭐ · 12ש׳

- [x] **2.5ש׳** — Gemini client · system prompt · context builder (N הודעות + תקרת tokens) — `lib/ai/gemini.ts` + `lib/ai/context.ts`
- [x] **3.25ש׳** — `POST /api/rooms/[id]/messages`: זיהוי trigger, קריאה ל-`start_ai_run`, `after()`, `maxDuration=60`
- [x] **1.75ש׳** — צבירת stream + UPDATE סופי + **`onChunk` hook (no-op)**
- [x] **backend** — שמירת טקסט חלקי + "(נקטע)", `status='failed'`, דיווח ל-Sentry
- [x] **~0.5ש׳ נותר** — כפתור "נסה שוב" — פרונטאנד
- [x] **backend** — Rate limiting (בתוך ה-RPC, נקרא מה-route)
- [x] **~0.5ש׳ נותר** — UX של הודעת חריגה — פרונטאנד
- [x] **1.25ש׳** — רינדור הודעת AI: markdown, סגנון נבדל, "העוזר כותב…"
- [x] בדיקות 13-16 — **כבר עוברות** ב-`supabase/tests/rpc.test.mjs` (נבנו ב-M1). מה שעדיין לא נבדק: אותו תרחיש דרך ה-route האמיתי, לא רק דרך ה-RPC ישירות — חסום עד Docker

---

## M6 — Profile & Super Admin · 7.75ש׳

- [x] **2.5ש׳** — פרופיל: צפייה/עריכה + avatar דרך `lib/storage/` + הגדרות
- [x] **0.5ש׳** — פרופיל ציבורי מצומצם
- [x] **1.25ש׳** — אדמין: משתמשים (רשימה, חיפוש, סינון, השבתה)
- [x] **2ש׳** — אדמין: קטלוג CRUD (מוסדות, מחלקות, קורסים)
- [x] **0.75ש׳** — אדמין: חדרים (רשימה, מטא, ארכוב) — **בלי תוכן הודעות**
- [x] **0.75ש׳** — אדמין: `ai_system_prompt` + `ai_enabled` + סיכום צריכה + כשלונות אחרונים

---

## M7 — QA & Launch · 9ש׳

- [ ] **2.5ש׳** — Responsive: desktop, tablet, mobile
- [x] **2ש׳** — בדיקות פונקציונליות מקצה לקצה
- [x] **1.5ש׳** — בדיקות הרשאות ומקרי קצה (חזרה על 1-16)
- [ ] **2ש׳** — תיקוני באגים
- [ ] **1ש׳** — Production: Supabase prod, Vercel, דומיין, env, Sentry, smoke test, מסירה. **ב-Supabase prod: לוודא JWT signing keys אסימטריים (ברירת המחדל בפרויקט חדש) ולהשתמש במפתחות `sb_publishable_`/`sb_secret_`** — אחרת `getClaims()` נופל חזרה ל-`getUser()` והרווח בביצועים אובד
- [x] בדיקה 17 — אין סודות ב-bundle (נבדק: `SUPABASE_SERVICE_ROLE_KEY` ו-`service_role` לא מופיעים ב-`.next/static`)

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

- [x] **להתקין Docker Desktop** — חוסם את כל השאר ברשימה
- [x] `npm run db:start` + `npm run db:reset` — לוודא שה-migrations וה-seed עולים על Supabase האמיתי. הסיכון העיקרי: ב-Supabase `postgres` אינו superuser, והפקודות על `realtime.messages` ו-`storage` עלולות להיכשל
- [x] התחברות עם משתמש seed (`Password123!`) — מאמת את מבנה `auth.users` / `auth.identities`
- [x] בדיקת concurrency אמיתית בשני חיבורים: #11 (שני אישורים לחדר עם 3) ו-#13 (שני `@AI` במקביל)
- [x] Realtime אמיתי: הודעה מופיעה אצל חבר אחר; לא-חבר לא מצליח להצטרף ל-`room:<id>`
- [ ] `npx supabase gen types typescript --local > lib/database.types.ts`
- [x] `npm run lint` + `npm run format:check` + `npm run typecheck` — **לא הורצו אחרי הוספת קבצי ה-DB והבדיקות**
- [ ] לבדוק בעין את `/dev/rtl` (5 הבדיקות בראש הדף)
- [x] commit — **שום דבר עוד לא ב-git**

### התאמות באפליקציה שנובעות מה-DB (לזכור ב-M1-M6)

- [x] `lib/storage/index.ts` — `uploadAvatar` מחזיר URL, אבל ה-DB מצפה לנתיב `<id>/<file>` ב-`avatar_url`
- [x] פרופילים של אחרים — לקרוא מ-`public_profiles`, לא מ-`profiles`
- [x] insert של הודעה — **בלי** `created_at`
- [x] route ה-AI — `start_ai_run` דרך `createAdminClient()`, אחרי אימות המשתמש
- [x] broadcast `message_deleted` אחרי `soft_delete_message` (ה-DB מוכן, האפליקציה לא)

### החלטות DB שדורשות אישור

- [ ] משתמש מושבת שחוזר לפעילות **לא** חוזר אוטומטית לחדרים — צריך הזמנה מחדש
- [ ] חבר שעזב חדר מאבד גישה להיסטוריה שלו
- [ ] תוכנית Vercel של הלקוח (Hobby = `maxDuration` 60 שניות)

### הבא בתוכנית

**M1 — Auth + Onboarding** (3.5ש׳): הרשמה, התחברות, middleware, בחירת מוסד/מחלקה/שנה ורישום לקורסים.

---

## יומן

| תאריך         | שלב              | שעות | הערות                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ---------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11.09.2026    | מסמכים           | —    | `SPEC`, `TECHNICAL_SPEC`, `TASKS`, `PHASE3` נכתבו                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 13.09.2026    | M0               | —    | scaffold, RTL, shadcn, Sentry, CI, גבולות. חסר Docker ל-`supabase start`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 13.09.2026    | M1 (DB)          | —    | 4 migrations, seed, 15 RPCs, RLS מלא, 39/39 בדיקות ב-PGlite. review: 13 תיקונים. נעצר לפני Auth                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 18.09.2026    | ליבת בקאנד       | —    | Auth actions, 7 repositories, Gemini client, AI route. lint/typecheck/build נקיים. review: ממצא אחד (email enumeration) — תוקן                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 25-28.09.2026 | UI לפי מוקאפ     | —    | 7 מסכים + דף נחיתה (nav, hero עם חיפוש, features grid, איך זה עובד, CTA, footer) לפי קנבס Claude Design (Rubik, טוקנים, תפריט עליון). נמחקו רכיבים ישנים שאין אליהם imports. migration `20260925000001`: התראות+העדפות, חדרים פתוחים, נושאי קורס (מניעים `progress_percent`), "פנוי ללמוד עכשיו", סוגי אירועים+הרשמה. **49/49 בדיקות DB עוברות** (עודכנו ציפיות ישנות: 28 הודעות ב-R1 אחרי הרחבת ה-seed, `city`/`last_seen_at` ב-`public_profiles`). lint/typecheck/format/build נקיים. **Change Request מול `SPEC.md` §7 (סילבוס, קבוצות) — לאשר.** חסר: בדיקה בדפדפן |
| 28.09.2026    | M1-M6 סגירה + QA | —    | Docker + Supabase אמיתי: כל 8 ה-migrations וה-seed עולים. חדר: Presence, מחיקה עצמית (broadcast), טעינת הודעות קודמות, סטטוס נקרא, פאנל משתתפים (הזמנת 1-3, ביטול, הסרה, ארכוב/סגירה, AI בחדר, עזיבה). AI: "שאל את העוזר", markdown, "העוזר כותב…", "נסה שוב" (`/api/rooms/[id]/ai-retry`, אותו `start_ai_run`), busy/מגבלה. דשבורד: החדרים שלי + unread, הזמנות ממתינות, חדר חדש. Onboarding מחובר. פאנל Super Admin `/admin`. E2E על ה-stack: 43/43, concurrency #11/#13 אמיתי עובר. בלי שינוי סכמה                                                                  |
| 29.09.2026    | ביצועים          | —    | נמדד ב-production מקומי: 2 קריאות `/auth/v1/user` (~250ms) היו ~60% מזמן כל עמוד. `getClaims()` + מפתח חתימה ES256 מאמתים מקומית; `touchLastSeen` ב-`after()`; `cache()` לקריאות משותפות ל-nav ולעמוד (`lib/app/cached.ts`); הדשבורד כגרף תלויות במקום 4 סבבים; `loading.tsx` לכל עמוד. תוצאה: דשבורד ~1000→~280ms, שאר העמודים 100–230ms. `.env.local` עבר למפתחות `sb_publishable_`/`sb_secret_`. E2E 43/43, concurrency #11/#13, רענון session שפג תוקפו ו-JWT מזויף נבדקו                                                                                          |
| 03.10.2026    | ביצועים          | —    | נמדד ב-production עם לוגי `[perf]` (`lib/perf/timing.ts`): שאילתת שורה בודדת לקחה 243ms כי ה-Functions רצו ב-`iad1` וה-Supabase ב-`ap-south-1`. `vercel.json` → `bom1`: profile ~1400→74ms, courses ~1550→83ms. בנוסף: `prefetch={false}` לקישורים ברשימות (כל כניסה ל-`/courses` יצרה ~10 רינדורים), ה-proxy מדלג על prefetch, RPC `course_catalog_counts(institution_id)` (סבב אחד פחות בקטלוג ובדשבורד, עם fallback עד `db push`), profile ו-course detail כגרף תלויות                                                                                              |
| 04.10.2026    | מצב דמו (UX)     | —    | כפתור צף "מצב דמו" עם 3 תרחישים (פעיל / משתמשים בלי פעילות / ריק) למעצבת. fixtures ב-`lib/demo`, cookie במקום משתמש, כל הכתיבות חסומות, Realtime כבוי, אווטארים סטטיים ב-`public/demo/avatars`. בלי שינוי סכמה                                                                                                                                                                                                                                                                                                                                                         |
