"use client";

import { useState } from "react";
import { BookOpenIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OptionTile } from "@/components/onboarding/option-tile";
import { ContinueButton, StepFrame } from "@/components/onboarding/step-frame";
import { SEMESTER_LABEL } from "@/lib/constants/profile-options";
import { semesterLabel, semesterNumber, yearLabel } from "@/lib/ui/labels";
import type { DepartmentCourse } from "@/lib/catalog/queries";

export const MAX_ONBOARDING_COURSES = 30;

// This semester's courses of my year: pre-selected when the step opens.
export function recommendedCourses(
  courses: DepartmentCourse[],
  year: number | null,
  semester: number | null,
): DepartmentCourse[] {
  return courses.filter((c) => c.yearLevel === year && semesterNumber(c.semester) === semester);
}

export function CoursesStep({
  courses,
  year,
  semester,
  selected,
  onChange,
  onContinue,
}: {
  /** null while loading. */
  courses: DepartmentCourse[] | null;
  year: number | null;
  semester: number | null;
  selected: string[];
  onChange: (ids: string[]) => void;
  onContinue: () => void;
}) {
  const [query, setQuery] = useState("");
  const recommended = courses ? recommendedCourses(courses, year, semester) : [];
  const recommendedIds = new Set(recommended.map((c) => c.id));
  const q = query.trim();
  const others = (courses ?? []).filter(
    (c) => !recommendedIds.has(c.id) && (!q || c.name.includes(q) || c.code?.includes(q)),
  );
  const full = selected.length >= MAX_ONBOARDING_COURSES;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const tile = (c: DepartmentCourse) => (
    <OptionTile
      key={c.id}
      mode="multi"
      icon={BookOpenIcon}
      label={c.name}
      hint={[c.code, yearLabel(c.yearLevel), semesterLabel(c.semester)].filter(Boolean).join(" · ")}
      selected={selected.includes(c.id)}
      disabled={full && !selected.includes(c.id)}
      onSelect={() => toggle(c.id)}
    />
  );

  const subtitle =
    recommended.length > 0
      ? `בחרנו לך ${recommended.length === 1 ? "קורס אחד" : `${recommended.length} קורסים`} של ${yearLabel(year)} · ${SEMESTER_LABEL[semester ?? 1]}. אפשר להוסיף ולהוריד`
      : "סמנו את הקורסים שאתם לומדים עכשיו. אפשר לשנות גם אחר כך";

  return (
    <StepFrame
      title="הקורסים שלך 📚"
      subtitle={courses ? subtitle : undefined}
      footer={
        <ContinueButton disabled={selected.length === 0} onClick={onContinue}>
          {selected.length === 0
            ? "בחרו לפחות קורס אחד"
            : `המשך עם ${selected.length === 1 ? "קורס אחד" : `${selected.length} קורסים`}`}
        </ContinueButton>
      }
    >
      {!courses ? (
        <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="טוען קורסים">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[60px] animate-pulse rounded-[18px] bg-muted" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <p className="rounded-[18px] bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          עדיין אין קורסים במחלקה הזו בקטלוג. חזרו ובחרו מחלקה אחרת, או פנו אלינו כדי שנוסיף אותם.
        </p>
      ) : (
        <>
          {recommended.length > 0 && (
            <section aria-labelledby="recommended-courses" className="flex flex-col gap-2.5">
              <h2
                id="recommended-courses"
                className="flex items-center gap-1.5 text-sm font-bold text-primary-strong"
              >
                <SparklesIcon className="size-4" aria-hidden />
                מומלצים לך
              </h2>
              {recommended.map(tile)}
            </section>
          )}

          <section aria-labelledby="all-courses" className="mt-3 flex flex-col gap-2.5">
            <h2 id="all-courses" className="text-sm font-bold text-ink-2">
              {recommended.length > 0 ? "עוד קורסים במחלקה" : "כל הקורסים במחלקה"}
            </h2>
            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute start-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש לפי שם או קוד קורס"
                aria-label="חיפוש קורס"
                className="h-12 rounded-[16px] border-[1.5px] bg-white ps-11 text-[15px] shadow-none"
              />
            </div>
            {others.map(tile)}
            {others.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {q ? "לא מצאנו קורס כזה" : "אין קורסים נוספים"}
              </p>
            )}
          </section>
        </>
      )}
    </StepFrame>
  );
}
