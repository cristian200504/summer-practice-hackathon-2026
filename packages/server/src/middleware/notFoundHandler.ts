import { Request, Response } from 'express';

/**
 * Catch-all handler for unmatched routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'not_found',
    message: `Route ${req.method} ${req.path} not found.`,
  });
}
