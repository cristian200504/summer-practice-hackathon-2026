# Services Layer

This directory contains the **business logic layer** of the ShowUp2Move server.

Services are responsible for:
- Implementing domain rules and workflows
- Orchestrating calls to repositories and external APIs
- Keeping route handlers thin (no business logic in routes)

## Conventions

- Each service is a plain TypeScript class or module (no framework coupling)
- Services receive dependencies via constructor injection for testability
- Services never import from `routes/` — they are framework-agnostic
- Services may call other services but must avoid circular dependencies

## Services (populated as features are implemented)

| File | Responsibility |
|------|---------------|
| `auth.service.ts` | Registration, login, OAuth, JWT, password reset |
| `profile.service.ts` | Profile CRUD, photo upload, sports preferences |
| `availability.service.ts` | Daily availability responses and lifecycle |
| `matching.service.ts` | Group matching algorithm and scheduling |
| `group.service.ts` | Group state transitions and captain assignment |
| `chat.service.ts` | Real-time messaging and polls |
| `notification.service.ts` | Push and in-app notification dispatch |
| `ai-enrichment.service.ts` | NLP + vision AI sport suggestions and compatibility scores |
| `location.service.ts` | Venue search and proximity queries |
| `weather.service.ts` | Weather forecast retrieval |
| `calendar.service.ts` | Google Calendar and ICS integration |
| `achievement.service.ts` | Achievement evaluation and leaderboard |
| `event.service.ts` | Manual event creation and management |
