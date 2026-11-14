import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  DIRECT_MESSAGES_PAGE,
  getConversation,
  getConversationReadAt,
  listDirectMessages,
  listMyConversations,
} from "@/lib/repositories/conversations";
import { listPublicProfiles, type PublicProfile } from "@/lib/repositories/profiles";
import { isOnline } from "@/lib/ui/people";
import { getDemoScenario } from "@/lib/demo/state";
import { getStudentProfileData } from "@/lib/students/queries";

export interface InboxItem {
  conversationId: string;
  other: {
    id: string;
    fullName: string;
    avatarPath: string | null;
    online: boolean;
    lastSeenAt: string | null;
  };
  lastMessageAt: string;
  preview: string | null;
  /** The preview is my own message ("את/ה: ..."). */
  previewIsMine: boolean;
  unread: number;
}

function person(id: string, profile: PublicProfile | undefined) {
  return {
    id,
    // A deactivated account drops out of public_profiles; the history stays.
    fullName: profile?.full_name ?? "משתמש/ת לא פעיל/ה",
    avatarPath: profile?.avatar_url ?? null,
    online: isOnline(profile?.last_seen_at),
    lastSeenAt: profile?.last_seen_at ?? null,
  };
}

// "הודעות": my conversations, newest first. Demo mode has none (it can't
// write, so it can't start one).
export async function getInbox(userId: string): Promise<InboxItem[]> {
  if (await getDemoScenario()) return [];
  const supabase = await createClient();
  const rows = await listMyConversations(supabase);
  const profiles = await listPublicProfiles(
    supabase,
    rows.map((r) => r.other_user_id),
  );
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((r) => ({
    conversationId: r.conversation_id,
    other: person(r.other_user_id, byId.get(r.other_user_id)),
    lastMessageAt: r.last_message_at,
    preview: r.last_message_content,
    previewIsMine: r.last_message_sender_id === userId,
    unread: r.unread_count,
  }));
}

// One conversation: the other participant and the latest page of messages
// (oldest first). null = not mine / doesn't exist.
export async function getConversationPageData(conversationId: string, userId: string) {
  if (await getDemoScenario()) return null;
  const supabase = await createClient();
  const conversation = await getConversation(supabase, conversationId);
  if (!conversation) return null;

  const otherId =
    conversation.user_a_id === userId ? conversation.user_b_id : conversation.user_a_id;
  const [profiles, messages, otherLastReadAt] = await Promise.all([
    listPublicProfiles(supabase, [otherId]),
    listDirectMessages(supabase, conversationId, { limit: DIRECT_MESSAGES_PAGE }),
    getConversationReadAt(supabase, conversationId, otherId),
  ]);

  return {
    conversationId,
    other: person(otherId, profiles[0]),
    otherActive: profiles.length > 0,
    /** "נקרא" under my last message (Change Request 12.11.2026). */
    otherLastReadAt,
    messages: [...messages].reverse(),
    hasMore: messages.length === DIRECT_MESSAGES_PAGE,
  };
}

export type ConversationPageData = NonNullable<Awaited<ReturnType<typeof getConversationPageData>>>;

// The partner panel beside a private chat (opened on demand): the same data as
// the student's profile page, trimmed to what the panel shows. null = an
// inactive account, or someone who isn't a student.
export async function getChatPartner(userId: string, otherId: string) {
  const data = await getStudentProfileData(userId, otherId);
  if (!data) return null;
  const { details, match } = data;
  return {
    meta: [details.department ?? details.institution, details.year].filter(Boolean).join(" · "),
    match: match
      ? {
          percent: match.percent,
          reasons: match.breakdown.filter((b) => b.matched).map((b) => b.label),
        }
      : null,
    sharedCourses: data.sharedCourses.map((c) => ({ id: c.id, name: c.name })),
    myCourses: data.myCourses.map((c) => ({ id: c.id, name: c.name })),
  };
}

export type ChatPartner = NonNullable<Awaited<ReturnType<typeof getChatPartner>>>;
