"use client";

import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ContinueButton, StepFrame } from "@/components/onboarding/step-frame";

// Optional: a photo, or one of the ready-made avatars; with neither, an
// automatic avatar is shown. Saved on pick (AvatarUploader), independent of
// finishing the wizard.
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
      subtitle={
        <>
          <p>האנושיות היא חלק בלתי נפרד מהקהילה,</p>
          <p>לכן חשוב לנו שתעלו תמונה (:</p>
          <p className="mt-2 font-semibold text-ink-2">מתביישים? אפשר גם אווטאר.</p>
        </>
      }
      footer={
        <ContinueButton disabled={pending} onClick={onFinish}>
          {pending ? "שומרים הכל..." : "סיום ההרשמה"}
        </ContinueButton>
      }
    >
      <div className="flex flex-col items-center gap-4 py-4">
        <p className="text-sm text-muted-foreground">לחצו על המצלמה כדי להעלות תמונה (עד 2MB)</p>
        <AvatarUploader userId={userId} fullName={fullName} avatarPath={avatarPath} withPresets />
      </div>
    </StepFrame>
  );
}
