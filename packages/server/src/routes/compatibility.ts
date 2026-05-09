import { Router, Request, Response, NextFunction } from 'express';
import { param, query as qv, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/authenticate';
import { computeCompatibilityScore } from '../services/aiEnrichmentService';
import { query } from '../infrastructure/database';
import { getAvailableUsers } from '../services/availabilityService';

export const compatibilityRouter = Router();

function ve(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ error: 'validation_error', details: errors.array() }); return true; }
  return false;
}

// ── GET /users/:id/compatibility/:otherId ─────────────────────────────────────

/**
 * Get compatibility score between two users for a sport.
 * Requirements: 3.5
 */
compatibilityRouter.get(
  '/users/:id/compatibility/:otherId',
  authenticateToken,
  [param('id').isUUID(), param('otherId').isUUID(), qv('sport').optional().isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (ve(req, res)) return;
    try {
      const { id, otherId } = req.params;
      const sportId = req.query.sport as string | undefined;

      if (!sportId) {
        // Return scores for all shared sports
        const result = await query<{ sport_id: string; name: string }>(
          `SELECT DISTINCT us.sport_id, s.name
           FROM user_sports us
           JOIN sports s ON s.id = us.sport_id
           WHERE us.user_id = $1
             AND us.sport_id IN (SELECT sport_id FROM user_sports WHERE user_id = $2)`,
          [id, otherId],
        );

        const scores = await Promise.all(
          result.rows.map(async (row) => ({
            sportId: row.sport_id,
            sportName: row.name,
            score: await computeCompatibilityScore(id, otherId, row.sport_id),
          })),
        );
        res.status(200).json(scores);
        return;
      }

      const score = await computeCompatibilityScore(id, otherId, sportId);
      res.status(200).json({ score });
    } catch (err) { next(err); }
  },
);

// ── GET /users/:id/recommendations ───────────────────────────────────────────

/**
 * Get top-N compatible users available today for a given sport.
 * Requirements: 3.6
 */
compatibilityRouter.get(
  '/users/:id/recommendations',
  authenticateToken,
  [param('id').isUUID(), qv('sport').optional().isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (ve(req, res)) return;
    try {
      const { id } = req.params;
      const sportId = req.query.sport as string | undefined;
      const limit = Math.min(parseInt((req.query.limit as string) ?? '10', 10), 20);

      // Get users available today
      const today = new Date();
      const availableIds = await getAvailableUsers(today, sportId);
      const candidates = availableIds.filter((uid) => uid !== id);

      if (candidates.length === 0) {
        res.status(200).json([]);
        return;
      }

      // Determine sport to score against
      let targetSportId = sportId;
      if (!targetSportId) {
        const sportResult = await query<{ sport_id: string }>(
          `SELECT sport_id FROM user_sports WHERE user_id = $1 LIMIT 1`,
          [id],
        );
        targetSportId = sportResult.rows[0]?.sport_id;
      }

      if (!targetSportId) {
        res.status(200).json([]);
        return;
      }

      // Score all candidates
      const scored = await Promise.all(
        candidates.map(async (uid) => ({
          userId: uid,
          score: await computeCompatibilityScore(id, uid, targetSportId!),
        })),
      );

      // Sort by score descending, take top N
      const topN = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Fetch display names
      const userIds = topN.map((u) => u.userId);
      const profileResult = await query<{ user_id: string; display_name: string; thumbnail_url: string | null }>(
        `SELECT user_id, display_name, thumbnail_url FROM profiles WHERE user_id = ANY($1::uuid[])`,
        [userIds],
      );
      const profileMap = new Map(profileResult.rows.map((r) => [r.user_id, r]));

      const recommendations = topN.map((u) => ({
        userId: u.userId,
        score: u.score,
        displayName: profileMap.get(u.userId)?.display_name ?? 'Unknown',
        thumbnailUrl: profileMap.get(u.userId)?.thumbnail_url ?? null,
      }));

      res.status(200).json(recommendations);
    } catch (err) { next(err); }
  },
);
