import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import passport from 'passport';
import { authenticateToken } from '../middleware/authenticate';
import {
  register,
  login,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
  signToken,
  AuthError,
} from '../services/authService';
import { env } from '../config/env';
import { User } from '../types';

export const authRouter = Router();

// ── Validation helpers ───────────────────────────────────────────────────────

const emailValidation = body('email')
  .isEmail()
  .withMessage('A valid email address is required.')
  .normalizeEmail();

const passwordValidation = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters.');

/**
 * Send a 422 response with validation errors if any exist.
 * Returns true if there were errors (caller should return early).
 */
function handleValidationErrors(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({
      error: 'validation_error',
      message: 'Request validation failed.',
      details: errors.array(),
    });
    return true;
  }
  return false;
}

/**
 * Wrap an AuthError into the appropriate HTTP response.
 */
function handleAuthError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof AuthError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
  } else {
    next(err);
  }
}

// ── POST /auth/register ──────────────────────────────────────────────────────

/**
 * Register a new user with email and password.
 *
 * Body: { email: string, password: string }
 * Success 201: { userId: string, token: string }
 * Error 409: { error: "email_in_use" }
 * Error 422: validation errors
 */
authRouter.post(
  '/register',
  [emailValidation, passwordValidation],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { email, password } = req.body as { email: string; password: string };
      const result = await register(email, password);
      res.status(201).json(result);
    } catch (err) {
      handleAuthError(err, res, next);
    }
  },
);

// ── POST /auth/login ─────────────────────────────────────────────────────────

/**
 * Authenticate with email and password.
 *
 * Body: { email: string, password: string }
 * Success 200: { token: string }
 * Error 401: { error: "invalid_credentials" } — no field disclosure
 * Error 422: validation errors
 */
authRouter.post(
  '/login',
  [emailValidation, passwordValidation],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { email, password } = req.body as { email: string; password: string };
      const result = await login(email, password);
      res.status(200).json(result);
    } catch (err) {
      handleAuthError(err, res, next);
    }
  },
);

// ── POST /auth/logout ────────────────────────────────────────────────────────

/**
 * Invalidate the current session token.
 * Requires a valid Bearer token in the Authorization header.
 *
 * Success 204: (no body)
 */
authRouter.post(
  '/logout',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

      if (token) {
        await logout(token);
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /auth/password-reset/request ────────────────────────────────────────

/**
 * Request a password reset email.
 *
 * Body: { email: string }
 * Success 200: { message: "If that email is registered, a reset link has been sent." }
 *
 * Always returns 200 regardless of whether the email exists (prevents
 * email enumeration).
 */
authRouter.post(
  '/password-reset/request',
  [emailValidation],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { email } = req.body as { email: string };
      await requestPasswordReset(email);

      // Always return the same response to prevent email enumeration
      res.status(200).json({
        message: 'If that email is registered, a reset link has been sent.',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /auth/password-reset/confirm ────────────────────────────────────────

/**
 * Confirm a password reset using the token from the email link.
 *
 * Body: { token: string, newPassword: string }
 * Success 200: { message: "Password updated successfully." }
 * Error 400: { error: "reset_token_expired" }
 * Error 422: validation errors
 */
authRouter.post(
  '/password-reset/confirm',
  [
    body('token').notEmpty().withMessage('Reset token is required.'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters.'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };
      await confirmPasswordReset(token, newPassword);
      res.status(200).json({ message: 'Password updated successfully.' });
    } catch (err) {
      handleAuthError(err, res, next);
    }
  },
);

// ── GET /auth/google ─────────────────────────────────────────────────────────

/**
 * Initiate Google OAuth 2.0 login flow.
 * Redirects the browser to Google's consent screen.
 */
authRouter.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false }),
);

// ── GET /auth/google/callback ────────────────────────────────────────────────

/**
 * Google OAuth 2.0 callback.
 *
 * On success: issues a JWT and redirects to CLIENT_URL/auth/callback?token=<jwt>
 * so the React client can store the token.
 *
 * On failure: redirects to CLIENT_URL/login?error=oauth_failed
 */
authRouter.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${env.CLIENT_URL}/login?error=oauth_failed`,
  }),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User | undefined;

      if (!user) {
        res.redirect(`${env.CLIENT_URL}/login?error=oauth_failed`);
        return;
      }

      const token = signToken(user.id);
      res.redirect(`${env.CLIENT_URL}/auth/callback?token=${encodeURIComponent(token)}`);
    } catch (err) {
      next(err);
    }
  },
);
