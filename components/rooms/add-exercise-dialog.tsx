"use client";

import { useRef, useState } from "react";
import { FileUpIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addExerciseAction } from "@/lib/rooms/exercise-actions";
import type { RoomExercise } from "@/lib/repositories/exercises";
import { isRoomFileType, MAX_ROOM_FILE_BYTES, uploadRoomFile } from "@/lib/storage";

// "העלאת תרגיל": paste the exercise, attach an image / PDF of it, or both.
export function AddExerciseDialog({
  roomId,
  nextNumber,
  onAdded,
  className,
}: {
  roomId: string;
  nextNumber: number;
  onAdded: (exercise: RoomExercise) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTitle("");
    setContent("");
    setFile(null);
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!isRoomFileType(f.type)) {
      toast.error("אפשר לצרף תמונה (PNG, JPG, WEBP) או PDF");
      return;
    }
    if (f.size > MAX_ROOM_FILE_BYTES) {
      toast.error("הקובץ גדול מ-10MB");
      return;
    }
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && !file) {
      toast.error("יש להדביק את התרגיל או לצרף קובץ");
      return;
    }
    setPending(true);
    try {
      const path = file ? await uploadRoomFile(roomId, file) : null;
      const result = await addExerciseAction({
        roomId,
        title: title.trim() || `תרגיל ${nextNumber}`,
        content: content.trim() || null,
        file: path && file ? { path, name: file.name, type: file.type } : null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onAdded(result.exercise);
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(
        (err as Error)?.message === "DEMO_MODE" ? "במצב הדגמה אי אפשר להעלות" : "ההעלאה נכשלה",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="solid"
          className={className ?? "h-[39px] rounded-[7px] px-5 text-base font-bold"}
        >
          <PlusIcon className="size-4" aria-hidden />
          העלאת תרגיל
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">העלאת תרגיל לחדר</DialogTitle>
            <DialogDescription>
              כל המשתתפים יראו את התרגיל וגם העוזר יוכל לעזור בו.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="exercise-title">שם התרגיל</Label>
            <Input
              id="exercise-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`תרגיל ${nextNumber}`}
              maxLength={120}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exercise-content">התרגיל</Label>
            <Textarea
              id="exercise-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="הדביקו כאן את נוסח התרגיל"
              rows={7}
              maxLength={20000}
              className="max-h-72"
            />
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {file ? (
              <div className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm">
                <FileUpIcon className="size-4 text-primary" aria-hidden />
                <span className="grow truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="הסרת הקובץ"
                  onClick={() => setFile(null)}
                >
                  <XIcon />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="quiet"
                size="md"
                onClick={() => fileRef.current?.click()}
              >
                <FileUpIcon aria-hidden />
                צירוף תמונה או PDF (עד 10MB)
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" variant="solid" size="md" disabled={pending}>
              {pending ? "מעלה..." : "העלאה לחדר"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
