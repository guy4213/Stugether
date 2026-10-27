// Profile fields that feed the student match score (20261013000003,
// 20261027000001).
// The stored value of a hobby IS its Hebrew label, like ISRAELI_CITIES.

export const STUDY_TRACKS = ["day", "evening", "mixed", "online"] as const;
export type StudyTrack = (typeof STUDY_TRACKS)[number];

export const TRACK_LABEL: Record<StudyTrack, string> = {
  day: "לימודי בוקר",
  evening: "לימודי ערב",
  mixed: "מסלול משולב",
  online: "לימודים מקוונים",
};

// The onboarding wizard offers only these two (SPEC §4.1); the profile form
// keeps every track.
export const ONBOARDING_TRACKS = ["day", "evening"] as const satisfies readonly StudyTrack[];

export const SEMESTERS = [1, 2, 3] as const;

export const SEMESTER_LABEL: Record<number, string> = {
  1: "סמסטר א׳",
  2: "סמסטר ב׳",
  3: "סמסטר קיץ",
};

export const MAX_HOBBIES = 8;
/** The wizard asks for exactly this many (complete_onboarding checks it too). */
export const ONBOARDING_HOBBIES = 3;

// Preferred study times and learning styles (20261027000001). Stored as keys;
// the DB CHECK constraints list the same keys.
export const STUDY_TIMES = ["morning", "noon", "evening", "night"] as const;
export type StudyTime = (typeof STUDY_TIMES)[number];

export const STUDY_TIME_LABEL: Record<StudyTime, string> = {
  morning: "בוקר",
  noon: "צהריים",
  evening: "ערב",
  night: "לילה",
};

export const LEARNING_STYLES = [
  "summaries",
  "exercises",
  "group",
  "explanations",
  "discussions",
  "sample_exams",
  "pairs",
  "memorization",
] as const;
export type LearningStyle = (typeof LEARNING_STYLES)[number];

export const LEARNING_STYLE_LABEL: Record<LearningStyle, string> = {
  summaries: "קריאת סיכומים",
  exercises: "פתרון תרגילים",
  group: "למידה בקבוצה",
  explanations: "למידה דרך הסברים",
  discussions: "דיונים ושאלות",
  sample_exams: "בחינות לדוגמה",
  pairs: "למידה בזוגות",
  memorization: "שינון וחזרה",
};

/** Profile maximum; the wizard asks for exactly this many. */
export const MAX_LEARNING_STYLES = 3;

export const HOBBIES = [
  "ספורט",
  "כדורגל",
  "כדורסל",
  "ריצה",
  "חדר כושר",
  "יוגה",
  "מוזיקה",
  "נגינה",
  "צילום",
  "בישול",
  "אפייה",
  "קריאה",
  "כתיבה",
  "ציור",
  "סרטים וסדרות",
  "משחקי מחשב",
  "משחקי קופסה",
  "טיולים",
  "טיולים בחו״ל",
  "תכנות",
  "יזמות",
  "התנדבות",
  "ריקוד",
  "שחמט",
] as const;
