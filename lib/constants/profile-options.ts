// Profile fields that feed the student match score (20261013000003).
// The stored value of a hobby IS its Hebrew label, like ISRAELI_CITIES.

export const STUDY_TRACKS = ["day", "evening", "mixed", "online"] as const;
export type StudyTrack = (typeof STUDY_TRACKS)[number];

export const TRACK_LABEL: Record<StudyTrack, string> = {
  day: "לימודי בוקר",
  evening: "לימודי ערב",
  mixed: "מסלול משולב",
  online: "לימודים מקוונים",
};

export const SEMESTERS = [1, 2, 3] as const;

export const SEMESTER_LABEL: Record<number, string> = {
  1: "סמסטר א׳",
  2: "סמסטר ב׳",
  3: "סמסטר קיץ",
};

export const MAX_HOBBIES = 8;

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
