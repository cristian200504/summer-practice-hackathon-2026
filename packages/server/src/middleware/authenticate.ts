import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { isTokenBlacklisted } from '../services/authService';

export interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

// Declare Express.User as the domain User type so Passport's req.user is typed correctly.
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends Omit<import('../types').User, never> {}
  }
}

/**
 * Middleware that validates the Bearer JWT on protected routes.
 *
 * - Extracts the Bearer token from the Authorization header.
 * - Checks the Redis blacklist for invalidated (logged-out) tokens.
 * - Verifies the JWT signature and expiry.
 * - Attaches `req.user` with the JWT payload (userId) for downstream handlers.
 * - Returns 401 with a `redirectTo: '/login'` hint when the token is expired,
 *   missing, or blacklisted.
 *
 * Requirement 1.7: When a User's session token expires, the Auth_Service SHALL
 * redirect the User to the login screen.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({
      error: 'token_missing',
      message: 'Authentication token is required.',
      redirectTo: '/login',
    });
    return;
  }

  // Check Redis blacklist — covers tokens invalidated via logout
  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      res.status(401).json({
        error: 'token_invalid',
        message: 'This session has been invalidated. Please log in again.',
        redirectTo: '/login',
      });
      return;
    }
  } catch {
    // If Redis is unavailable, fall through to JWT verification.
    // This is a graceful degradation — the token signature still protects the route.
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    // Store the JWT payload as req.user — cast needed since Express.User is the domain User type
    req.user = payload as unknown as Express.User;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'token_expired',
        message: 'Your session has expired. Please log in again.',
        redirectTo: '/login',
      });
    } else {
      res.status(401).json({
        error: 'token_invalid',
        message: 'Invalid authentication token.',
        redirectTo: '/login',
      });
    }
  }
}
