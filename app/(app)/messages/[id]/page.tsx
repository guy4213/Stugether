import { notFound, redirect } from "next/navigation";
import { ConversationList } from "@/components/messages/conversation-list";
import { DirectChat } from "@/components/messages/direct-chat";
import { getCurrentUser } from "@/lib/auth/session";
import { getConversationPageData, getInbox } from "@/lib/messages/queries";

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

  return (
    <main
      id="main-content"
      className="mx-auto grid h-[calc(100dvh-73px)] min-h-[480px] w-full max-w-[1440px] gap-4 px-0 pt-0 sm:px-8 sm:pt-6 sm:pb-6 lg:min-h-[560px] lg:grid-cols-[360px_1fr] xl:px-12"
    >
      <h1 className="sr-only">שיחה עם {data.other.fullName}</h1>
      <ConversationList items={inbox} activeId={id} className="hidden lg:flex lg:h-full" />
      {/* key: another conversation remounts the chat and its channel. */}
      <DirectChat
        key={id}
        data={data}
        currentUserId={user.id}
        className="h-full max-sm:rounded-none"
      />
    </main>
  );
}
