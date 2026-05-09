import { PoolClient } from 'pg';
import { query } from '../infrastructure/database';
import { User } from '../types';

/**
 * Data access layer for the `users` table.
 * All queries are parameterised to prevent SQL injection.
 */

/**
 * Find a user by their email address.
 * Returns null if no user exists with that email.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await query<{
    id: string;
    email: string;
    password_hash: string | null;
    oauth_provider: string | null;
    oauth_id: string | null;
    created_at: Date;
  }>(
    `SELECT id, email, password_hash, oauth_provider, oauth_id, created_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email.toLowerCase()],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    oauthProvider: row.oauth_provider,
    oauthId: row.oauth_id,
    createdAt: row.created_at,
  };
}

/**
 * Find a user by their UUID.
 * Returns null if no user exists with that ID.
 */
export async function findUserById(id: string): Promise<User | null> {
  const result = await query<{
    id: string;
    email: string;
    password_hash: string | null;
    oauth_provider: string | null;
    oauth_id: string | null;
    created_at: Date;
  }>(
    `SELECT id, email, password_hash, oauth_provider, oauth_id, created_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    oauthProvider: row.oauth_provider,
    oauthId: row.oauth_id,
    createdAt: row.created_at,
  };
}

/**
 * Create a new user with an email and hashed password.
 * Returns the newly created user.
 */
export async function createUser(email: string, passwordHash: string): Promise<User> {
  const result = await query<{
    id: string;
    email: string;
    password_hash: string | null;
    oauth_provider: string | null;
    oauth_id: string | null;
    created_at: Date;
  }>(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, password_hash, oauth_provider, oauth_id, created_at`,
    [email.toLowerCase(), passwordHash],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    oauthProvider: row.oauth_provider,
    oauthId: row.oauth_id,
    createdAt: row.created_at,
  };
}

/**
 * Create a new OAuth user (no password hash).
 * Returns the newly created user.
 */
export async function createOAuthUser(
  email: string,
  oauthProvider: string,
  oauthId: string,
): Promise<User> {
  const result = await query<{
    id: string;
    email: string;
    password_hash: string | null;
    oauth_provider: string | null;
    oauth_id: string | null;
    created_at: Date;
  }>(
    `INSERT INTO users (email, oauth_provider, oauth_id)
     VALUES ($1, $2, $3)
     RETURNING id, email, password_hash, oauth_provider, oauth_id, created_at`,
    [email.toLowerCase(), oauthProvider, oauthId],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    oauthProvider: row.oauth_provider,
    oauthId: row.oauth_id,
    createdAt: row.created_at,
  };
}

/**
 * Find a user by OAuth provider and provider-specific ID.
 * Returns null if no matching user exists.
 */
export async function findUserByOAuth(
  oauthProvider: string,
  oauthId: string,
): Promise<User | null> {
  const result = await query<{
    id: string;
    email: string;
    password_hash: string | null;
    oauth_provider: string | null;
    oauth_id: string | null;
    created_at: Date;
  }>(
    `SELECT id, email, password_hash, oauth_provider, oauth_id, created_at
     FROM users
     WHERE oauth_provider = $1 AND oauth_id = $2
     LIMIT 1`,
    [oauthProvider, oauthId],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    oauthProvider: row.oauth_provider,
    oauthId: row.oauth_id,
    createdAt: row.created_at,
  };
}

/**
 * Update a user's password hash.
 * Used during password reset confirmation.
 */
export async function updatePasswordHash(
  userId: string,
  passwordHash: string,
  client?: PoolClient,
): Promise<void> {
  if (client) {
    await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      passwordHash,
      userId,
    ]);
  } else {
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, userId]);
  }
}
