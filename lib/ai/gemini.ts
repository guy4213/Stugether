import "server-only";
import { GoogleGenAI } from "@google/genai";

// -----------------------------------------------------------------------------
// Thin, typed wrapper around Gemini's streaming text generation.
//
// SDK choice: the official `@google/genai` package (added as a direct
// dependency; it installed cleanly, no native deps) rather than hand-rolled
// `fetch` against the REST streaming endpoint. `ai.models.generateContentStream`
// returns a proper `AsyncGenerator<GenerateContentResponse>`, and each chunk
// exposes a `.text` getter plus `.usageMetadata.{promptTokenCount,
// candidatesTokenCount}` — simpler to audit than reimplementing SSE/NDJSON
// parsing, backoff and auth headers by hand.
//
// Model default: GEMINI_MODEL is read from env; if unset we fall back to
// "gemini-2.5-flash" — the current Gemini flash-tier model (fast + cheap,
// appropriate for a short group-chat assistant reply per TECHNICAL_SPEC §6.5).
// -----------------------------------------------------------------------------

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export type GeminiRole = "system" | "user" | "model";

export interface GeminiTurn {
  role: GeminiRole;
  text: string;
}

export interface GeminiStreamResult {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface StreamGeminiOptions {
  // Intentional no-op hook for now (TECHNICAL_SPEC §6.6): nothing subscribes
  // to it yet, but it is called faithfully as chunks arrive so a future
  // live-streaming UI (Broadcast) only needs to add a subscriber, not touch
  // this function.
  onChunk?: (text: string) => void;
  maxOutputTokens?: number;
}

let cachedClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_CONFIG_MISSING: GEMINI_API_KEY is not set");
  }
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

// Streams a completion for `turns` (chronological order; 'system' turns are
// merged into Gemini's systemInstruction, 'user'/'model' turns become the
// conversation contents — Gemini's API only accepts those two roles in
// `contents`). Returns the full accumulated text plus token usage counts when
// the API reports them.
export async function streamGeminiCompletion(
  turns: GeminiTurn[],
  options: StreamGeminiOptions = {},
): Promise<GeminiStreamResult> {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  const systemText = turns
    .filter((t) => t.role === "system")
    .map((t) => t.text)
    .filter((t) => t.trim().length > 0)
    .join("\n\n");

  const contents = turns
    .filter((t) => t.role === "user" || t.role === "model")
    .map((t) => ({ role: t.role, parts: [{ text: t.text }] }));

  const ai = getClient();
  const stream = await ai.models.generateContentStream({
    model,
    contents,
    config: {
      systemInstruction: systemText.length > 0 ? systemText : undefined,
      maxOutputTokens: options.maxOutputTokens,
    },
  });

  let fullText = "";
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;

  for await (const chunk of stream) {
    const chunkText = chunk.text;
    if (chunkText) {
      fullText += chunkText;
      options.onChunk?.(chunkText);
    }
    if (chunk.usageMetadata) {
      promptTokens = chunk.usageMetadata.promptTokenCount ?? promptTokens;
      completionTokens = chunk.usageMetadata.candidatesTokenCount ?? completionTokens;
    }
  }

  return { text: fullText, promptTokens, completionTokens };
}
