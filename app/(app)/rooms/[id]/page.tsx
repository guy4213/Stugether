import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon, UsersIcon } from "lucide-react";
import { ChatWindow } from "@/components/rooms/chat-window";
import { getCurrentUser } from "@/lib/auth/session";
import { getRoomPageData } from "@/lib/rooms/queries";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id: roomId } = await params;
  const data = await getRoomPageData(roomId);
  if (!data) notFound();

  const { room, members, messages, course } = data;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link
          href={course ? `/courses/${course.id}` : "/dashboard"}
          className="text-muted-foreground hover:text-foreground"
          aria-label="חזרה"
        >
          <ArrowRightIcon className="size-5 rtl:-scale-x-100" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{room.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {course?.name ?? ""}
            {room.topic ? ` · ${room.topic}` : ""}
          </p>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <UsersIcon className="size-3.5" />
          {members.filter((m) => !m.left_at).length}
        </span>
      </div>

      <ChatWindow
        roomId={room.id}
        currentUserId={user.id}
        initialMessages={messages}
        members={members}
        isActive={room.status === "active"}
      />
    </div>
  );
}
