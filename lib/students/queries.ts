import "server-only";
import { getCachedOwnProfile } from "@/lib/app/cached";
import { createClient } from "@/lib/supabase/server";
import {
  listAllDepartments,
  listAllFaculties,
  listInstitutions,
  type Department,
  type Faculty,
  type Institution,
} from "@/lib/repositories/catalog";
import { listMyEnrollments } from "@/lib/repositories/enrollments";
import {
  getPublicProfile,
  listDirectoryProfiles,
  type PublicProfile,
} from "@/lib/repositories/profiles";
import { computeMatchPercent, type MatchResult } from "@/lib/matching/score";
import { sharedCoursesByUser } from "@/lib/matching/shared-courses";
import {
  LEARNING_STYLE_LABEL,
  SEMESTER_LABEL,
  STUDY_TIME_LABEL,
  TRACK_LABEL,
} from "@/lib/constants/profile-options";
import { isOnline } from "@/lib/ui/people";
import { yearLabel } from "@/lib/ui/labels";
import { timed } from "@/lib/perf/timing";
import { getDemoScenario } from "@/lib/demo/state";
import { demoStudentInputs } from "@/lib/demo/fixtures";

export const STUDENTS_PAGE_SIZE = 32;

export interface StudentFilters {
  q?: string;
  institutionId?: string;
  departmentId?: string;
  year?: number;
  courseId?: string;
  online?: boolean;
  page?: number;
}

// Everything the directory and a profile need, from the DB or from the demo.
export interface StudentInputs {
  me: PublicProfile | null;
  others: PublicProfile[];
  institutions: Institution[];
  faculties: Faculty[];
  departments: Department[];
  /** user id → ids of my active courses they are also in. */
  sharedCourses: Map<string, string[]>;
  myCourses: { id: string; name: string }[];
}

async function loadInputs(
  userId: string,
  others: (supabase: Awaited<ReturnType<typeof createClient>>) => Promise<PublicProfile[]>,
): Promise<StudentInputs> {
  const supabase = await createClient();
  const pEnrollments = listMyEnrollments(supabase, userId);
  const pActiveIds = pEnrollments.then((rows) =>
    rows.filter((e) => e.status === "active").map((e) => e.course_id),
  );
  const [me, enrollments, people, institutions, faculties, departments, sharedCourses] =
    await Promise.all([
      getCachedOwnProfile(userId),
      pEnrollments,
      others(supabase),
      listInstitutions(supabase),
      listAllFaculties(supabase),
      listAllDepartments(supabase),
      pActiveIds.then((ids) => sharedCoursesByUser(supabase, ids, userId)),
    ]);
  return {
    me,
    others: people,
    institutions,
    faculties,
    departments,
    sharedCourses,
    myCourses: enrollments
      .filter((e) => e.status === "active")
      .map((e) => ({ id: e.course_id, name: e.course.name })),
  };
}

