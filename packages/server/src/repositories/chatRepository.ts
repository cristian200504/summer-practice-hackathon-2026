import { PoolClient } from 'pg';
import { query, withTransaction } from '../infrastructure/database';
import { Message, Poll, PollOption } from '../types';

/**
 * Data access layer for messages, polls, poll_options, and poll_votes.
 */

// ── Row types ─────────────────────────────────────────────────────────────────

interface MessageRow {
  id: string;
  group_id: string;
  sender_id: string | null;
  content: string;
  message_type: string;
  created_at: Date;
  expires_at: Date | null;
}

interface PollRow {
  id: string;
  group_id: string;
  creator_id: string;
  question: string;
  closes_at: Date;
  is_closed: boolean;
}

interface PollOptionRow {
  id: string;
  poll_id: string;
  label: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    content: row.content,
    messageType: row.message_type as Message['messageType'],
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

// ── Message queries ───────────────────────────────────────────────────────────

/**
 * Insert a new message. expiresAt = event.end_time + 24h (Req 8.6).
 * For groups without an event yet, expires 7 days from now as a safe default.
 */
export async function insertMessage(
  groupId: string,
  senderId: string | null,
  content: string,
  messageType: 'text' | 'system' | 'poll',
  client?: PoolClient,
): Promise<Message> {
  // Compute expiry: event end_time + 24h if available, else 7 days from now
  const expiryQuery = `
    SELECT COALESCE(
      (SELECT end_time + INTERVAL '24 hours'
       FROM events WHERE group_id = $1 LIMIT 1),
      NOW() + INTERVAL '7 days'
    ) AS expires_at
  `;

  const expiryResult = client
    ? await client.query<{ expires_at: Date }>(expiryQuery, [groupId])
    : await query<{ expires_at: Date }>(expiryQuery, [groupId]);

  const expiresAt = expiryResult.rows[0]?.expires_at ?? null;

  const sql = `
    INSERT INTO messages (group_id, sender_id, content, message_type, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, group_id, sender_id, content, message_type, created_at, expires_at
  `;
  const params = [groupId, senderId, content, messageType, expiresAt];

  const result = client
    ? await client.query<MessageRow>(sql, params)
    : await query<MessageRow>(sql, params);

  return mapMessage(result.rows[0]);
}

/**
 * Paginated message history for a group, ordered oldest-first.
 * cursor is the last message ID seen (for keyset pagination).
 */
export async function findMessages(
  groupId: string,
  limit = 50,
  cursor?: string,
): Promise<Message[]> {
  let sql: string;
  let params: unknown[];

  if (cursor) {
    sql = `
      SELECT id, group_id, sender_id, content, message_type, created_at, expires_at
      FROM messages
      WHERE group_id = $1
        AND created_at > (SELECT created_at FROM messages WHERE id = $2)
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at ASC
      LIMIT $3
    `;
    params = [groupId, cursor, limit];
  } else {
    sql = `
      SELECT id, group_id, sender_id, content, message_type, created_at, expires_at
      FROM messages
      WHERE group_id = $1
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at ASC
      LIMIT $2
    `;
    params = [groupId, limit];
  }

  const result = await query<MessageRow>(sql, params);
  return result.rows.map(mapMessage);
}

// ── Poll queries ──────────────────────────────────────────────────────────────

export async function insertPoll(
  groupId: string,
  creatorId: string,
  question: string,
  options: string[],
  durationMinutes: number,
): Promise<{ poll: Poll; options: PollOption[] }> {
  return withTransaction(async (client) => {
    const closesAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const pollResult = await client.query<PollRow>(
      `INSERT INTO polls (group_id, creator_id, question, closes_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, group_id, creator_id, question, closes_at, is_closed`,
      [groupId, creatorId, question, closesAt],
    );
    const poll = pollResult.rows[0];

    const insertedOptions: PollOption[] = [];
    for (const label of options) {
      const optResult = await client.query<PollOptionRow>(
        `INSERT INTO poll_options (poll_id, label) VALUES ($1, $2)
         RETURNING id, poll_id, label`,
        [poll.id, label],
      );
      insertedOptions.push({ id: optResult.rows[0].id, pollId: poll.id, label });
    }

    return {
      poll: {
        id: poll.id,
        groupId: poll.group_id,
        creatorId: poll.creator_id,
        question: poll.question,
        closesAt: poll.closes_at,
        isClosed: poll.is_closed,
      },
      options: insertedOptions,
    };
  });
}

export async function findPollWithTally(pollId: string): Promise<{
  poll: Poll;
  options: Array<PollOption & { voteCount: number }>;
} | null> {
  const pollResult = await query<PollRow>(
    `SELECT id, group_id, creator_id, question, closes_at, is_closed
     FROM polls WHERE id = $1 LIMIT 1`,
    [pollId],
  );
  if (pollResult.rows.length === 0) return null;
  const p = pollResult.rows[0];

  const optResult = await query<PollOptionRow & { vote_count: string }>(
    `SELECT po.id, po.poll_id, po.label, COUNT(pv.id)::text AS vote_count
     FROM poll_options po
     LEFT JOIN poll_votes pv ON pv.option_id = po.id
     WHERE po.poll_id = $1
     GROUP BY po.id
     ORDER BY po.id`,
    [pollId],
  );

  return {
    poll: {
      id: p.id,
      groupId: p.group_id,
      creatorId: p.creator_id,
      question: p.question,
      closesAt: p.closes_at,
      isClosed: p.is_closed,
    },
    options: optResult.rows.map((r) => ({
      id: r.id,
      pollId: r.poll_id,
      label: r.label,
      voteCount: parseInt(r.vote_count, 10),
    })),
  };
}

export async function castVote(
  pollId: string,
  optionId: string,
  userId: string,
): Promise<void> {
  // UNIQUE constraint on (poll_id, user_id) enforces one vote per user per poll
  await query(
    `INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)
     ON CONFLICT (poll_id, user_id) DO UPDATE SET option_id = $2, voted_at = NOW()`,
    [pollId, optionId, userId],
  );
}

export async function closePoll(pollId: string): Promise<void> {
  await query(`UPDATE polls SET is_closed = TRUE WHERE id = $1`, [pollId]);
}
