-- =============================================================================
-- "חיפוש בשיחה" (client QA 12.11.2026)
-- =============================================================================
-- Searching inside a study room's chat / a private chat is a plain
-- `content ILIKE '%text%'` read (lib/repositories/messages.ts,
-- conversations.ts) under the existing SELECT policies — members only, a
-- Super Admin still never reads content. Trigram indexes keep the "contains"
-- search fast as rooms grow. No policy or function changes.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS messages_content_trgm_idx
  ON public.messages USING gin (content extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS direct_messages_content_trgm_idx
  ON public.direct_messages USING gin (content extensions.gin_trgm_ops);
