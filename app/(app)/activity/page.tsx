import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";
import { ActivityList } from "@/components/activity/activity-list";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourseActivity } from "@/lib/activity/queries";

const PAGE_SIZE = 30;

// "כל הפעילות האחרונה" (client QA 12.11.2026): what happened in my courses and
// rooms — rooms opened, sessions scheduled, classmates who joined, new
// friends, invitations. Notifications stay personal (/notifications).
// Paging: ?before=<time of the last item shown>.
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { before } = await searchParams;
  const valid = before && !Number.isNaN(Date.parse(before)) ? before : null;
  const items = await getCourseActivity(user.id, { limit: PAGE_SIZE, before: valid });
  const last = items.at(-1);

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 px-4 pt-7 pb-10 sm:px-8"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowRightIcon className="size-4" aria-hidden />
        חזרה לדף הבית
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-[30px] leading-tight font-extrabold">פעילות אחרונה</h1>
        <p className="text-muted-foreground">
          מה קורה בקורסים ובחדרים שלך. ההתראות האישיות שלך נמצאות ב
          <Link href="/notifications" className="font-semibold text-primary">
            התראות
          </Link>
          .
        </p>
      </header>

      <section className="rounded-[22px] border border-border bg-card px-4 py-1 shadow-card-sm sm:px-6">
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {valid ? "אין פעילות ישנה יותר." : "עוד אין פעילות בקורסים שלך."}
          </p>
        ) : (
          <ActivityList items={items} avatars />
        )}
      </section>

      <nav className="flex items-center justify-between gap-3">
        {valid ? (
          <Link href="/activity" className="text-sm font-semibold text-primary">
            לפעילות החדשה ביותר
          </Link>
        ) : (
          <span />
        )}
        {last && items.length === PAGE_SIZE && (
          <Link
            href={`/activity?before=${encodeURIComponent(last.at)}`}
            className="rounded-full border border-primary-line bg-white px-5 py-2 text-sm font-semibold text-primary hover:bg-primary-soft"
          >
            פעילות קודמת
          </Link>
        )}
      </nav>
    </main>
  );
}
