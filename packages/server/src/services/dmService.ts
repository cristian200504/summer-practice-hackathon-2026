import {
  findOrCreateConversation,
  findConversationsForUser,
  isParticipant,
  insertDmMessage,
  findDmMessages,
  markMessagesRead,
  DmConversation,
  DmMessage,
} from '../repositories/dmRepository';
import { publishToRoom } from '../infrastructure/websocket';

export { DmConversation, DmMessage };

export class DmError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'DmError';
  }
}

/**
 * Returns the canonical WebSocket room name for a DM conversation.
 * Room key: `dm:<conversationId>`
 */
function dmRoom(conversationId: string): string {
  return `dm:${conversationId}`;
}

// ── Conversations ─────────────────────────────────────────────────────────────

/**
 * Get or create a DM conversation between two users.
 * Prevents users from messaging themselves.
 */
export async function getOrCreateConversation(
  userId: string,
  otherUserId: string,
): Promise<DmConversation> {
  if (userId === otherUserId) {
    throw new DmError('self_message', 'You cannot start a conversation with yourself.', 400);
  }
  return findOrCreateConversation(userId, otherUserId);
}

/**
 * List all DM conversations for a user, ordered by most recent message.
 */
export async function listConversations(userId: string): Promise<DmConversation[]> {
  return findConversationsForUser(userId);
}

// ── Messages ──────────────────────────────────────────────────────────────────

/**
 * Send a DM. Persists the message and broadcasts it via WebSocket.
 */
export async function sendDm(
  conversationId: string,
  senderId: string,
  content: string,
): Promise<DmMessage> {
  if (!content.trim()) {
    throw new DmError('empty_message', 'Message content cannot be empty.');
  }

  const participant = await isParticipant(conversationId, senderId);
  if (!participant) {
    throw new DmError('forbidden', 'You are not a participant in this conversation.', 403);
  }

  const message = await insertDmMessage(conversationId, senderId, content.trim());

  // Broadcast to both participants via WebSocket room
  await publishToRoom(dmRoom(conversationId), {
    type: 'new_dm_message',
    payload: message,
  });

  return message;
}

/**
 * Get paginated message history for a conversation.
 * Also marks all received messages as read for the requesting user.
 */
export async function getDmMessages(
  conversationId: string,
  userId: string,
  limit = 50,
  cursor?: string,
): Promise<DmMessage[]> {
  const participant = await isParticipant(conversationId, userId);
  if (!participant) {
    throw new DmError('forbidden', 'You are not a participant in this conversation.', 403);
  }

  const messages = await findDmMessages(conversationId, limit, cursor);

  // Mark received messages as read (fire-and-forget)
  void markMessagesRead(conversationId, userId);

  return messages;
}
