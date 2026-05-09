import { PoolClient } from 'pg';
import { query, withTransaction } from '../infrastructure/database';
import { AvailabilityResponse } from '../types';

/**
 * Data access layer for the `availability_responses` and
 * `availability_sport_selections` tables.
 * All queries are parameterised to prevent SQL injection.
 */

// ── Row types ────────────────────────────────────────────────────────────────

interface AvailabilityResponseRow {
  id: string;
  user_id: string;
  date: string; // DATE comes back as a string from pg
  available: boolean;
  locked_for_matching: boolean;
  created_at: Date;
  updated_at: Date;
}

interface SportSelectionRow {
  sport_id: string;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapResponse(row: AvailabilityResponseRow, sportIds: string[]): AvailabilityResponse {
  return {
    id: row.id,
    userId: row.user_id,
    // pg returns DATE columns as 'YYYY-MM-DD' strings; normalise just in case
    date: typeof row.date === 'string' ? row.date.slice(0, 10) : row.date,
    available: row.available,
    lockedForMatching: row.locked_for_matching,
    sportIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Sport selection helpers ──────────────────────────────────────────────────

/**
 * Fetch all sport IDs associated with an availability response.
 */
async function fetchSportIds(responseId: string, client?: PoolClient): Promise<string[]> {
  const result = client
    ? await client.query<SportSelectionRow>(
        `SELECT sport_id FROM availability_sport_selections WHERE availability_response_id = $1`,
        [responseId],
      )
    : await query<SportSelectionRow>(
        `SELECT sport_id FROM availability_sport_selections WHERE availability_response_id = $1`,
        [responseId],
      );
  return result.rows.map((r) => r.sport_id);
}

/**
 * Replace all sport selections for a response within a transaction.
 * Deletes existing entries and inserts the new set.
 */
async function replaceSportSelections(
  responseId: string,
  sportIds: string[],
  client: PoolClient,
): Promise<void> {
  await client.query(
    `DELETE FROM availability_sport_selections WHERE availability_response_id = $1`,
    [responseId],
  );

  for (const sportId of sportIds) {
    await client.query(
      `INSERT INTO availability_sport_selections (availability_response_id, sport_id)
       VALUES ($1, $2)`,
      [responseId, sportId],
    );
  }
}

// ── Read queries ─────────────────────────────────────────────────────────────

/**
 * Find an availability response by its ID.
 * Returns null if not found.
 */
export async function findResponseById(responseId: string): Promise<AvailabilityResponse | null> {
  const result = await query<AvailabilityResponseRow>(
    `SELECT id, user_id, date, available, locked_for_matching, created_at, updated_at
     FROM availability_responses
     WHERE id = $1
     LIMIT 1`,
    [responseId],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const sportIds = await fetchSportIds(row.id);
  return mapResponse(row, sportIds);
}

/**
 * Find the availability response for a user on a specific date (YYYY-MM-DD).
 * Returns null if no response exists for that day.
 */
export async function findResponseByUserAndDate(
  userId: string,
  date: string,
): Promise<AvailabilityResponse | null> {
  const result = await query<AvailabilityResponseRow>(
    `SELECT id, user_id, date, available, locked_for_matching, created_at, updated_at
     FROM availability_responses
     WHERE user_id = $1 AND date = $2
     LIMIT 1`,
    [userId, date],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const sportIds = await fetchSportIds(row.id);
  return mapResponse(row, sportIds);
}

/**
 * Find all user IDs that are marked available on a given date,
 * optionally filtered to those who selected a specific sport.
 */
export async function findAvailableUserIds(date: string, sportId?: string): Promise<string[]> {
  if (sportId) {
    const result = await query<{ user_id: string }>(
      `SELECT ar.user_id
       FROM availability_responses ar
       JOIN availability_sport_selections ass ON ass.availability_response_id = ar.id
       WHERE ar.date = $1
         AND ar.available = TRUE
         AND ass.sport_id = $2`,
      [date, sportId],
    );
    return result.rows.map((r) => r.user_id);
  }

  const result = await query<{ user_id: string }>(
    `SELECT user_id
     FROM availability_responses
     WHERE date = $1 AND available = TRUE`,
    [date],
  );
  return result.rows.map((r) => r.user_id);
}

// ── Write queries ────────────────────────────────────────────────────────────

/**
 * Create a new availability response for a user.
 * Wraps the insert and sport-selection inserts in a transaction.
 */
export async function createResponse(
  userId: string,
  date: string,
  available: boolean,
  sportIds: string[],
): Promise<AvailabilityResponse> {
  return withTransaction(async (client) => {
    const result = await client.query<AvailabilityResponseRow>(
      `INSERT INTO availability_responses (user_id, date, available)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, date, available, locked_for_matching, created_at, updated_at`,
      [userId, date, available],
    );

    const row = result.rows[0];

    if (sportIds.length > 0) {
      await replaceSportSelections(row.id, sportIds, client);
    }

    return mapResponse(row, sportIds);
  });
}

/**
 * Update an existing availability response.
 * Replaces sport selections atomically.
 * Returns null if the response was not found.
 */
export async function updateResponse(
  responseId: string,
  available: boolean,
  sportIds: string[],
): Promise<AvailabilityResponse | null> {
  return withTransaction(async (client) => {
    const result = await client.query<AvailabilityResponseRow>(
      `UPDATE availability_responses
       SET available = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, user_id, date, available, locked_for_matching, created_at, updated_at`,
      [available, responseId],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    await replaceSportSelections(row.id, sportIds, client);

    return mapResponse(row, sportIds);
  });
}

/**
 * Lock all availability responses for a given date so they cannot be changed.
 * Called by the matching engine before it runs.
 */
export async function lockResponsesForDate(date: string): Promise<void> {
  await query(
    `UPDATE availability_responses
     SET locked_for_matching = TRUE, updated_at = NOW()
     WHERE date = $1`,
    [date],
  );
}
