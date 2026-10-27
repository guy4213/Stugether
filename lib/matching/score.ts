import type { PublicProfile } from "@/lib/repositories/profiles";
import type { Department } from "@/lib/repositories/catalog";

// Match percentage between two students (Change Request 13.10.2026). A fixed,
// explainable sum of weighted criteria — no ML/AI call: every input is
// already loaded for the page, and "why are we matched" needs a transparent
// score. Weights add up to 100. Study times and learning styles joined with
// the onboarding wizard (Change Request 27.10.2026).
const WEIGHTS = {
  sharedCourses: 33, // 11 per shared course, up to 3
  department: 12,
  year: 9,
  institution: 7,
  hobbies: 8, // 4 per shared hobby, up to 2
  studyTimes: 6, // 3 per shared study time, up to 2
  learningStyles: 6, // 3 per shared learning style, up to 2
  faculty: 5,
  semester: 5,
  track: 5,
  city: 4,
} as const;
const PER_SHARED_COURSE = 11;
const PER_SHARED_HOBBY = 4;
const PER_SHARED_STUDY_TIME = 3;
const PER_SHARED_LEARNING_STYLE = 3;

const sharedCount = (a: readonly string[] | null, b: readonly string[] | null) =>
  [...new Set(a ?? [])].filter((x) => (b ?? []).includes(x)).length;

export interface MatchBreakdownItem {
  label: string;
  /** Points this criterion adds (0 when not matched). */
  points: number;
  matched: boolean;
}

export interface MatchResult {
  percent: number;
  breakdown: MatchBreakdownItem[];
}

export function computeMatchPercent(
  me: PublicProfile,
  other: PublicProfile,
  departmentsById: Map<string, Department>,
  sharedCourseCount = 0,
): MatchResult {
  const facultyOf = (p: PublicProfile) =>
    p.department_id ? (departmentsById.get(p.department_id)?.faculty_id ?? null) : null;
  const myFaculty = facultyOf(me);
  const sharedHobbies = sharedCount(me.hobbies, other.hobbies);
  const sharedStudyTimes = sharedCount(me.study_times, other.study_times);
  const sharedLearningStyles = sharedCount(me.learning_styles, other.learning_styles);

  const item = (label: string, points: number): MatchBreakdownItem => ({
    label,
    points,
    matched: points > 0,
  });
  const when = (cond: boolean, weight: number) => (cond ? weight : 0);

  const breakdown: MatchBreakdownItem[] = [
    item("קורסים משותפים", Math.min(sharedCourseCount * PER_SHARED_COURSE, WEIGHTS.sharedCourses)),
    item(
      "אותה מחלקה",
      when(!!me.department_id && me.department_id === other.department_id, WEIGHTS.department),
    ),
    item(
      "אותה שנת לימודים",
      when(me.study_year !== null && me.study_year === other.study_year, WEIGHTS.year),
    ),
    item(
      "אותו מוסד לימודים",
      when(!!me.institution_id && me.institution_id === other.institution_id, WEIGHTS.institution),
    ),
    item("תחביבים משותפים", Math.min(sharedHobbies * PER_SHARED_HOBBY, WEIGHTS.hobbies)),
    item(
      "זמני למידה משותפים",
      Math.min(sharedStudyTimes * PER_SHARED_STUDY_TIME, WEIGHTS.studyTimes),
    ),
    item(
      "דרכי למידה משותפות",
      Math.min(sharedLearningStyles * PER_SHARED_LEARNING_STYLE, WEIGHTS.learningStyles),
    ),
    item("אותה פקולטה", when(!!myFaculty && myFaculty === facultyOf(other), WEIGHTS.faculty)),
    item(
      "אותו סמסטר",
      when(me.semester != null && me.semester === other.semester, WEIGHTS.semester),
    ),
    item("אותו מסלול לימודים", when(!!me.track && me.track === other.track, WEIGHTS.track)),
    item("אותה עיר", when(!!me.city && me.city === other.city, WEIGHTS.city)),
  ];

  const percent = Math.min(
    100,
    breakdown.reduce((sum, b) => sum + b.points, 0),
  );
  return { percent, breakdown };
}
