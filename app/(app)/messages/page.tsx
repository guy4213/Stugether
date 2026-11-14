import { redirect } from "next/navigation";
import { ConversationList } from "@/components/messages/conversation-list";
import { MessagesWindow, NoConversationPane } from "@/components/messages/messages-window";
import { getCurrentUser } from "@/lib/auth/session";
import { getInbox } from "@/lib/messages/queries";

// "הודעות" (SPEC §5.1): my private chats. On large screens the list sits
// beside an empty chat pane, in the same window as /messages/[id].
export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const inbox = await getInbox(user.id);

  return (
    <MessagesWindow mode="inbox">
      <ConversationList items={inbox} heading="h1" className="lg:h-full" />
      <NoConversationPane />
    </MessagesWindow>
  );
}
