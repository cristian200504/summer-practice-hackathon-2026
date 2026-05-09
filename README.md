# ShowUp2Move

> Smart social sports-matching platform — hackathon prototype

ShowUp2Move makes spontaneous sports coordination frictionless. Users tap "Yes" once a day, the platform finds compatible players nearby, forms a group, assigns a captain, suggests venues, and facilitates real-time coordination through group chat.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Running Tests](#running-tests)
- [API Overview](#api-overview)

---

## Architecture Overview

The system follows a **monorepo structure** with two packages:

```
packages/
  client/   ← React + Vite + TypeScript (frontend)
  server/   ← Node.js + Express + TypeScript (backend)
```

### Server Three-Layer Architecture

The server enforces a strict three-layer separation of concerns (Requirement 20.1):

```
packages/server/src/
  routes/          ← Presentation layer
                     HTTP handlers, request validation, response shaping
  services/        ← Business logic layer
                     Matching engine, AI enrichment, notifications, etc.
  repositories/    ← Data access layer
                     SQL queries (PostgreSQL), Redis operations
  infrastructure/  ← Infrastructure clients
                     Database pool, Redis client
  middleware/      ← Cross-cutting concerns
                     Auth, error handling, logging
  config/          ← Environment configuration
  types/           ← Shared TypeScript types
```

**Request flow:**
```
React Client
    │  HTTP / WebSocket
    ▼
Express Routes  (validate input, shape response)
    │
    ▼
Services        (business logic, orchestration)
    │
    ▼
Repositories    (SQL queries, Redis ops)
    │
    ▼
PostgreSQL / Redis
```

### Real-Time Infrastructure

- **WebSocket** (`ws` library) for group chat messages and match notifications
- **Redis pub/sub** fans out WebSocket messages across multiple server instances
- Client-side automatic reconnection with exponential backoff (up to 5 retries)

### AI Enrichment

- **NLP** (OpenAI API): extracts sport interests from profile bio text
- **Vision AI** (OpenAI Vision / Google Vision): infers sports from profile photos
- **Compatibility scores**: symmetric numeric scores `[0.0, 1.0]` used to rank group matches

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript (strict), React Router v6 |
| Backend | Node.js, Express, TypeScript (strict) |
| Database | PostgreSQL (connection pool via `pg`) |
| Cache / Pub-Sub | Redis (`redis` v4) |
| Auth | JWT (7-day expiry), bcrypt (cost ≥ 12), Google OAuth 2.0 |
| Real-time | WebSocket (`ws`), Redis pub/sub |
| AI | OpenAI API (NLP + Vision) |
| Push notifications | Web Push API (VAPID) |
| Maps | Google Places API, Leaflet |
| Weather | OpenWeatherMap API |
| Calendar | Google Calendar API + ICS fallback |
| i18n | react-i18next (English + French) |
| Testing | Vitest + fast-check (property-based tests) |
| Linting | ESLint + Prettier |

---

## Project Structure

```
show-up-2-move/
├── packages/
│   ├── client/                  # React + Vite frontend
│   │   ├── src/
│   │   │   ├── pages/           # Route-level page components
│   │   │   ├── components/      # Reusable UI components
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   ├── services/        # API client functions
│   │   │   ├── i18n/            # Translations (en, fr)
│   │   │   ├── App.tsx          # Router and lazy-loaded routes
│   │   │   └── main.tsx         # Entry point
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   │
│   └── server/                  # Node.js + Express backend
│       └── src/
│           ├── routes/          # Presentation layer (HTTP handlers)
│           ├── services/        # Business logic layer
│           ├── repositories/    # Data access layer
│           ├── infrastructure/  # DB pool, Redis client
│           ├── middleware/      # Auth, error handling
│           ├── config/          # Env var validation
│           ├── types/           # Shared domain types
│           └── index.ts         # Server entry point
│
├── .env.example                 # Environment variable template
├── .eslintrc.json               # Root ESLint config
├── .prettierrc                  # Prettier config
├── package.json                 # Workspace root
└── README.md
```

---

## Prerequisites

- **Node.js** ≥ 20.x
- **npm** ≥ 10.x (workspaces support)
- **PostgreSQL** ≥ 15
- **Redis** ≥ 7

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repo-url>
cd show-up-2-move
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values (see [Environment Variables](#environment-variables) below).

### 4. Create the PostgreSQL database

```bash
createdb showup2move
```

### 5. Run database migrations

```bash
# Migrations are in packages/server/src/migrations/
# Run them in order:
psql -d showup2move -f packages/server/src/migrations/001_initial_schema.sql
```

### 6. Start the development servers

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 5173) concurrently.

---

## Environment Variables

All secrets and environment-specific values are loaded from `.env` (Requirement 20.5). **Never commit `.env` to version control.**

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | No | `development` \| `production` \| `test` (default: `development`) |
| `PORT` | No | Server port (default: `3001`) |
| `CLIENT_URL` | No | Frontend URL for CORS (default: `http://localhost:5173`) |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (`postgres://user:pass@host:port/db`) |
| `DB_POOL_MIN` | No | Min pool connections (default: `2`) |
| `DB_POOL_MAX` | No | Max pool connections (default: `10`) |
| `REDIS_URL` | **Yes** | Redis connection string (`redis://host:port`) |
| `JWT_SECRET` | **Yes** | Secret for signing JWTs — use `openssl rand -hex 64` |
| `JWT_EXPIRES_IN` | No | JWT expiry duration (default: `7d`) |
| `BCRYPT_COST` | No | bcrypt cost factor — minimum 12 (default: `12`) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth 2.0 client secret |
| `GOOGLE_CALLBACK_URL` | No | OAuth callback URL |
| `VAPID_PUBLIC_KEY` | No | Web Push VAPID public key — generate with `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | No | Web Push VAPID private key |
| `VAPID_SUBJECT` | No | VAPID subject (mailto: or URL) |
| `OPENAI_API_KEY` | No | OpenAI API key for NLP + vision AI enrichment |
| `GOOGLE_PLACES_API_KEY` | No | Google Places API key for venue search |
| `OPENWEATHERMAP_API_KEY` | No | OpenWeatherMap API key for weather forecasts |
| `GOOGLE_CALENDAR_CLIENT_ID` | No | Google Calendar OAuth client ID |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | No | Google Calendar OAuth client secret |
| `UPLOAD_DIR` | No | Directory for uploaded files (default: `./uploads`) |
| `MAX_FILE_SIZE_BYTES` | No | Max upload size in bytes (default: `5242880` = 5 MB) |
| `AVAILABILITY_PROMPT_CRON` | No | Cron schedule for daily availability prompt (default: `0 8 * * *`) |
| `MATCHING_ENGINE_CRON` | No | Cron schedule for matching engine run (default: `0 12 * * *`) |
| `DEFAULT_PROXIMITY_KM` | No | Default proximity radius for matching (default: `10`) |

> **Note:** Variables marked **Yes** are required — the server will refuse to start without them.

---

## Running the App

### Development (both packages)

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

### Production build

```bash
npm run build
npm start --workspace=packages/server
```

---

## Running Tests

```bash
# All tests
npm test

# Server tests only
npm test --workspace=packages/server

# Client tests only
npm test --workspace=packages/client

# Watch mode
npm run test:watch --workspace=packages/server
```

Tests use **Vitest** for both unit and property-based tests. Property-based tests use **fast-check** with a minimum of 100 iterations per property.

---

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server and dependency health check |
| `POST` | `/auth/register` | Register with email + password |
| `POST` | `/auth/login` | Login, receive JWT |
| `POST` | `/auth/logout` | Invalidate session |
| `POST` | `/auth/password-reset/request` | Request password reset email |
| `POST` | `/auth/password-reset/confirm` | Confirm reset with token |
| `GET` | `/auth/google` | Initiate Google OAuth flow |
| `POST` | `/profiles` | Create user profile |
| `GET` | `/profiles/:userId` | Get profile |
| `PUT` | `/profiles/:userId` | Update profile |
| `POST` | `/profiles/:userId/photo` | Upload profile photo |
| `PUT` | `/profiles/:userId/sports` | Update sports preferences |
| `POST` | `/availability` | Record availability response |
| `PUT` | `/availability/:id` | Update availability response |
| `GET` | `/availability/today` | Get today's response |
| `POST` | `/groups/:id/confirm` | Confirm group match |
| `POST` | `/groups/:id/decline` | Decline group match |
| `GET` | `/groups/:id/teams` | Get team assignments |
| `POST` | `/groups/:id/messages` | Send chat message |
| `GET` | `/groups/:id/messages` | Get paginated message history |
| `POST` | `/groups/:id/polls` | Create poll |
| `POST` | `/polls/:id/vote` | Cast vote |
| `POST` | `/events` | Create manual event |
| `GET` | `/events` | List public events |
| `GET` | `/events/:id` | Get event detail |
| `POST` | `/events/:id/invite-response` | Accept/decline invitation |
| `GET` | `/events/:id/share-link` | Get shareable event link |
| `GET` | `/events/nearby` | Get nearby events |
| `POST` | `/events/:id/calendar` | Add event to calendar |
| `GET` | `/venues` | Search nearby venues |
| `GET` | `/weather` | Get weather forecast |
| `GET` | `/leaderboard` | Get achievement leaderboard |
| `GET` | `/notifications/preferences` | Get notification preferences |
| `PUT` | `/notifications/preferences` | Update notification preferences |
| `GET` | `/users/:id/compatibility/:otherId` | Get compatibility score |
| `GET` | `/users/:id/recommendations` | Get smart teammate recommendations |

All protected endpoints require `Authorization: Bearer <token>` header.

All error responses follow the format:
```json
{
  "error": "error_code",
  "message": "Human-readable description",
  "correlationId": "uuid"
}
```
