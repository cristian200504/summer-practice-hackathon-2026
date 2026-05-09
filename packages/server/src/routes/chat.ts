import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, JwtPayload } from '../middleware/authenticate';
import {
  sendMessage,
  getMessages,
  createPoll,
  vote,
  ChatError,
} from '../services/chatService';

export const chatRouter = Router();

function handleValidationErrors(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'validation_error', message: 'Invalid request.', details: errors.array() });
    return true;
  }
  return false;
}

// ── POST /groups/:id/messages ─────────────────────────────────────────────────

/**
 * Send a text message to a group chat.
 * Requirements: 8.1, 8.2, 8.3
 */
chatRouter.post(
  '/groups/:id/messages',
  authenticateToken,
  [
    param('id').isUUID(),
    body('content').isString().trim().notEmpty().withMessage('content is required.'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;
    try {
      const { userId } = req.user as unknown as JwtPayload;
      const message = await sendMessage(req.params.id, userId, (req.body as { content: string }).content);
      res.status(201).json(message);
    } catch (err) {
      if (err instanceof ChatError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message });
      } else {
        next(err);
      }
    }
  },
);

// ── GET /groups/:id/messages ──────────────────────────────────────────────────

/**
 * Get paginated message history for a group.
 * Query params: limit (default 50), cursor (last message ID for pagination).
 * Requirements: 8.3, 8.6
 */
chatRouter.get(
  '/groups/:id/messages',
  authenticateToken,
  [param('id').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;
    try {
      const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10), 100);
      const cursor = req.query.cursor as string | undefined;
      const messages = await getMessages(req.params.id, limit, cursor);
      res.status(200).json({ messages, cursor: messages.at(-1)?.id ?? null });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /groups/:id/polls ────────────────────────────────────────────────────

/**
 * Create an inline poll in a group chat.
 * Requirements: 8.7, 9.4
 */
chatRouter.post(
  '/groups/:id/polls',
  authenticateToken,
  [
    param('id').isUUID(),
    body('question').isString().trim().notEmpty(),
    body('options').isArray({ min: 2 }).withMessage('At least 2 options required.'),
    body('durationMinutes').optional().isInt({ min: 1, max: 1440 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;
    try {
      const { userId } = req.user as unknown as JwtPayload;
      const { question, options, durationMinutes } = req.body as {
        question: string;
        options: string[];
        durationMinutes?: number;
      };
      const result = await createPoll(req.params.id, userId, question, options, durationMinutes ?? 30);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof ChatError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message });
      } else {
        next(err);
      }
    }
  },
);

// ── POST /polls/:id/vote ──────────────────────────────────────────────────────

/**
 * Cast a vote on a poll option.
 * One vote per user per poll (Req 9.4).
 */
chatRouter.post(
  '/polls/:id/vote',
  authenticateToken,
  [
    param('id').isUUID(),
    body('optionId').isUUID().withMessage('optionId must be a valid UUID.'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;
    try {
      const { userId } = req.user as unknown as JwtPayload;
      await vote(req.params.id, (req.body as { optionId: string }).optionId, userId);
      res.status(200).json({ message: 'Vote recorded.' });
    } catch (err) {
      next(err);
    }
  },
);
