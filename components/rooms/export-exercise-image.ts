// "הורדת התרגיל" as an image (Change Request 07.11.2026): the exercise as the
// room sees it — title, text, the uploaded image — with the whiteboard drawn
// over it, saved as a PNG. Positions come from the live DOM, so the drawings
// land on the same lines they were made on.

const HEADER = 64; // title band above the exercise, CSS px
const SCALE = 2; // export resolution

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Signed Storage URLs allow CORS; without it the canvas would be tainted.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// The lowest drawn pixel of the whiteboard canvas, in CSS px (0 = empty).
function drawingsBottom(board: HTMLCanvasElement | null, cssWidth: number): number {
  if (!board || board.width === 0 || board.height === 0) return 0;
  const ctx = board.getContext("2d");
  if (!ctx) return 0;
  const { data } = ctx.getImageData(0, 0, board.width, board.height);
  for (let y = board.height - 1; y >= 0; y--) {
    const row = y * board.width * 4;
    for (let x = 3; x < board.width * 4; x += 4) {
      if (data[row + x] !== 0) return (y + 1) * (cssWidth / board.width);
    }
  }
  return 0;
}

function fileName(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "תרגיל";
  return `${safe}.png`;
}

/**
 * Renders `scroller` (the exercise's scrolling area: its text, images and the
 * whiteboard canvas) into a PNG and downloads it.
 */
export async function downloadExerciseImage(scroller: HTMLElement, title: string): Promise<void> {
  const box = scroller.getBoundingClientRect();
  const width = scroller.clientWidth;
  // Element position inside the scroller's full (scrolled) content.
  const place = (el: Element) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left - box.left + scroller.scrollLeft,
      y: r.top - box.top + scroller.scrollTop,
      w: r.width,
      h: r.height,
    };
  };
  const board = scroller.querySelector("canvas");
  // Crop the empty space under the exercise: keep down to the lower of the
  // content and the last drawing.
  const article = scroller.querySelector("article");
  const contentBottom = article ? place(article).y + place(article).h : 0;
  const height = Math.min(
    scroller.scrollHeight,
    Math.max(240, contentBottom + 48, drawingsBottom(board, width) + 32),
  );

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * SCALE);
  canvas.height = Math.round((height + HEADER) * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height + HEADER);

  const bodyFont = getComputedStyle(scroller).fontFamily || "sans-serif";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  // Title band.
  ctx.fillStyle = "#0f1b33";
  ctx.font = `700 22px ${bodyFont}`;
  ctx.fillText(title, width - 32, HEADER / 2 + 4);
  ctx.fillStyle = "#e6ebf3";
  ctx.fillRect(24, HEADER - 1, width - 48, 1);

  ctx.save();
  ctx.translate(0, HEADER);

  // Text paragraphs (the exercise content), re-wrapped at their own width
  // with their own font — the same lines the browser drew.
  for (const p of Array.from(scroller.querySelectorAll("article p"))) {
    const at = place(p);
    const style = getComputedStyle(p);
    const fontSize = Number.parseFloat(style.fontSize) || 17;
    const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.75;
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color || "#0f1b33";
    wrapLines(ctx, p.textContent ?? "", at.w).forEach((line, i) => {
      ctx.fillText(line, at.x + at.w, at.y + lineHeight * i + lineHeight / 2);
    });
  }

  // The uploaded image.
  for (const img of Array.from(scroller.querySelectorAll("article img"))) {
    const at = place(img);
    try {
      ctx.drawImage(await loadImage((img as HTMLImageElement).src), at.x, at.y, at.w, at.h);
    } catch {
      /* not loadable with CORS: leave the drawings on white */
    }
  }

  // The whiteboard: its canvas already holds every drawing at device scale.
  // Only its top `height` CSS px are kept (the rest is empty).
  if (board && board.width > 0 && board.height > 0) {
    const ratio = board.width / width;
    const rows = Math.min(board.height, Math.round(height * ratio));
    ctx.drawImage(board, 0, 0, board.width, rows, 0, 0, width, rows / ratio);
  }
  ctx.restore();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("export failed");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName(title);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
