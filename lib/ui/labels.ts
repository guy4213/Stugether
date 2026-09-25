import type { StudyActivity, StudyMode } from "@/lib/repositories/availability";
import type { EventKind } from "@/lib/repositories/tests";

export const MODE_LABEL: Record<StudyMode, string> = {
  online: "אונליין",
  campus: "בקמפוס",
};

export const ACTIVITY_LABEL: Record<StudyActivity, string> = {
  summaries: "קריאת סיכומים",
  exercises: "פתרון תרגילים",
  review: "חזרה על החומר",
  exam_prep: "הכנה למבחן",
};

export function durationLabel(minutes: number): string {
  if (minutes === 60) return "שעה";
  if (minutes === 90) return "שעה וחצי";
  if (minutes === 120) return "שעתיים";
  return `${minutes} דק׳`;
}

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  test: "מבחן",
  workshop: "סדנה",
  study_session: "מפגש לימוד",
};

export const NEXT_EVENT_LABEL: Record<EventKind, string> = {
  test: "המבחן הבא",
  workshop: "הסדנה הבאה",
  study_session: "המפגש הבא",
};

const HEBREW_ORDINALS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י"];

// 1 -> "שנה א׳"
export function yearLabel(year: number | null | undefined): string | null {
  if (!year || year < 1 || year > HEBREW_ORDINALS.length) return null;
  return `שנה ${HEBREW_ORDINALS[year - 1]}׳`;
}
