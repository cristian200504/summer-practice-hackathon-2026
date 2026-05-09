import { Router, Request, Response, NextFunction } from 'express';
import { param, validationResult } from 'express-validator';
import { authenticateToken, JwtPayload } from '../middleware/authenticate';
import { query } from '../infrastructure/database';

export const usersRouter = Router();

interface AchievementRow {
  id: string;
  key: string;
  title: string;
  description: string;
  icon_url: string | null;
  granted_at: Date;
}

/**
 * GET /users/:userId/achievements
 *
 * Returns all achievements earned by the given user.
 * The authenticated user may only fetch their own achievements.
 *
 * Success 200: Achievement[]
 * Error 403: forbidden
 *
 * Requirements: 16.3
 */
usersRouter.get(
  '/:userId/achievements',
  authenticateToken,
  [param('userId').isUUID().withMessage('userId must be a valid UUID.')],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: 'validation_error', message: 'Invalid userId.', details: errors.array() });
      return;
    }

    const { userId } = req.params;
    const { userId: authenticatedUserId } = req.user as unknown as JwtPayload;

    if (userId !== authenticatedUserId) {
      res.status(403).json({ error: 'forbidden', message: 'You may only view your own achievements.' });
      return;
    }

    try {
      const result = await query<AchievementRow>(
        `SELECT a.id, a.key, a.title, a.description, a.icon_url, ua.granted_at
         FROM user_achievements ua
         JOIN achievements a ON a.id = ua.achievement_id
         WHERE ua.user_id = $1
         ORDER BY ua.granted_at DESC`,
        [userId],
      );

      res.status(200).json(
        result.rows.map((row) => ({
          id: row.id,
          key: row.key,
          title: row.title,
          description: row.description,
          iconUrl: row.icon_url,
          grantedAt: row.granted_at,
        })),
      );
    } catch (err) {
      next(err);
    }
  },
);
