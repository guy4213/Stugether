"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContinueButton, StepFrame } from "@/components/onboarding/step-frame";

export function NameStep({
  value,
  onChange,
  onContinue,
}: {
  value: string;
  onChange: (value: string) => void;
  onContinue: () => void;
}) {
  const valid = value.trim().length > 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onContinue();
      }}
    >
      <StepFrame
        title="היי! איך קוראים לך? 👋"
        subtitle="ככה יכירו אותך השותפים ללמידה"
        focusHeading={false}
        footer={<ContinueButton type="submit" disabled={!valid} />}
      >
        <Label htmlFor="onboarding-name" className="sr-only">
          שם מלא
        </Label>
        <Input
          id="onboarding-name"
          autoFocus
          autoComplete="name"
          maxLength={120}
          placeholder="שם פרטי ושם משפחה"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-14 rounded-[16px] border-[1.5px] bg-white px-4 text-lg shadow-none md:text-lg"
        />
      </StepFrame>
    </form>
  );
}
