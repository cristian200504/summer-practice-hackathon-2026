import { Router, Request, Response, NextFunction } from 'express';
import { query as queryValidator } from 'express-validator';
import { authenticateToken } from '../middleware/authenticate';
import { getForecast } from '../services/weatherService';

export const weatherRouter = Router();

/**
 * GET /weather?lat=&lng=&datetime=
 *
 * Fetch weather forecast for a location and datetime.
 * Requirements: 9.7, 14.1, 14.4
 */
weatherRouter.get(
  '/',
  authenticateToken,
  [
    queryValidator('lat').isFloat({ min: -90, max: 90 }),
    queryValidator('lng').isFloat({ min: -180, max: 180 }),
    queryValidator('datetime').optional().isISO8601(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const datetime = req.query.datetime
        ? new Date(req.query.datetime as string)
        : new Date();

      const forecast = await getForecast(lat, lng, datetime);
      res.status(200).json(forecast);
    } catch (err) {
      next(err);
    }
  },
);
