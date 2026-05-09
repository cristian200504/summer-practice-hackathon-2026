-- ============================================================
-- Migration 007: Direct Messages
-- Adds dm_conversations and dm_messages tables.
-- ============================================================

-- ── dm_conversations ──────────────────────────────────────────
-- One row per unique pair of users (canonical order: user_a_id < user_b_id).
CREATE TABLE IF NOT EXISTS dm_conversations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Enforce canonical ordering so (A,B) and (B,A) map to the same row
  CONSTRAINT dm_conversations_unique  UNIQUE (user_a_id, user_b_id),
  CONSTRAINT dm_conversations_order   CHECK  (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS dm_conversations_user_a_idx ON dm_conversations (user_a_id);
CREATE INDEX IF NOT EXISTS dm_conversations_user_b_idx ON dm_conversations (user_b_id);

-- ── dm_messages ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dm_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,
  is_read         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dm_messages_conv_created_idx ON dm_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS dm_messages_unread_idx       ON dm_messages (conversation_id, is_read) WHERE is_read = FALSE;
