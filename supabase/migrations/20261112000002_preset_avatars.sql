-- =============================================================================
-- Ready-made avatars (client QA 12.11.2026)
-- =============================================================================
-- Besides an uploaded photo ('<profile id>/<file>' in the avatars bucket), a
-- student may pick one of 12 avatars that ship with the app
-- (public/avatars/presets). avatar_url then holds 'presets/avatar-NN.svg':
-- still a fixed, app-relative path — never a URL — so the original reasons
-- for the CHECK (no external hosts, no javascript:/data: URIs) still hold.

ALTER TABLE public.profiles DROP CONSTRAINT profiles_avatar_url_own_object_path;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_url_own_object_path CHECK (
  avatar_url IS NULL
  OR avatar_url ~ ('^' || id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$')
  OR avatar_url ~ '^presets/avatar-(0[1-9]|1[0-2])\.svg$'
);
