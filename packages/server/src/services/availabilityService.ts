import { AvailabilityResponse } from '../types';
import {
  findResponseById,
  findResponseByUserAndDate,
  findAvailableUserIds,
  createResponse,
  updateResponse as repoUpdateResponse,
  lockResponsesForDate,
} from '../repositories/availabilityRepository';

/**
 * Business logic layer for the availability system ("ShowUpToday?").
 *
 * Requirements: 4.3, 4.4, 4.7, 4.8
 */

// ── Custom errors ────────────────────────────────────────────────────────────

export class AvailabilityError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AvailabilityError';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return today's date as a YYYY-MM-DD string in UTC.
 */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Service methods ──────────────────────────────────────────────────────────

/**
 * Record a Yes/No availability response for the authenticated user.
 *
 * - One response per user per day is enforced (UNIQUE constraint on user_id, date).
 * - If a response already exists for today, throws AvailabilityError with
 *   code "response_already_exists" (409).
 * - sportIds is optional; an empty array means "all preferred sports".
 *
 * Requirements: 4.3, 4.4, 4.8
 */
export async function recordResponse(
  userId: string,
  available: boolean,
  sportIds: string[] = [],
): Promise<AvailabilityResponse> {
  const date = todayUTC();

  // Enforce one response per user per day
  const existing = await findResponseByUserAndDate(userId, date);
  if (existing) {
    throw new AvailabilityError(
      'response_already_exists',
      'You have already submitted an availability response for today.',
      409,
    );
  }

  return createResponse(userId, date, available, sportIds);
}

/**
 * Update an existing availability response before matching runs.
 *
 * - Verifies the response belongs to the authenticated user (403 if not).
 * - Rejects updates if the response is locked for matching (400).
 * - Returns the updated response.
 *
 * Requirements: 4.7
 */
export async function updateResponse(
  responseId: string,
  userId: string,
  available: boolean,
  sportIds: string[] = [],
): Promise<AvailabilityResponse> {
  const existing = await findResponseById(responseId);

  if (!existing) {
    throw new AvailabilityError('response_not_found', 'Availability response not found.', 404);
  }

  // Ownership check
  if (existing.userId !== userId) {
    throw new AvailabilityError(
      'forbidden',
      'You are not allowed to update this availability response.',
      403,
    );
  }

  // Lock check — reject if matching has already locked this response
  if (existing.lockedForMatching) {
    throw new AvailabilityError(
      'response_locked',
      'This availability response has been locked for matching and can no longer be changed.',
      400,
    );
  }

  const updated = await repoUpdateResponse(responseId, available, sportIds);
  if (!updated) {
    throw new AvailabilityError('response_not_found', 'Availability response not found.', 404);
  }

  return updated;
}

/**
 * Return the current day's availability response for the given user.
 * Returns null if the user has not yet responded today.
 *
 * Requirements: 4.3, 4.8
 */
export async function getTodayResponse(userId: string): Promise<AvailabilityResponse | null> {
  const date = todayUTC();
  return findResponseByUserAndDate(userId, date);
}

/**
 * Return the user IDs of all users marked available on the given date,
 * optionally filtered to those who selected a specific sport.
 *
 * Used by the matching engine.
 */
export async function getAvailableUsers(date: Date, sportId?: string): Promise<string[]> {
  const dateStr = date.toISOString().slice(0, 10);
  return findAvailableUserIds(dateStr, sportId);
}

/**
 * Lock all availability responses for the given date so they can no longer
 * be changed. Called by the matching engine before it runs.
 *
 * Requirements: 4.7
 */
export async function lockResponsesForMatching(date: Date): Promise<void> {
  const dateStr = date.toISOString().slice(0, 10);
  return lockResponsesForDate(dateStr);
}
