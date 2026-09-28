import { notFound } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { requireSuperAdmin } from "@/lib/admin/queries";

// Super Admin area (SPEC §4.9). Anyone else gets a plain 404 — the panel's
// existence is not advertised. RLS still gates every read and write.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSuperAdmin();
  if (!admin) notFound();

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 pt-7 pb-10 sm:px-8 xl:px-12"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-[30px] leading-[1.1] font-extrabold tracking-[-0.5px] sm:text-[38px]">
          <ShieldCheckIcon className="size-8 text-primary" aria-hidden />
          ניהול המערכת
        </h1>
        <p className="text-sm text-muted-foreground">מטא-נתונים בלבד — תוכן הודעות אינו גלוי</p>
      </div>
      <AdminTabs />
      {children}
    </main>
  );
}
