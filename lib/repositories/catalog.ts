import type { SupabaseClient } from "@supabase/supabase-js";
import { countActiveStudentsByCourseIds } from "@/lib/repositories/enrollments";
import { countActiveRoomsByCourseIds } from "@/lib/repositories/rooms";

// Academic catalog: institutions, departments, courses.
// Read paths are filtered to is_active; write paths rely on RLS
// (institutions/departments/courses *_insert_super_admin, *_update_super_admin
// policies in 20260913000003_helpers_and_rls.sql) to gate super_admin-only access.

export interface Institution {
  id: string;
  name: string;
  city: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Faculty {
  id: string;
  institution_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  institution_id: string;
  faculty_id: string | null;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Course {
  id: string;
  institution_id: string;
  department_id: string | null;
  code: string | null;
  name: string;
  year_level: number | null;
  semester: string | null;
  is_active: boolean;
  created_at: string;
}

export async function listInstitutions(client: SupabaseClient): Promise<Institution[]> {
  const { data, error } = await client
    .from("institutions")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data as Institution[];
}

export async function listFaculties(
  client: SupabaseClient,
  institutionId: string,
): Promise<Faculty[]> {
  const { data, error } = await client
    .from("faculties")
    .select("*")
    .eq("institution_id", institutionId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data as Faculty[];
}

export async function listDepartments(
  client: SupabaseClient,
  institutionId: string,
): Promise<Department[]> {
  const { data, error } = await client
    .from("departments")
    .select("*")
    .eq("institution_id", institutionId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data as Department[];
}

export async function getCourse(client: SupabaseClient, courseId: string): Promise<Course | null> {
  const { data, error } = await client.from("courses").select("*").eq("id", courseId).maybeSingle();
  if (error) throw error;
  return data as Course | null;
}

export async function listActiveCourses(
  client: SupabaseClient,
  filters: { institutionId?: string; departmentId?: string } = {},
): Promise<Course[]> {
  let query = client.from("courses").select("*").eq("is_active", true);
  if (filters.institutionId) query = query.eq("institution_id", filters.institutionId);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  const { data, error } = await query.order("name");
  if (error) throw error;
  return data as Course[];
}

// Active students + active rooms for every active course of an institution
// (course_catalog_counts RPC, 20261003000001). Keyed by institution so it can
// run alongside listActiveCourses instead of waiting for the course ids.
export async function getCatalogCounts(
  client: SupabaseClient,
  institutionId: string,
): Promise<{ studentCounts: Record<string, number>; roomCounts: Record<string, number> }> {
  const { data, error } = await client.rpc("course_catalog_counts", {
    p_institution_id: institutionId,
  });
  // PGRST202: the RPC isn't deployed yet (code shipped before `db push`).
  // Fall back to the per-course RPCs — slower, but the page still works.
  if (error?.code === "PGRST202") {
    const ids = (await listActiveCourses(client, { institutionId })).map((c) => c.id);
    const [studentCounts, roomCounts] = await Promise.all([
      countActiveStudentsByCourseIds(client, ids),
      countActiveRoomsByCourseIds(client, ids),
    ]);
    return { studentCounts, roomCounts };
  }
  if (error) throw error;

  const studentCounts: Record<string, number> = {};
  const roomCounts: Record<string, number> = {};
  for (const row of data as { course_id: string; student_count: number; room_count: number }[]) {
    if (Number(row.student_count) > 0) studentCounts[row.course_id] = Number(row.student_count);
    if (Number(row.room_count) > 0) roomCounts[row.course_id] = Number(row.room_count);
  }
  return { studentCounts, roomCounts };
}

// --- Admin CRUD (RLS restricts writes to an active super_admin; call with the
// user-scoped client so RLS gates it). ---------------------------------------

export async function createInstitution(
  client: SupabaseClient,
  input: { name: string; city?: string | null },
): Promise<Institution> {
  const { data, error } = await client
    .from("institutions")
    .insert({ name: input.name, city: input.city ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as Institution;
}

export async function updateInstitution(
  client: SupabaseClient,
  institutionId: string,
  input: { name?: string; city?: string | null; isActive?: boolean },
): Promise<Institution> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.city !== undefined) patch.city = input.city;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await client
    .from("institutions")
    .update(patch)
    .eq("id", institutionId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Institution;
}

export async function createFaculty(
  client: SupabaseClient,
  input: { institutionId: string; name: string },
): Promise<Faculty> {
  const { data, error } = await client
    .from("faculties")
    .insert({ institution_id: input.institutionId, name: input.name })
    .select("*")
    .single();
  if (error) throw error;
  return data as Faculty;
}

export async function updateFaculty(
  client: SupabaseClient,
  facultyId: string,
  input: { name?: string; isActive?: boolean },
): Promise<Faculty> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await client
    .from("faculties")
    .update(patch)
    .eq("id", facultyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Faculty;
}

export async function createDepartment(
  client: SupabaseClient,
  input: { institutionId: string; facultyId?: string | null; name: string },
): Promise<Department> {
  const { data, error } = await client
    .from("departments")
    .insert({
      institution_id: input.institutionId,
      faculty_id: input.facultyId ?? null,
      name: input.name,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Department;
}

export async function updateDepartment(
  client: SupabaseClient,
  departmentId: string,
  input: { name?: string; facultyId?: string | null; isActive?: boolean },
): Promise<Department> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.facultyId !== undefined) patch.faculty_id = input.facultyId;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await client
    .from("departments")
    .update(patch)
    .eq("id", departmentId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Department;
}

export async function createCourse(
  client: SupabaseClient,
  input: {
    institutionId: string;
    departmentId?: string | null;
    code?: string | null;
    name: string;
    yearLevel?: number | null;
    semester?: string | null;
  },
): Promise<Course> {
  const { data, error } = await client
    .from("courses")
    .insert({
      institution_id: input.institutionId,
      department_id: input.departmentId ?? null,
      code: input.code ?? null,
      name: input.name,
      year_level: input.yearLevel ?? null,
      semester: input.semester ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Course;
}

export async function updateCourse(
  client: SupabaseClient,
  courseId: string,
  input: {
    departmentId?: string | null;
    code?: string | null;
    name?: string;
    yearLevel?: number | null;
    semester?: string | null;
    isActive?: boolean;
  },
): Promise<Course> {
  const patch: Record<string, unknown> = {};
  if (input.departmentId !== undefined) patch.department_id = input.departmentId;
  if (input.code !== undefined) patch.code = input.code;
  if (input.name !== undefined) patch.name = input.name;
  if (input.yearLevel !== undefined) patch.year_level = input.yearLevel;
  if (input.semester !== undefined) patch.semester = input.semester;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await client
    .from("courses")
    .update(patch)
    .eq("id", courseId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Course;
}
