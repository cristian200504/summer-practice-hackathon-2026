import { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { getRedisSubscriber, redisPublish } from './redis';

/**
 * WebSocket server with JWT authentication and Redis pub/sub fan-out.
 *
 * - Authenticates connections via JWT in the `Authorization` header or
 *   `token` query parameter.
 * - Organises clients into rooms keyed by `group:{groupId}`.
 * - Uses Redis pub/sub to fan out messages across multiple server instances.
 *
 * Requirements: 20.2
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  rooms: Set<string>;
  isAlive: boolean;
}

interface WsMessage {
  type: string;
  room?: string;
  payload?: unknown;
}

// ── State ─────────────────────────────────────────────────────────────────────

let wss: WebSocketServer | null = null;

/** Map from room name → set of connected clients in that room */
const rooms = new Map<string, Set<AuthenticatedWebSocket>>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractToken(req: IncomingMessage): string | null {
  // Try Authorization header first
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  // Fall back to query param ?token=
  const url = new URL(req.url ?? '', `http://localhost`);
  return url.searchParams.get('token');
}

function verifyToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

function joinRoom(client: AuthenticatedWebSocket, room: string): void {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room)!.add(client);
  client.rooms.add(room);
}

function leaveRoom(client: AuthenticatedWebSocket, room: string): void {
  rooms.get(room)?.delete(client);
  if (rooms.get(room)?.size === 0) rooms.delete(room);
  client.rooms.delete(room);
}

function leaveAllRooms(client: AuthenticatedWebSocket): void {
  for (const room of client.rooms) {
    leaveRoom(client, room);
  }
}

/** Broadcast a message to all clients in a room (local instance only). */
function broadcastToRoom(room: string, message: string, excludeClient?: WebSocket): void {
  const clients = rooms.get(room);
  if (!clients) return;
  for (const client of clients) {
    if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// ── Redis pub/sub fan-out ─────────────────────────────────────────────────────

const REDIS_WS_CHANNEL = 'ws:broadcast';

/**
 * Subscribe to the Redis broadcast channel so messages published by other
 * server instances are delivered to local clients.
 */
async function subscribeToRedis(): Promise<void> {
  try {
    await getRedisSubscriber().subscribe(REDIS_WS_CHANNEL, (message: string) => {
      try {
        const { room, data } = JSON.parse(message) as { room: string; data: string };
        broadcastToRoom(room, data);
      } catch {
        // Malformed message — ignore
      }
    });
    console.info('[websocket] Subscribed to Redis broadcast channel');
  } catch (err) {
    console.error('[websocket] Failed to subscribe to Redis:', err);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Publish a message to a room across all server instances via Redis pub/sub.
 * Also broadcasts locally to avoid the round-trip for single-instance setups.
 */
export async function publishToRoom(room: string, message: WsMessage): Promise<void> {
  const data = JSON.stringify(message);
  // Broadcast locally
  broadcastToRoom(room, data);
  // Fan out via Redis for multi-instance deployments
  try {
    await redisPublish(REDIS_WS_CHANNEL, JSON.stringify({ room, data }));
  } catch (err) {
    console.error('[websocket] Redis publish failed:', err);
  }
}

/**
 * Attach the WebSocket server to an existing HTTP server.
 * Call once at startup after `app.listen()`.
 *
 * Requirements: 20.2
 */
export function attachWebSocketServer(httpServer: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server: httpServer });

  // Heartbeat interval to detect stale connections
  const heartbeat = setInterval(() => {
    wss?.clients.forEach((rawClient) => {
      const client = rawClient as AuthenticatedWebSocket;
      if (!client.isAlive) {
        leaveAllRooms(client);
        client.terminate();
        return;
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (rawSocket: WebSocket, req: IncomingMessage) => {
    const client = rawSocket as AuthenticatedWebSocket;

    // Authenticate
    const token = extractToken(req);
    if (!token) {
      client.close(4001, 'Authentication required');
      return;
    }
    const auth = verifyToken(token);
    if (!auth) {
      client.close(4001, 'Invalid or expired token');
      return;
    }

    client.userId = auth.userId;
    client.rooms = new Set();
    client.isAlive = true;

    client.on('pong', () => { client.isAlive = true; });

    client.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;

        if (msg.type === 'join' && msg.room) {
          joinRoom(client, msg.room);
          client.send(JSON.stringify({ type: 'joined', room: msg.room }));
        } else if (msg.type === 'leave' && msg.room) {
          leaveRoom(client, msg.room);
        }
        // Other message types are handled by feature-specific services
      } catch {
        // Malformed message — ignore
      }
    });

    client.on('close', () => {
      leaveAllRooms(client);
    });

    client.on('error', (err) => {
      console.error(`[websocket] Client error (user ${client.userId}):`, err);
      leaveAllRooms(client);
    });
  });

  // Subscribe to Redis for multi-instance fan-out
  void subscribeToRedis();

  console.info('[websocket] WebSocket server attached');
  return wss;
}

export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}
