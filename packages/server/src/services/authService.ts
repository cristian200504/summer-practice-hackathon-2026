import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { redisSet, redisGet, redisDel } from '../infrastructure/redis';
import {
  findUserByEmail,
  findUserById,
  createUser,
  updatePasswordHash,
} from '../repositories/userRepository';

// ── Constants ────────────────────────────────────────────────────────────────

const PASSWORD_RESET_TTL_SECONDS = 60 * 60; // 1 hour
const RESET_TOKEN_PREFIX = 'pwd_reset:';
const SESSION_BLACKLIST_PREFIX = 'session_blacklist:';

// ── Custom errors ────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sign a JWT for the given userId.
 * Expiry is controlled by JWT_EXPIRES_IN env var (default: 7d).
 */
export function signToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Validate that a password meets the minimum length requirement (≥ 8 chars).
 */
function validatePasswordStrength(password: string): void {
  if (password.length < 8) {
    throw new AuthError('password_too_short', 'Password must be at least 8 characters.', 400);
  }
}

// ── AuthService ──────────────────────────────────────────────────────────────

/**
 * Register a new user with email and password.
 *
 * - Validates email uniqueness
 * - Hashes password with bcrypt at cost factor from BCRYPT_COST env var (≥ 12)
 * - Issues a JWT valid for 7 days
 *
 * Throws AuthError with code "email_in_use" if the email is already registered.
 */
export async function register(
  email: string,
  password: string,
): Promise<{ userId: string; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  validatePasswordStrength(password);

  // Check email uniqueness
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new AuthError('email_in_use', 'This email address is already registered.', 409);
  }

  // Hash password — cost factor is at least 12 per requirements
  const costFactor = Math.max(env.BCRYPT_COST, 12);
  const passwordHash = await bcrypt.hash(password, costFactor);

  const user = await createUser(normalizedEmail, passwordHash);
  const token = signToken(user.id);

  return { userId: user.id, token };
}

/**
 * Authenticate a user with email and password.
 *
 * Returns a JWT on success.
 * Throws AuthError with code "invalid_credentials" on failure — intentionally
 * does not reveal which field (email or password) is wrong (Req 1.6).
 */
export async function login(email: string, password: string): Promise<{ token: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await findUserByEmail(normalizedEmail);

  // Constant-time comparison: always run bcrypt even when user not found
  // to prevent timing-based email enumeration attacks.
  const dummyHash = '$2b$12$invalidhashfortimingprotection000000000000000000000000';
  const hashToCompare = user?.passwordHash ?? dummyHash;

  const passwordMatches = await bcrypt.compare(password, hashToCompare);

  if (!user || !passwordMatches || !user.passwordHash) {
    throw new AuthError(
      'invalid_credentials',
      'Invalid email or password.',
      401,
    );
  }

  const token = signToken(user.id);
  return { token };
}

/**
 * Invalidate a session token by adding it to a Redis blacklist.
 * The blacklist entry expires when the token itself would have expired.
 *
 * Protected routes should check the blacklist via the authenticate middleware.
 */
export async function logout(token: string): Promise<void> {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (decoded?.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redisSet(`${SESSION_BLACKLIST_PREFIX}${token}`, '1', ttl);
      }
    }
  } catch {
    // If decoding fails, the token is already invalid — nothing to blacklist.
  }
}

/**
 * Check whether a token has been blacklisted (logged out).
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const value = await redisGet(`${SESSION_BLACKLIST_PREFIX}${token}`);
  return value !== null;
}

/**
 * Generate a time-limited password reset token and store it in Redis.
 *
 * For the hackathon prototype, the reset link is logged to the console
 * instead of being sent via email.
 *
 * Silently succeeds even if the email is not registered (prevents email
 * enumeration — callers should not reveal whether the email exists).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    // Do not reveal whether the email is registered
    return;
  }

  const resetToken = uuidv4();
  const redisKey = `${RESET_TOKEN_PREFIX}${resetToken}`;

  // Store userId → token mapping with 1-hour TTL
  await redisSet(redisKey, user.id, PASSWORD_RESET_TTL_SECONDS);

  // In production this would send an email. For the hackathon prototype,
  // log the reset link to the console.
  const resetLink = `${env.CLIENT_URL}/reset-password?token=${resetToken}`;
  console.info(`[auth] Password reset link for ${normalizedEmail}: ${resetLink}`);
}

/**
 * Validate a password reset token and update the user's password.
 *
 * Throws AuthError with code "reset_token_expired" if the token is invalid
 * or has expired.
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  validatePasswordStrength(newPassword);

  const redisKey = `${RESET_TOKEN_PREFIX}${token}`;
  const userId = await redisGet(redisKey);

  if (!userId) {
    throw new AuthError(
      'reset_token_expired',
      'This password reset link is invalid or has expired.',
      400,
    );
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new AuthError(
      'reset_token_expired',
      'This password reset link is invalid or has expired.',
      400,
    );
  }

  const costFactor = Math.max(env.BCRYPT_COST, 12);
  const passwordHash = await bcrypt.hash(newPassword, costFactor);

  await updatePasswordHash(userId, passwordHash);

  // Invalidate the reset token immediately after use
  await redisDel(redisKey);
}

/**
 * Validate a JWT and return the userId it encodes.
 * Throws AuthError with code "token_expired" or "token_invalid" on failure.
 */
export async function validateToken(token: string): Promise<{ userId: string }> {
  // Check blacklist first
  const blacklisted = await isTokenBlacklisted(token);
  if (blacklisted) {
    throw new AuthError('token_invalid', 'This session has been invalidated.', 401);
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    return { userId: payload.userId };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthError('token_expired', 'Your session has expired. Please log in again.', 401);
    }
    throw new AuthError('token_invalid', 'Invalid authentication token.', 401);
  }
}
