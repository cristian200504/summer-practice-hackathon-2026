import { PoolClient } from 'pg';
import { query } from '../infrastructure/database';
import { Profile, UserSport, Sport, SkillLevel } from '../types';

/**
 * Data access layer for the `profiles` and `user_sports` tables.
 * All queries are parameterised to prevent SQL injection.
 */

// ── Row types ────────────────────────────────────────────────────────────────

interface ProfileRow {
  id: string;
  user_id: string;
  display_name: string;
  bio: string;
  photo_url: string | null;
  thumbnail_url: string | null;
  is_complete: boolean;
  updated_at: Date;
}

interface UserSportRow {
  id: string;
  user_id: string;
  sport_id: string;
  skill_level: SkillLevel | null;
}

interface SportRow {
  id: string;
  name: string;
  min_group_size: number;
  max_group_size: number;
  is_team_sport: boolean;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    photoUrl: row.photo_url,
    thumbnailUrl: row.thumbnail_url,
    isComplete: row.is_complete,
    updatedAt: row.updated_at,
  };
}

function mapSport(row: SportRow): Sport {
  return {
    id: row.id,
    name: row.name,
    minGroupSize: row.min_group_size,
    maxGroupSize: row.max_group_size,
    isTeamSport: row.is_team_sport,
  };
}

function mapUserSport(row: UserSportRow): UserSport {
  return {
    id: row.id,
    userId: row.user_id,
    sportId: row.sport_id,
    skillLevel: row.skill_level,
  };
}

// ── Profile queries ──────────────────────────────────────────────────────────

/**
 * Find a profile by the owning user's ID.
 * Returns null if no profile exists for that user.
 */
export async function findProfileByUserId(userId: string): Promise<Profile | null> {
  const result = await query<ProfileRow>(
    `SELECT id, user_id, display_name, bio, photo_url, thumbnail_url, is_complete, updated_at
     FROM profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  if (result.rows.length === 0) return null;
  return mapProfile(result.rows[0]);
}

/**
 * Create a new profile for a user.
 * Returns the newly created profile.
 */
export async function createProfile(
  userId: string,
  displayName: string,
  bio: string,
  isComplete: boolean,
  client?: PoolClient,
): Promise<Profile> {
  const result = await (client
    ? client.query<ProfileRow>(
        `INSERT INTO profiles (user_id, display_name, bio, is_complete)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, display_name, bio, photo_url, thumbnail_url, is_complete, updated_at`,
        [userId, displayName, bio, isComplete],
      )
    : query<ProfileRow>(
        `INSERT INTO profiles (user_id, display_name, bio, is_complete)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, display_name, bio, photo_url, thumbnail_url, is_complete, updated_at`,
        [userId, displayName, bio, isComplete],
      ));

  return mapProfile(result.rows[0]);
}

/**
 * Update an existing profile.
 * Only updates fields that are provided (non-undefined).
 * Returns the updated profile, or null if no profile was found.
 */
export async function updateProfile(
  userId: string,
  fields: {
    displayName?: string;
    bio?: string;
    photoUrl?: string | null;
    thumbnailUrl?: string | null;
    isComplete?: boolean;
  },
  client?: PoolClient,
): Promise<Profile | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];
  let idx = 1;

  if (fields.displayName !== undefined) {
    setClauses.push('display_name = $' + idx++);
    params.push(fields.displayName);
  }
  if (fields.bio !== undefined) {
    setClauses.push('bio = $' + idx++);
    params.push(fields.bio);
  }
  if (fields.photoUrl !== undefined) {
    setClauses.push('photo_url = $' + idx++);
    params.push(fields.photoUrl);
  }
  if (fields.thumbnailUrl !== undefined) {
    setClauses.push('thumbnail_url = $' + idx++);
    params.push(fields.thumbnailUrl);
  }
  if (fields.isComplete !== undefined) {
    setClauses.push('is_complete = $' + idx++);
    params.push(fields.isComplete);
  }

  params.push(userId);
  const sql =
    'UPDATE profiles SET ' +
    setClauses.join(', ') +
    ' WHERE user_id = $' +
    idx +
    ' RETURNING id, user_id, display_name, bio, photo_url, thumbnail_url, is_complete, updated_at';

  const result = client
    ? await client.query<ProfileRow>(sql, params)
    : await query<ProfileRow>(sql, params);

  if (result.rows.length === 0) return null;
  return mapProfile(result.rows[0]);
}

// ── UserSport queries ────────────────────────────────────────────────────────

/**
 * Get all sport preferences for a user, including sport details.
 */
export async function findUserSports(
  userId: string,
): Promise<Array<{ userSport: UserSport; sport: Sport }>> {
  const result = await query<UserSportRow & SportRow>(
    `SELECT
       us.id, us.user_id, us.sport_id, us.skill_level,
       s.name, s.min_group_size, s.max_group_size, s.is_team_sport
     FROM user_sports us
     JOIN sports s ON s.id = us.sport_id
     WHERE us.user_id = $1
     ORDER BY s.name`,
    [userId],
  );

  return result.rows.map((row) => ({
    userSport: mapUserSport(row),
    sport: mapSport(row),
  }));
}

/**
 * Replace all sport preferences for a user within a transaction.
 * Deletes existing entries and inserts the new set.
 */
export async function replaceUserSports(
  userId: string,
  sports: Array<{ sportId: string; skillLevel?: SkillLevel }>,
  client: PoolClient,
): Promise<void> {
  await client.query(`DELETE FROM user_sports WHERE user_id = $1`, [userId]);

  for (const { sportId, skillLevel } of sports) {
    await client.query(
      `INSERT INTO user_sports (user_id, sport_id, skill_level)
       VALUES ($1, $2, $3)`,
      [userId, sportId, skillLevel ?? null],
    );
  }
}

/**
 * Check whether all provided sport IDs exist in the sports table.
 * Returns the first invalid sport ID found, or null if all are valid.
 */
export async function findInvalidSportId(sportIds: string[]): Promise<string | null> {
  if (sportIds.length === 0) return null;

  const result = await query<{ id: string }>(
    `SELECT id FROM sports WHERE id = ANY($1::uuid[])`,
    [sportIds],
  );

  const validIds = new Set(result.rows.map((r) => r.id));
  for (const id of sportIds) {
    if (!validIds.has(id)) return id;
  }
  return null;
}
