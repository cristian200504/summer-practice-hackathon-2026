/**
 * Centralised environment variable configuration.
 * All env vars are validated at startup — the server will not start if required
 * variables are missing or malformed.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  // ── Server ───────────────────────────────────────────────────────────────────
  NODE_ENV: optionalEnv('NODE_ENV', 'development') as 'development' | 'production' | 'test',
  PORT: parseInt(optionalEnv('PORT', '3001'), 10),
  CLIENT_URL: optionalEnv('CLIENT_URL', 'http://localhost:5173'),

  // ── Database (PostgreSQL) ────────────────────────────────────────────────────
  DATABASE_URL: requireEnv('DATABASE_URL'),
  DB_POOL_MIN: parseInt(optionalEnv('DB_POOL_MIN', '2'), 10),
  DB_POOL_MAX: parseInt(optionalEnv('DB_POOL_MAX', '10'), 10),

  // ── Redis ────────────────────────────────────────────────────────────────────
  REDIS_URL: requireEnv('REDIS_URL'),

  // ── Authentication ───────────────────────────────────────────────────────────
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: optionalEnv('JWT_EXPIRES_IN', '7d'),
  BCRYPT_COST: parseInt(optionalEnv('BCRYPT_COST', '12'), 10),

  // ── OAuth ────────────────────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: optionalEnv('GOOGLE_CLIENT_ID', ''),
  GOOGLE_CLIENT_SECRET: optionalEnv('GOOGLE_CLIENT_SECRET', ''),
  GOOGLE_CALLBACK_URL: optionalEnv('GOOGLE_CALLBACK_URL', 'http://localhost:3001/auth/google/callback'),

  // ── Web Push (VAPID) ─────────────────────────────────────────────────────────
  VAPID_PUBLIC_KEY: optionalEnv('VAPID_PUBLIC_KEY', ''),
  VAPID_PRIVATE_KEY: optionalEnv('VAPID_PRIVATE_KEY', ''),
  VAPID_SUBJECT: optionalEnv('VAPID_SUBJECT', 'mailto:admin@showup2move.com'),

  // ── External APIs ────────────────────────────────────────────────────────────
  OPENAI_API_KEY: optionalEnv('OPENAI_API_KEY', ''),
  GOOGLE_PLACES_API_KEY: optionalEnv('GOOGLE_PLACES_API_KEY', ''),
  OPENWEATHERMAP_API_KEY: optionalEnv('OPENWEATHERMAP_API_KEY', ''),
  GOOGLE_CALENDAR_CLIENT_ID: optionalEnv('GOOGLE_CALENDAR_CLIENT_ID', ''),
  GOOGLE_CALENDAR_CLIENT_SECRET: optionalEnv('GOOGLE_CALENDAR_CLIENT_SECRET', ''),

  // ── File uploads ─────────────────────────────────────────────────────────────
  UPLOAD_DIR: optionalEnv('UPLOAD_DIR', './uploads'),
  MAX_FILE_SIZE_BYTES: parseInt(optionalEnv('MAX_FILE_SIZE_BYTES', '5242880'), 10), // 5 MB

  // ── Cron schedules ───────────────────────────────────────────────────────────
  AVAILABILITY_PROMPT_CRON: optionalEnv('AVAILABILITY_PROMPT_CRON', '0 8 * * *'),
  MATCHING_ENGINE_CRON: optionalEnv('MATCHING_ENGINE_CRON', '0 12 * * *'),

  // ── Matching ─────────────────────────────────────────────────────────────────
  DEFAULT_PROXIMITY_KM: parseInt(optionalEnv('DEFAULT_PROXIMITY_KM', '10'), 10),

  // ── Chatbot microservice ──────────────────────────────────────────────────────
  CHATBOT_SERVICE_URL: optionalEnv('CHATBOT_SERVICE_URL', 'http://localhost:8000'),
} as const;

export type Env = typeof env;
