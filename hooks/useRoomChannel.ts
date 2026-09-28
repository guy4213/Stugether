"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// The only place allowed to open Realtime channels.
// Swapping postgres_changes for broadcast later changes this file only.

type RoomMessageRow = Record<string, unknown> & { id: string; room_id: string };

type Handlers = {
  onMessageInsert?: (row: RoomMessageRow) => void;
  onMessageUpdate?: (row: RoomMessageRow) => void;
  // soft_delete_message broadcasts { id, room_id } — never content — because
  // other members' RLS hides the deleted row, so no postgres_changes UPDATE
  // reaches them.
  onMessageDeleted?: (messageId: string) => void;
};

export type ChannelStatus = "connecting" | "subscribed" | "error" | "closed";

// `presenceKey` is the current user's id: tracked on the room's private
// channel so every member sees who is connected right now (SPEC §4.6).
export function useRoomChannel(roomId: string, presenceKey: string | null, handlers: Handlers) {
  const [status, setStatus] = useState<ChannelStatus>("connecting");
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const filter = `room_id=eq.${roomId}`;

    const channel: RealtimeChannel = supabase.channel(`room:${roomId}`, {
      config: { private: true, presence: { key: presenceKey ?? "" } },
    });

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
      .on("broadcast", { event: "message_deleted" }, ({ payload }) => {
        const id = (payload as { id?: unknown } | null)?.id;
        if (typeof id === "string") handlersRef.current.onMessageDeleted?.(id);
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
      supabase.removeChannel(channel);
    };
  }, [roomId, presenceKey]);

  return { status, onlineUserIds };
}
