import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCourse, listDepartments } from "@/lib/repositories/catalog";
import { getOwnProfile } from "@/lib/repositories/profiles";
import { listMyEnrollments } from "@/lib/repositories/enrollments";
import { listEnrolledCourseStudents } from "@/lib/repositories/invitations";
import { listMyActiveRooms, countActiveRoomsByCourseIds } from "@/lib/repositories/rooms";
import { listTestsForCourse } from "@/lib/repositories/tests";
import { computeMatchPercent } from "@/lib/matching/score";

export async function getCourseDetailData(userId: string, courseId: string) {
  const supabase = await createClient();
  const [course, myProfile, myEnrollments, roster, myActiveRooms, tests, roomCounts] =
    await Promise.all([
      getCourse(supabase, courseId),
      getOwnProfile(supabase, userId),
      listMyEnrollments(supabase, userId),
      listEnrolledCourseStudents(supabase, courseId),
      listMyActiveRooms(supabase, userId),
      listTestsForCourse(supabase, courseId),
      countActiveRoomsByCourseIds(supabase, [courseId]),
    ]);

  const departments = course ? await listDepartments(supabase, course.institution_id) : [];
  const departmentsById = new Map(departments.map((d) => [d.id, d]));

  const myEnrollment = myEnrollments.find((e) => e.course_id === courseId) ?? null;
  const classmates =
    myProfile && course
      ? roster
          .filter((p) => p.id !== userId)
          .map((p) => ({ profile: p, match: computeMatchPercent(myProfile, p, departmentsById) }))
          .sort((a, b) => b.match.percent - a.match.percent)
      : [];

  return {
    course,
    departmentName: course?.department_id
      ? (departmentsById.get(course.department_id)?.name ?? null)
      : null,
    isEnrolled: myEnrollment?.status === "active",
    progressPercent: myEnrollment?.progress_percent ?? 0,
    activeRoomCount: roomCounts[courseId] ?? 0,
    myRoomsForCourse: myActiveRooms.filter((r) => r.course_id === courseId),
    classmates,
    tests,
  };
}
