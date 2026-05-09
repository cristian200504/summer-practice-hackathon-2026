import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/authenticate';
import { getLeaderboard } from '../services/achievementService';

export const leaderboardRouter = Router();

/**
 * GET /leaderboard?sport=
 * Requirements: 16.4
 */
leaderboardRouter.get('/', authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sportId = req.query.sport as string | undefined;
      const board = await getLeaderboard(sportId);
      res.status(200).json(board);
    } catch (err) { next(err); }
  },
);
