import { ArchiveRoomButton } from "@/components/admin/archive-room-button";
import { FilterForm, SELECT_CLASS } from "@/components/admin/filter-form";
import { Pill } from "@/components/ui/pill";
import { getAdminRooms } from "@/lib/admin/queries";
import { relativeTimeHe } from "@/lib/ui/format";

const STATUS_LABEL = { active: "פעיל", archived: "מאורכב", closed: "סגור" } as const;
const STATUSES = ["active", "archived", "closed"] as const;

// "חדרים" (SPEC §4.9): list, filter, metadata, archive. Never message
// content — counts come from admin_room_stats(), and the admin has no
// messages SELECT policy at all.
export default async function AdminRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status);
  const search = params.q?.trim() || undefined;
  const rooms = await getAdminRooms({ search, status });

  return (
    <section className="flex flex-col gap-4">
      <FilterForm search={search ?? ""} searchPlaceholder="חיפוש לפי שם חדר">
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label="סטטוס"
          className={SELECT_CLASS}
        >
          <option value="">כל הסטטוסים</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </FilterForm>

      <p className="text-sm text-muted-foreground">{rooms.length} חדרים</p>

      <div className="overflow-x-auto rounded-[22px] border border-border bg-white shadow-card">
        {rooms.length === 0 ? (
          <p className="px-6 py-12 text-center text-muted-foreground">לא נמצאו חדרים</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2 text-start text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-start font-semibold">חדר</th>
                <th className="px-3 py-3 text-start font-semibold">קורס</th>
                <th className="px-3 py-3 text-start font-semibold">סטטוס</th>
                <th className="px-3 py-3 text-start font-semibold">משתתפים</th>
                <th className="px-3 py-3 text-start font-semibold">הודעות</th>
                <th className="px-3 py-3 text-start font-semibold">הודעה אחרונה</th>
                <th className="px-5 py-3">
                  <span className="sr-only">פעולות</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-t border-divider">
                  <td className="px-5 py-3 font-semibold">{room.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {room.course
                      ? `${room.course.name}${room.course.code ? ` (${room.course.code})` : ""}`
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <Pill
                      tone={
                        room.status === "active"
                          ? "success"
                          : room.status === "archived"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {STATUS_LABEL[room.status]}
                    </Pill>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{Number(room.member_count)}/4</td>
                  <td className="px-3 py-3 tabular-nums">{Number(room.message_count)}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {room.last_message_at ? relativeTimeHe(room.last_message_at) : "—"}
                  </td>
                  <td className="px-5 py-3 text-end">
                    {room.status === "active" && (
                      <ArchiveRoomButton roomId={room.id} name={room.name} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
