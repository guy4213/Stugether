@AGENTS.md

# Stugether — מדריך לעבודה בריפו

חדרי למידה קבוצתיים (2-4 סטודנטים מאותו קורס) עם עוזר AI שיושב בתוך השיחה. ממשק בעברית, RTL.

## מסמכי מקור (לקרוא לפני שינוי התנהגות)

| מסמך                | תפקיד                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| `SPEC.md`           | מה המוצר עושה. **מחייב — באג = סטייה ממנו.** מה שלא כתוב שם הוא Change Request |
| `TECHNICAL_SPEC.md` | ארכיטקטורה, מודל נתונים, RLS, AI, realtime. גובר על `SPEC.md` רק בעניין המימוש |
| `TASKS.md`          | Roadmap ומעקב milestones (M0-M7). מתעדכן בסוף כל שלב                           |
| `PHASE3.md`         | מה נחתך מה-MVP                                                                 |

בעת סתירה: `SPEC.md` גובר על המוצר, `TECHNICAL_SPEC.md` גובר על המימוש.

## Stack

Next.js 16.3 (App Router, React 19.2, TypeScript strict) · Tailwind 4 + shadcn/ui (Radix) · Supabase (Postgres, Auth, Realtime, Storage) · Gemini (`@google/genai`) · Sentry · Zod 4 · Node 22.

**Next.js כאן שונה ממה שמוכר.** לפני כתיבת קוד קראו את המדריך הרלוונטי ב-`node_modules/next/dist/docs/`. דוגמה: `middleware.ts` הוחלף ב-**`proxy.ts`** (export בשם `proxy`).

## פקודות

```bash
npm run dev            # http://localhost:3000
npm run lint           # ESLint, כולל כללי הגבולות
npm run typecheck      # next typegen && tsc --noEmit
npm run format         # Prettier (format:check ב-CI)
npm run build
npm run db:start       # Supabase מקומי (דורש Docker)
npm run db:reset       # migrations + seed מחדש
npm run db:test        # node --test על supabase/tests/**/*.test.mjs (PGlite)
```

CI (`.github/workflows/ci.yml`) מריץ: lint → format:check → typecheck → build. הריצו אותם לפני סיום משימה.
הגדרת סביבה: `cp .env.example .env.local` ומילוי הערכים מפלט `db:start`. **לעולם לא לקומיט ערכים אמיתיים.**

## מבנה

```
app/
  (app)/            אזור מאומת: dashboard, courses, rooms/[id], profile, notifications, analytics
  api/rooms/[id]/messages/route.ts   שליחת הודעה + הפעלת ה-AI
  login, signup, auth/callback, dev/rtl
components/         UI בלבד (ui/ = shadcn; שאר התיקיות לפי תחום)
hooks/useRoomChannel.ts             נקודת הכניסה היחידה ל-Realtime
lib/
  repositories/     כל הגישה ל-DB
  storage/          קבצים (avatars)
  supabase/         clients: client / server / admin / middleware
  ai/               context.ts, gemini.ts
  <domain>/         actions.ts (Server Actions) ו-queries.ts לפי תחום
supabase/
  migrations/       סכמה + RLS + RPCs
  seed.sql
  tests/            בדיקות DB (rls, rpc, load, ...)
proxy.ts            רענון session של Supabase בכל בקשה
```

## גבולות ארכיטקטורה (נאכפים ב-ESLint)

`components/**`, `app/**/page.tsx` ו-`app/**/layout.tsx` **אסור** שייבאו `@supabase/*` או `@/lib/supabase/*`.

| צריך     | משתמשים ב-                |
| -------- | ------------------------- |
| DB       | `lib/repositories/`       |
| Realtime | `hooks/useRoomChannel.ts` |
| קבצים    | `lib/storage/`            |

אל תעקפו את הכלל ב-`eslint-disable`; הוסיפו פונקציה ל-repository.

## עקרונות מוצר שחשוב לא לשבור

- **Super Admin אינו רואה תוכן הודעות** — מטא-נתונים בלבד (החלטת פרטיות).
- ה-AI עונה **רק** על `@AI` או "שאל את העוזר", ראה 30 הודעות אחרונות, עונה בעברית, מנחה ולא פותר מטלה מוערכת. ריצה אחת פעילה לחדר (`ai_runs_one_active_per_room`), עם rate limit לסטודנט ולחדר.
- חדר: 2-4 משתתפים כולל היוצר. `archived`/`closed` = קריאה בלבד. הזמנות in-app בלבד, תוקף 7 ימים, רק לרשומים לאותו קורס.
- אין עריכת הודעות; מחיקה עצמית תוך 5 דקות (RPC `soft_delete_message`).
- סטטוס "נקרא" ברמת חדר, לא לכל הודעה.
- הזרימה הקריטית (`start_ai_run`, `accept_room_invitation`, ...) היא **RPC בטרנזקציה אחת** — לא מפרקים ללוגיקה בצד האפליקציה.

## מסד נתונים

- כל שינוי סכמה = migration חדש ב-`supabase/migrations/` (שם: `YYYYMMDDNNNNNN_name.sql`). לא עורכים migration קיים.
- RLS מופעל עם `FORCE` על כל הטבלאות. פונקציות העזר (`is_room_member`, `can_post_in_room`, `is_super_admin`) הן `SECURITY DEFINER`.
- שינוי ב-RLS/RPC מלווה בעדכון/הוספת בדיקה ב-`supabase/tests/` והרצת `npm run db:test`.
- `SUPABASE_SERVICE_ROLE_KEY` והמפתחות ללא `NEXT_PUBLIC_` הם server-only.

## סגנון קוד

- Prettier: `printWidth` 100, נקודה-פסיק, מרכאות כפולות, trailing commas, סדר classes אוטומטי של Tailwind.
- Alias: `@/*` מצביע לשורש הריפו.
- RTL: `dir="rtl"` ב-`<html>`, פונט Rubik. השתמשו ב-**logical properties** (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) ולא ב-`left/right`. לבדיקה ויזואלית: `/dev/rtl`.
- טקסטי UI בעברית.

## הערות

- `TASKS.md` הוא מקור האמת להתקדמות; אם הושלמה משימה, עדכנו אותו.
- ב-`lib/` קיימים מודולים מעבר ל-`SPEC.md` (favorites, matching, topics, availability, analytics) שנוספו עם migrations `20260923`–`20260925`. לפני הרחבתם בדקו ש-`SPEC.md` מכסה את התכונה, אחרת זה Change Request.
- `AGENTS.md` נוצר מחדש ע"י `next dev` — אל תערכו אותו ידנית מעבר לשורה שכבר קיימת.
