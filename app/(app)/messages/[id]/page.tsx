import { notFound, redirect } from "next/navigation";
import { ConversationList } from "@/components/messages/conversation-list";
import { DirectChat } from "@/components/messages/direct-chat";
import { MessagesWindow } from "@/components/messages/messages-window";
import { getCurrentUser } from "@/lib/auth/session";
import { getChatPartner, getConversationPageData, getInbox } from "@/lib/messages/queries";
import { getBlockStateWith } from "@/lib/blocks/queries";

// One private chat. RLS returns nothing for a conversation that isn't mine,
// which lands on 404 like a missing one.
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const [data, inbox] = await Promise.all([
    getConversationPageData(id, user.id),
    getInbox(user.id),
  ]);
  if (!data) notFound();
  const [partner, blockState] = await Promise.all([
    data.otherActive ? getChatPartner(user.id, data.other.id) : null,
    getBlockStateWith(data.other.id),
  ]);

  return (
    <MessagesWindow mode="chat">
      <h1 className="sr-only">שיחה עם {data.other.fullName}</h1>
      <ConversationList items={inbox} activeId={id} className="hidden lg:flex lg:h-full" />
      {/* key: another conversation remounts the chat and its channel. */}
      <DirectChat
        key={id}
        data={data}
        currentUserId={user.id}
        partner={partner}
        blockState={blockState}
        className="h-full"
      />
    </MessagesWindow>
  );
}
