import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import { authenticateToken, JwtPayload } from '../middleware/authenticate';
import {
  getOrCreateConversation,
  listConversations,
  sendDm,
  getDmMessages,
  DmError,
} from '../services/dmService';
import { query } from '../infrastructure/database';

export const dmRouter = Router();

function handleValidation(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'validation_error', message: 'Invalid request.', details: errors.array() });
    return true;
  }
  return false;
}

// ── GET /dm/conversations ─────────────────────────────────────────────────────

/**
 * List all DM conversations for the authenticated user.
 * Ordered by most recent message.
 */
dmRouter.get(
  '/dm/conversations',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user as unknown as JwtPayload;
      const conversations = await listConversations(userId);
      res.status(200).json(conversations);
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /dm/conversations ────────────────────────────────────────────────────

/**
 * Get or create a DM conversation with another user.
 * Body: { otherUserId: string }
 */
dmRouter.post(
  '/dm/conversations',
  authenticateToken,
  [body('otherUserId').isUUID().withMessage('otherUserId must be a valid UUID.')],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidation(req, res)) return;
    try {
      const { userId } = req.user as unknown as JwtPayload;
      const { otherUserId } = req.body as { otherUserId: string };
      const conversation = await getOrCreateConversation(userId, otherUserId);
      res.status(200).json(conversation);
    } catch (err) {
      if (err instanceof DmError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message });
      } else {
        next(err);
      }
    }
  },
);

// ── GET /dm/conversations/:id/messages ────────────────────────────────────────

/**
 * Get paginated message history for a DM conversation.
 * Query params: limit (default 50), cursor (last message ID).
 */
dmRouter.get(
  '/dm/conversations/:id/messages',
  authenticateToken,
  [
    param('id').isUUID(),
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }),
    queryValidator('cursor').optional().isUUID(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidation(req, res)) return;
    try {
      const { userId } = req.user as unknown as JwtPayload;
      const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10), 100);
      const cursor = req.query.cursor as string | undefined;
      const messages = await getDmMessages(req.params.id, userId, limit, cursor);
      res.status(200).json({ messages, cursor: messages.at(-1)?.id ?? null });
    } catch (err) {
      if (err instanceof DmError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message });
      } else {
        next(err);
      }
    }
  },
);

// ── POST /dm/conversations/:id/messages ───────────────────────────────────────

/**
 * Send a DM in a conversation.
 * Body: { content: string }
 */
dmRouter.post(
  '/dm/conversations/:id/messages',
  authenticateToken,
  [
    param('id').isUUID(),
    body('content').isString().trim().notEmpty().withMessage('content is required.'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidation(req, res)) return;
    try {
      const { userId } = req.user as unknown as JwtPayload;
      const message = await sendDm(
        req.params.id,
        userId,
        (req.body as { content: string }).content,
      );
      res.status(201).json(message);
    } catch (err) {
      if (err instanceof DmError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message });
      } else {
        next(err);
      }
    }
  },
);

// ── GET /users/search ─────────────────────────────────────────────────────────

/**
 * Search users by email address or display name.
 * Query params: q (search term, min 1 char)
 * Returns up to 20 results, excluding the authenticated user.
 *
 * Searches:
 *   - users.email        (exact prefix or substring match)
 *   - profiles.display_name (substring match, if profile exists)
 *
 * Users without a profile are still returned — display_name falls back to
 * the part of their email before the @.
 */
dmRouter.get(
  '/users/search',
  authenticateToken,
  [queryValidator('q').isString().trim().isLength({ min: 1 }).withMessage('q must be at least 1 character.')],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidation(req, res)) return;
    try {
      const { userId } = req.user as unknown as JwtPayload;
      const q = (req.query.q as string).trim();

      const result = await query<{
        user_id: string;
        email: string;
        display_name: string | null;
        thumbnail_url: string | null;
      }>(
        `SELECT
           u.id            AS user_id,
           u.email,
           p.display_name,
           p.thumbnail_url
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.id != $2
           AND (
             u.email        ILIKE '%' || $1 || '%'
             OR p.display_name ILIKE '%' || $1 || '%'
           )
         ORDER BY
           -- Exact email prefix matches first, then alphabetical
           (u.email ILIKE $1 || '%') DESC,
           COALESCE(p.display_name, split_part(u.email, '@', 1)) ASC
         LIMIT 20`,
        [q, userId],
      );

      res.status(200).json(
        result.rows.map((r) => ({
          userId: r.user_id,
          email: r.email,
          displayName: r.display_name ?? r.email.split('@')[0],
          thumbnailUrl: r.thumbnail_url ?? null,
        })),
      );
    } catch (err) {
      next(err);
    }
  },
);
