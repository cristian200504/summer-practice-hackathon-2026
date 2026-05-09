import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/authenticate';

export const chatbotRouter = Router();

const CHATBOT_SERVICE_URL = process.env.CHATBOT_SERVICE_URL ?? 'http://localhost:8000';

/**
 * POST /chatbot
 *
 * Proxy to the Python g4f chatbot microservice.
 * Forwards the user's message and conversation history.
 *
 * Body: { message: string, history?: Array<{ role: string, content: string }> }
 * Success 200: { reply: string }
 */
chatbotRouter.post(
  '/',
  authenticateToken,
  [
    body('message').isString().trim().notEmpty().withMessage('message is required.'),
    body('history').optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: 'validation_error', details: errors.array() });
      return;
    }

    try {
      const { message, history } = req.body as {
        message: string;
        history?: Array<{ role: string; content: string }>;
      };

      const response = await fetch(`${CHATBOT_SERVICE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: history ?? [] }),
        signal: AbortSignal.timeout(30_000), // 30s timeout
      });

      if (!response.ok) {
        throw new Error(`Chatbot service error: ${response.status}`);
      }

      const data = await response.json() as { reply: string; error?: string };
      res.status(200).json({ reply: data.reply });
    } catch (err) {
      // Graceful degradation — don't crash the main app if chatbot is down
      console.error('[chatbot] Service unavailable:', err);
      res.status(200).json({
        reply: "I'm temporarily unavailable. Please try again in a moment! 🏃",
      });
    }
  },
);
