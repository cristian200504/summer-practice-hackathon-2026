import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, JwtPayload } from '../middleware/authenticate';
import { query } from '../infrastructure/database';
import { env } from '../config/env';

export const notificationsRouter = Router();

const NOTIFICATION_TYPES = [
  'availability_prompt', 'match_found', 'match_confirmation', 'captain_assigned',
  'new_message', 'poll_result', 'event_reminder', 'achievement_unlocked', 'weather_alert',
];

// ── GET /notifications/preferences ───────────────────────────────────────────

/**
 * Get notification preferences for the authenticated user.
 * Returns all types with their enabled status (defaults to true if not set).
 * Requirements: 11.5
 */
notificationsRouter.get(
  '/preferences',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user as unknown as JwtPayload;
      const result = await query<{ type: string; enabled: boolean }>(
        `SELECT type, enabled FROM notification_preferences WHERE user_id = $1`,
        [userId],
      );

      const prefs: Record<string, boolean> = {};
      for (const type of NOTIFICATION_TYPES) {
        prefs[type] = true; // default enabled
      }
      for (const row of result.rows) {
        prefs[row.type] = row.enabled;
      }

      res.status(200).json(prefs);
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /notifications/preferences ───────────────────────────────────────────

/**
 * Update notification preferences for the authenticated user.
 * Body: { [type]: boolean }
 * Requirements: 11.5
 */
notificationsRouter.put(
  '/preferences',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user as unknown as JwtPayload;
      const updates = req.body as Record<string, boolean>;

      for (const [type, enabled] of Object.entries(updates)) {
        if (!NOTIFICATION_TYPES.includes(type)) continue;
        await query(
          `INSERT INTO notification_preferences (user_id, type, enabled)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, type) DO UPDATE SET enabled = $3, updated_at = NOW()`,
          [userId, type, Boolean(enabled)],
        );
      }

      res.status(200).json({ message: 'Preferences updated.' });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /notifications/subscribe ────────────────────────────────────────────

/**
 * Register a Web Push subscription for the authenticated user.
 * Requirements: 11.1
 */
notificationsRouter.post(
  '/subscribe',
  authenticateToken,
  [
    body('endpoint').isURL().withMessage('endpoint must be a valid URL.'),
    body('keys.p256dh').isString().notEmpty(),
    body('keys.auth').isString().notEmpty(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: 'validation_error', details: errors.array() });
      return;
    }

    try {
      const { userId } = req.user as unknown as JwtPayload;
      const { endpoint, keys } = req.body as { endpoint: string; keys: { p256dh: string; auth: string } };

      await query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (endpoint) DO UPDATE SET p256dh = $3, auth = $4`,
        [userId, endpoint, keys.p256dh, keys.auth],
      );

      res.status(201).json({ message: 'Subscription registered.' });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /notifications/vapid-public-key ──────────────────────────────────────

/**
 * Return the VAPID public key so the client can subscribe to push notifications.
 */
notificationsRouter.get(
  '/vapid-public-key',
  (_req: Request, res: Response) => {
    res.status(200).json({ publicKey: env.VAPID_PUBLIC_KEY || null });
  },
);
