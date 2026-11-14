"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CheckCheckIcon,
  CheckIcon,
  InfoIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { LastSeen } from "@/components/ui/last-seen";
import { ChatSearch, type ChatSearchHit } from "@/components/chat/chat-search";
import { CHAT_BACKDROP } from "@/components/messages/messages-window";
import { PartnerPanel } from "@/components/messages/partner-panel";
import { loadDirectMessagesFrom, searchDirectMessagesAction } from "@/lib/messages/search-actions";
import { DELETE_WINDOW_MS } from "@/components/rooms/message-bubble";
import { dayKey, dayLabel } from "@/components/rooms/chat-panel";
import { useConversationChannel } from "@/hooks/useRoomChannel";
import {
  deleteDirectMessageAction,
  loadOlderDirectMessages,
  markConversationReadAction,
  sendDirectMessageAction,
} from "@/lib/messages/actions";
import { timeHe } from "@/lib/ui/format";
import { firstName } from "@/lib/ui/people";
import type { DirectMessage } from "@/lib/repositories/conversations";
import type { ChatPartner, ConversationPageData } from "@/lib/messages/queries";

const PAGE = 50;
const MARK_READ_THROTTLE_MS = 3000;
// Consecutive messages from one sender, on one day, less than this apart,
// read as one group: one time stamp under the group.
const GROUP_GAP_MS = 5 * 60 * 1000;
const STARTERS = ["היי 👋 רוצה ללמוד יחד?", "מתי נוח לך להיפגש?", "יש לך סיכום מההרצאה?"];

function upsert(list: DirectMessage[], row: DirectMessage): DirectMessage[] {
  const i = list.findIndex((m) => m.id === row.id);
  if (i === -1) return [...list, row];
  const next = [...list];
  next[i] = row;
  return next;
}

interface Group {
  own: boolean;
  newDay: boolean;
  items: DirectMessage[];
}

function groupMessages(messages: DirectMessage[], me: string): Group[] {
  const groups: Group[] = [];
  for (const m of messages) {
    const group = groups.at(-1);
    const last = group?.items.at(-1);
    const sameDay = !!last && dayKey(last.created_at) === dayKey(m.created_at);
    if (
      group &&
      last &&
      sameDay &&
      last.sender_id === m.sender_id &&
      Date.parse(m.created_at) - Date.parse(last.created_at) < GROUP_GAP_MS
    ) {
      group.items.push(m);
    } else {
      groups.push({ own: m.sender_id === me, newDay: !sameDay, items: [m] });
    }
  }
  return groups;
}

// The partner panel's open/closed choice outlives the page (closed by
// default). Storage may be blocked: then it lasts for this tab only.
const PANEL_KEY = "stugether.dm.partnerPanel";
const panelListeners = new Set<() => void>();
let panelMemory = false;
function readPanel(): boolean {
  try {
    return window.localStorage.getItem(PANEL_KEY) === "1";
  } catch {
    return panelMemory;
  }
}
function writePanel(open: boolean) {
  panelMemory = open;
  try {
    window.localStorage.setItem(PANEL_KEY, open ? "1" : "0");
  } catch {
    // Private mode: memory only.
  }
  panelListeners.forEach((l) => l());
}
function subscribePanel(listener: () => void) {
  panelListeners.add(listener);
  return () => {
    panelListeners.delete(listener);
  };
}

function sharedCoursesLine(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `שניכם לומדים ${names[0]}`;
  if (names.length === 2) {
    const joiner = /^[֐-׿]/.test(names[1]) ? "ו" : "ו-";
    return `שניכם לומדים ${names[0]} ${joiner}${names[1]}`;
  }
  return `שניכם לומדים ${names[0]}, ${names[1]} ועוד ${names.length - 2}`;
}

const ICON_BUTTON =
  "flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-white/70 text-ink-2 shadow-[0_0_0_1px_rgba(15,27,51,.06)] transition-colors outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-primary-line sm:size-[42px]";

