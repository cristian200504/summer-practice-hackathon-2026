import { createClient, RedisClientType } from 'redis';
import { env } from '../config/env';

let client: RedisClientType | null = null;
let subscriber: RedisClientType | null = null;

/**
 * Initialise the Redis client and a dedicated pub/sub subscriber client.
 * Called once at server startup.
 */
export async function connectRedis(): Promise<void> {
  client = createClient({ url: env.REDIS_URL }) as RedisClientType;
  subscriber = createClient({ url: env.REDIS_URL }) as RedisClientType;

  client.on('error', (err: Error) => {
    console.error('[redis] Client error:', err);
  });

  subscriber.on('error', (err: Error) => {
    console.error('[redis] Subscriber error:', err);
  });

  try {
    await client.connect();
    await subscriber.connect();
    console.info('[redis] Redis clients connected');
  } catch (err) {
    console.error('[redis] Failed to connect to Redis:', err);
    throw err;
  }
}

/**
 * Returns the active Redis client.
 * Throws if the client has not been initialised.
 */
export function getRedisClient(): RedisClientType {
  if (!client) {
    throw new Error('Redis client is not initialised. Call connectRedis() first.');
  }
  return client;
}

/**
 * Returns the dedicated pub/sub subscriber client.
 * Throws if the client has not been initialised.
 */
export function getRedisSubscriber(): RedisClientType {
  if (!subscriber) {
    throw new Error('Redis subscriber is not initialised. Call connectRedis() first.');
  }
  return subscriber;
}

/**
 * Set a key with an optional TTL (in seconds).
 */
export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const redis = getRedisClient();
  if (ttlSeconds !== undefined) {
    await redis.set(key, value, { EX: ttlSeconds });
  } else {
    await redis.set(key, value);
  }
}

/**
 * Get a value by key. Returns null if the key does not exist.
 */
export async function redisGet(key: string): Promise<string | null> {
  return getRedisClient().get(key);
}

/**
 * Delete one or more keys.
 */
export async function redisDel(...keys: string[]): Promise<void> {
  await getRedisClient().del(keys);
}

/**
 * Publish a message to a Redis channel.
 */
export async function redisPublish(channel: string, message: string): Promise<void> {
  await getRedisClient().publish(channel, message);
}

/**
 * Subscribe to a Redis channel.
 */
export async function redisSubscribe(
  channel: string,
  handler: (message: string) => void,
): Promise<void> {
  await getRedisSubscriber().subscribe(channel, handler);
}

/**
 * Gracefully close both Redis clients.
 * Called during server shutdown.
 */
export async function closeRedis(): Promise<void> {
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
  if (client) {
    await client.quit();
    client = null;
  }
  console.info('[redis] Redis clients closed');
}
