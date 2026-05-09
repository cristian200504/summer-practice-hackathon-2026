import { Message, Poll, PollOption } from '../types';
import {
  insertMessage,
  findMessages,
  insertPoll,
  findPollWithTally,
  castVote,
  closePoll,
} from '../repositories/chatRepository';
import { publishToRoom } from '../infrastructure/websocket';

/**
 * Group Chat Service
 *
 * Handles real-time messaging, system messages, and inline polls.
 * Messages are persisted to PostgreSQL and broadcast via WebSocket.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

export class ChatError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

// ── Messages ──────────────────────────────────────────────────────────────────

/**
 * Send a text message from a user to a group chat.
 * Persists the message and broadcasts it via WebSocket (< 1s latency, Req 8.2).
 */
export async function sendMessage(
  groupId: string,
  senderId: string,
  content: string,
): Promise<Message> {
  if (!content.trim()) {
    throw new ChatError('empty_message', 'Message content cannot be empty.');
  }

  const message = await insertMessage(groupId, senderId, content, 'text');

  // Broadcast to all group members via WebSocket room
  await publishToRoom(`group:${groupId}`, {
    type: 'new_message',
    payload: message,
  });

  return message;
}

/**
 * Emit a system message (member joined/left, team update, etc.).
 * Requirements: 8.4, 8.5
 */
export async function sendSystemMessage(
  groupId: string,
  content: string,
): Promise<Message> {
  const message = await insertMessage(groupId, null, content, 'system');

  await publishToRoom(`group:${groupId}`, {
    type: 'system_message',
    payload: message,
  });

  return message;
}

/**
 * Get paginated message history for a group.
 * Requirements: 8.3, 8.6
 */
export async function getMessages(
  groupId: string,
  limit = 50,
  cursor?: string,
): Promise<Message[]> {
  return findMessages(groupId, limit, cursor);
}

// ── Polls ─────────────────────────────────────────────────────────────────────

/**
 * Create an inline poll in a group chat.
 * Requirements: 8.7, 9.4
 */
export async function createPoll(
  groupId: string,
  creatorId: string,
  question: string,
  options: string[],
  durationMinutes = 30,
): Promise<{ poll: Poll; options: PollOption[] }> {
  if (options.length < 2) {
    throw new ChatError('insufficient_options', 'A poll must have at least 2 options.');
  }

  const result = await insertPoll(groupId, creatorId, question, options, durationMinutes);

  // Post a system message announcing the poll
  await insertMessage(groupId, null, `📊 Poll: ${question}`, 'poll');

  // Broadcast poll creation
  await publishToRoom(`group:${groupId}`, {
    type: 'poll_created',
    payload: { ...result, groupId },
  });

  // Schedule poll close
  setTimeout(async () => {
    try {
      await closePoll(result.poll.id);
      const tally = await findPollWithTally(result.poll.id);
      if (tally) {
        const winner = tally.options.reduce((a, b) =>
          a.voteCount >= b.voteCount ? a : b,
        );
        await publishToRoom(`group:${groupId}`, {
          type: 'poll_closed',
          payload: { pollId: result.poll.id, winner, tally: tally.options },
        });
      }
    } catch (err) {
      console.error(`[chatService] Failed to close poll ${result.poll.id}:`, err);
    }
  }, durationMinutes * 60 * 1000);

  return result;
}

/**
 * Cast a vote on a poll option.
 * One vote per user per poll (enforced by DB UNIQUE constraint, Req 9.4).
 */
export async function vote(
  pollId: string,
  optionId: string,
  userId: string,
): Promise<void> {
  await castVote(pollId, optionId, userId);

  // Broadcast live tally update
  const tally = await findPollWithTally(pollId);
  if (tally) {
    await publishToRoom(`group:${tally.poll.groupId}`, {
      type: 'poll_tally',
      payload: { pollId, options: tally.options },
    });
  }
}

/**
 * Get a poll with its current vote tally.
 */
export async function getPollTally(pollId: string) {
  return findPollWithTally(pollId);
}
