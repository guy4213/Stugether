"use client";

import { PartyPopperIcon } from "lucide-react";
import { ContinueButton, StepFrame } from "@/components/onboarding/step-frame";

export function DoneStep({
  firstName,
  summary,
  demo,
  onContinue,
}: {
  firstName: string;
  summary: string[];
  demo: boolean;
  onContinue: () => void;
}) {
  return (
    <StepFrame
      title={`הכל מוכן, ${firstName}! 🎉`}
      subtitle="אפשר להתחיל ללמוד ביחד. השותפים שהכי מתאימים לך כבר מחכים בדשבורד"
      footer={<ContinueButton onClick={onContinue}>יאללה לדשבורד</ContinueButton>}
    >
      <div className="flex flex-col items-center gap-5 py-4">
        <span className="flex size-24 animate-in items-center justify-center rounded-full bg-brand-diag text-white shadow-glow-teal duration-500 zoom-in-50 motion-reduce:animate-none">
          <PartyPopperIcon className="size-11" strokeWidth={1.8} aria-hidden />
        </span>
        <ul className="flex flex-wrap justify-center gap-2">
          {summary.map((s) => (
            <li
              key={s}
              className="rounded-full bg-primary-soft px-3.5 py-1.5 text-sm font-semibold text-primary-strong"
            >
              {s}
            </li>
          ))}
        </ul>
        {demo && (
          <p className="rounded-[14px] bg-warning-soft px-4 py-2.5 text-center text-sm text-warning-ink">
            מצב הדגמה: התשובות לא נשמרו
          </p>
        )}
      </div>
    </StepFrame>
  );
}
