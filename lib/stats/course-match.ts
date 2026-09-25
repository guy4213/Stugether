import type { Course, Department } from "@/lib/repositories/catalog";
import type { Profile } from "@/lib/repositories/profiles";

// "N% התאמה" for course recommendations. RLS hides the rosters of courses the
// student isn't in, so this scores the course against the student's own
// profile rather than against its students (unlike lib/matching/score.ts).
//   same department 40 · same faculty 15 · year level = study year 30
//   (±1 year: 15) · has live rooms 15
export function computeCourseMatch(
  profile: Pick<Profile, "department_id" | "study_year">,
  course: Pick<Course, "department_id" | "year_level">,
  departmentsById: Map<string, Department>,
  activeRoomCount: number,
): number {
  let score = 0;
  if (profile.department_id && course.department_id === profile.department_id) score += 40;

  const myFaculty = profile.department_id
    ? departmentsById.get(profile.department_id)?.faculty_id
    : null;
  const courseFaculty = course.department_id
    ? departmentsById.get(course.department_id)?.faculty_id
    : null;
  if (myFaculty && myFaculty === courseFaculty) score += 15;

  if (profile.study_year !== null && course.year_level !== null) {
    const gap = Math.abs(course.year_level - profile.study_year);
    if (gap === 0) score += 30;
    else if (gap === 1) score += 15;
  }

  if (activeRoomCount > 0) score += 15;
  return score;
}
