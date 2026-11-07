import { redirect } from "next/navigation";
import { MessageSquareTextIcon } from "lucide-react";
import { ConversationList } from "@/components/messages/conversation-list";
import { getCurrentUser } from "@/lib/auth/session";
import { getInbox } from "@/lib/messages/queries";

// "הודעות" (SPEC §5.1): my private chats. On large screens the list sits
// beside an empty chat pane, as on /messages/[id].
export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const inbox = await getInbox(user.id);

  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-[1440px] flex-1 gap-4 px-4 pt-7 pb-10 sm:px-8 lg:h-[calc(100dvh-73px)] lg:min-h-[560px] lg:grid-cols-[360px_1fr] lg:pb-6 xl:px-12"
    >
      <h1 className="sr-only">הודעות</h1>
      <ConversationList items={inbox} className="lg:h-full" />
      <section
        aria-hidden
        className="hidden flex-col items-center justify-center gap-3 rounded-[22px] bg-card text-center text-muted-foreground shadow-card lg:flex"
      >
        <MessageSquareTextIcon className="size-10" />
        <p className="text-sm">בחרו שיחה מהרשימה, או פתחו שיחה חדשה מכרטיס של סטודנט/ית.</p>
      </section>
    </main>
  );
}
