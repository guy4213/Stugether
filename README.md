# Stugether

חדרי למידה קבוצתיים לסטודנטים, עם עוזר AI שמשתתף בשיחה.

| מסמך                                   | תוכן           |
| -------------------------------------- | -------------- |
| [SPEC.md](SPEC.md)                     | מה המערכת עושה |
| [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md) | איך היא בנויה  |
| [TASKS.md](TASKS.md)                   | Roadmap ומעקב  |

## דרישות

- Node.js 22
- Docker Desktop (עבור Supabase המקומי)

## הקמה

```bash
npm install
cp .env.example .env.local
npm run db:start          # Supabase מקומי — מדפיס URL ומפתחות
```

מעתיקים מהפלט של `db:start` ל-`.env.local`:

| פלט                | משתנה                           |
| ------------------ | ------------------------------- |
| `API URL`          | `NEXT_PUBLIC_SUPABASE_URL`      |
| `anon key`         | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role key` | `SUPABASE_SERVICE_ROLE_KEY`     |

```bash
npm run dev               # http://localhost:3000
```

Supabase Studio: http://localhost:54323

## סקריפטים

| פקודה                          |                             |
| ------------------------------ | --------------------------- |
| `npm run dev`                  | שרת פיתוח                   |
| `npm run build`                | build ל-production          |
| `npm run lint`                 | ESLint, כולל כללי הגבולות   |
| `npm run typecheck`            | TypeScript                  |
| `npm run format`               | Prettier                    |
| `npm run db:start` / `db:stop` | Supabase מקומי              |
| `npm run db:reset`             | מריץ מחדש migrations + seed |

## כללי ארכיטקטורה

קומפוננטות ודפים **לא** מייבאים Supabase. ESLint נכשל אם כן.

| צריך     | משתמשים ב-                |
| -------- | ------------------------- |
| DB       | `lib/repositories/`       |
| Realtime | `hooks/useRoomChannel.ts` |
| קבצים    | `lib/storage/`            |

פירוט: [TECHNICAL_SPEC.md §2.2](TECHNICAL_SPEC.md).

## בדיקת RTL

בפיתוח בלבד: http://localhost:3000/dev/rtl