function matchFor(inputs: StudentInputs, other: PublicProfile): MatchResult | null {
  if (!inputs.me) return null;
  const departmentsById = new Map(inputs.departments.map((d) => [d.id, d]));
  return computeMatchPercent(
    inputs.me,
    other,
    departmentsById,
    inputs.sharedCourses.get(other.id)?.length ?? 0,
  );
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

export async function getStudentsPageData(userId: string, filters: StudentFilters) {
  const demo = await getDemoScenario();
  const inputs = demo
    ? demoStudentInputs(demo)
    : await timed(
        "page.students",
        loadInputs(userId, (supabase) => listDirectoryProfiles(supabase, userId)),
      );
  return shapeDirectory(inputs, filters);
}

function shapeDirectory(inputs: StudentInputs, filters: StudentFilters) {
  const now = Date.now();
  const institutionById = new Map(inputs.institutions.map((i) => [i.id, i]));
  const departmentById = new Map(inputs.departments.map((d) => [d.id, d]));
  const q = filters.q?.trim().toLowerCase();

  const all = inputs.others.map((p) => ({
    profile: p,
    online: isOnline(p.last_seen_at, now),
    departmentName: p.department_id ? (departmentById.get(p.department_id)?.name ?? null) : null,
    institutionName: p.institution_id
      ? (institutionById.get(p.institution_id)?.name ?? null)
      : null,
    sharedCourseIds: inputs.sharedCourses.get(p.id) ?? [],
    match: matchFor(inputs, p),
  }));

  const matching = all
    .filter((s) => {
      if (q && !s.profile.full_name.toLowerCase().includes(q)) return false;
      if (filters.institutionId && s.profile.institution_id !== filters.institutionId) return false;
      if (filters.departmentId && s.profile.department_id !== filters.departmentId) return false;
      if (filters.year && s.profile.study_year !== filters.year) return false;
      if (filters.courseId && !s.sharedCourseIds.includes(filters.courseId)) return false;
      if (filters.online && !s.online) return false;
      return true;
    })
    .sort(
      (a, b) =>
        (b.match?.percent ?? 0) - (a.match?.percent ?? 0) ||
        Number(b.online) - Number(a.online) ||
        a.profile.full_name.localeCompare(b.profile.full_name, "he"),
    );

  const pageCount = Math.max(1, Math.ceil(matching.length / STUDENTS_PAGE_SIZE));
  const page = Math.min(filters.page ?? 1, pageCount);

  // Filter options: departments of the chosen (or my) institution.
  const optionInstitution = filters.institutionId ?? inputs.me?.institution_id ?? null;
  return {
    students: matching.slice((page - 1) * STUDENTS_PAGE_SIZE, page * STUDENTS_PAGE_SIZE),
    pagination: { page, pageCount, total: matching.length },
    totals: { all: all.length, online: all.filter((s) => s.online).length },
    options: {
      institutions: inputs.institutions
        .filter((i) => inputs.others.some((p) => p.institution_id === i.id))
        .map((i) => ({ id: i.id, name: i.name })),
      departments: inputs.departments
        .filter((d) => d.institution_id === optionInstitution)
        .map((d) => ({ id: d.id, name: d.name })),
      myCourses: inputs.myCourses,
    },
    hasProfile: !!inputs.me?.institution_id,
  };
}

export type StudentsPageData = Awaited<ReturnType<typeof getStudentsPageData>>;
export type StudentCard = StudentsPageData["students"][number];

// ---------------------------------------------------------------------------
// One student's profile
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getStudentProfileData(userId: string, studentId: string) {
  // A malformed id is "not found", not a database error (22P02).
  if (!UUID_RE.test(studentId)) return null;
  const demo = await getDemoScenario();
  const inputs = demo
    ? demoStudentInputs(demo)
    : await loadInputs(userId, async (supabase) => {
        const p = await getPublicProfile(supabase, studentId);
        return p ? [p] : [];
      });
  const student = inputs.others.find((p) => p.id === studentId) ?? null;
  if (!student) return null;

  const institution = inputs.institutions.find((i) => i.id === student.institution_id);
  const department = inputs.departments.find((d) => d.id === student.department_id);
  const faculty = department?.faculty_id
    ? inputs.faculties.find((f) => f.id === department.faculty_id)
    : undefined;
  const sharedIds = inputs.sharedCourses.get(student.id) ?? [];
  const myHobbies = inputs.me?.hobbies ?? [];
  const myStudyTimes: string[] = inputs.me?.study_times ?? [];
  const myLearningStyles: string[] = inputs.me?.learning_styles ?? [];

  return {
    student,
    online: isOnline(student.last_seen_at),
    match: matchFor(inputs, student),
    details: {
      institution: institution?.name ?? null,
      faculty: faculty?.name ?? null,
      department: department?.name ?? null,
      track: student.track ? TRACK_LABEL[student.track] : null,
      year: yearLabel(student.study_year),
      semester: student.semester ? (SEMESTER_LABEL[student.semester] ?? null) : null,
    },
    hobbies: (student.hobbies ?? []).map((name) => ({ name, shared: myHobbies.includes(name) })),
    studyTimes: (student.study_times ?? []).map((t) => ({
      name: STUDY_TIME_LABEL[t],
      shared: myStudyTimes.includes(t),
    })),
    learningStyles: (student.learning_styles ?? []).map((l) => ({
      name: LEARNING_STYLE_LABEL[l],
      shared: myLearningStyles.includes(l),
    })),
    sharedCourses: inputs.myCourses.filter((c) => sharedIds.includes(c.id)),
  };
}

export type StudentProfileData = NonNullable<Awaited<ReturnType<typeof getStudentProfileData>>>;
