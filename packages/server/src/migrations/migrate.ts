/**
 * Simple sequential SQL migration runner.
 *
 * Usage:
 *   npx ts-node src/migrations/migrate.ts
 *
 * Reads all *.sql files in this directory in lexicographic order and executes
 * each one inside a transaction. A `schema_migrations` table tracks which
 * files have already been applied so re-running is safe (idempotent).
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

// Load env vars before importing the pool so DATABASE_URL is available.
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[migrate] ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function ensureMigrationsTable(client: import('pg').PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client: import('pg').PoolClient): Promise<Set<string>> {
  const result = await client.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename',
  );
  return new Set(result.rows.map((r) => r.filename));
}

async function runMigrations(): Promise<void> {
  const migrationsDir = path.resolve(__dirname);

  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic order — 001_... before 002_...

  if (sqlFiles.length === 0) {
    console.info('[migrate] No SQL migration files found.');
    return;
  }

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    for (const filename of sqlFiles) {
      if (applied.has(filename)) {
        console.info(`[migrate] Skipping (already applied): ${filename}`);
        continue;
      }

      const filePath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.info(`[migrate] Applying: ${filename}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename],
        );
        await client.query('COMMIT');
        console.info(`[migrate] Applied:  ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] FAILED:   ${filename}`, err);
        throw err;
      }
    }

    console.info('[migrate] All migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('[migrate] Unhandled error:', err);
  process.exit(1);
});
