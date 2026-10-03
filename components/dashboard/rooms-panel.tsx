"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailIcon, MessageSquareIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { LiveDot } from "@/components/ui/live-dot";
import { Pill } from "@/components/ui/pill";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { CreateRoomForm } from "@/components/courses/create-room-form";
import { acceptRoomInvitation, declineRoomInvitation } from "@/lib/notifications/actions";
import { relativeTimeHe, shortDateHe } from "@/lib/ui/format";
import type { DashboardData } from "@/lib/dashboard/queries";

// Dashboard areas from SPEC §4.2 that the mockup has no card for: pending
// invitations (accept/decline in place), my rooms sorted by last message with
// an unread badge, and the quick "new room" entry.
export function RoomsPanel({
  rooms,
  invitations,
  courses,
}: {
  rooms: DashboardData["rooms"];
  invitations: DashboardData["pendingInvitations"];
  courses: DashboardData["roomCourses"];
}) {
  const activeRooms = rooms.filter((r) => r.status === "active");
  const readOnlyRooms = rooms.filter((r) => r.status !== "active");

  return (
    <section aria-labelledby="my-rooms" className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="my-rooms" className="text-2xl font-extrabold">
          החדרים שלי
        </h2>
        {courses.length > 0 && <CreateRoomForm courses={courses} />}
      </div>

      {invitations.length > 0 && (
        <ul className="flex flex-col gap-2.5" aria-label="הזמנות ממתינות">
          {invitations.map((inv) => (
            <InvitationCard key={inv.id} invitation={inv} />
          ))}
        </ul>
      )}

      {activeRooms.length === 0 && readOnlyRooms.length === 0 ? (
        <div className="rounded-[20px] border-2 border-dashed border-switch-off bg-surface-2 p-6 text-center">
          <p className="font-bold">עוד אין לך חדרי לימוד</p>
          <p className="text-sm text-muted-foreground">
            פתחו חדר בקורס והזמינו עד 3 חברים ללמוד יחד עם העוזר.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...activeRooms, ...readOnlyRooms].map((room) => (
            <li key={room.id}>
              <Link
                prefetch={false}
                href={`/rooms/${room.id}`}
                className={cn(
                  "flex h-full items-center gap-3 rounded-[18px] border border-border bg-card p-4 transition-colors hover:border-primary-line",
                  room.status !== "active" && "opacity-75",
                )}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-primary-tint text-primary">
                  <MessageSquareIcon className="size-5" aria-hidden />
                </span>
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    {room.live && <LiveDot />}
                    <span className="truncate font-bold">{room.name}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {room.courseName ?? ""}
                    {room.lastMessageAt ? ` · ${relativeTimeHe(room.lastMessageAt)}` : ""}
                  </span>
                </span>
                {room.status === "archived" && <Pill tone="warning">מאורכב</Pill>}
                {room.status === "closed" && <Pill tone="neutral">סגור</Pill>}
                {room.unread > 0 && (
                  <span
                    className="h-6 min-w-6 rounded-full bg-primary px-2 text-center text-xs leading-6 font-bold text-white"
                    aria-label={`${room.unread} הודעות שלא נקראו`}
                  >
                    {room.unread > 99 ? "99+" : room.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InvitationCard({
  invitation,
}: {
  invitation: DashboardData["pendingInvitations"][number];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function respond(accept: boolean) {
    startTransition(async () => {
      const result = accept
        ? await acceptRoomInvitation(invitation.id)
        : await declineRoomInvitation(invitation.id);
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      if (accept && "roomId" in result && result.roomId) router.push(`/rooms/${result.roomId}`);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[18px] border border-primary-line bg-unread p-4">
      <span className="relative">
        <PersonAvatar
          id={invitation.inviter.id}
          name={invitation.inviter.name}
          className="size-11"
        />
        <span className="absolute -end-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-violet text-white">
          <MailIcon className="size-3" aria-hidden />
        </span>
      </span>
      <div className="flex min-w-0 grow basis-48 flex-col">
        <span className="font-bold">
          {invitation.inviter.name} הזמין/ה אותך לחדר &quot;{invitation.roomName}&quot;
        </span>
        <span className="text-xs text-muted-foreground">
          {invitation.courseName} · בתוקף עד {shortDateHe(invitation.expiresAt)}
        </span>
      </div>
      <div className="flex gap-2">
        <Button variant="solid" size="chip" disabled={pending} onClick={() => respond(true)}>
          אישור
        </Button>
        <Button variant="quiet" size="chip" disabled={pending} onClick={() => respond(false)}>
          דחייה
        </Button>
      </div>
    </li>
  );
}
