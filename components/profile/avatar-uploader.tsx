"use client";

import { useRef, useState, useTransition } from "react";
import { CameraIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadAvatar, getAvatarUrl } from "@/lib/storage";
import { updateAvatarPath } from "@/lib/profile/actions";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function AvatarUploader({
  userId,
  fullName,
  avatarPath,
}: {
  userId: string;
  fullName: string;
  avatarPath: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
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
    <div className="relative ms-6 -mt-10 w-fit sm:ms-8 sm:-mt-12">
      <Avatar size="lg" className="size-20 ring-4 ring-background sm:size-24">
        {previewUrl && <AvatarImage src={previewUrl} alt={fullName} />}
        <AvatarFallback className="text-lg">{initials(fullName)}</AvatarFallback>
      </Avatar>
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        className="absolute end-0 bottom-0 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background transition-opacity hover:opacity-90 disabled:opacity-50"
        aria-label="שנה תמונת פרופיל"
      >
        <CameraIcon className="size-3.5" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
