"use client";

import { Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ShareButton({ completedCount }: { completedCount: number }) {
  async function handleShare() {
    const text = `סיימתי ${completedCount} קורסים ב-StuGether!`;
    const url = typeof window !== "undefined" ? window.location.origin : "";

    if (navigator.share) {
      try {
        await navigator.share({ text, url });
      } catch {
        // user cancelled the native share sheet — nothing to report
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast.success("הקישור הועתק, מוכן לשיתוף");
    } catch {
      toast.error("לא ניתן לשתף כרגע");
    }
  }

  return (
    <Button variant="quiet" size="md" onClick={handleShare} className="rounded-[13px] px-[18px] text-sm font-semibold">
      <Share2Icon className="size-[18px] text-primary" strokeWidth={2} />
      שיתוף
    </Button>
  );
}
