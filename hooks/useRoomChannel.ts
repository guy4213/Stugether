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
};

export type ChannelStatus = "connecting" | "subscribed" | "error" | "closed";

export function useRoomChannel(roomId: string, handlers: Handlers) {
  const [status, setStatus] = useState<ChannelStatus>("connecting");
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const filter = `room_id=eq.${roomId}`;

    const channel: RealtimeChannel = supabase
      .channel(`room:${roomId}`, { config: { private: true } })
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
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("subscribed");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("error");
        else if (s === "CLOSED") setStatus("closed");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return { status };
}
