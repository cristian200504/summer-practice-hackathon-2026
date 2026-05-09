import { Router, Request, Response, NextFunction } from 'express';
import { query as queryValidator } from 'express-validator';
import { authenticateToken } from '../middleware/authenticate';
import { getNearbyVenues } from '../services/locationService';

export const venuesRouter = Router();

/**
 * GET /venues?sport=&lat=&lng=&radius=
 *
 * Search for nearby venues suitable for a sport.
 * Returns ≥ 3 venues when available; expands radius if needed (Req 9.8).
 *
 * Requirements: 9.1, 9.2, 9.8
 */
venuesRouter.get(
  '/',
  authenticateToken,
  [
    queryValidator('sport').isString().notEmpty().withMessage('sport is required.'),
    queryValidator('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be a valid latitude.'),
    queryValidator('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be a valid longitude.'),
    queryValidator('radius').optional().isFloat({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sport = req.query.sport as string;
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : undefined;

      const result = await getNearbyVenues(sport, lat, lng, radius);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

import { query } from '../infrastructure/database';

/**
 * GET /events/nearby?lat=&lng=&radius=
 *
 * Return active events near the user's location.
 * Requirements: 12.6, 18.1
 */
export async function getNearbyEvents(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<unknown[]> {
  // Simple bounding-box filter (no PostGIS required for hackathon)
  const degPerKm = 1 / 111;
  const latDelta = radiusKm * degPerKm;
  const lngDelta = radiusKm * degPerKm / Math.cos((lat * Math.PI) / 180);

  const result = await query(
    `SELECT id, title, sport_id, venue_name, venue_address, venue_lat, venue_lng,
            start_time, min_participants, max_participants, state
     FROM events
     WHERE is_public = TRUE
       AND state IN ('Pending', 'Active')
       AND venue_lat BETWEEN $1 AND $2
       AND venue_lng BETWEEN $3 AND $4
     ORDER BY start_time ASC
     LIMIT 50`,
    [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta],
  );
  return result.rows;
}
