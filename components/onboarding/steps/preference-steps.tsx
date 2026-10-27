"use client";

import {
  BrainIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  HandshakeIcon,
  LightbulbIcon,
  MessagesSquareIcon,
  MoonIcon,
  PencilLineIcon,
  SunIcon,
  SunriseIcon,
  SunsetIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { OptionChip, OptionTile, PickCounter } from "@/components/onboarding/option-tile";
import { ContinueButton, StepFrame } from "@/components/onboarding/step-frame";
import {
  HOBBIES,
  LEARNING_STYLES,
  LEARNING_STYLE_LABEL,
  MAX_LEARNING_STYLES,
  ONBOARDING_HOBBIES,
  STUDY_TIMES,
  STUDY_TIME_LABEL,
  type LearningStyle,
  type StudyTime,
} from "@/lib/constants/profile-options";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function HobbiesStep({
  selected,
  onChange,
  onContinue,
}: {
  selected: string[];
  onChange: (hobbies: string[]) => void;
  onContinue: () => void;
}) {
  const full = selected.length >= ONBOARDING_HOBBIES;
  return (
    <StepFrame
      title="מה את/ה אוהב/ת לעשות?"
      subtitle={`בחרו ${ONBOARDING_HOBBIES} תחביבים — ככה נמצא לך שותפים שיהיה כיף ללמוד איתם`}
      footer={
        <ContinueButton disabled={selected.length !== ONBOARDING_HOBBIES} onClick={onContinue} />
      }
    >
      <PickCounter count={selected.length} of={ONBOARDING_HOBBIES} />
      <div className="flex flex-wrap gap-2">
        {HOBBIES.map((h) => {
          const isSelected = selected.includes(h);
          return (
            <OptionChip
              key={h}
              label={h}
              selected={isSelected}
              disabled={full && !isSelected}
              onToggle={() => onChange(toggle(selected, h))}
            />
          );
        })}
      </div>
    </StepFrame>
  );
}

const TIME_ICON: Record<StudyTime, LucideIcon> = {
  morning: SunriseIcon,
  noon: SunIcon,
  evening: SunsetIcon,
  night: MoonIcon,
};
const TIME_HINT: Record<StudyTime, string> = {
  morning: "08:00–12:00",
  noon: "12:00–16:00",
  evening: "16:00–21:00",
  night: "21:00 והלאה",
};

export function StudyTimesStep({
  selected,
  onChange,
  onContinue,
}: {
  selected: StudyTime[];
  onChange: (times: StudyTime[]) => void;
  onContinue: () => void;
}) {
  return (
    <StepFrame
      title="מתי נוח לך ללמוד?"
      subtitle="אפשר לבחור כמה"
      footer={<ContinueButton disabled={selected.length === 0} onClick={onContinue} />}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {STUDY_TIMES.map((t) => (
          <OptionTile
            key={t}
            mode="multi"
            icon={TIME_ICON[t]}
            label={STUDY_TIME_LABEL[t]}
            hint={TIME_HINT[t]}
            selected={selected.includes(t)}
            onSelect={() => onChange(toggle(selected, t))}
          />
        ))}
      </div>
    </StepFrame>
  );
}

const STYLE_ICON: Record<LearningStyle, LucideIcon> = {
  summaries: FileTextIcon,
  exercises: PencilLineIcon,
  group: UsersIcon,
  explanations: LightbulbIcon,
  discussions: MessagesSquareIcon,
  sample_exams: ClipboardCheckIcon,
  pairs: HandshakeIcon,
  memorization: BrainIcon,
};

export function LearningStylesStep({
  selected,
  onChange,
  onContinue,
}: {
  selected: LearningStyle[];
  onChange: (styles: LearningStyle[]) => void;
  onContinue: () => void;
}) {
  const full = selected.length >= MAX_LEARNING_STYLES;
  return (
    <StepFrame
      title="איך את/ה הכי אוהב/ת ללמוד?"
      subtitle={`בחרו ${MAX_LEARNING_STYLES} דרכים שהכי מתאימות לך`}
      footer={
        <ContinueButton disabled={selected.length !== MAX_LEARNING_STYLES} onClick={onContinue} />
      }
    >
      <PickCounter count={selected.length} of={MAX_LEARNING_STYLES} />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {LEARNING_STYLES.map((s) => {
          const isSelected = selected.includes(s);
          return (
            <OptionTile
              key={s}
              mode="multi"
              icon={STYLE_ICON[s]}
              label={LEARNING_STYLE_LABEL[s]}
              selected={isSelected}
              disabled={full && !isSelected}
              onSelect={() => onChange(toggle(selected, s))}
            />
          );
        })}
      </div>
    </StepFrame>
  );
}
