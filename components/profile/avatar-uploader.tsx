"use client";

import { useState, useTransition } from "react";
import { CameraIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { uploadAvatar, getAvatarUrl } from "@/lib/storage";
import { choosePresetAvatar, updateAvatarPath } from "@/lib/profile/actions";
import { PRESET_AVATAR_PATHS, defaultAvatarFor } from "@/lib/avatars/presets";
import { DEMO_READ_ONLY_ERROR } from "@/lib/demo/constants";

// The file input is addressable by id so other controls (the completion
// card's "העלאת תמונה") can open it with <label htmlFor>.
export const AVATAR_INPUT_ID = "avatar-upload-input";

// 132px avatar in a blue→teal ring with a camera button (Profile.dc.html).
// No photo → the chosen ready-made avatar, or an automatic one (no initials).
// `withPresets` adds the grid of ready-made avatars under it (client QA
// 11.2026: "מתביישים? אפשר גם אווטאר").
export function AvatarUploader({
  userId,
  fullName,
  avatarPath,
  withPresets = false,
  presetsOnly = false,
}: {
  userId: string;
  fullName: string;
  avatarPath: string | null;
  withPresets?: boolean;
  /** Only the grid (the profile page shows the avatar itself in its cover). */
  presetsOnly?: boolean;
}) {
  const [current, setCurrent] = useState<string | null>(avatarPath);
  // A save elsewhere on the page (the other uploader) re-renders us with the
  // new path: take it over.
  const [seenProp, setSeenProp] = useState(avatarPath);
  if (avatarPath !== seenProp) {
    setSeenProp(avatarPath);
    setCurrent(avatarPath);
  }
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const shown = localPreview ?? getAvatarUrl(current || defaultAvatarFor(userId));

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const blobUrl = URL.createObjectURL(file);
    setLocalPreview(blobUrl);

    startTransition(async () => {
      try {
        const path = await uploadAvatar(userId, file);
        const result = await updateAvatarPath(path);
        if (!result.ok) {
          toast.error(result.error ?? "העלאת התמונה נכשלה");
          return;
        }
        setCurrent(path);
        toast.success("תמונת הפרופיל עודכנה");
      } catch (err) {
        const message =
          err instanceof Error && err.message === "AVATAR_TOO_LARGE"
            ? "הקובץ גדול מדי (עד 2MB)"
            : err instanceof Error && err.message === "AVATAR_INVALID_TYPE"
              ? "סוג קובץ לא נתמך (JPEG, PNG או WEBP בלבד)"
              : err instanceof Error && err.message === "DEMO_MODE"
                ? DEMO_READ_ONLY_ERROR
                : "העלאת התמונה נכשלה";
        toast.error(message);
      } finally {
        setLocalPreview(null);
        URL.revokeObjectURL(blobUrl);
      }
    });
  }

  function pickPreset(index: number) {
    const previous = current;
    setCurrent(PRESET_AVATAR_PATHS[index]);
    startTransition(async () => {
      const result = await choosePresetAvatar(index + 1);
      if (!result.ok) {
        setCurrent(previous);
        toast.error(result.error ?? "עדכון האווטאר נכשל");
        return;
      }
      toast.success("האווטאר נשמר");
    });
  }

  const avatar = (
    <div className="relative size-[132px] shrink-0 rounded-full bg-brand-diag p-1 shadow-[0_14px_28px_-12px_rgba(37,99,235,.55)]">
      <span className="flex size-full items-center justify-center overflow-hidden rounded-full border-5 border-white bg-primary-tint">
        {/* eslint-disable-next-line @next/next/no-img-element -- public storage URL / local blob preview */}
        <img src={shown} alt={fullName} className="size-full object-cover" />
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

  if (!withPresets && !presetsOnly) return avatar;

  const grid = (
    <fieldset className="flex w-full flex-col gap-2.5">
      <legend
        className={cn(
          "mb-2.5 text-sm font-bold text-ink-2",
          presetsOnly ? "text-start text-lg text-foreground" : "text-center",
        )}
      >
        {presetsOnly ? "בחירת אווטאר" : "או בחרו אווטאר"}
      </legend>
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
        {PRESET_AVATAR_PATHS.map((path, i) => {
          const selected = current === path;
          return (
            <button
              key={path}
              type="button"
              disabled={isPending}
              aria-pressed={selected}
              aria-label={`אווטאר ${i + 1}`}
              onClick={() => pickPreset(i)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-full border-[3px] transition-[border-color,transform] hover:scale-105 disabled:opacity-60",
                selected ? "border-primary" : "border-transparent",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- bundled SVG */}
              <img src={getAvatarUrl(path)} alt="" className="size-full" />
              {selected && (
                <span className="absolute inset-x-0 bottom-0 flex justify-center bg-primary/85 py-px text-white">
                  <CheckIcon className="size-3" strokeWidth={3} aria-hidden />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  if (presetsOnly) return grid;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {avatar}
      {grid}
    </div>
  );
}
