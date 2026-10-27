"use client";

import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ContinueButton, StepFrame } from "@/components/onboarding/step-frame";

// Optional: the initials avatar is the default. The photo uploads on pick
// (AvatarUploader), independent of finishing the wizard.
export function PhotoStep({
  userId,
  fullName,
  avatarPath,
  onFinish,
  pending,
}: {
  userId: string;
  fullName: string;
  avatarPath: string | null;
  onFinish: () => void;
  pending: boolean;
}) {
  return (
    <StepFrame
      title="ונשאר רק לחייך 📸"
      subtitle="תמונה עוזרת לשותפים לזהות אותך. אין לך תמונה עכשיו? נציג את ראשי התיבות שלך"
      footer={
        <ContinueButton disabled={pending} onClick={onFinish}>
          {pending ? "שומרים הכל..." : "סיום ההרשמה"}
        </ContinueButton>
      }
    >
      <div className="flex flex-col items-center gap-4 py-4">
        <AvatarUploader userId={userId} fullName={fullName} avatarPath={avatarPath} />
        <p className="text-sm text-muted-foreground">לחצו על המצלמה כדי להעלות תמונה (עד 2MB)</p>
      </div>
    </StepFrame>
  );
}
