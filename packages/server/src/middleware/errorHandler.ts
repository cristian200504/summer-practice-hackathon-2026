import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Centralised error handler middleware.
 * Returns structured JSON errors; never exposes stack traces in production.
 */
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const correlationId = uuidv4();
  const statusCode = err.statusCode ?? 500;

  console.error(`[error] correlationId=${correlationId} status=${statusCode}`, err);

  const body: Record<string, unknown> = {
    error: err.code ?? 'internal_server_error',
    message: statusCode < 500 ? err.message : 'An unexpected error occurred.',
    correlationId,
  };

  // Include stack trace only in development
  if (env.NODE_ENV === 'development' && err.stack) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
