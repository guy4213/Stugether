import { redirect } from "next/navigation";
import Link from "next/link";
import { RoomCard } from "@/components/rooms/room-card";
import { RoomsFilters } from "@/components/rooms/rooms-filters";
import { CreateRoomForm } from "@/components/courses/create-room-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getRoomsPageData, type RoomsView } from "@/lib/rooms/directory-queries";

const VIEWS: RoomsView[] = ["all", "live", "mine"];

// "חדרי לימוד" (Figma, Change Request 30.10.2026): my rooms and the open
// rooms of my courses, the ones in session first.
export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; courseId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const view = VIEWS.find((v) => v === params.view) ?? "all";
  const data = await getRoomsPageData(user.id, {
    view,
    q: params.q,
    courseId: params.courseId,
  });
  const empty = data.liveRooms.length === 0 && data.otherRooms.length === 0;

  return (
    <main id="main-content" className="flex w-full flex-1 flex-col">
      <header className="bg-surface-2">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 pt-10 pb-8 sm:px-8 xl:px-24">
          <div className="flex flex-col gap-2">
            <h1 className="text-[34px] leading-tight font-extrabold tracking-[-0.5px]">
              חדרי לימוד
            </h1>
            <p className="text-[17px] text-muted-foreground">מצאו חדר שמתאים לקורס ולקצב שלכם</p>
          </div>
          {data.courses.length > 0 && (
            <CreateRoomForm courses={data.courses} trigger="new" className="rounded-[14px] px-6" />
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pt-7 pb-12 sm:px-8 xl:px-24">
        <RoomsFilters courses={data.courses} />

        {empty ? (
          <p className="rounded-[22px] border-2 border-dashed border-switch-off bg-surface-2 p-8 text-center text-muted-foreground">
            {data.totals.all === 0 ? (
              <>עוד אין חדרים בקורסים שלך. פתחו חדר והזמינו עד 3 חברים ללמוד יחד.</>
            ) : (
              <>
                לא נמצאו חדרים תואמים.{" "}
                <Link href="/rooms" className="font-semibold text-primary">
                  ניקוי הסינון
                </Link>
              </>
            )}
          </p>
        ) : (
          <>
            {data.liveRooms.length > 0 && (
              <section aria-labelledby="live-rooms" className="flex flex-col gap-4">
                <h2 id="live-rooms" className="text-[22px] font-extrabold">
                  חדרים פעילים
                </h2>
                <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  {data.liveRooms.map((r) => (
                    <li key={r.id}>
                      <RoomCard room={r} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {data.otherRooms.length > 0 && (
              <section aria-labelledby="all-rooms" className="flex flex-col gap-4">
                <h2 id="all-rooms" className="text-[22px] font-extrabold">
                  כל חדרי הלימוד
                </h2>
                <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  {data.otherRooms.map((r) => (
                    <li key={r.id}>
                      <RoomCard room={r} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
