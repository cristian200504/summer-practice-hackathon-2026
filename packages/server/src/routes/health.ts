import { Router, Request, Response } from 'express';
import { getPool } from '../infrastructure/database';
import { getRedisClient } from '../infrastructure/redis';

export const healthRouter = Router();

/**
 * GET /health
 * Returns the health status of the server and its dependencies.
 */
healthRouter.get('/', async (_req: Request, res: Response) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  // Check PostgreSQL
  try {
    await getPool().query('SELECT 1');
    status.services.database = 'ok';
  } catch {
    status.services.database = 'error';
    status.status = 'degraded';
  }

  // Check Redis
  try {
    await getRedisClient().ping();
    status.services.redis = 'ok';
  } catch {
    status.services.redis = 'error';
    status.status = 'degraded';
  }

  const httpStatus = status.status === 'ok' ? 200 : 503;
  res.status(httpStatus).json(status);
});
