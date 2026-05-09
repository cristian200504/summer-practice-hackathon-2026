import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './app';
import { connectDatabase } from './infrastructure/database';
import { connectRedis } from './infrastructure/redis';
import { attachWebSocketServer } from './infrastructure/websocket';
import { env } from './config/env';
import { startJobs } from './jobs';

const PORT = env.PORT;

async function bootstrap(): Promise<void> {
  // Connect to infrastructure
  await connectDatabase();
  await connectRedis();

  const app = createApp();

  // Create an HTTP server so we can attach both Express and WebSocket
  const httpServer = createServer(app);

  // Attach WebSocket server (JWT auth + Redis pub/sub fan-out)
  attachWebSocketServer(httpServer);

  httpServer.listen(PORT, () => {
    console.info(`[server] ShowUp2Move API running on port ${PORT} (${env.NODE_ENV})`);
  });

  // Start background cron jobs after the server is listening
  startJobs();
}

bootstrap().catch((err: unknown) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
