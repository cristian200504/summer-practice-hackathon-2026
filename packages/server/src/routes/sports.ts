import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../infrastructure/database';
import { Sport } from '../types';

export const sportsRouter = Router();

interface SportRow {
  id: string;
  name: string;
  min_group_size: number;
  max_group_size: number;
  is_team_sport: boolean;
}

function mapSport(row: SportRow): Sport {
  return {
    id: row.id,
    name: row.name,
    minGroupSize: row.min_group_size,
    maxGroupSize: row.max_group_size,
    isTeamSport: row.is_team_sport,
  };
}

/**
 * GET /sports
 *
 * Returns all sports from the database, ordered by name.
 * Public endpoint — no authentication required.
 *
 * Success 200: Sport[]
 *
 * Requirements: 2.6
 */
sportsRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query<SportRow>(
        `SELECT id, name, min_group_size, max_group_size, is_team_sport
         FROM sports
         ORDER BY name ASC`,
        [],
      );
      res.status(200).json(result.rows.map(mapSport));
    } catch (err) {
      next(err);
    }
  },
);
