-- =============================================================================
-- 001_users_and_auth.sql
-- Users, authentication, push subscriptions, and document verification tables.
--
-- Run order: 1 of 6
-- Depends on: nothing
--
-- Idempotency: All CREATE TYPE statements are guarded with DO $$ blocks.
--              All CREATE TABLE statements use IF NOT EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- user_role_enum
-- Defines the access tier for every user account. Used by RBAC middleware.
--   PASSENGER    — regular commuter booking trips
--   DRIVER       — operates a bus on assigned shifts
--   MANAGER      — company-level staff who can manage routes and shifts
--   COMPANY_LEAD — top-level company authority; full fleet management access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    CREATE TYPE user_role_enum AS ENUM (
      'PASSENGER',
      'DRIVER',
      'MANAGER',
      'COMPANY_LEAD'
    );
  END IF;
END
$$;

-- passenger_category_enum
-- Determines which fare_rules discount bracket applies to a passenger.
--   REGULAR       — standard adult fare
--   STUDENT       — discounted student fare (requires verified document)
--   WORKER        — industrial/labour concession fare
--   GOVT_PERSONNEL — government-mandated rate (may use fixed_price override)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'passenger_category_enum') THEN
    CREATE TYPE passenger_category_enum AS ENUM (
      'REGULAR',
      'STUDENT',
      'WORKER',
      'GOVT_PERSONNEL'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- users
-- Central identity record for every account in the system.
-- Role and passenger_category together drive RBAC and fare calculations.
CREATE TABLE IF NOT EXISTS users (
  id                 UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT                     UNIQUE NOT NULL,
  phone              TEXT                     UNIQUE NOT NULL,
  password_hash      TEXT                     NOT NULL,
  role               user_role_enum           NOT NULL,
  -- passenger_category is meaningful only for PASSENGER role.
  -- Non-passenger roles carry REGULAR as a safe default.
  passenger_category passenger_category_enum  NOT NULL DEFAULT 'REGULAR',
  full_name          TEXT                     NOT NULL,
  -- avatar_url: publicly accessible URL to the user's profile picture.
  -- NULL until the user uploads one.
  avatar_url         TEXT,
  -- is_verified: toggled true after phone/email OTP verification succeeds.
  is_verified        BOOLEAN                  NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ              NOT NULL DEFAULT NOW()
);

-- user_documents
-- Stores uploaded verification documents (e.g. student ID, government card).
-- Linked documents determine whether a passenger's category discount applies.
CREATE TABLE IF NOT EXISTS user_documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: remove documents when the owning user is deleted.
  user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  document_type TEXT        NOT NULL,
  document_url  TEXT        NOT NULL,
  -- verified_by: admin/manager who approved or rejected this document.
  -- ON DELETE SET NULL: keeps the document record even if the reviewer leaves.
  verified_by   UUID        REFERENCES users (id) ON DELETE SET NULL,
  verified_at   TIMESTAMPTZ,
  -- status lifecycle: PENDING → APPROVED | REJECTED
  status        TEXT        NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- refresh_tokens
-- Stores hashed refresh tokens issued on login.
-- Each token is bound to a single user and a single device session.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: invalidate all tokens when the user is deleted.
  user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- token_hash: bcrypt/SHA-256 hash of the raw refresh token.
  -- Never store the raw token. Unique to prevent duplicate issuance.
  token_hash  TEXT        UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  -- revoked_at: set when the token is explicitly invalidated (logout/rotation).
  -- NULL means the token is still valid (if not past expires_at).
  revoked_at  TIMESTAMPTZ,
  -- device_info: JSON bag of device metadata (user-agent, OS, app version).
  -- Used for the "sessions" screen in account settings.
  device_info JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- push_subscriptions
-- Web Push API subscription objects for server-sent push notifications.
-- A user may have multiple subscriptions (one per browser/device).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: remove subscriptions when the user is deleted.
  user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- endpoint: the push service URL provided by the browser.
  endpoint   TEXT        NOT NULL,
  -- p256dh: client's ECDH public key for payload encryption.
  p256dh     TEXT        NOT NULL,
  -- auth_key: client's authentication secret for payload encryption.
  auth_key   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevents registering the same browser endpoint twice for one user.
  UNIQUE (user_id, endpoint)
);
