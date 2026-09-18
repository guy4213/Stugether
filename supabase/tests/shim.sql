-- =============================================================================
-- supabase/tests/shim.sql
-- Minimal Supabase compatibility layer for the PGlite test harness.
-- Loaded BEFORE supabase/migrations/*.sql and supabase/seed.sql so the real
-- files run unchanged. This is NOT a migration; never copy it to migrations/.
--
-- Mirrors (a subset of) what a real Supabase project provides:
--   roles:   anon, authenticated, service_role (BYPASSRLS), authenticator,
--            supabase_admin, supabase_auth_admin, supabase_storage_admin
--   schemas: auth, extensions, realtime, storage
--   funcs:   auth.uid(), auth.role(), auth.jwt(), realtime.topic(),
--            storage.foldername(), storage.filename(), storage.extension()
--   grants:  Supabase-style default privileges in schema public
-- pgcrypto is created in schema "extensions" by db.mjs BEFORE this file when
-- the PGlite contrib extension is available; otherwise stubs are created here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin NOLOGIN NOINHERIT;
  END IF;
END
$$;

GRANT anon, authenticated, service_role TO authenticator;

-- -----------------------------------------------------------------------------
-- Schema public: Supabase-style grants. RLS decides row access.
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Schema extensions (pgcrypto lives here on Supabase)
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('extensions.crypt(text,text)') IS NULL THEN
    -- Fallback stubs (only when real pgcrypto is unavailable). Not secure; test-only.
    EXECUTE $f$
      CREATE FUNCTION extensions.gen_salt(text) RETURNS text
      LANGUAGE sql IMMUTABLE AS $b$ SELECT '$stub$' || $1 || '$' $b$
    $f$;
    EXECUTE $f$
      CREATE FUNCTION extensions.gen_salt(text, integer) RETURNS text
      LANGUAGE sql IMMUTABLE AS $b$ SELECT '$stub$' || $1 || '$' $b$
    $f$;
    EXECUTE $f$
      CREATE FUNCTION extensions.crypt(text, text) RETURNS text
      LANGUAGE sql IMMUTABLE AS $b$ SELECT $2 || md5($1) $b$
    $f$;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Schema auth
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  instance_id                 uuid,
  id                          uuid        NOT NULL PRIMARY KEY,
  aud                         varchar(255),
  role                        varchar(255),
  email                       varchar(255),
  encrypted_password          varchar(255),
  email_confirmed_at          timestamptz,
  invited_at                  timestamptz,
  confirmation_token          varchar(255),
  confirmation_sent_at        timestamptz,
  recovery_token              varchar(255),
  recovery_sent_at            timestamptz,
  email_change_token_new      varchar(255),
  email_change                varchar(255),
  email_change_sent_at        timestamptz,
  email_change_token_current  varchar(255) DEFAULT '',
  email_change_confirm_status smallint     DEFAULT 0,
  reauthentication_token      varchar(255) DEFAULT '',
  reauthentication_sent_at    timestamptz,
  last_sign_in_at             timestamptz,
  raw_app_meta_data           jsonb,
  raw_user_meta_data          jsonb,
  is_super_admin              boolean,
  phone                       text         DEFAULT NULL UNIQUE,
  phone_confirmed_at          timestamptz,
  phone_change                text         DEFAULT '',
  phone_change_token          varchar(255) DEFAULT '',
  phone_change_sent_at        timestamptz,
  confirmed_at                timestamptz GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
  banned_until                timestamptz,
  is_sso_user                 boolean     NOT NULL DEFAULT false,
  deleted_at                  timestamptz,
  is_anonymous                boolean     NOT NULL DEFAULT false,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

CREATE TABLE auth.identities (
  provider_id     text        NOT NULL,
  user_id         uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  identity_data   jsonb       NOT NULL,
  provider        text        NOT NULL,
  last_sign_in_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  email           text GENERATED ALWAYS AS (lower(identity_data ->> 'email')) STORED,
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider)
);

-- Supabase: anon/authenticated have no table privileges on auth.*
GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role, supabase_auth_admin;

-- Same bodies as Supabase (GoTrue) so claim parsing behaves identically.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

GRANT EXECUTE ON FUNCTION auth.uid(), auth.role(), auth.email(), auth.jwt()
  TO PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Schema realtime
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS realtime;
GRANT USAGE ON SCHEMA realtime TO anon, authenticated, service_role;

-- Real Supabase partitions this table by inserted_at; not needed for tests.
CREATE TABLE realtime.messages (
  id          uuid      NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic       text      NOT NULL,
  extension   text      NOT NULL,
  payload     jsonb,
  event       text,
  private     boolean   DEFAULT false,
  updated_at  timestamp NOT NULL DEFAULT now(),
  inserted_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON realtime.messages TO anon, authenticated;
GRANT ALL ON realtime.messages TO service_role;

CREATE OR REPLACE FUNCTION realtime.topic() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('realtime.topic', true), '')::text
$$;

GRANT EXECUTE ON FUNCTION realtime.topic() TO PUBLIC, anon, authenticated, service_role;

-- Broadcast-from-database helpers (simplified: just store the message).
CREATE OR REPLACE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO realtime.messages (payload, event, topic, private, extension)
  VALUES (payload, event, topic, private, 'broadcast')
$$;

CREATE OR REPLACE FUNCTION realtime.broadcast_changes(
  topic_name text, event_name text, operation text, table_name text, table_schema text,
  new record, old record, level text DEFAULT 'ROW'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'operation', operation, 'table', table_name, 'schema', table_schema,
      'record', CASE WHEN new IS NULL THEN NULL ELSE to_jsonb(new) END,
      'old_record', CASE WHEN old IS NULL THEN NULL ELSE to_jsonb(old) END
    ),
    event_name, topic_name, true
  );
END
$$;

-- Publication used by Postgres Changes (migrations may ALTER PUBLICATION ... ADD TABLE).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Schema storage
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

CREATE TABLE storage.buckets (
  id                 text        NOT NULL PRIMARY KEY,
  name               text        NOT NULL UNIQUE,
  owner              uuid,
  owner_id           text,
  public             boolean     DEFAULT false,
  avif_autodetection boolean     DEFAULT false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  type               text        DEFAULT 'STANDARD',
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE TABLE storage.objects (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_id        text        REFERENCES storage.buckets (id),
  name             text,
  owner            uuid,
  owner_id         text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  metadata         jsonb,
  user_metadata    jsonb,
  version          text,
  path_tokens      text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
  CONSTRAINT bucketid_objname UNIQUE (bucket_id, name)
);

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

GRANT ALL ON storage.buckets, storage.objects TO anon, authenticated, service_role, supabase_storage_admin;

CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  _parts text[];
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  RETURN _parts[1:array_length(_parts, 1) - 1];
END
$$;

CREATE OR REPLACE FUNCTION storage.filename(name text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  _parts text[];
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  RETURN _parts[array_length(_parts, 1)];
END
$$;

CREATE OR REPLACE FUNCTION storage.extension(name text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  _parts    text[];
  _filename text;
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  SELECT _parts[array_length(_parts, 1)] INTO _filename;
  RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;

GRANT EXECUTE ON FUNCTION storage.foldername(text), storage.filename(text), storage.extension(text)
  TO PUBLIC, anon, authenticated, service_role;
