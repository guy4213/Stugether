"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  DownloadIcon,
  EraserIcon,
  FileTextIcon,
  HighlighterIcon,
  Maximize2Icon,
  Minimize2Icon,
  PencilIcon,
  Redo2Icon,
  RulerIcon,
  Share2Icon,
  SparklesIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddExerciseDialog } from "@/components/rooms/add-exercise-dialog";
import { WhiteboardCanvas } from "@/components/rooms/whiteboard-canvas";
import type { WhiteboardItem, WhiteboardTool } from "@/hooks/useWhiteboard";
import type { RoomExercise } from "@/lib/repositories/exercises";
import { getRoomFileUrl } from "@/lib/storage";

const COLORS = ["#2563eb", "#0f1b33", "#e11d48", "#0d9488"];

const TOOLS: { id: WhiteboardTool; label: string; icon: typeof PencilIcon }[] = [
  { id: "pen", label: "עט", icon: PencilIcon },
  { id: "highlighter", label: "מרקר", icon: HighlighterIcon },
  { id: "eraser", label: "מחק", icon: EraserIcon },
  { id: "text", label: "טקסט", icon: TypeIcon },
  { id: "line", label: "סרגל (קו ישר)", icon: RulerIcon },
];

function useSignedUrl(path: string | null) {
  const [url, setUrl] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    getRoomFileUrl(path)
      .then((u) => !cancelled && setUrl({ path, url: u }))
      .catch(() => !cancelled && toast.error("לא ניתן לטעון את הקובץ"));
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url && url.path === path ? url.url : null;
}

function IconButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-[39px] items-center justify-center rounded-[7px] text-primary transition-colors disabled:opacity-40 [&_svg]:size-[18px]",
        active ? "bg-primary text-white" : "bg-surface-2 hover:bg-primary-soft",
      )}
    >
      {children}
    </button>
  );
}

