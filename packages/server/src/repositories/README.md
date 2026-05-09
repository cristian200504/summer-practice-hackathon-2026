# Repositories Layer

This directory contains the **data access layer** of the ShowUp2Move server.

Repositories are responsible for:
- Executing parameterised SQL queries against PostgreSQL
- Reading and writing to Redis
- Mapping raw database rows to domain types
- Keeping all SQL out of the service layer

## Conventions

- Each repository is a plain TypeScript class or module
- Repositories accept a `PoolClient` or use the shared pool from `infrastructure/database`
- Repositories never contain business logic — only data access
- All queries use parameterised placeholders (`$1`, `$2`, …) to prevent SQL injection

## Repositories (populated as features are implemented)

| File | Responsibility |
|------|---------------|
| `user.repository.ts` | CRUD for `users` table |
| `profile.repository.ts` | CRUD for `profiles`, `user_sports` tables |
| `sport.repository.ts` | Read-only access to `sports` seed data |
| `availability.repository.ts` | CRUD for `availability_responses` and `availability_sport_selections` |
| `group.repository.ts` | CRUD for `groups` and `group_members` tables |
| `event.repository.ts` | CRUD for `events` and `event_participants` tables |
| `message.repository.ts` | CRUD for `messages` table |
| `poll.repository.ts` | CRUD for `polls`, `poll_options`, `poll_votes` tables |
| `notification.repository.ts` | CRUD for `notifications` and `push_subscriptions` tables |
| `ai-suggestion.repository.ts` | CRUD for `ai_suggestions` table |
| `compatibility.repository.ts` | CRUD for `compatibility_scores` table |
| `achievement.repository.ts` | CRUD for `achievements` and `user_achievements` tables |
