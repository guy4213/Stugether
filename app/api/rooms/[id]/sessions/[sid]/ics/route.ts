import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getRoomPageData } from "@/lib/rooms/queries";

// "הוספה ליומן" for a scheduled study session: an .ics event with a reminder
// 30 minutes before (the calendar app does the reminding — no cron).
// Room data goes through getRoomPageData, so RLS (members only) and demo
// mode apply as on the room page.

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
// RFC 5545 text: escape \ ; , and newlines.
const text = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id: roomId, sid } = await params;
  const data = await getRoomPageData(roomId, user.id);
  const session = data?.sessions.current;
  if (
    !data ||
    !session ||
    session.id !== sid ||
    session.status !== "scheduled" ||
    !session.startsAt
  ) {
    return NextResponse.json({ error: "המפגש לא נמצא" }, { status: 404 });
  }

  const start = new Date(session.startsAt);
  const end = new Date(start.getTime() + session.durationMin * 60_000);
  const roomUrl = new URL(`/rooms/${roomId}`, request.nextUrl.origin).toString();
  const title = `מפגש לימוד: ${data.room.name}`;
  const description = [session.note, data.course?.name, roomUrl].filter(Boolean).join("\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StuGether//Study session//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${session.id}@stugether`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(title)}`,
    `DESCRIPTION:${text(description)}`,
    `URL:${roomUrl}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${text(title)}`,
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="study-session.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
