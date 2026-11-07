"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailIcon, MessageSquareIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { CreateRoomForm } from "@/components/courses/create-room-form";
import { SectionHeader } from "@/components/dashboard/section-header";
import { RowMenu } from "@/components/dashboard/row-menu";
import { acceptRoomInvitation, declineRoomInvitation } from "@/lib/notifications/actions";
import { shortDateHe } from "@/lib/ui/format";
import type { DashboardRoom, RoomRowStatus } from "@/lib/dashboard/room-row";
import type { DashboardData } from "@/lib/dashboard/queries";

const ROWS_SHOWN = 5;
const MAX_MEMBERS = 4;

const PILL = "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold";

function StatusPill({ status }: { status: RoomRowStatus }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  switch (status.kind) {
    case "live":
      return (
        <span className={cn(PILL, "bg-success-soft text-success-ink")}>
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          פעיל עכשיו
        </span>
      );
    case "soon":
      return (
        <span className={cn(PILL, "bg-warning-soft text-warning-ink")}>
          מתחיל בעוד {status.minutes} דקות
        </span>
      );
    case "seats":
      return (
        <span className={cn(PILL, "bg-warning-soft text-warning-ink")}>
          {status.free === 1 ? "נותר מקום אחד" : `נותרו ${status.free} מקומות`}
        </span>
      );
    case "scheduled":
      return <span className={cn(PILL, "bg-warning-soft text-warning-ink")}>ממתין להתחלה</span>;
    case "waiting":
      return <span className={cn(PILL, "bg-surface-2 text-muted-foreground")}>ממתין למשתתפים</span>;
    case "archived":
      return <span className={cn(PILL, "bg-surface-2 text-muted-foreground")}>מאורכב</span>;
    case "closed":
      return <span className={cn(PILL, "bg-surface-2 text-muted-foreground")}>סגור</span>;
  }
}

function RoomRow({ room }: { room: DashboardRoom }) {
  const href = `/rooms/${room.id}`;
  return (
    <tr className={cn("align-middle", room.status !== "active" && "opacity-75")}>
      <td className="py-3.5 ps-5 pe-3">
        <Link
          prefetch={false}
          href={href}
          className="block max-w-[220px] truncate font-bold hover:text-primary"
        >
          {room.name}
        </Link>
        {room.topic && (
          <span className="block max-w-[220px] truncate text-xs text-muted-foreground">
            נושא: {room.topic}
          </span>
        )}
      </td>
      <td className="max-w-[160px] truncate px-3 py-3.5 text-[13px]">{room.courseName ?? "—"}</td>
      <td
        className={cn(
          "px-3 py-3.5 text-[13px] whitespace-nowrap",
          !room.when && "text-muted-foreground",
        )}
      >
        {room.when ?? "לא נקבע"}
      </td>
      <td className="px-3 py-3.5">
        <span
          className="flex items-center gap-2"
          aria-label={`${room.memberCount} מתוך ${MAX_MEMBERS} משתתפים`}
        >
          <span className="flex" aria-hidden>
            {room.people.slice(0, 3).map((p) => (
              <PersonAvatar
                key={p.id}
                id={p.id}
                name={p.name}
                avatarPath={p.avatarPath}
                className="-ms-1.5 size-7 border-2 border-white text-[10px] first:ms-0"
              />
            ))}
          </span>
          <span className="text-[13px] font-semibold">
            {room.memberCount}/{MAX_MEMBERS}
          </span>
        </span>
      </td>
      <td className="px-3 py-3.5">
        <span className="flex items-center gap-2 whitespace-nowrap">
          <StatusPill status={room.rowStatus} />
          {room.unread > 0 && (
            <Link
              prefetch={false}
              href={href}
              aria-label={`${room.unread} הודעות שלא נקראו`}
              className="flex items-center gap-1 text-xs font-bold text-primary"
            >
              <MessageSquareIcon className="size-4" aria-hidden />
              {room.unread > 99 ? "99+" : room.unread}
            </Link>
          )}
        </span>
      </td>
      <td className="py-3.5 ps-3 pe-5">
        <span className="flex items-center justify-end gap-1.5">
          <RowMenu
            label={`אפשרויות לחדר ${room.name}`}
            items={[
              { label: "כניסה לחדר", href },
              { label: "לדף הקורס", href: `/courses/${room.courseId}` },
            ]}
          />
          <Button
            asChild
            variant={room.live ? "solid" : "outline-primary"}
            size="chip"
            className="min-w-[112px] rounded-[10px]"
          >
            <Link prefetch={false} href={href}>
              {room.live ? "הצטרפות" : room.nextSessionAt ? "פרטי המפגש" : "כניסה לחדר"}
            </Link>
          </Button>
        </span>
      </td>
    </tr>
  );
}

// "חדרי למידה" (SPEC §4.2): my rooms by last message with unread counts, the
// pending invitations (accept/decline in place) and "new room".
export function RoomsPanel({
  rooms,
  invitations,
  courses,
}: {
  rooms: DashboardData["rooms"];
  invitations: DashboardData["pendingInvitations"];
  courses: DashboardData["roomCourses"];
}) {
  // Active rooms first, each group by last message (already sorted).
  const ordered = [
    ...rooms.filter((r) => r.status === "active"),
    ...rooms.filter((r) => r.status !== "active"),
  ].slice(0, ROWS_SHOWN);
  const liveCount = rooms.filter((r) => r.live).length;

  return (
    <section aria-labelledby="my-rooms" className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader
        id="my-rooms"
        title="חדרי למידה"
        extra={
          liveCount > 0 && (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-success-soft px-2.5 text-xs font-semibold text-success-ink">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              פעילים {liveCount}
            </span>
          )
        }
        actions={
          courses.length > 0 && (
            <CreateRoomForm courses={courses} className="h-9 rounded-[10px] px-3 text-[13px]" />
          )
        }
        link={{ href: "/rooms", label: "הצג הכל" }}
      />

      {invitations.length > 0 && (
        <ul className="flex flex-col gap-2.5" aria-label="הזמנות ממתינות">
          {invitations.map((inv) => (
            <InvitationCard key={inv.id} invitation={inv} />
          ))}
        </ul>
      )}

      {ordered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-switch-off bg-surface-2 p-6 text-center">
          <p className="font-bold">עוד אין לך חדרי לימוד</p>
          <p className="text-sm text-muted-foreground">
            פתחו חדר בקורס והזמינו עד 3 חברים ללמוד יחד עם העוזר.
          </p>
        </div>
      ) : (
        // `relative`: makes this scroll box the containing block of the
        // absolutely positioned sr-only header text, which otherwise escapes
        // the clip and widens the whole page on phones (RTL overflow).
        <div className="relative flex-1 overflow-x-auto rounded-[20px] border border-border bg-card shadow-card-sm">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-start">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="py-3 ps-5 pe-3 text-start font-medium">
                  נושא המפגש
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  קורס
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  שעה
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  משתתפים
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  סטטוס
                </th>
                <th scope="col" className="py-3 ps-3 pe-5">
                  <span className="sr-only">פעולות</span>
                </th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:border-t [&>tr>td]:border-divider">
              {ordered.map((room) => (
                <RoomRow key={room.id} room={room} />
              ))}
            </tbody>
          </table>
        </div>
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
