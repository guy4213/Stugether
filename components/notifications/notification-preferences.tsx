"use client";

import { useOptimistic, useSyncExternalStore, useTransition } from "react";
import {
  SOUND_CHANGED_EVENT,
  isNotifySoundOn,
  playNotifySound,
  setNotifySoundOn,
  unlockNotifySound,
} from "@/lib/ui/notify-sound";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { updateNotificationPreference } from "@/lib/notifications/actions";
import type {
  NotificationPreferenceKey,
  NotificationPreferences as Prefs,
} from "@/lib/repositories/notifications";

const ROWS: { key: NotificationPreferenceKey; title: string; description: string }[] = [
  { key: "live_rooms", title: "חדרים חיים", description: "כשחבר/ה פותח/ת חדר בקורס שלך" },
  {
    key: "messages_invites",
    title: "הודעות, הזמנות וחדרים",
    description: "הודעות פרטיות, הזמנות ללמידה ומי שהצטרף/ה לחדר שלך",
  },
  { key: "course_recs", title: "המלצות קורסים", description: "קורסים שמתאימים למסלול שלך" },
  { key: "system_updates", title: "עדכוני מערכת", description: "פיצ׳רים חדשים ותחזוקה" },
  {
    key: "email_invites",
    title: "מייל על הזמנה",
    description: "מייל כשמזמינים אותך לחדר לימוד",
  },
];

export function NotificationPreferences({ preferences }: { preferences: Prefs }) {
  const [optimistic, setOptimistic] = useOptimistic(
    preferences,
    (state, patch: Partial<Prefs>) => ({ ...state, ...patch }),
  );
  const [, startTransition] = useTransition();

  function toggle(key: NotificationPreferenceKey, value: boolean) {
    startTransition(async () => {
      setOptimistic({ [key]: value });
      const result = await updateNotificationPreference(key, value);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1 rounded-[22px] border border-border bg-card px-6 py-[22px]">
      <h2 className="mb-2 text-lg font-bold">העדפות התראות</h2>
      {ROWS.map((row, i) => (
        <div
          key={row.key}
          className={
            i < ROWS.length - 1
              ? "flex items-center justify-between gap-3 border-b border-divider py-3"
              : "flex items-center justify-between gap-3 pt-3"
          }
        >
          <div className="flex flex-col">
            <span id={`pref-${row.key}`} className="text-[15px] font-semibold">
              {row.title}
            </span>
            <span className="text-[13px] text-muted-foreground">{row.description}</span>
          </div>
          <Switch
            checked={optimistic[row.key]}
            onCheckedChange={(v) => toggle(row.key, v)}
            aria-labelledby={`pref-${row.key}`}
          />
        </div>
      ))}
      <SoundRow />
    </div>
  );
}

function subscribeSound(onChange: () => void) {
  window.addEventListener(SOUND_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SOUND_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// "צליל בהתראות" (client QA 12.11.2026): per device, so it lives in the
// browser (lib/ui/notify-sound.ts), not in notification_preferences.
function SoundRow() {
  const on = useSyncExternalStore(subscribeSound, isNotifySoundOn, () => true);
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-divider pt-3">
      <div className="flex flex-col">
        <span id="pref-sound" className="text-[15px] font-semibold">
          צליל בהתראות
        </span>
        <span className="text-[13px] text-muted-foreground">
          צליל קצר כשמגיעה התראה (במכשיר הזה)
        </span>
      </div>
      <Switch
        checked={on}
        onCheckedChange={(v) => {
          setNotifySoundOn(v);
          if (v) {
            unlockNotifySound()();
            setTimeout(playNotifySound, 50);
          }
        }}
        aria-labelledby="pref-sound"
      />
    </div>
  );
}
