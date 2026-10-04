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

## מצב דמו (UX/UI)

כפתור צף בפינה הימנית-תחתונה ("מצב דמו") מציג את האפליקציה עם נתוני דוגמה, בשביל עיצוב ובדיקות UX. אין צורך בחשבון. שלושה תרחישים:

| תרחיש                     | מה רואים                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **מצב פעיל** (ברירת מחדל) | אינפי 1 (8 סטודנטים, 3 פנויים, חדר חי עם 4 משתתפים ושיחה עם העוזר), מבוא למדמ"ח (10, 2 פנויים), אלגברה לינארית (6, 1 פנוי), מפגש לימוד שנקבע, הזמנה ממתינה, התראות |
| משתמשים, בלי פעילות       | אותם סטודנטים בקורסים, אף אחד לא פנוי, אין חדרים                                                                                                                   |
| מצב ריק                   | הסטודנטית לבד בקורסים: 0 שותפים, 0 חדרים, 0 התראות                                                                                                                 |

בידוד: הדמו הוא cookie (`stugether_demo`), לא משתמש. כל טוען עמוד מחזיר fixtures (`lib/demo/fixtures.ts`) בלי לגשת ל-Supabase, וכל Server Action, ה-routes של הודעות/AI והעלאת אווטאר נחסמים ("מצב דמו — הפעולה לא נשמרת"). שליחת הודעה בחדר הדמו מדומה בדפדפן בלבד. אין שינוי במשתמשים, בנתונים או בסטטיסטיקות.

זמינות: פעיל ב-`npm run dev` וב-Preview של Vercel, **כבוי ב-production**. להפעלה בפריסה מסוימת: `DEMO_MODE=on` (ו-`off` לכיבוי מוחלט).

<!-- test -->
