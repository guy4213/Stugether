// A short chime for in-site notifications (client QA 12.11.2026), with a mute
// switch. Synthesized with WebAudio — no audio file to ship. The choice is
// per device (localStorage), like the system's own notification sounds.

const KEY = "stugether:notify-sound";
export const SOUND_CHANGED_EVENT = "stugether:notify-sound-changed";

export function isNotifySoundOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setNotifySoundOn(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the switch just won't stick.
  }
  window.dispatchEvent(new Event(SOUND_CHANGED_EVENT));
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

// Browsers only let a page make sound after the user interacted with it:
// resume the context on the first tap / key press.
export function unlockNotifySound() {
  const resume = () => {
    void audio()?.resume();
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
  };
  window.addEventListener("pointerdown", resume, { once: true });
  window.addEventListener("keydown", resume, { once: true });
  return resume;
}

// Two soft notes, ~0.35s. Silent when muted, hidden, or not yet unlocked.
export function playNotifySound() {
  if (!isNotifySoundOn() || document.visibilityState !== "visible") return;
  const ac = audio();
  if (!ac || ac.state !== "running") return;
  const now = ac.currentTime;
  [
    { freq: 880, at: 0 },
    { freq: 1318.5, at: 0.12 },
  ].forEach(({ freq, at }) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.25);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.27);
  });
}
