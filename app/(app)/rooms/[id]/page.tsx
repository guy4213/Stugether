import { notFound, redirect } from "next/navigation";
import { ChatWindow } from "@/components/rooms/chat-window";
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
      className="mx-auto flex h-[calc(100dvh-73px)] w-full max-w-4xl flex-col px-0 sm:px-6 sm:py-6"
    >
      {/* key: a different room remounts the thread and its realtime channel. */}
      <ChatWindow key={data.room.id} data={data} currentUserId={user.id} />
    </main>
  );
}
