-- ============================================================
-- Migration 003: Notification Preferences
-- Per-user, per-type opt-in/opt-out settings
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notification_preferences_unique UNIQUE (user_id, type),
  CONSTRAINT notification_preferences_type_enum CHECK (type IN (
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
