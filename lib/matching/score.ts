import type { PublicProfile } from "@/lib/repositories/profiles";
import type { Department } from "@/lib/repositories/catalog";

// Course-roster "match percentage" (Eyal's request): institution, study
// year, department, faculty (derived from department) and city — each an
// equal 20% weight. Deliberately simple/deterministic (no ML/AI call): every
// input is already loaded for the page, and a transparent, explainable score
// fits a "why are we matched" UI better than an opaque one.
const CRITERIA_WEIGHT = 20;

export interface MatchBreakdownItem {
  label: string;
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
): MatchResult {
  const myFacultyId = me.department_id
    ? (departmentsById.get(me.department_id)?.faculty_id ?? null)
    : null;
  const otherFacultyId = other.department_id
    ? (departmentsById.get(other.department_id)?.faculty_id ?? null)
    : null;

  const breakdown: MatchBreakdownItem[] = [
    {
      label: "מוסד לימודים",
      matched: !!me.institution_id && me.institution_id === other.institution_id,
    },
    {
      label: "פקולטה",
      matched: !!myFacultyId && myFacultyId === otherFacultyId,
    },
    {
      label: "מחלקה",
      matched: !!me.department_id && me.department_id === other.department_id,
    },
    {
      label: "שנת לימודים",
      matched: me.study_year !== null && me.study_year === other.study_year,
    },
    { label: "עיר", matched: !!me.city && me.city === other.city },
  ];

  const percent = breakdown.filter((b) => b.matched).length * CRITERIA_WEIGHT;
  return { percent, breakdown };
}
