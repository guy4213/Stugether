"use client";

import { useEffect, useRef, useState } from "react";
import type { WhiteboardItem, WhiteboardTool } from "@/hooks/useWhiteboard";

const TOOL_STYLE: Record<
  Exclude<WhiteboardTool, "text">,
  { width: number; alpha: number; composite: GlobalCompositeOperation }
> = {
  pen: { width: 2.5, alpha: 1, composite: "source-over" },
  line: { width: 2.5, alpha: 1, composite: "source-over" },
  highlighter: { width: 16, alpha: 0.3, composite: "source-over" },
  eraser: { width: 22, alpha: 1, composite: "destination-out" },
};

// Simplify a freehand stroke: drop points closer than ~1.5px to the last one,
// so a stroke stays small enough for one broadcast.
function simplify(points: [number, number][], minDist: number): [number, number][] {
  const out: [number, number][] = [];
  for (const p of points) {
    const last = out.at(-1);
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= minDist) out.push(p);
  }
  const end = points.at(-1);
  if (end && out.at(-1) !== end) out.push(end);
  return out;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

function drawItem(ctx: CanvasRenderingContext2D, item: WhiteboardItem, w: number) {
  ctx.save();
  if (item.tool === "text") {
    const [x, y] = item.points[0] ?? [0, 0];
    ctx.fillStyle = item.color;
    ctx.font = `600 ${Math.max(12, item.width * w)}px Rubik, sans-serif`;
    ctx.textAlign = "right";
    ctx.direction = "rtl";
    ctx.textBaseline = "top";
    ctx.fillText(item.text ?? "", x * w, y * w);
    ctx.restore();
    return;
  }
  const style = TOOL_STYLE[item.tool];
  ctx.globalAlpha = style.alpha;
  ctx.globalCompositeOperation = style.composite;
  ctx.strokeStyle = item.color;
  ctx.lineWidth = item.width * w;
  ctx.lineCap = item.tool === "highlighter" ? "square" : "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  item.points.forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x * w, y * w) : ctx.lineTo(x * w, y * w),
  );
  if (item.points.length === 1) {
    const [x, y] = item.points[0];
    ctx.lineTo(x * w + 0.1, y * w);
  }
  ctx.stroke();
  ctx.restore();
}

// A transparent canvas over the exercise. It fills its (scrolling) parent,
// so drawings stay on the lines they were made on. With `tool` null it lets
// clicks through to the exercise (select / copy text).
export function WhiteboardCanvas({
  items,
  tool,
  color,
  disabled,
  onAdd,
}: {
  items: WhiteboardItem[];
  tool: WhiteboardTool | null;
  color: string;
  disabled: boolean;
  onAdd: (item: Omit<WhiteboardItem, "id" | "by">) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drawing = useRef<[number, number][] | null>(null);
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState("");

  // Track the parent's full scroll size.
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const measure = () => setSize({ w: parent.clientWidth, h: parent.scrollHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    for (const child of Array.from(parent.children)) if (child !== canvas) ro.observe(child);
    return () => ro.disconnect();
  }, []);

  // Redraw everything (and the stroke in progress) on any change.
  const redraw = (live?: WhiteboardItem) => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    for (const item of items) drawItem(ctx, item, size.w);
    if (live) drawItem(ctx, live, size.w);
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, size]);

  const toPoint = (e: React.PointerEvent): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [round((e.clientX - rect.left) / size.w), round((e.clientY - rect.top) / size.w)];
  };

  const liveItem = (points: [number, number][]): WhiteboardItem | undefined => {
    if (!tool || tool === "text") return undefined;
    return {
      id: "live",
      by: "",
      tool,
      color,
      width: TOOL_STYLE[tool].width / size.w,
      points: tool === "line" ? [points[0], points.at(-1)!] : points,
    };
  };

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!tool || disabled || e.button !== 0) return;
    if (tool === "text") {
      const [x, y] = toPoint(e);
      setTextAt({ x, y });
      setText("");
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = [toPoint(e)];
    redraw(liveItem(drawing.current));
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current.push(toPoint(e));
    redraw(liveItem(drawing.current));
  }

  function onPointerUp() {
    const points = drawing.current;
    drawing.current = null;
    if (!points || !tool || tool === "text") return;
    const item = liveItem(simplify(points, 1.5 / size.w));
    if (item) onAdd({ tool: item.tool, color: item.color, width: item.width, points: item.points });
  }

  function commitText() {
    if (textAt && text.trim()) {
      onAdd({
        tool: "text",
        color,
        width: 16 / size.w,
        points: [[textAt.x, textAt.y]],
        text: text.trim().slice(0, 300),
      });
    }
    setTextAt(null);
    setText("");
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label="לוח משותף"
        role="img"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ width: size.w, height: size.h }}
        className={
          tool && !disabled
            ? "absolute inset-x-0 top-0 z-10 touch-none " +
              (tool === "text" ? "cursor-text" : "cursor-crosshair")
            : "pointer-events-none absolute inset-x-0 top-0 z-10"
        }
      />
      {textAt && (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitText();
            if (e.key === "Escape") {
              setTextAt(null);
              setText("");
            }
          }}
          aria-label="טקסט על הלוח"
          placeholder="כתבו כאן..."
          style={{ top: textAt.y * size.w, right: size.w - textAt.x * size.w, color }}
          className="absolute z-20 w-56 rounded-md border border-primary-line bg-white/90 px-2 py-1 text-base font-semibold shadow-soft outline-none"
        />
      )}
    </>
  );
}
