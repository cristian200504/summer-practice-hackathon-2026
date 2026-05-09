import { query, withTransaction } from '../infrastructure/database';

/**
 * Data access layer for direct messages.
 *
 * Canonical conversation ordering: user_a_id < user_b_id (UUID lexicographic).
 * All public functions accept (userA, userB) in any order and normalise internally.
 */

// ── Row types ─────────────────────────────────────────────────────────────────

export interface DmConversationRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: Date;
  // Joined fields from profiles + unread count
  other_display_name?: string;
  other_thumbnail_url?: string | null;
  unread_count?: string;
  last_message_content?: string | null;
  last_message_at?: Date | null;
}

export interface DmMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: Date;
}

// ── Domain types ──────────────────────────────────────────────────────────────

export interface DmConversation {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: Date;
  otherUserId: string;
  otherDisplayName: string;
  otherThumbnailUrl: string | null;
  unreadCount: number;
  lastMessageContent: string | null;
  lastMessageAt: Date | null;
}

export interface DmMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns [smaller, larger] UUID pair for canonical ordering. */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function mapMessage(row: DmMessageRow): DmMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

// ── Conversation queries ──────────────────────────────────────────────────────

/**
 * Find an existing conversation between two users, or create one.
 * Returns the conversation with the "other" user's profile info.
 */
export async function findOrCreateConversation(
  userId: string,
  otherUserId: string,
): Promise<DmConversation> {
  const [a, b] = canonicalPair(userId, otherUserId);

  return withTransaction(async (client) => {
    // Upsert the conversation row
    await client.query(
      `INSERT INTO dm_conversations (user_a_id, user_b_id)
       VALUES ($1, $2)
       ON CONFLICT (user_a_id, user_b_id) DO NOTHING`,
      [a, b],
    );

    const result = await client.query<DmConversationRow>(
      `SELECT
         c.id, c.user_a_id, c.user_b_id, c.created_at,
         p.display_name  AS other_display_name,
         p.thumbnail_url AS other_thumbnail_url,
         (SELECT COUNT(*) FROM dm_messages m
          WHERE m.conversation_id = c.id
            AND m.sender_id != $3
            AND m.is_read = FALSE)::text AS unread_count,
         (SELECT content   FROM dm_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_content,
         (SELECT created_at FROM dm_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
       FROM dm_conversations c
       JOIN profiles p ON p.user_id = CASE WHEN c.user_a_id = $3 THEN c.user_b_id ELSE c.user_a_id END
       WHERE c.user_a_id = $1 AND c.user_b_id = $2`,
      [a, b, userId],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userAId: row.user_a_id,
      userBId: row.user_b_id,
      createdAt: row.created_at,
      otherUserId: userId === row.user_a_id ? row.user_b_id : row.user_a_id,
      otherDisplayName: row.other_display_name ?? 'Unknown',
      otherThumbnailUrl: row.other_thumbnail_url ?? null,
      unreadCount: parseInt(row.unread_count ?? '0', 10),
      lastMessageContent: row.last_message_content ?? null,
      lastMessageAt: row.last_message_at ?? null,
    };
  });
}

/**
 * List all conversations for a user, ordered by most recent message.
 */
export async function findConversationsForUser(userId: string): Promise<DmConversation[]> {
  const result = await query<DmConversationRow>(
    `SELECT
       c.id, c.user_a_id, c.user_b_id, c.created_at,
       p.display_name  AS other_display_name,
       p.thumbnail_url AS other_thumbnail_url,
       (SELECT COUNT(*) FROM dm_messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id != $1
          AND m.is_read = FALSE)::text AS unread_count,
       (SELECT content    FROM dm_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_content,
       (SELECT created_at FROM dm_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
     FROM dm_conversations c
     JOIN profiles p ON p.user_id = CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END
     WHERE c.user_a_id = $1 OR c.user_b_id = $1
     ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC`,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    userAId: row.user_a_id,
    userBId: row.user_b_id,
    createdAt: row.created_at,
    otherUserId: userId === row.user_a_id ? row.user_b_id : row.user_a_id,
    otherDisplayName: row.other_display_name ?? 'Unknown',
    otherThumbnailUrl: row.other_thumbnail_url ?? null,
    unreadCount: parseInt(row.unread_count ?? '0', 10),
    lastMessageContent: row.last_message_content ?? null,
    lastMessageAt: row.last_message_at ?? null,
  }));
}

/**
 * Verify that a user is a participant in a conversation.
 */
export async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM dm_conversations
       WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)
     ) AS exists`,
    [conversationId, userId],
  );
  return result.rows[0]?.exists ?? false;
}

// ── Message queries ───────────────────────────────────────────────────────────

/**
 * Insert a DM message.
 */
export async function insertDmMessage(
  conversationId: string,
  senderId: string,
  content: string,
): Promise<DmMessage> {
  const result = await query<DmMessageRow>(
    `INSERT INTO dm_messages (conversation_id, sender_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, conversation_id, sender_id, content, is_read, created_at`,
    [conversationId, senderId, content],
  );
  return mapMessage(result.rows[0]);
}

/**
 * Paginated message history for a conversation, oldest-first.
 * cursor = last message ID seen (keyset pagination on created_at).
 */
export async function findDmMessages(
  conversationId: string,
  limit = 50,
  cursor?: string,
): Promise<DmMessage[]> {
  let sql: string;
  let params: unknown[];

  if (cursor) {
    sql = `
      SELECT id, conversation_id, sender_id, content, is_read, created_at
      FROM dm_messages
      WHERE conversation_id = $1
        AND created_at > (SELECT created_at FROM dm_messages WHERE id = $2)
      ORDER BY created_at ASC
      LIMIT $3
    `;
    params = [conversationId, cursor, limit];
  } else {
    sql = `
      SELECT id, conversation_id, sender_id, content, is_read, created_at
      FROM dm_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT $2
    `;
    params = [conversationId, limit];
  }

  const result = await query<DmMessageRow>(sql, params);
  return result.rows.map(mapMessage);
}

/**
 * Mark all messages in a conversation as read for the given recipient.
 */
export async function markMessagesRead(conversationId: string, recipientId: string): Promise<void> {
  await query(
    `UPDATE dm_messages
     SET is_read = TRUE
     WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE`,
    [conversationId, recipientId],
  );
}
