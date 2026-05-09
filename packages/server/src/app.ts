import express, { Application } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from 'passport';
import { env } from './config/env';
import { configurePassport } from './config/passport';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';

// Route imports (will be populated as features are implemented)
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { profilesRouter } from './routes/profiles';
import { sportsRouter } from './routes/sports';
import { usersRouter } from './routes/users';
import { availabilityRouter } from './routes/availability';
import { groupsRouter } from './routes/groups';
import { chatRouter } from './routes/chat';
import { notificationsRouter } from './routes/notifications';
import { venuesRouter } from './routes/venues';
import { weatherRouter } from './routes/weather';
import { eventsRouter } from './routes/events';
import { compatibilityRouter } from './routes/compatibility';
import { leaderboardRouter } from './routes/leaderboard';
import { calendarRouter } from './routes/calendar';
import { chatbotRouter } from './routes/chatbot';
import { dmRouter } from './routes/dm';

export function createApp(): Application {
  const app = express();

  // ── Passport configuration ───────────────────────────────────────────────────
  configurePassport();

  // ── Security middleware ──────────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );

  // ── Request parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Passport middleware ──────────────────────────────────────────────────────
  app.use(passport.initialize());

  // ── Static file serving (uploaded photos) ───────────────────────────────────
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

  // ── Logging ──────────────────────────────────────────────────────────────────
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // ── Routes ───────────────────────────────────────────────────────────────────
  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/profiles', profilesRouter);
  app.use('/sports', sportsRouter);
  app.use('/users', usersRouter);
  app.use('/availability', availabilityRouter);
  app.use('/groups', groupsRouter);
  app.use('/', chatRouter);
  app.use('/notifications', notificationsRouter);
  app.use('/venues', venuesRouter);
  app.use('/weather', weatherRouter);
  app.use('/events', eventsRouter);
  app.use('/', compatibilityRouter);
  app.use('/leaderboard', leaderboardRouter);
  app.use('/', calendarRouter);
  app.use('/chatbot', chatbotRouter);
  app.use('/', dmRouter);

  // ── Error handling ───────────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
