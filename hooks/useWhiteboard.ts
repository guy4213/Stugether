"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomBroadcastEvent } from "@/hooks/useRoomChannel";

// Shared whiteboard over the room's exercise (Change Request 30.10.2026).
// One board per exercise ("blank" when there is none). Items travel on the
// room channel's "wb" broadcast; nothing is stored in the DB — a member who
// comes in asks the others for their copy ("sync_request"), so the board
// lives as long as someone is in the room.
//
// Coordinates are divided by the board's width, so a drawing keeps its place
// on screens of a different size.

export type WhiteboardTool = "pen" | "highlighter" | "eraser" | "line" | "text";

export type WhiteboardItem = {
  id: string;
  by: string;
  tool: WhiteboardTool;
  color: string;
  width: number;
  /** [x, y] pairs, each divided by the board width. */
  points: [number, number][];
  text?: string;
};

type Boards = Record<string, WhiteboardItem[]>;

type WbMessage =
  | { op: "add"; from: string; board: string; item: WhiteboardItem }
  | { op: "remove"; from: string; board: string; id: string }
  | { op: "clear"; from: string; board: string }
  | { op: "sync_request"; from: string }
  | { op: "sync"; from: string; to: string; boards: Boards };

const MAX_ITEMS_PER_BOARD = 2000;

export function useWhiteboard({
  userId,
  enabled,
  ready,
  broadcast,
}: {
  userId: string;
  /** Can post in the room (not demo, active room). Read-only boards still render. */
  enabled: boolean;
  ready: boolean;
  broadcast: (event: RoomBroadcastEvent, payload: Record<string, unknown>) => void;
}) {
  const [boards, setBoards] = useState<Boards>({});
  const boardsRef = useRef<Boards>({});
  // My own undo / redo, per board.
  const undoRef = useRef<Record<string, WhiteboardItem[]>>({});
  const redoRef = useRef<Record<string, WhiteboardItem[]>>({});
  const broadcastRef = useRef(broadcast);
  useEffect(() => {
    broadcastRef.current = broadcast;
  });

  const commit = useCallback((next: Boards) => {
    boardsRef.current = next;
    setBoards(next);
  }, []);

  const send = useCallback(
    (msg: Record<string, unknown>) => {
      if (enabled) broadcastRef.current("wb", { ...msg, from: userId });
    },
    [enabled, userId],
  );

  const addLocal = (board: string, item: WhiteboardItem) => {
    const list = boardsRef.current[board] ?? [];
    if (list.some((i) => i.id === item.id)) return;
    commit({ ...boardsRef.current, [board]: [...list, item].slice(-MAX_ITEMS_PER_BOARD) });
  };
  const removeLocal = (board: string, id: string) => {
    const list = boardsRef.current[board] ?? [];
    commit({ ...boardsRef.current, [board]: list.filter((i) => i.id !== id) });
  };

  const add = useCallback(
    (board: string, item: Omit<WhiteboardItem, "id" | "by">) => {
      const full: WhiteboardItem = { ...item, id: crypto.randomUUID(), by: userId };
      addLocal(board, full);
      (undoRef.current[board] ??= []).push(full);
      redoRef.current[board] = [];
      send({ op: "add", board, item: full });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, send],
  );

  const undo = useCallback(
    (board: string) => {
      const item = undoRef.current[board]?.pop();
      if (!item) return;
      (redoRef.current[board] ??= []).push(item);
      removeLocal(board, item.id);
      send({ op: "remove", board, id: item.id });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [send],
  );

  const redo = useCallback(
    (board: string) => {
      const item = redoRef.current[board]?.pop();
      if (!item) return;
      (undoRef.current[board] ??= []).push(item);
      addLocal(board, item);
      send({ op: "add", board, item });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [send],
  );

  const clear = useCallback(
    (board: string) => {
      commit({ ...boardsRef.current, [board]: [] });
      undoRef.current[board] = [];
      redoRef.current[board] = [];
      send({ op: "clear", board });
    },
    [commit, send],
  );

  const onWhiteboard = useCallback(
    (payload: Record<string, unknown>) => {
      const msg = payload as unknown as WbMessage;
      if (!msg || msg.from === userId) return;
      switch (msg.op) {
        case "add":
          if (msg.item && typeof msg.board === "string") addLocal(msg.board, msg.item);
          return;
        case "remove":
          if (typeof msg.board === "string") removeLocal(msg.board, msg.id);
          return;
        case "clear":
          if (typeof msg.board === "string") commit({ ...boardsRef.current, [msg.board]: [] });
          return;
        case "sync_request":
          if (Object.keys(boardsRef.current).length > 0) {
            send({ op: "sync", to: msg.from, boards: boardsRef.current });
          }
          return;
        case "sync": {
          if (msg.to !== userId || !msg.boards) return;
          const merged: Boards = { ...boardsRef.current };
          for (const [board, items] of Object.entries(msg.boards)) {
            const known = new Set((merged[board] ?? []).map((i) => i.id));
            merged[board] = [...(merged[board] ?? []), ...items.filter((i) => !known.has(i.id))];
          }
          commit(merged);
          return;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, send, commit],
  );

  useEffect(() => {
    if (ready) send({ op: "sync_request" });
  }, [ready, send]);

  return { boards, add, undo, redo, clear, onWhiteboard };
}
