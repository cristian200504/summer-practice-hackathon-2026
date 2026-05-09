# Routes Layer (Presentation Layer)

This directory contains the **presentation layer** of the ShowUp2Move server.

Route handlers are responsible for:
- Parsing and validating HTTP requests
- Delegating to the service layer
- Shaping HTTP responses (status codes, JSON bodies)
- Applying authentication/authorisation middleware

## Conventions

- Route handlers must be thin — no business logic here
- Use `express-validator` for input validation
- Each router file maps to a resource or feature domain
- All routes are mounted in `src/app.ts`

## Routes (populated as features are implemented)

| File | Endpoints |
|------|-----------|
| `health.ts` | `GET /health` |
| `auth.ts` | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/password-reset/*`, `GET /auth/google` |
| `profiles.ts` | `POST /profiles`, `GET /profiles/:userId`, `PUT /profiles/:userId`, `POST /profiles/:userId/photo`, `PUT /profiles/:userId/sports` |
| `availability.ts` | `POST /availability`, `PUT /availability/:id`, `GET /availability/today` |
| `groups.ts` | `POST /groups/:id/confirm`, `POST /groups/:id/decline`, `GET /groups/:id/teams` |
| `events.ts` | `POST /events`, `GET /events`, `GET /events/:id`, `POST /events/:id/invite-response`, `GET /events/:id/share-link`, `GET /events/nearby` |
| `messages.ts` | `POST /groups/:id/messages`, `GET /groups/:id/messages` |
| `polls.ts` | `POST /groups/:id/polls`, `POST /polls/:id/vote` |
| `notifications.ts` | `GET /notifications/preferences`, `PUT /notifications/preferences` |
| `venues.ts` | `GET /venues` |
| `weather.ts` | `GET /weather` |
| `leaderboard.ts` | `GET /leaderboard` |
| `calendar.ts` | `POST /events/:id/calendar` |