// The middle of the room: the shared exercise, with the whiteboard drawn
// over it (Change Request 30.10.2026).
export function ExercisePanel({
  roomId,
  exercises,
  selectedId,
  onSelect,
  onAdded,
  canPost,
  board,
  onAskAi,
  className,
}: {
  roomId: string;
  exercises: RoomExercise[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdded: (exercise: RoomExercise) => void;
  canPost: boolean;
  board: {
    items: WhiteboardItem[];
    add: (item: Omit<WhiteboardItem, "id" | "by">) => void;
    undo: () => void;
    redo: () => void;
    clear: () => void;
  };
  onAskAi: (() => void) | null;
  className?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [tool, setTool] = useState<WhiteboardTool | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [fullscreen, setFullscreen] = useState(false);
  const exercise = exercises.find((e) => e.id === selectedId) ?? exercises.at(-1) ?? null;
  const index = exercise ? exercises.indexOf(exercise) + 1 : 0;
  const fileUrl = useSignedUrl(exercise?.file_path ?? null);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === panelRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void panelRef.current?.requestFullscreen?.().catch(() => {});
  }

  async function share() {
    const url = `${window.location.origin}/rooms/${roomId}`;
    try {
      if (navigator.share) await navigator.share({ title: exercise?.title ?? "חדר לימוד", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("הקישור לחדר הועתק");
      }
    } catch {
      /* cancelled */
    }
  }

  function download() {
    if (!exercise) return;
    if (fileUrl && exercise.file_path) {
      window.open(fileUrl, "_blank", "noopener");
      return;
    }
    const blob = new Blob([`${exercise.title}\n\n${exercise.content ?? ""}`], {
      type: "text/plain;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exercise.title}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section
      ref={panelRef}
      aria-label="התרגיל והלוח המשותף"
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-[22px] bg-card shadow-card",
        className,
      )}
    >
      <header className="mx-4 flex flex-wrap items-center gap-3 border-b border-divider py-5 sm:mx-6">
        <DropdownMenu dir="rtl">
          <DropdownMenuTrigger
            disabled={exercises.length === 0}
            className="flex h-[39px] items-center gap-2 rounded-[8px] bg-surface-2 px-4 text-sm text-foreground disabled:text-muted-foreground"
          >
            <span>{exercise ? `תרגיל ${index}` : "לבחירת תרגיל"}</span>
            <ChevronDownIcon className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            {exercises.map((ex, i) => (
              <DropdownMenuItem key={ex.id} onSelect={() => onSelect(ex.id)}>
                <span className="font-semibold">תרגיל {i + 1}</span>
                <span className="truncate text-muted-foreground">{ex.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {exercise && (
          <h2 className="min-w-0 grow truncate text-lg font-bold sm:text-[20px]">
            {exercise.title}
          </h2>
        )}
        <div className="ms-auto flex items-center gap-2">
          {canPost && exercise && (
            <AddExerciseDialog
              roomId={roomId}
              nextNumber={exercises.length + 1}
              onAdded={onAdded}
            />
          )}
          <IconButton label="הורדת התרגיל" onClick={download} disabled={!exercise}>
            <DownloadIcon />
          </IconButton>
          <IconButton label="שיתוף החדר" onClick={() => void share()}>
            <Share2Icon />
          </IconButton>
          <IconButton label={fullscreen ? "יציאה ממסך מלא" : "מסך מלא"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2Icon /> : <Maximize2Icon />}
          </IconButton>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Whiteboard tools (Figma: a vertical bar at the start of the board). */}
        <div
          role="toolbar"
          aria-label="כלי הלוח"
          aria-orientation="vertical"
          className="absolute end-4 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-2 rounded-[10px] bg-surface-2 p-1.5 shadow-soft sm:end-6"
        >
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-label={t.label}
              title={t.label}
              aria-pressed={tool === t.id}
              disabled={!canPost}
              onClick={() => setTool((cur) => (cur === t.id ? null : t.id))}
              className={cn(
                "flex size-9 items-center justify-center rounded-[8px] text-primary transition-colors disabled:opacity-40 [&_svg]:size-[18px]",
                tool === t.id ? "bg-white shadow-soft" : "hover:bg-white",
              )}
            >
              <t.icon aria-hidden />
            </button>
          ))}
          {tool && tool !== "eraser" && (
            <div className="flex flex-col gap-1.5 py-1" role="radiogroup" aria-label="צבע">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`צבע ${c}`}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "size-5 rounded-full border-2",
                    color === c ? "border-white ring-2 ring-primary" : "border-white",
                  )}
                />
              ))}
            </div>
          )}
          <span className="h-4" aria-hidden />
          <button
            type="button"
            aria-label="ביטול פעולה"
            title="ביטול פעולה"
            disabled={!canPost}
            onClick={board.undo}
            className="flex size-9 items-center justify-center rounded-[8px] text-primary hover:bg-white disabled:opacity-40 [&_svg]:size-[18px]"
          >
            <Undo2Icon aria-hidden />
          </button>
          <button
            type="button"
            aria-label="חזרה על פעולה"
            title="חזרה על פעולה"
            disabled={!canPost}
            onClick={board.redo}
            className="flex size-9 items-center justify-center rounded-[8px] text-primary hover:bg-white disabled:opacity-40 [&_svg]:size-[18px]"
          >
            <Redo2Icon aria-hidden />
          </button>
          <button
            type="button"
            aria-label="ניקוי הלוח"
            title="ניקוי הלוח"
            disabled={!canPost || board.items.length === 0}
            onClick={() => {
              if (confirm("לנקות את הלוח לכל המשתתפים?")) board.clear();
            }}
            className="flex size-9 items-center justify-center rounded-[8px] text-primary hover:bg-white disabled:opacity-40 [&_svg]:size-[18px]"
          >
            <Trash2Icon aria-hidden />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto ps-6 pe-20 pt-8 pb-24 sm:ps-10 sm:pe-24">
          {exercise ? (
            <article className="flex flex-col gap-4">
              {exercise.content && (
                <p className="text-[17px] leading-[1.75] whitespace-pre-wrap text-foreground">
                  {exercise.content}
                </p>
              )}
              {exercise.file_path &&
                (fileUrl ? (
                  exercise.file_type === "application/pdf" ? (
                    <iframe
                      src={fileUrl}
                      title={exercise.file_name ?? exercise.title}
                      className="h-[70vh] w-full rounded-xl border border-border"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
                    <img
                      src={fileUrl}
                      alt={exercise.file_name ?? exercise.title}
                      className="max-w-full rounded-xl border border-border"
                    />
                  )
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileTextIcon className="size-4" aria-hidden />
                    טוען את {exercise.file_name ?? "הקובץ"}...
                  </p>
                ))}
            </article>
          ) : (
            <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 text-center">
              <p className="text-[15px] text-foreground">עדיין לא העלית תרגיל</p>
              {canPost && <AddExerciseDialog roomId={roomId} nextNumber={1} onAdded={onAdded} />}
            </div>
          )}
          <WhiteboardCanvas
            items={board.items}
            tool={tool}
            color={color}
            disabled={!canPost}
            onAdd={board.add}
          />
        </div>

        {onAskAi && (
          <button
            type="button"
            onClick={onAskAi}
            aria-label="שאל את העוזר על התרגיל"
            title="שאל את העוזר על התרגיל"
            className="absolute end-4 bottom-5 z-20 flex size-[47px] items-center justify-center rounded-full bg-surface-2 text-primary shadow-soft transition-colors hover:bg-primary-soft sm:end-6"
          >
            <SparklesIcon className="size-6" aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}
