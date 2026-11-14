"use client";

import { InviteStudentButton } from "@/components/students/invite-student-button";

// "הזמנה ללמידה" on the course page: the same confirmation dialog as on a
// student's card, with this course already chosen and a new room named after
// the current syllabus topic.
export function InviteToStudyButton({
  courseId,
  courseName,
  inviteeId,
  inviteeName,
  topicTitle,
}: {
  courseId: string;
  courseName: string;
  inviteeId: string;
  inviteeName: string;
  topicTitle: string | null;
}) {
  return (
    <InviteStudentButton
      inviteeId={inviteeId}
      inviteeName={inviteeName}
      sharedCourses={[{ id: courseId, name: courseName }]}
      presetCourseId={courseId}
      topicTitle={topicTitle}
      buttonClassName="h-[46px] w-full rounded-[14px] text-[15px] shadow-none"
    />
  );
}
