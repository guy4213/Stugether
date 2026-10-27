import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningStyle, StudyTime, StudyTrack } from "@/lib/constants/profile-options";

// The onboarding wizard's answers + course enrollments in one transaction
// (complete_onboarding RPC, 20261027000001). Returns the number of courses
// enrolled. Business errors come back with the code as the message
// (ALREADY_ONBOARDED, INVALID_ARGUMENT, INVALID_DEPARTMENT, INVALID_COURSES).
export async function completeOnboarding(
  client: SupabaseClient,
  input: {
    fullName: string;
    institutionId: string;
    departmentId: string;
    studyYear: number;
    semester: number;
    track: StudyTrack;
    hobbies: string[];
    studyTimes: StudyTime[];
    learningStyles: LearningStyle[];
    courseIds: string[];
  },
): Promise<number> {
  const { data, error } = await client.rpc("complete_onboarding", {
    p_full_name: input.fullName,
    p_institution_id: input.institutionId,
    p_department_id: input.departmentId,
    p_study_year: input.studyYear,
    p_semester: input.semester,
    p_track: input.track,
    p_hobbies: input.hobbies,
    p_study_times: input.studyTimes,
    p_learning_styles: input.learningStyles,
    p_course_ids: input.courseIds,
  });
  if (error) throw error;
  return Number(data);
}
