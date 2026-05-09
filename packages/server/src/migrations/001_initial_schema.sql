-- ============================================================
-- Migration 001: Initial Schema
-- ShowUp2Move — core tables
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL UNIQUE,
  password_hash   TEXT,                          -- NULL for OAuth-only accounts
  oauth_provider  TEXT,                          -- e.g. 'google'
  oauth_id        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_email_format CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT users_oauth_pair   CHECK (
    (oauth_provider IS NULL AND oauth_id IS NULL) OR
    (oauth_provider IS NOT NULL AND oauth_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS users_oauth_unique
  ON users (oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL;

-- ── profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name   TEXT        NOT NULL,
  bio            TEXT        NOT NULL DEFAULT '',
  photo_url      TEXT,
  thumbnail_url  TEXT,
  is_complete    BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT profiles_bio_length CHECK (char_length(bio) <= 300)
);

-- ── sports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sports (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL UNIQUE,
  min_group_size INT         NOT NULL,
  max_group_size INT         NOT NULL,
  is_team_sport  BOOLEAN     NOT NULL DEFAULT FALSE,

  CONSTRAINT sports_group_size_positive CHECK (min_group_size > 0 AND max_group_size > 0),
  CONSTRAINT sports_group_size_order    CHECK (min_group_size <= max_group_size)
);

-- ── user_sports ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sports (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_id    UUID  NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  skill_level TEXT  CHECK (skill_level IN ('Beginner', 'Intermediate', 'Advanced')),

  CONSTRAINT user_sports_unique UNIQUE (user_id, sport_id)
);

-- ── availability_responses ────────────────────────────────────
CREATE TABLE IF NOT EXISTS availability_responses (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                DATE    NOT NULL,
  available           BOOLEAN NOT NULL,
  locked_for_matching BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One response per user per day
  CONSTRAINT availability_responses_unique UNIQUE (user_id, date)
);

-- ── availability_sport_selections ────────────────────────────
CREATE TABLE IF NOT EXISTS availability_sport_selections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  availability_response_id UUID NOT NULL REFERENCES availability_responses(id) ON DELETE CASCADE,
  sport_id                UUID NOT NULL REFERENCES sports(id) ON DELETE CASCADE,

  CONSTRAINT availability_sport_selections_unique UNIQUE (availability_response_id, sport_id)
);

-- ── groups ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id        UUID  NOT NULL REFERENCES sports(id) ON DELETE RESTRICT,
  state           TEXT  NOT NULL DEFAULT 'Pending',
  captain_user_id UUID  REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT groups_state_enum CHECK (state IN ('Pending', 'Active', 'Dissolved'))
);

-- ── group_members ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID  NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id             UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  confirmation_status TEXT  NOT NULL DEFAULT 'Pending',
  team                TEXT,                          -- 'A' | 'B' | NULL for non-team sports
  confirmed_at        TIMESTAMPTZ,

  CONSTRAINT group_members_unique              UNIQUE (group_id, user_id),
  CONSTRAINT group_members_status_enum         CHECK (confirmation_status IN ('Pending', 'Confirmed', 'Declined')),
  CONSTRAINT group_members_team_enum           CHECK (team IS NULL OR team IN ('A', 'B'))
);

-- ── events ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID    REFERENCES groups(id) ON DELETE SET NULL,
  sport_id         UUID    NOT NULL REFERENCES sports(id) ON DELETE RESTRICT,
  captain_user_id  UUID    REFERENCES users(id) ON DELETE SET NULL,
  title            TEXT    NOT NULL,
  description      TEXT    NOT NULL DEFAULT '',
  venue_name       TEXT,
  venue_address    TEXT,
  venue_lat        DOUBLE PRECISION,
  venue_lng        DOUBLE PRECISION,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  min_participants INT     NOT NULL,
  max_participants INT     NOT NULL,
  is_public        BOOLEAN NOT NULL DEFAULT TRUE,
  state            TEXT    NOT NULL DEFAULT 'Pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT events_time_order          CHECK (end_time > start_time),
  CONSTRAINT events_participants_order  CHECK (min_participants > 0 AND max_participants >= min_participants),
  CONSTRAINT events_state_enum          CHECK (state IN ('Pending', 'Active', 'Cancelled', 'Completed'))
);

-- ── event_participants ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_participants (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID  NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT  NOT NULL DEFAULT 'Pending',
  responded_at TIMESTAMPTZ,

  CONSTRAINT event_participants_unique       UNIQUE (event_id, user_id),
  CONSTRAINT event_participants_status_enum  CHECK (status IN ('Pending', 'Confirmed', 'Declined'))
);

-- ── messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID  NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id    UUID  REFERENCES users(id) ON DELETE SET NULL,  -- NULL for system messages
  content      TEXT  NOT NULL,
  message_type TEXT  NOT NULL DEFAULT 'text',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,                           -- event.end_time + 24h

  CONSTRAINT messages_type_enum CHECK (message_type IN ('text', 'system', 'poll'))
);

CREATE INDEX IF NOT EXISTS messages_group_created_idx ON messages (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_expires_idx       ON messages (expires_at);

-- ── polls ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polls (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID    NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  creator_id UUID    REFERENCES users(id) ON DELETE SET NULL,
  question   TEXT    NOT NULL,
  closes_at  TIMESTAMPTZ NOT NULL,
  is_closed  BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── poll_options ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poll_options (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label   TEXT NOT NULL
);

-- ── poll_votes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poll_votes (
  id        UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   UUID  NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID  NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id   UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One vote per user per poll
  CONSTRAINT poll_votes_unique UNIQUE (poll_id, user_id)
);

-- ── ai_suggestions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_id   UUID  NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  source     TEXT  NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  status     TEXT  NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ai_suggestions_source_enum     CHECK (source IN ('bio', 'photo')),
  CONSTRAINT ai_suggestions_status_enum     CHECK (status IN ('pending', 'accepted', 'dismissed')),
  CONSTRAINT ai_suggestions_confidence_range CHECK (confidence >= 0.0 AND confidence <= 1.0)
);

-- ── compatibility_scores ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS compatibility_scores (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id   UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_id    UUID  NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  score       DOUBLE PRECISION NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Canonical ordering: user_a_id < user_b_id (enforces symmetry at DB level)
  CONSTRAINT compatibility_scores_unique    UNIQUE (user_a_id, user_b_id, sport_id),
  CONSTRAINT compatibility_scores_ordering  CHECK (user_a_id < user_b_id),
  CONSTRAINT compatibility_scores_range     CHECK (score >= 0.0 AND score <= 1.0)
);

-- ── achievements ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon_url    TEXT
);

-- ── user_achievements ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_achievements (
  id             UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID  NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_achievements_unique UNIQUE (user_id, achievement_id)
);

-- ── notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  deep_link  TEXT    NOT NULL DEFAULT '',
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notifications_type_enum CHECK (type IN (
    'availability_prompt',
    'match_found',
    'match_confirmation',
    'captain_assigned',
    'new_message',
    'poll_result',
    'event_reminder',
    'achievement_unlocked',
    'weather_alert'
  ))
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, created_at DESC)
  WHERE is_read = FALSE;

-- ── push_subscriptions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT  NOT NULL UNIQUE,
  p256dh     TEXT  NOT NULL,
  auth       TEXT  NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);
