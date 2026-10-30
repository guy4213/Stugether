"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// The only place allowed to open Realtime channels.
// Swapping postgres_changes for broadcast later changes this file only.

type RoomMessageRow = Record<string, unknown> & { id: string; room_id: string };

// Peer-to-peer events between the members on the room's private channel
// (Change Request 30.10.2026): WebRTC signaling for the call and whiteboard
// strokes. Sending needs can_post_in_room (realtime_topic_send policy), so a
// read-only room can't use them. Payloads are plain JSON; the sender is
// stamped by the caller, not trusted for anything beyond routing.
export type RoomBroadcastEvent = "call" | "wb";

type Handlers = {
  onMessageInsert?: (row: RoomMessageRow) => void;
  onMessageUpdate?: (row: RoomMessageRow) => void;
  // soft_delete_message broadcasts { id, room_id } — never content — because
  // other members' RLS hides the deleted row, so no postgres_changes UPDATE
  // reaches them.
  onMessageDeleted?: (messageId: string) => void;
  onExerciseInsert?: (row: RoomMessageRow) => void;
  onCallSignal?: (payload: Record<string, unknown>) => void;
  onWhiteboard?: (payload: Record<string, unknown>) => void;
};

export type ChannelStatus = "connecting" | "subscribed" | "error" | "closed";

// `presenceKey` is the current user's id: tracked on the room's private
// channel so every member sees who is connected right now (SPEC §4.6).
// `enabled: false` (demo mode) opens no channel at all.
export function useRoomChannel(
  roomId: string,
  presenceKey: string | null,
  handlers: Handlers,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const [status, setStatus] = useState<ChannelStatus>("connecting");
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const handlersRef = useRef(handlers);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const filter = `room_id=eq.${roomId}`;

    const channel: RealtimeChannel = supabase.channel(`room:${roomId}`, {
      config: { private: true, presence: { key: presenceKey ?? "" } },
    });
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter },
        (payload) => handlersRef.current.onMessageInsert?.(payload.new as RoomMessageRow),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter },
        (payload) => handlersRef.current.onMessageUpdate?.(payload.new as RoomMessageRow),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_exercises", filter },
        (payload) => handlersRef.current.onExerciseInsert?.(payload.new as RoomMessageRow),
      )
      .on("broadcast", { event: "message_deleted" }, ({ payload }) => {
        const id = (payload as { id?: unknown } | null)?.id;
        if (typeof id === "string") handlersRef.current.onMessageDeleted?.(id);
      })
      .on("broadcast", { event: "call" }, ({ payload }) => {
        if (payload && typeof payload === "object") handlersRef.current.onCallSignal?.(payload);
      })
      .on("broadcast", { event: "wb" }, ({ payload }) => {
        if (payload && typeof payload === "object") handlersRef.current.onWhiteboard?.(payload);
      })
      .on("presence", { event: "sync" }, () => {
        setOnlineUserIds(Object.keys(channel.presenceState()).filter(Boolean));
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          setStatus("subscribed");
          if (presenceKey) void channel.track({ online_at: new Date().toISOString() });
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("error");
        else if (s === "CLOSED") setStatus("closed");
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId, presenceKey, enabled]);

  // Fire-and-forget; dropped while the channel isn't subscribed yet.
  const broadcast = useCallback((event: RoomBroadcastEvent, payload: Record<string, unknown>) => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event, payload });
  }, []);

  return { status, onlineUserIds, broadcast };
}
