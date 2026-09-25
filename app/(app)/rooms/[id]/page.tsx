import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon, MessageSquareIcon, SparklesIcon } from "lucide-react";
import { ChatWindow } from "@/components/rooms/chat-window";
import { getCurrentUser } from "@/lib/auth/session";
import { getRoomPageData } from "@/lib/rooms/queries";

const AVATAR_COLORS = ["#1f6fd1", "#14a38b", "#8b5cf6", "#d9467b", "#c26a00"];

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id: roomId } = await params;
  const data = await getRoomPageData(roomId);
  if (!data) notFound();

  const { room, members, messages, course } = data;
  const activeMembers = members.filter((m) => !m.left_at);

  return (
    <main
      id="main-content"
      className="mx-auto flex h-[calc(100dvh-73px)] w-full max-w-4xl flex-col px-0 sm:px-6 sm:py-6"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card shadow-sm sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <Link
            href={course ? `/courses/${course.id}` : "/dashboard"}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="חזרה לקורס"
          >
            <ArrowRightIcon className="size-5" />
          </Link>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquareIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{room.name}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {course?.name ?? ""}
              {room.topic ? ` · ${room.topic}` : ""}
            </p>
          </div>
          {room.ai_enabled && (
            <span className="hidden items-center gap-1 rounded-full bg-[oklch(0.94_0.05_175)] px-2.5 py-1 text-xs font-medium text-[oklch(0.4_0.1_180)] sm:flex">
              <SparklesIcon className="size-3.5" />
              עוזר AI פעיל
            </span>
          )}
          <div
            className="flex -space-x-2 rtl:space-x-reverse"
            aria-label={`${activeMembers.length} משתתפים: ${activeMembers.map((m) => m.profile?.full_name ?? "").join(", ")}`}
          >
            {activeMembers.slice(0, 4).map((m, i) => (
              <span
                key={m.user_id}
                title={m.profile?.full_name ?? ""}
                className="flex size-8 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-card"
                style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
              >
                {initials(m.profile?.full_name ?? "?")}
              </span>
            ))}
          </div>
        </div>

        <ChatWindow
          roomId={room.id}
          currentUserId={user.id}
          initialMessages={messages}
          members={members}
          isActive={room.status === "active"}
        />
      </div>
    </main>
  );
}
