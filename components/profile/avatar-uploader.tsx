"use client";

import { useState, useTransition } from "react";
import { CameraIcon } from "lucide-react";
import { toast } from "sonner";
import { uploadAvatar, getAvatarUrl } from "@/lib/storage";
import { updateAvatarPath } from "@/lib/profile/actions";
import { initials } from "@/lib/ui/people";

// The file input is addressable by id so other controls (the completion
// card's "העלאת תמונה") can open it with <label htmlFor>.
export const AVATAR_INPUT_ID = "avatar-upload-input";

// 132px avatar in a blue→teal ring with a camera button (Profile.dc.html).
export function AvatarUploader({
  userId,
  fullName,
  avatarPath,
}: {
  userId: string;
  fullName: string;
  avatarPath: string | null;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    avatarPath ? getAvatarUrl(avatarPath) : null,
  );
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    startTransition(async () => {
      try {
        const path = await uploadAvatar(userId, file);
        const result = await updateAvatarPath(path);
        if (!result.ok) {
          toast.error(result.error ?? "העלאת התמונה נכשלה");
          return;
        }
        setPreviewUrl(getAvatarUrl(path));
        toast.success("תמונת הפרופיל עודכנה");
      } catch (err) {
        const message =
          err instanceof Error && err.message === "AVATAR_TOO_LARGE"
            ? "הקובץ גדול מדי (עד 2MB)"
            : err instanceof Error && err.message === "AVATAR_INVALID_TYPE"
              ? "סוג קובץ לא נתמך (JPEG, PNG או WEBP בלבד)"
              : "העלאת התמונה נכשלה";
        toast.error(message);
      } finally {
        URL.revokeObjectURL(localPreview);
      }
    });
  }

  return (
    <div className="relative size-[132px] shrink-0 rounded-full bg-brand-diag p-1 shadow-[0_14px_28px_-12px_rgba(37,99,235,.55)]">
      <span className="flex size-full items-center justify-center overflow-hidden rounded-full border-5 border-white bg-primary-tint text-[40px] font-extrabold text-primary-strong">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- public storage URL / local blob preview
          <img src={previewUrl} alt={fullName} className="size-full object-cover" />
        ) : (
          initials(fullName)
        )}
      </span>
      <label
        htmlFor={AVATAR_INPUT_ID}
        aria-label="העלאת תמונת פרופיל"
        aria-disabled={isPending}
        className="absolute bottom-1 left-1 flex size-10 cursor-pointer items-center justify-center rounded-full border-3 border-white bg-primary-strong text-white hover:bg-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
      >
        <CameraIcon className="size-[18px]" strokeWidth={2} aria-hidden />
      </label>
      <input
        id={AVATAR_INPUT_ID}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={isPending}
        onChange={handleFileChange}
      />
    </div>
  );
}
