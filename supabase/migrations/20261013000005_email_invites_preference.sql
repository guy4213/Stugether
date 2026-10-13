-- =============================================================================
-- 20261013000005_email_invites_preference.sql
-- Change Request (13.10.2026): an email is sent when a student is invited to
-- a study room (SMTP, lib/email/). Students can turn it off on the
-- notifications page. No row in notification_preferences = default (on).
-- =============================================================================

ALTER TABLE public.notification_preferences
  ADD COLUMN email_invites boolean NOT NULL DEFAULT true;  -- email on room invitation
