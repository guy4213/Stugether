"use server";

import { createClient } from "@/lib/supabase/server";
import { listFaculties, listDepartments, listActiveCourses } from "@/lib/repositories/catalog";
import { getDemoScenario } from "@/lib/demo/state";
import { demoDepartmentCourses, demoInstitutionCatalog } from "@/lib/demo/fixtures";

// Called directly from the (client) profile form when the Institution select
// changes, per React 19's support for calling exported "use server" functions
// outside of <form action>. Changing Faculty needs no round trip: the client
// already holds the full departments array (with faculty_id) from here and
// filters it in-memory.
export async function getCatalogForInstitution(institutionId: string) {
  if (await getDemoScenario()) return demoInstitutionCatalog(institutionId);
  const supabase = await createClient();
  const [faculties, departments] = await Promise.all([
    listFaculties(supabase, institutionId),
    listDepartments(supabase, institutionId),
  ]);
  return { faculties, departments };
}

export interface DepartmentCourse {
  id: string;
  name: string;
  code: string | null;
  yearLevel: number | null;
  semester: string | null;
}

// The onboarding wizard's course step: a department's active courses, only
// the fields the picker shows (year/semester pick the recommended ones).
export async function getDepartmentCourses(
  institutionId: string,
  departmentId: string,
): Promise<DepartmentCourse[]> {
  if (await getDemoScenario()) return demoDepartmentCourses(departmentId);
  const supabase = await createClient();
  const courses = await listActiveCourses(supabase, { institutionId, departmentId });
  return courses.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    yearLevel: c.year_level,
    semester: c.semester,
  }));
}
