import Link from "next/link";
import { MessageSquareIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Room } from "@/lib/repositories/rooms";

export function ActiveRoomsCard({
  rooms,
  courseNameById,
}: {
  rooms: Room[];
  courseNameById: Map<string, string>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>חדרים פעילים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rooms.length === 0 && (
          <p className="text-sm text-muted-foreground">אין לך כרגע חדרים פעילים.</p>
        )}
        {rooms.map((room) => (
          <div
            key={room.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquareIcon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{room.name}</p>
                <p className="text-xs text-muted-foreground">
                  {courseNameById.get(room.course_id) ?? room.topic ?? ""}
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/rooms/${room.id}`}>המשך</Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
