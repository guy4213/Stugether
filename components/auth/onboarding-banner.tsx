import Link from "next/link";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

const STEPS = ["חשבון", "פרטי לימודים", "רישום לקורסים"];

// Onboarding (SPEC §4.1): 1. account (signup page) → 2. institution,
// department, year (profile) → 3. enroll in courses (catalog) → dashboard.
export function OnboardingBanner({ step }: { step: 1 | 2 }) {
  return (
    <section
      aria-label="השלמת הרשמה"
      className="flex flex-col gap-4 rounded-[22px] border border-primary-line bg-primary-soft p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-3">
        <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="שלבי הרשמה">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                  i <= step
                    ? "bg-brand text-white"
                    : "border-2 border-border bg-white text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span className={cn(i === step ? "font-bold" : "text-muted-foreground")}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="h-0.5 w-6 rounded bg-border" aria-hidden />}
            </li>
          ))}
        </ol>
        <p className="text-[15px] font-semibold text-primary-strong">
          {step === 1
            ? "בחרו מוסד, מחלקה ושנת לימודים ושמרו — ואז נעבור לבחירת הקורסים."
            : "הירשמו לקורסים שלכם מהקטלוג. אפשר להוסיף ולהסיר קורסים גם אחר כך."}
        </p>
      </div>
      {step === 2 && (
        <Button asChild variant="brand" size="md">
          <Link href="/dashboard">סיום והמשך לדשבורד</Link>
        </Button>
      )}
    </section>
  );
}
