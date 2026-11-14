import "server-only";
import { getCachedOwnProfile } from "@/lib/app/cached";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getAiUsageSummary,
  getAppSettings,
  getGlobalStats,
  getUsageStats,
  listAllRooms,
  listAllUsers,
  listFullCatalog,
  listRecentAiFailures,
} from "@/lib/repositories/admin";

// Super Admin panel reads (SPEC §4.9). Every read goes through the user-scoped
// client, so RLS is the real gate; requireSuperAdmin() only decides whether to
// render the panel at all. Message content is never read anywhere here.

export const requireSuperAdmin = cache(async () => {
  const user = await getCurrentUser();
  if (!user || user.demo) return null;
  const profile = await getCachedOwnProfile(user.id);
  if (!profile || profile.role !== "super_admin" || !profile.is_active) return null;
  return { userId: user.id };
});

// Next renders a page in parallel with its layout, so the layout's guard
// alone does not stop a page's reads from running: each reader checks too.
async function assertSuperAdmin(): Promise<void> {
  if (!(await requireSuperAdmin())) notFound();
}

export async function getAdminOverview() {
  await assertSuperAdmin();
  const supabase = await createClient();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [stats, usage] = await Promise.all([
    getGlobalStats(supabase),
    getAiUsageSummary(supabase, since30),
  ]);
  return {
    stats: {
      usersTotal: Number(stats.users_total),
      usersActive7d: Number(stats.users_active_7d),
      roomsTotal: Number(stats.rooms_total),
      roomsActive: Number(stats.rooms_active),
      messagesTotal: Number(stats.messages_total),
      aiRunsTotal: Number(stats.ai_runs_total),
      aiRunsFailed: Number(stats.ai_runs_failed),
    },
    usage,
  };
}

export async function getAdminUsers(filters: {
  search?: string;
  institutionId?: string;
  departmentId?: string;
  role?: "student" | "super_admin";
}) {
  await assertSuperAdmin();
  const supabase = await createClient();
  const [users, catalog] = await Promise.all([
    listAllUsers(supabase, filters),
    listFullCatalog(supabase),
  ]);
  const institutionName = new Map(catalog.institutions.map((i) => [i.id, i.name]));
  const departmentName = new Map(catalog.departments.map((d) => [d.id, d.name]));
  return {
    users: users.map((u) => ({
      id: u.id,
      fullName: u.full_name,
      role: u.role,
      isActive: u.is_active,
      institution: u.institution_id ? (institutionName.get(u.institution_id) ?? null) : null,
      department: u.department_id ? (departmentName.get(u.department_id) ?? null) : null,
      studyYear: u.study_year,
      lastSeenAt: u.last_seen_at,
      createdAt: u.created_at,
    })),
    institutions: catalog.institutions.map((i) => ({ id: i.id, name: i.name })),
    departments: catalog.departments
      .filter((d) => !filters.institutionId || d.institution_id === filters.institutionId)
      .map((d) => ({ id: d.id, name: d.name })),
  };
}

export async function getAdminCatalog() {
  await assertSuperAdmin();
  const supabase = await createClient();
  return listFullCatalog(supabase);
}

export async function getAdminRooms(filters: { search?: string; status?: "active" | "closed" }) {
  await assertSuperAdmin();
  const supabase = await createClient();
  return listAllRooms(supabase, filters);
}

// Rough USD cost from measured tokens. Rates are env-configurable because
// prices change; defaults are Gemini 2.5 Flash list prices per 1M tokens.
function pricePerMillion(name: string, fallback: number): number {
  const parsed = Number.parseFloat(process.env[name] ?? "");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  const inputRate = pricePerMillion("AI_PRICE_INPUT_PER_MTOK_USD", 0.3);
  const outputRate = pricePerMillion("AI_PRICE_OUTPUT_PER_MTOK_USD", 2.5);
  return (promptTokens / 1_000_000) * inputRate + (completionTokens / 1_000_000) * outputRate;
}

export const USAGE_PERIODS = [7, 30, 90] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

// "שימוש" (SPEC §4.9, CR 11.11.2026): daily series, period totals, top
// courses / users / AI consumers — counts only (admin_usage_stats), with the
// estimated AI cost added per row.
export async function getAdminUsage(days: UsagePeriod) {
  await assertSuperAdmin();
  const supabase = await createClient();
  const stats = await getUsageStats(supabase, days);
  const n = (v: unknown) => Number(v ?? 0);

  const daily = stats.daily.map((d) => ({
    day: d.day,
    signups: n(d.signups),
    activeUsers: n(d.active_users),
    roomMessages: n(d.room_messages),
    directMessages: n(d.direct_messages),
    roomsCreated: n(d.rooms_created),
    aiRuns: n(d.ai_runs),
    aiFailed: n(d.ai_failed),
    tokens: n(d.prompt_tokens) + n(d.completion_tokens),
    costUsd: estimateCostUsd(n(d.prompt_tokens), n(d.completion_tokens)),
  }));
  const total = (pick: (d: (typeof daily)[number]) => number) =>
    daily.reduce((sum, d) => sum + pick(d), 0);

  return {
    days: stats.days,
    daily,
    totals: {
      activeUsers: n(stats.active_users),
      signups: total((d) => d.signups),
      roomMessages: total((d) => d.roomMessages),
      directMessages: total((d) => d.directMessages),
      roomsCreated: total((d) => d.roomsCreated),
      aiRuns: total((d) => d.aiRuns),
      aiFailed: total((d) => d.aiFailed),
      tokens: total((d) => d.tokens),
      costUsd: total((d) => d.costUsd),
    },
    topCourses: stats.top_courses.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      roomsCreated: n(c.rooms_created),
      activeRooms: n(c.active_rooms),
      messages: n(c.messages),
      aiRuns: n(c.ai_runs),
      costUsd: estimateCostUsd(n(c.prompt_tokens), n(c.completion_tokens)),
    })),
    topUsers: stats.top_users.map((u) => ({
      id: u.id,
      fullName: u.full_name,
      roomMessages: n(u.room_messages),
      directMessages: n(u.direct_messages),
      aiRuns: n(u.ai_runs),
    })),
    topAiUsers: stats.top_ai_users.map((u) => ({
      id: u.id,
      fullName: u.full_name,
      aiRuns: n(u.ai_runs),
      aiFailed: n(u.ai_failed),
      tokens: n(u.prompt_tokens) + n(u.completion_tokens),
      costUsd: estimateCostUsd(n(u.prompt_tokens), n(u.completion_tokens)),
    })),
  };
}

export async function getAdminAi() {
  await assertSuperAdmin();
  const supabase = await createClient();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [settings, usage, failures] = await Promise.all([
    getAppSettings(supabase),
    getAiUsageSummary(supabase, since30),
    listRecentAiFailures(supabase, 10),
  ]);
  const estimatedCostUsd = estimateCostUsd(usage.promptTokens, usage.completionTokens);
  return { settings, usage, failures, estimatedCostUsd };
}
