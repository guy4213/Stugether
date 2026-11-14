import { hashString } from "@/lib/ui/tones";

// Ready-made avatars (client QA 11.2026): instead of initials, a student with
// no photo picks one of these — or gets one automatically, chosen by id. The
// files ship with the app (public/avatars/presets) and profiles.avatar_url
// stores "presets/avatar-NN.svg" (CHECK in 20261112000002_preset_avatars.sql).
export const PRESET_AVATAR_COUNT = 12;
export const PRESET_AVATAR_PREFIX = "presets/";

export function presetAvatarPath(n: number): string {
  return `${PRESET_AVATAR_PREFIX}avatar-${String(n).padStart(2, "0")}.svg`;
}

export const PRESET_AVATAR_PATHS = Array.from({ length: PRESET_AVATAR_COUNT }, (_, i) =>
  presetAvatarPath(i + 1),
);

export function isPresetAvatarPath(path: string | null | undefined): boolean {
  return !!path && PRESET_AVATAR_PATHS.includes(path);
}

// The automatic avatar of someone who never chose one: stable per person.
export function defaultAvatarFor(id: string): string {
  return presetAvatarPath((hashString(id) % PRESET_AVATAR_COUNT) + 1);
}
