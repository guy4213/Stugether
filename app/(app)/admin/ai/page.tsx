import { AlertTriangleIcon, CoinsIcon, SparklesIcon, TextIcon } from "lucide-react";
import { AiSettingsForm } from "@/components/admin/ai-settings-form";
import { StatTile } from "@/components/admin/stat-tile";
import { getAdminAi } from "@/lib/admin/queries";
import { relativeTimeHe } from "@/lib/ui/format";

const nf = new Intl.NumberFormat("he-IL");
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// "AI" (SPEC §4.9): system prompt, global on/off, usage summary (runs, tokens,
// estimated cost) and the latest failures — error codes only, no content.
export default async function AdminAiPage() {
  const { settings, usage, failures, estimatedCostUsd } = await getAdminAi();

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="ריצות (30 יום)"
          value={nf.format(usage.runs)}
          hint={`${nf.format(usage.succeeded)} הצליחו`}
          icon={SparklesIcon}
          tone="teal"
        />
        <StatTile
          label="כשלונות (30 יום)"
          value={nf.format(usage.failed)}
          icon={AlertTriangleIcon}
          tone="rose"
        />
        <StatTile
          label="טוקנים (30 יום)"
          value={nf.format(usage.promptTokens + usage.completionTokens)}
          hint={`קלט ${nf.format(usage.promptTokens)} · פלט ${nf.format(usage.completionTokens)}`}
          icon={TextIcon}
          tone="sky"
        />
        <StatTile
          label="עלות מוערכת (30 יום)"
          value={usd.format(estimatedCostUsd)}
          hint="לפי מחירון Gemini, הערכה בלבד"
          icon={CoinsIcon}
          tone="warning"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        {settings ? (
          <AiSettingsForm
            systemPrompt={settings.ai_system_prompt}
            aiEnabled={settings.ai_enabled}
          />
        ) : (
          <p className="text-muted-foreground">הגדרות ה-AI חסרות במסד הנתונים (app_settings).</p>
        )}

        <section className="flex flex-col gap-3 rounded-[22px] border border-border bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold">כשלונות אחרונים</h2>
          {failures.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין כשלונות</p>
          ) : (
            <ul className="flex flex-col">
              {failures.map((f, i) => (
                <li
                  key={f.id}
                  className={
                    i > 0
                      ? "flex flex-col gap-0.5 border-t border-divider py-2.5"
                      : "flex flex-col gap-0.5 pb-2.5"
                  }
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                    <span className="truncate">{f.room_name ?? "חדר"}</span>
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">
                      {relativeTimeHe(f.created_at)}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-destructive" dir="ltr">
                    {f.error_code ?? "error"}
                  </span>
                  {f.error_message && (
                    <span className="line-clamp-2 text-xs text-muted-foreground" dir="ltr">
                      {f.error_message}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
