"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Pill } from "@/components/ui/pill";
import { getUserDetailsAction } from "@/lib/admin/actions";
import type { AdminUserDetailsView } from "@/lib/admin/queries";
import { lastSeenHe, relativeTimeHe } from "@/lib/ui/format";

const nf = new Intl.NumberFormat("he-IL");
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fullDate = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateHe = (iso: string | null | undefined) => (iso ? fullDate.format(new Date(iso)) : "—");

const PROVIDERS: Record<string, string> = { email: "מייל וסיסמה", google: "Google" };
const ROOM_STATUS: Record<string, string> = { active: "פעיל", closed: "סגור", archived: "מאורכב" };

// "משתמשים" -> click a user: everything the admin may know about the account
// (SPEC §4.9, CR 14.11.2026). Loaded on open via a server action. Metadata
// and counts only — no message content and not who the user talks to.
export function UserDetailsDialog({
  userId,
  name,
  children,
}: {
  userId: string;
  name: string;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AdminUserDetailsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    setError(null);
    startTransition(async () => {
      const result = await getUserDetailsAction(userId);
      if (result.ok) setUser(result.user);
      else setError(result.error);
    });
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        // Fresh data on every open (role / status may have changed meanwhile).
        if (open) load();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 grow basis-48 items-center gap-3 rounded-xl text-start outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`פרטי ${name}`}
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {user ? (
          <UserDetails user={user} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription className="sr-only">פרטי משתמש</DialogDescription>
            {error ? (
              <>
                <p className="text-sm text-destructive">{error}</p>
                <button
                  type="button"
                  onClick={load}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  נסה שוב
                </button>
              </>
            ) : (
              <Loader2Icon
                className="size-6 animate-spin text-muted-foreground"
                aria-label="טוען"
              />
            )}
          </div>
        )}
        {user && pending && (
          <Loader2Icon
            className="absolute start-4 top-4 size-4 animate-spin text-muted-foreground"
            aria-label="מרענן"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UserDetails({ user }: { user: AdminUserDetailsView }) {
  const s = user.stats;
  const facts: [string, string][] = [
    ["מוסד", user.institution ?? "—"],
    ["מחלקה", user.department ?? "—"],
    ["שנת לימוד", user.study_year ? `שנה ${user.study_year}` : "—"],
    ["עיר", user.city ?? "—"],
    ["נרשם/ה", dateHe(user.created_at)],
    ["שאלון הרשמה", user.onboarded_at ? `הושלם ב-${dateHe(user.onboarded_at)}` : "לא הושלם"],
    ["כניסה אחרונה", user.last_sign_in_at ? relativeTimeHe(user.last_sign_in_at) : "—"],
    ["נראה/תה באתר", lastSeenHe(user.last_seen_at)],
    ["פעילות אחרונה", s.lastActivityAt ? relativeTimeHe(s.lastActivityAt) : "אין עדיין"],
  ];
  const tiles: [string, string, string?][] = [
    ["הודעות בחדרים", nf.format(s.roomMessages)],
    ["הודעות פרטיות", nf.format(s.directMessages)],
    [
      "שאלות לעוזר",
      nf.format(s.aiRuns),
      s.aiFailed > 0 ? `${nf.format(s.aiFailed)} נכשלו` : undefined,
    ],
    ["עלות AI מוערכת", usd.format(s.costUsd), `${nf.format(s.tokens)} טוקנים`],
    ["חדרים שפתח/ה", nf.format(s.roomsCreated)],
    ["חברים", nf.format(s.friends)],
  ];
  const activeCourses = user.courses.filter((c) => c.status === "active");
  const pastCourses = user.courses.filter((c) => c.status !== "active");

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-4 border-b border-divider px-6 pt-6 pb-5">
        <PersonAvatar
          id={user.id}
          name={user.full_name}
          avatarPath={user.avatar_url}
          className="size-16"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="truncate text-xl font-extrabold">{user.full_name}</DialogTitle>
            {user.role === "super_admin" && <Pill tone="violet">אדמין</Pill>}
            {!user.is_active && <Pill tone="rose">מושבת/ת</Pill>}
          </div>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              {user.email && (
                <a
                  href={`mailto:${user.email}`}
                  dir="ltr"
                  className="hover:text-primary hover:underline"
                >
                  {user.email}
                </a>
              )}
              {user.provider && <span>התחברות: {PROVIDERS[user.provider] ?? user.provider}</span>}
            </div>
          </DialogDescription>
        </div>
      </header>

      <div className="flex flex-col gap-6 px-6 py-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="flex min-w-0 flex-col">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="truncate font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">פעילות (מאז ההרשמה)</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tiles.map(([label, value, hint]) => (
              <div
                key={label}
                className="flex flex-col rounded-xl border border-border px-3 py-2.5"
              >
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-lg font-extrabold tabular-nums">{value}</span>
                {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">קורסים ({activeCourses.length})</h3>
          {user.courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">לא רשום/ה לקורסים</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {[...activeCourses, ...pastCourses].map((c) => (
                <li
                  key={c.id}
                  title={`נרשם/ה ב-${dateHe(c.enrolled_at)}${c.status !== "active" ? " · הוסר/ה" : ""}`}
                  className={
                    c.status === "active"
                      ? "rounded-lg bg-primary-tint px-2.5 py-1 text-xs font-medium text-primary"
                      : "rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground line-through"
                  }
                >
                  {c.name}
                  {c.code && (
                    <span className="ms-1 opacity-70" dir="ltr">
                      {c.code}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">חדרי לימוד ({user.rooms.length})</h3>
          {user.rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">לא השתתף/ה בחדרים</p>
          ) : (
            <ul className="flex flex-col divide-y divide-divider rounded-xl border border-border">
              {user.rooms.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                  <div className="flex min-w-0 grow basis-40 flex-col">
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{r.course}</span>
                  </div>
                  <Pill tone={r.status === "active" ? "success" : "neutral"}>
                    {ROOM_STATUS[r.status] ?? r.status}
                  </Pill>
                  {r.role === "owner" && <Pill tone="blue">בעלים</Pill>}
                  <span className="text-xs text-muted-foreground">
                    {r.left_at
                      ? `עזב/ה ב-${dateHe(r.left_at)}`
                      : `הצטרף/ה ב-${dateHe(r.joined_at)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {user.bio && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-bold">אודות</h3>
            <p className="text-sm whitespace-pre-line text-ink-2">{user.bio}</p>
          </section>
        )}

        <p className="text-xs text-muted-foreground">
          מטא-נתונים וספירות בלבד. תוכן הודעות ועם מי המשתמש/ת מתכתב/ת אינם גלויים.
        </p>
      </div>
    </div>
  );
}
