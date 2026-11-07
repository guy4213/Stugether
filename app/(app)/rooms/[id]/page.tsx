import { notFound, redirect } from "next/navigation";
import { RoomScreen } from "@/components/rooms/room-screen";
import { JoinRequestsBanner } from "@/components/rooms/join-requests-banner";
import { SessionPanel } from "@/components/rooms/session-panel";
import { getCurrentUser } from "@/lib/auth/session";
import { getRoomPageData } from "@/lib/rooms/queries";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id: roomId } = await params;
  const data = await getRoomPageData(roomId, user.id);
  if (!data) notFound();

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[1680px] min-w-0 flex-col gap-4 pt-5 sm:px-8 sm:pb-6 xl:px-12"
    >
      <JoinRequestsBanner requests={data.joinRequests} />
      {data.isMember && (
        <SessionPanel
          roomId={data.room.id}
          roomName={data.room.name}
          roomStatus={data.room.status}
          isOwner={data.isOwner}
          sessions={data.sessions}
        />
      )}
      {/* key: a different room remounts the room, its channel and its call. */}
      <RoomScreen key={data.room.id} data={data} currentUserId={user.id} />
    </main>
  );
}
