import Link from "next/link";
import { MessageSquareIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import type { Room } from "@/lib/repositories/rooms";

function formatLastActivity(iso: string | null): string {
  if (!iso) return "חדש";
  const date = new Date(iso);
  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 60 * 24) {
    return date.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    });
  }
  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jerusalem",
  });
}

// "Today's Schedule" in the mockup → per the client's notes, active rooms in
// the courses the student is active in.
export function ActiveRoomsCard({
  rooms,
  courseNameById,
}: {
  rooms: Room[];
  courseNameById: Map<string, string>;
}) {
  return (
    <Card className="border-0 shadow-sm ring-0">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">חדרים פעילים</CardTitle>
        <CardAction>
          <Link href="/courses" className="text-sm font-medium text-primary hover:underline">
            לכל הקורסים
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {rooms.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">אין לך כרגע חדרים פעילים.</p>
            <Link
              href="/courses"
              className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
            >
              מצאו קורס ופתחו חדר לימוד
            </Link>
          </div>
        )}
        {rooms.map((room) => (
          <Link
            key={room.id}
            href={`/rooms/${room.id}`}
            className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-accent/50"
          >
            <span className="w-16 shrink-0 text-center text-sm font-semibold whitespace-nowrap text-primary tabular-nums">
              {formatLastActivity(room.last_message_at)}
            </span>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageSquareIcon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{room.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {courseNameById.get(room.course_id) ?? room.topic ?? ""}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-[oklch(0.94_0.05_175)] px-2.5 py-0.5 text-xs font-medium text-[oklch(0.4_0.1_180)]">
              {room.ai_enabled ? "AI פעיל" : "פעיל"}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
