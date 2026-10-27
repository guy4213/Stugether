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

// Catalog rows say "סמסטר א׳"; hand-entered ones may say just "א".
export function semesterLabel(semester: string | null | undefined): string | null {
  if (!semester) return null;
  if (semester.startsWith("סמסטר")) return semester;
  return semester.length === 1 ? `סמסטר ${semester}׳` : `סמסטר ${semester}`;
}

// The same text as profiles.semester (1 = א׳, 2 = ב׳, 3 = קיץ); null if unknown.
export function semesterNumber(semester: string | null | undefined): 1 | 2 | 3 | null {
  if (!semester) return null;
  const s = semester.replace(/^סמסטר\s*/, "");
  if (s.startsWith("קיץ")) return 3;
  if (s.startsWith("א")) return 1;
  if (s.startsWith("ב")) return 2;
  return null;
}
