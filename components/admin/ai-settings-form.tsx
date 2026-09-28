"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateAiSettingsAction } from "@/lib/admin/actions";

// Global AI switch + the system prompt template (TECHNICAL_SPEC §6.8).
// Placeholders {course_name} / {room_topic} / {participant_names} are filled
// in per room by lib/ai/context.ts.
export function AiSettingsForm({
  systemPrompt,
  aiEnabled,
}: {
  systemPrompt: string;
  aiEnabled: boolean;
}) {
  const [prompt, setPrompt] = useState(systemPrompt);
  const [enabled, setEnabled] = useState(aiEnabled);
  const [pending, startTransition] = useTransition();
  const dirty = prompt.trim() !== systemPrompt.trim();

  function toggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const result = await updateAiSettingsAction({ aiEnabled: next });
      if (!result.ok) {
        setEnabled(!next);
        toast.error(result.error ?? "הפעולה נכשלה");
      } else toast.success(next ? "העוזר הופעל בכל המערכת" : "העוזר כובה בכל המערכת");
    });
  }

  function save() {
    startTransition(async () => {
      const result = await updateAiSettingsAction({ systemPrompt: prompt });
      if (!result.ok) toast.error(result.error ?? "השמירה נכשלה");
      else toast.success("ה-system prompt נשמר");
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-[22px] border border-border bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span id="ai-global-toggle" className="text-lg font-bold">
            עוזר AI פעיל במערכת
          </span>
          <span className="text-sm text-muted-foreground">כיבוי כאן גובר על ההגדרה של כל חדר</span>
        </div>
        <Switch
          checked={enabled}
          disabled={pending}
          onCheckedChange={toggle}
          aria-labelledby="ai-global-toggle"
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-divider pt-4">
        <label htmlFor="system-prompt" className="font-bold">
          System prompt
        </label>
        <p className="text-xs text-muted-foreground">
          משתנים זמינים: {"{course_name}"} · {"{room_topic}"} · {"{participant_names}"}
        </p>
        <Textarea
          id="system-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={14}
          maxLength={20000}
          className="min-h-64 font-mono text-sm leading-relaxed"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="brand"
            size="md"
            disabled={pending || !dirty || !prompt.trim()}
            onClick={save}
          >
            שמירה
          </Button>
          {dirty && (
            <Button
              variant="quiet"
              size="md"
              disabled={pending}
              onClick={() => setPrompt(systemPrompt)}
            >
              ביטול שינויים
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
