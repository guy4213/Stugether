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
# מפתח חתימה מקומי (ES256). הקובץ ב-.gitignore — לא לקמט אותו.
npx supabase gen signing-key --algorithm ES256 > supabase/signing_keys.json
npm run db:start          # Supabase מקומי — מדפיס URL ומפתחות
```

`signing_keys.json` חייב להיות **מערך** JSON. אם הפקודה כתבה אובייקט בודד, עוטפים אותו ב-`[ ]`.
בזכות המפתח האסימטרי, `auth.getClaims()` מאמת את ה-session מקומית, בלי קריאה לשרת האימות בכל עמוד.

מעתיקים מהפלט של `db:start` ל-`.env.local`:

| פלט               | משתנה                           |
| ----------------- | ------------------------------- |
| `API_URL`         | `NEXT_PUBLIC_SUPABASE_URL`      |
| `PUBLISHABLE_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SECRET_KEY`      | `SUPABASE_SERVICE_ROLE_KEY`     |

המפתחות הישנים (`ANON_KEY`/`SERVICE_ROLE_KEY`, ‏JWT בחתימת HS256) לא עובדים כשמפתח החתימה מופעל.

```bash
npm run dev               # http://localhost:3000
```

Supabase Studio: http://localhost:54323

ב-Git Bash על Windows, אם `supabase start` לא מוצא את `docker`:
`export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"`.

### משתמשי seed

סיסמה לכולם: `Password123!`

| מייל                   | תפקיד                                |
| ---------------------- | ------------------------------------ |
| `noa@stugether.test`   | סטודנטית, יוצרת חדר R1 (משתמשת הדמו) |
| `itai@stugether.test`  | סטודנט, חבר ב-R1                     |
| `admin@stugether.test` | Super Admin — פאנל ניהול ב-`/admin`  |

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

<!-- test -->
