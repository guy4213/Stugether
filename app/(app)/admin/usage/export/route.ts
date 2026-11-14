import type { NextRequest } from "next/server";
import { getAdminUsage, parseUsagePeriod, requireSuperAdmin } from "@/lib/admin/queries";
import { usageWorkbook } from "@/lib/admin/usage-export";

// GET /admin/usage/export?days=30 — the usage screen as an .xlsx workbook.
// Super Admin only; anyone else gets a plain 404 like the panel itself.
export async function GET(request: NextRequest) {
  if (!(await requireSuperAdmin())) return new Response("Not found", { status: 404 });

  const days = parseUsagePeriod(request.nextUrl.searchParams.get("days"));
  const usage = await getAdminUsage(days);
  const now = new Date();
  const file = usageWorkbook(usage, now);
  const stamp = now.toISOString().slice(0, 10);

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="stugether-usage-${days}d-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
