"use client";

import { useState } from "react";
import { Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface ShareStats {
  activeCourses: number;
  completedCourses: number;
  avgProgress: number;
  messages: number;
  weeks: number;
  courses: { name: string; progress: number }[];
}

const SIZE = 1080;
const PAD = 84;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

// The progress card as a square PNG (client QA 12.11.2026: sharing used to
// send a bare link to the home page — the recipient saw nothing of it).
// Drawn locally from numbers already on the page; nothing is published.
async function renderCard(stats: ShareStats): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("NO_CANVAS");
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  const right = SIZE - PAD;

  // Background.
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, "#2563eb");
  bg.addColorStop(1, "#0d9488");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.beginPath();
  ctx.arc(140, 160, 260, 0, Math.PI * 2);
  ctx.fill();

  // Title.
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 64px ${font}`;
  ctx.fillText("ההתקדמות שלי", right, PAD + 70);
  ctx.font = `500 34px ${font}`;
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fillText("לומדים יחד ב-StuGether", right, PAD + 125);

  // KPI tiles.
  const tiles = [
    { label: "ממוצע התקדמות", value: `${stats.avgProgress}%` },
    { label: "קורסים פעילים", value: String(stats.activeCourses) },
    { label: `הודעות ב-${stats.weeks} שבועות`, value: String(stats.messages) },
    { label: "קורסים שהושלמו", value: String(stats.completedCourses) },
  ];
  const gap = 24;
  const tileW = (SIZE - PAD * 2 - gap) / 2;
  const tileH = 150;
  tiles.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = right - tileW - col * (tileW + gap);
    const y = PAD + 180 + row * (tileH + gap);
    ctx.fillStyle = "rgba(255,255,255,.16)";
    roundRect(ctx, x, y, tileW, tileH, 28);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 60px ${font}`;
    ctx.fillText(t.value, x + tileW - 32, y + 78);
    ctx.font = `500 28px ${font}`;
    ctx.fillStyle = "rgba(255,255,255,.88)";
    ctx.fillText(t.label, x + tileW - 32, y + 122);
  });

  // Courses with their progress.
  const listTop = PAD + 180 + 2 * (tileH + gap) + 30;
  const cardH = SIZE - listTop - PAD;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, PAD, listTop, SIZE - PAD * 2, cardH, 32);
  ctx.fill();
  const inner = SIZE - PAD * 2 - 72;
  const rows = stats.courses.slice(0, 3);
  if (rows.length === 0) {
    ctx.fillStyle = "#5b6781";
    ctx.font = `500 32px ${font}`;
    ctx.fillText("מתחילים ללמוד יחד 🚀", right - 36, listTop + cardH / 2 + 12);
  }
  rows.forEach((c, i) => {
    const y = listTop + 70 + i * ((cardH - 70) / 3);
    ctx.fillStyle = "#0f1b33";
    ctx.font = `700 32px ${font}`;
    ctx.fillText(ellipsize(ctx, c.name, inner - 120), right - 36, y);
    ctx.textAlign = "left";
    ctx.fillStyle = "#2563eb";
    ctx.font = `800 32px ${font}`;
    ctx.fillText(`${c.progress}%`, PAD + 36, y);
    ctx.textAlign = "right";
    // Bar, filled from the right (RTL).
    ctx.fillStyle = "#e6ecf5";
    roundRect(ctx, PAD + 36, y + 20, inner, 16, 8);
    ctx.fill();
    const w = Math.max(16, (inner * Math.min(100, c.progress)) / 100);
    const bar = ctx.createLinearGradient(right - 36 - w, 0, right - 36, 0);
    bar.addColorStop(0, "#0d9488");
    bar.addColorStop(1, "#2563eb");
    ctx.fillStyle = bar;
    roundRect(ctx, right - 36 - w, y + 20, w, 16, 8);
    ctx.fill();
  });

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("NO_BLOB"))), "image/png"),
  );
}

// "שיתוף": shares the card as an image (WhatsApp, Instagram...) where the
// device can; otherwise downloads it.
export function ShareButton({ stats }: { stats: ShareStats }) {
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    setBusy(true);
    try {
      const blob = await renderCard(stats);
      const file = new File([blob], "stugether-progress.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: "ההתקדמות שלי ב-StuGether" });
        } catch {
          // user cancelled the share sheet — nothing to report
        }
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("התמונה נשמרה, אפשר לשתף אותה");
    } catch {
      toast.error("לא ניתן ליצור את התמונה כרגע");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="quiet"
      size="md"
      onClick={handleShare}
      disabled={busy}
      className="rounded-[13px] px-[18px] text-sm font-semibold"
    >
      <Share2Icon className="size-[18px] text-primary" strokeWidth={2} />
      {busy ? "מכינים תמונה…" : "שיתוף כתמונה"}
    </Button>
  );
}
