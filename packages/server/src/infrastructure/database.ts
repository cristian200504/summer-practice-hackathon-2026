import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env';

let pool: Pool | null = null;

/**
 * Initialise the PostgreSQL connection pool.
 * Called once at server startup.
 */
export async function connectDatabase(): Promise<void> {
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Verify connectivity
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.info('[database] PostgreSQL connection pool established');
  } catch (err) {
    console.error('[database] Failed to connect to PostgreSQL:', err);
    throw err;
  }

  pool.on('error', (err: Error) => {
    console.error('[database] Unexpected PostgreSQL pool error:', err);
  });
}

/**
 * Returns the active connection pool.
 * Throws if the pool has not been initialised.
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool is not initialised. Call connectDatabase() first.');
  }
  return pool;
}

/**
 * Execute a parameterised query against the pool.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/**
 * Acquire a client from the pool for use in a transaction.
 * The caller is responsible for releasing the client.
 */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/**
 * Execute a callback inside a database transaction.
 * Automatically commits on success and rolls back on error.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Gracefully close the connection pool.
 * Called during server shutdown.
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.info('[database] PostgreSQL connection pool closed');
  }
}