// The private chat screen (SPEC §5.1; design round 4, 12.11.2026): realtime on
// dm:{id}, history with keyset pagination, send, self-delete within 5 minutes,
// "נשלח / נקרא" under my last message, search in the conversation, and the
// partner panel on wide screens.
export function DirectChat({
  data,
  currentUserId,
  partner,
  className,
}: {
  data: ConversationPageData;
  currentUserId: string;
  partner: ChatPartner | null;
  className?: string;
}) {
  const router = useRouter();
  const { conversationId, other } = data;
  const [messages, setMessages] = useState<DirectMessage[]>(data.messages);
  const [hasMore, setHasMore] = useState(data.hasMore);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(data.otherLastReadAt);
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingOlder, startLoadingOlder] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const panelOpen = useSyncExternalStore(subscribePanel, readPanel, () => false);
  const lastHits = useRef(new Map<string, ChatSearchHit>());

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const lastMarkRead = useRef(0);
  const refreshedShell = useRef(false);
  const trailingMarkRead = useRef<number | null>(null);
  const markReadRef = useRef<() => void>(() => {});

  const { status } = useConversationChannel(conversationId, {
    onMessageInsert: (row) => {
      setMessages((prev) => upsert(prev, row as unknown as DirectMessage));
    },
    onMessageUpdate: (row) => {
      setMessages((prev) => upsert(prev, row as unknown as DirectMessage));
    },
    onMessageDeleted: (id) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    },
    onRead: (userId, lastReadAt) => {
      if (userId !== other.id) return;
      setOtherReadAt((prev) =>
        prev && Date.parse(prev) >= Date.parse(lastReadAt) ? prev : lastReadAt,
      );
    },
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    const t = Date.now();
    const wait = lastMarkRead.current + MARK_READ_THROTTLE_MS - t;
    if (wait > 0) {
      // Throttled: one trailing call, so a burst of messages still ends read.
      if (trailingMarkRead.current === null) {
        trailingMarkRead.current = window.setTimeout(() => {
          trailingMarkRead.current = null;
          markReadRef.current();
        }, wait);
      }
      return;
    }
    lastMarkRead.current = t;
    void markConversationReadAction(conversationId).then((result) => {
      // The nav badges were rendered before this read: refresh them once.
      if (result.ok && !refreshedShell.current) {
        refreshedShell.current = true;
        router.refresh();
      }
    });
  }, [conversationId, router]);

  useEffect(() => {
    markReadRef.current = markRead;
  }, [markRead]);
  useEffect(
    () => () => {
      if (trailingMarkRead.current !== null) window.clearTimeout(trailingMarkRead.current);
    },
    [],
  );

  const lastMessageId = messages.at(-1)?.id;
  useEffect(() => {
    markRead();
  }, [lastMessageId, markRead]);
  useEffect(() => {
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [markRead]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  // "חיפוש בשיחה" (client QA 12.11.2026).
  async function searchMessages(q: string) {
    const r = await searchDirectMessagesAction(conversationId, q);
    if (!r.ok) return { ok: false, error: r.error };
    const hits = (r.hits ?? []).map((m) => ({
      id: m.id,
      createdAt: m.created_at,
      content: m.content,
      sender: m.sender_id === currentUserId ? "את/ה" : other.fullName,
    }));
    lastHits.current = new Map(hits.map((h) => [h.id, h]));
    return { ok: true, hits };
  }

  async function jumpTo(id: string) {
    const hit = lastHits.current.get(id);
    const oldest = messages[0];
    if (!messages.some((m) => m.id === id) && hit && oldest) {
      const older = await loadDirectMessagesFrom(
        conversationId,
        { createdAt: hit.createdAt, id: hit.id },
        { createdAt: oldest.created_at, id: oldest.id },
      );
      setMessages((prev) => [...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev]);
    }
    stickToBottom.current = false;
    setHighlightId(id);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        scrollRef.current
          ?.querySelector(`[data-message-id="${id}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" }),
      ),
    );
    setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 2500);
  }

  function loadOlder() {
    const oldest = messages[0];
    const el = scrollRef.current;
    if (!oldest || !el) return;
    const prevHeight = el.scrollHeight;
    startLoadingOlder(async () => {
      const older = await loadOlderDirectMessages(conversationId, {
        createdAt: oldest.created_at,
        id: oldest.id,
      });
      setHasMore(older.length === PAGE);
      if (older.length === 0) return;
      stickToBottom.current = false;
      setMessages((prev) => [...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev]);
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevHeight;
      });
    });
  }

  async function send() {
    const text = content.trim();
    if (!text || isSending) return;
    setIsSending(true);
    try {
      const result = await sendDirectMessageAction(conversationId, text);
      if (!result.ok || !result.message) {
        toast.error(result.error ?? "שליחת ההודעה נכשלה");
        return;
      }
      setContent("");
      stickToBottom.current = true;
      setMessages((prev) => upsert(prev, result.message!));
    } catch {
      toast.error("שליחת ההודעה נכשלה");
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  async function handleDelete(message: DirectMessage) {
    setBusyId(message.id);
    const result = await deleteDirectMessageAction(message.id);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error ?? "המחיקה נכשלה");
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, deleted_at: new Date().toISOString() } : m)),
    );
  }

  function pickStarter(text: string) {
    setContent(text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    });
  }

  const groups = groupMessages(messages, currentUserId);
  // "נשלח / נקרא" only while the conversation ends with my message.
  const last = messages.at(-1);
  const readState =
    last && last.sender_id === currentUserId && last.deleted_at === null
      ? otherReadAt && Date.parse(otherReadAt) >= Date.parse(last.created_at)
        ? "read"
        : "sent"
      : null;
  const canSend = data.otherActive && !!content.trim() && !isSending;
  const coursesLine = sharedCoursesLine(partner?.sharedCourses.map((c) => c.name) ?? []);

  return (
    <section
      aria-label={`שיחה עם ${other.fullName}`}
      className={cn("flex min-h-0 min-w-0", className)}
    >
      <div className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col", CHAT_BACKDROP)}>
        <header className="flex items-center gap-3 px-3 pt-3 pb-2 sm:gap-3.5 sm:px-8 sm:pt-[22px] sm:pb-3.5">
          <Link
            href="/messages"
            aria-label="חזרה לשיחות"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white hover:text-foreground lg:hidden"
          >
            <ArrowRightIcon className="size-5" aria-hidden />
          </Link>
          <PersonAvatar
            id={other.id}
            name={other.fullName}
            avatarPath={other.avatarPath}
            online={other.online}
            ring={other.online}
            className="size-10 sm:size-[52px]"
          />
          <div className="flex min-w-0 grow flex-col gap-0.5">
            {data.otherActive ? (
              <Link
                href={`/students/${other.id}`}
                className="truncate text-[17px] font-extrabold tracking-[-.4px] hover:text-primary sm:text-xl"
              >
                {other.fullName}
              </Link>
            ) : (
              <span className="truncate text-[17px] font-extrabold tracking-[-.4px] sm:text-xl">
                {other.fullName}
              </span>
            )}
            <LastSeen
              online={other.online}
              lastSeenAt={other.lastSeenAt}
              className="sm:text-[13px]"
            />
          </div>
          {status === "error" && (
            <span className="shrink-0 text-xs text-warning-ink" role="status">
              אין חיבור בזמן אמת
            </span>
          )}
          {!searchOpen && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="חיפוש בשיחה"
              title="חיפוש בשיחה"
              className={ICON_BUTTON}
            >
              <SearchIcon className="size-[18px]" aria-hidden />
            </button>
          )}
          {data.otherActive && (
            <>
              {partner && (
                <button
                  type="button"
                  onClick={() => writePanel(!panelOpen)}
                  aria-expanded={panelOpen}
                  aria-label="פרטים"
                  title="פרטים"
                  className={cn(
                    ICON_BUTTON,
                    "hidden xl:flex",
                    panelOpen && "bg-foreground text-white shadow-none hover:bg-foreground",
                  )}
                >
                  <InfoIcon className="size-[18px]" aria-hidden />
                </button>
              )}
              <Link
                href={`/students/${other.id}`}
                aria-label={`הפרופיל של ${other.fullName}`}
                title="פרופיל"
                className={cn(ICON_BUTTON, partner && "xl:hidden")}
              >
                <InfoIcon className="size-[18px]" aria-hidden />
              </Link>
            </>
          )}
        </header>
        {searchOpen && (
          <ChatSearch
            search={searchMessages}
            onPick={(id) => void jumpTo(id)}
            onClose={() => {
              setSearchOpen(false);
              setHighlightId(null);
            }}
          />
        )}

        <div
          ref={scrollRef}
          onScroll={onScroll}
          // The thread fades out at its top and bottom edges (a mask, so it
          // works over the backdrop's halos too).
          className="flex min-h-0 flex-1 flex-col overflow-y-auto [mask-image:linear-gradient(180deg,transparent,#000_14px,#000_calc(100%-28px),transparent)] px-3 pt-3 pb-8 sm:px-8"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.length === 0 ? (
            <div className="m-auto flex flex-col items-center gap-2.5 py-6 text-center motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
              <span className="relative mb-3.5">
                <span
                  aria-hidden
                  className="absolute -inset-[26px] rounded-full bg-brand-diag opacity-[.28] blur-[34px]"
                />
                <PersonAvatar
                  id={other.id}
                  name={other.fullName}
                  avatarPath={other.avatarPath}
                  className="size-[88px] shadow-[0_0_0_6px_#fff,0_20px_40px_-18px_rgba(15,27,51,.45)] sm:size-[104px]"
                />
              </span>
              <h2 className="text-2xl leading-tight font-extrabold tracking-[-.8px] sm:text-[30px]">
                התחילו שיחה עם {firstName(other.fullName)}
              </h2>
              <p className="text-[15px] text-muted-foreground">
                {coursesLine ?? "זו תחילת השיחה שלכם. מספיק משפט אחד כדי להתחיל."}
              </p>
              {data.otherActive && (
                <div className="mt-5 flex max-w-[560px] flex-wrap justify-center gap-2.5">
                  {STARTERS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => pickStarter(text)}
                      className="h-[42px] rounded-full bg-white px-[18px] text-sm font-medium text-ink-2 shadow-[0_0_0_1px_rgba(15,27,51,.06),0_8px_18px_-12px_rgba(15,27,51,.3)] transition-[color,box-shadow] outline-none hover:text-primary-strong hover:shadow-[0_0_0_1.5px_var(--color-primary-line),0_12px_24px_-12px_rgba(37,99,235,.5)] focus-visible:shadow-[0_0_0_2px_var(--color-primary-line)]"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto mt-auto flex w-full max-w-[720px] flex-col">
              {hasMore && (
                <div className="flex justify-center pb-2">
                  <Button variant="quiet" size="chip" onClick={loadOlder} disabled={loadingOlder}>
                    {loadingOlder ? "טוען..." : "טעינת הודעות קודמות"}
                  </Button>
                </div>
              )}
              {groups.map((group, gi) => {
                const lastItem = group.items.at(-1)!;
                const n = group.items.length;
                const isLastGroup = gi === groups.length - 1;
                return (
                  <Fragment key={group.items[0].id}>
                    {group.newDay && (
                      <div className="mt-[22px] mb-1.5 text-center text-xs font-semibold tracking-[.2px] text-[#8592ab] first:mt-2">
                        {dayLabel(group.items[0].created_at)}
                      </div>
                    )}
                    <div
                      className={cn(
                        "mt-3.5 flex flex-col gap-1",
                        group.own ? "items-end" : "items-start",
                      )}
                    >
                      {group.items.map((message, i) => {
                        const pos =
                          n === 1 ? "only" : i === 0 ? "first" : i === n - 1 ? "last" : "mid";
                        const isDeleted = message.deleted_at !== null;
                        const canDelete =
                          group.own &&
                          !isDeleted &&
                          now - Date.parse(message.created_at) < DELETE_WINDOW_MS;
                        return (
                          <div
                            key={message.id}
                            data-message-id={message.id}
                            className={cn(
                              "group/msg flex max-w-[86%] items-center gap-1.5 rounded-[22px] transition-shadow duration-700 sm:max-w-[78%]",
                              highlightId === message.id &&
                                "ring-2 ring-warning/70 ring-offset-2 ring-offset-[#f6f8fc]",
                            )}
                          >
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => void handleDelete(message)}
                                disabled={busyId === message.id}
                                aria-label="מחיקת ההודעה"
                                title="מחיקה (אפשר עד 5 דקות מהשליחה)"
                                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity outline-none group-hover/msg:opacity-100 hover:bg-white hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-line disabled:opacity-50 pointer-coarse:opacity-100"
                              >
                                <Trash2Icon className="size-3.5" aria-hidden />
                              </button>
                            )}
                            <div
                              title={timeHe(message.created_at)}
                              className={cn(
                                "min-w-0 rounded-[22px] px-[17px] py-[11px] text-[14.5px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap",
                                isDeleted
                                  ? "border border-dashed border-border bg-transparent text-muted-foreground italic"
                                  : group.own
                                    ? "bg-[linear-gradient(180deg,#3b7bf0,#2563eb)] text-white shadow-[0_12px_24px_-14px_rgba(37,99,235,.85)]"
                                    : "bg-white text-foreground shadow-[0_1px_2px_rgba(15,27,51,.05),0_6px_18px_-8px_rgba(15,27,51,.12)]",
                                pos !== "only" && (group.own ? "rounded-ee-lg" : "rounded-es-lg"),
                                (pos === "mid" || pos === "last") &&
                                  (group.own ? "rounded-se-lg" : "rounded-ss-lg"),
                              )}
                            >
                              {isDeleted ? "ההודעה נמחקה" : message.content}
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-1.5 px-2 pt-[3px] text-[11.5px] text-[#8592ab]">
                        <time dateTime={lastItem.created_at}>{timeHe(lastItem.created_at)}</time>
                        {group.own && isLastGroup && readState === "read" && (
                          <span className="flex items-center gap-1 font-semibold text-primary">
                            <CheckCheckIcon className="size-3.5" aria-hidden />
                            נקרא
                          </span>
                        )}
                        {group.own && isLastGroup && readState === "sent" && (
                          <span className="flex items-center gap-1">
                            <CheckIcon className="size-3.5" aria-hidden />
                            נשלח
                          </span>
                        )}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative z-10 shrink-0 px-3 pt-1 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-8 sm:pb-6">
          {data.otherActive ? (
            <div className="relative mx-auto flex min-h-[62px] max-w-[720px] items-end gap-2.5 rounded-[24px] bg-white py-2 ps-4 pe-[9px] shadow-[0_0_0_1px_rgba(15,27,51,.06),0_24px_48px_-24px_rgba(15,27,51,.45)] transition-shadow focus-within:shadow-[0_0_0_1.5px_var(--color-primary-line),0_24px_48px_-24px_rgba(15,27,51,.45)] sm:ps-[22px]">
              <Textarea
                ref={inputRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={`כתבו הודעה ל${firstName(other.fullName)}…`}
                aria-label="כתיבת הודעה"
                rows={1}
                maxLength={4000}
                className="max-h-40 min-h-[46px] resize-none rounded-none border-0 bg-transparent px-0 py-3 text-[15px] leading-[22px] shadow-none placeholder:text-[#8592ab] focus-visible:ring-0 disabled:bg-transparent md:text-[15px] dark:bg-transparent"
                disabled={isSending}
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!canSend}
                aria-label="שליחת הודעה"
                className={cn(
                  "flex size-[46px] shrink-0 items-center justify-center rounded-2xl transition-[background,box-shadow,color] outline-none focus-visible:ring-2 focus-visible:ring-primary-line",
                  canSend
                    ? "bg-brand-diag text-white shadow-[0_12px_24px_-10px_rgba(37,99,235,.75)] hover:brightness-110"
                    : "bg-[#edf1f7] text-[#9aa6bd]",
                )}
              >
                <SendIcon className="size-[19px] rtl:-scale-x-100" aria-hidden />
              </button>
            </div>
          ) : (
            <p className="relative mx-auto max-w-[720px] rounded-[20px] bg-white/80 px-5 py-4 text-center text-sm text-muted-foreground shadow-[0_0_0_1px_rgba(15,27,51,.06)]">
              החשבון הזה לא פעיל, אי אפשר לשלוח אליו הודעות.
            </p>
          )}
        </div>
      </div>

      {panelOpen && partner && data.otherActive && (
        <div className="hidden min-h-0 xl:flex">
          <PartnerPanel other={other} partner={partner} onClose={() => writePanel(false)} />
        </div>
      )}
    </section>
  );
}
