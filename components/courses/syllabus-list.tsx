import { CheckIcon, ExternalLinkIcon, ListTreeIcon } from "lucide-react";
import { cn } from "cn";
import type { TopicWithState } from "@/lib/courses/topic-state";

// "סילבוס" tab: every topic with its subtopics, plus where the list came
// from. Borrowed lists (another institution's equivalent course) are labelled
// as such — the student should know it is not this course's own syllabus.
export function SyllabusList({ topics }: { topics: TopicWithState[] }) {
  if (topics.length === 0) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-[22px] border border-border bg-card p-8 text-center">
        <ListTreeIcon className="size-8 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-bold">אין עדיין סילבוס לקורס הזה</h2>
        <p className="text-sm text-muted-foreground">
          לא מצאנו רשימת נושאים מפורסמת לקורס. נוסיף אותה כשתהיה זמינה.
        </p>
      </section>
    );
  }

  const sources = uniqueSources(topics);

  return (
    <section
      aria-labelledby="syllabus-title"
      className="flex flex-col gap-4 rounded-[22px] border border-border bg-card p-6"
    >
      <header className="flex flex-col gap-1">
        <h2 id="syllabus-title" className="text-[22px] font-extrabold">
          סילבוס הקורס
        </h2>
        <p className="text-sm text-muted-foreground">
          {topics.length} נושאים
          {topics.some((t) => t.subtopics.length > 0) &&
            ` · ${topics.reduce((n, t) => n + t.subtopics.length, 0)} תתי־נושאים`}
        </p>
      </header>

      <ol className="flex flex-col divide-y divide-border">
        {topics.map((topic) => (
          <li key={topic.id} className="flex gap-3 py-3">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                topic.state === "mastered"
                  ? "bg-success text-white"
                  : topic.state === "current"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {topic.state === "mastered" ? (
                <CheckIcon className="size-3.5" strokeWidth={3} aria-label="נשלט" />
              ) : (
                topic.position
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="font-semibold">
                {topic.title}
                {topic.state === "current" && (
                  <span className="ms-2 text-xs font-bold text-primary-strong">· עכשיו</span>
                )}
              </p>
              {topic.subtopics.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label={`תתי־נושאים של ${topic.title}`}>
                  {topic.subtopics.map((sub) => (
                    <li
                      key={sub.id}
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {sub.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>

      <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
        {sources.map((s) => (
          <p key={s.key} className="flex flex-wrap items-center gap-1">
            <span>{s.label}</span>
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-semibold underline-offset-2 hover:underline"
              >
                {s.ref}
                <ExternalLinkIcon className="size-3" aria-hidden />
              </a>
            ) : (
              s.ref && <span className="font-semibold">{s.ref}</span>
            )}
          </p>
        ))}
      </footer>
    </section>
  );
}

const SOURCE_LABEL: Record<TopicWithState["source"], string> = {
  official_description: "מקור: תקציר הקורס הרשמי",
  official_syllabus: "מקור: הסילבוס הרשמי של המוסד",
  equivalent_course: "הקורס לא פרסם סילבוס — הנושאים לפי קורס מקביל:",
  ai_draft: "טיוטה אוטומטית",
  manual: "הוזן על ידי צוות Stugether",
};

function uniqueSources(topics: TopicWithState[]) {
  const seen = new Map<
    string,
    { key: string; label: string; ref: string | null; url: string | null }
  >();
  for (const t of topics) {
    const key = `${t.source}|${t.source_ref ?? ""}`;
    if (!seen.has(key)) {
      seen.set(key, { key, label: SOURCE_LABEL[t.source], ref: t.source_ref, url: t.source_url });
    }
  }
  return [...seen.values()];
}
