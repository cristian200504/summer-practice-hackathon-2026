# Implementation Plan: ShowUp2Move

## Overview

Hackathon-ordered implementation plan for ShowUp2Move — a smart social sports-matching web application. Tasks are sequenced foundation-first, then core features, then AI/smart features, then bonus features, mirroring the scoring tiers in the hackathon brief. Each task builds on the previous and ends with all components wired together.

The stack assumed: **TypeScript** (full-stack), **React** (frontend), **Node.js/Express** (backend), **PostgreSQL** (database), **WebSocket** (real-time), **Redis** (pub/sub + sessions).

---

## Tasks

- [x] 1. Project scaffold and clean architecture foundation
  - Initialize monorepo with `packages/client` (React + Vite + TypeScript) and `packages/server` (Node.js + Express + TypeScript)
  - Set up ESLint, Prettier, and TypeScript strict mode across both packages
  - Create three-layer server structure: `routes/` (presentation), `services/` (business logic), `repositories/` (data access)
  - Configure environment variable loading via `dotenv`; document all required env vars in `.env.example`
  - Set up PostgreSQL connection pool and Redis client with connection error handling
  - Write a root `README.md` with setup instructions, architecture overview, and env var documentation
  - _Requirements: 20.1, 20.4, 20.5_

- [x] 2. Database schema and migrations
  - [x] 2.1 Create core schema migrations
    - Write migrations for tables: `users`, `profiles`, `sports`, `user_sports` (preferences + skill levels), `availability_responses`, `groups`, `group_members`, `events`, `event_participants`, `messages`, `polls`, `poll_options`, `poll_votes`, `achievements`, `user_achievements`, `notifications`
    - Seed the `sports` table with at least 10 sports and their group-size constraints (Football 10–14, Basketball 6–10, Tennis 2–4, etc.)
    - _Requirements: 2.1, 2.6, 5.2_

  - [ ]* 2.2 Write property tests for schema constraints
    - **Property 1: Group size bounds** — for every sport, `min_size <= max_size` and both are positive integers
    - **Property 2: Skill level enum integrity** — `skill_level` values are always one of `{Beginner, Intermediate, Advanced, null}`
    - **Validates: Requirements 2.7, 5.2**

- [x] 3. Authentication service
  - [x] 3.1 Implement email/password registration and login
    - `POST /auth/register` — validate email uniqueness, hash password with bcrypt (cost ≥ 12), issue JWT (7-day expiry)
    - `POST /auth/login` — verify credentials, return JWT; return generic error without revealing which field is wrong
    - `POST /auth/logout` — invalidate session token
    - `POST /auth/password-reset/request` — generate time-limited reset token (1 hour), send email link
    - `POST /auth/password-reset/confirm` — validate token, update hashed password
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.8, 20.6_

  - [x] 3.2 Implement OAuth 2.0 social login (Google)
    - Integrate Passport.js Google OAuth 2.0 strategy
    - On first OAuth login, create a new user account; on subsequent logins, issue a fresh JWT
    - _Requirements: 1.2_

  - [x] 3.3 Implement JWT middleware and session expiry redirect
    - `authenticateToken` middleware that validates JWT on protected routes
    - Return 401 with a redirect hint when token is expired or missing
    - _Requirements: 1.7_

  - [ ]* 3.4 Write unit tests for Auth_Service
    - Test: duplicate email registration returns descriptive error
    - Test: invalid credentials return generic error (no field disclosure)
    - Test: expired token triggers redirect response
    - Test: password reset token expires after 1 hour
    - _Requirements: 1.4, 1.6, 1.7, 1.8_

- [x] 4. User profile creation and management
  - [x] 4.1 Implement profile CRUD API
    - `POST /profiles` — create profile (display name required, bio ≤ 300 chars, sports list required for completeness)
    - `PUT /profiles/:userId` — update profile; persist immediately
    - `GET /profiles/:userId` — fetch profile with sports and skill levels
    - Validate bio length server-side; return 400 with character-limit error if exceeded
    - _Requirements: 2.1, 2.2, 2.3, 2.8_

  - [x] 4.2 Implement profile photo upload
    - `POST /profiles/:userId/photo` — accept JPEG, PNG, WebP up to 5 MB; reject other formats/sizes with descriptive error
    - Resize and store a thumbnail (e.g., 200×200px) alongside the original
    - Store file references in the `profiles` table; serve via static URL
    - _Requirements: 2.4, 2.5_

  - [x] 4.3 Implement sports preferences and skill levels
    - `PUT /profiles/:userId/sports` — accept array of `{ sportId, skillLevel? }` objects
    - Validate that each `sportId` exists in the `sports` table and `skillLevel` is a valid enum value
    - _Requirements: 2.6, 2.7_

  - [ ]* 4.4 Write unit tests for Profile service
    - Test: bio > 300 chars is rejected with correct error
    - Test: unsupported file type returns descriptive error
    - Test: file > 5 MB returns descriptive error
    - Test: profile marked complete only when display name + ≥1 sport present
    - _Requirements: 2.2, 2.3, 2.5_

- [x] 5. Frontend foundation — routing, layout, and responsive UI
  - [x] 5.1 Set up React Router and global layout
    - Configure React Router v6 with routes: `/`, `/login`, `/register`, `/profile`, `/dashboard`, `/events`, `/events/:id`, `/chat/:groupId`, `/discover`
    - Implement a responsive shell layout (sidebar on desktop, bottom nav on mobile) using CSS Grid/Flexbox
    - Ensure layout renders correctly from 320px to 1440px without horizontal scroll
    - _Requirements: 19.1, 19.3_

  - [x] 5.2 Implement design system and WCAG 2.1 AA compliance
    - Define a color palette, typography scale, spacing tokens, and component library (Button, Input, Card, Badge, Avatar, Modal, Toast)
    - Verify all text/interactive element color contrast ratios meet WCAG 2.1 AA (≥ 4.5:1 for normal text)
    - All interactive elements must be keyboard-navigable and have visible focus indicators
    - _Requirements: 19.2_

  - [x] 5.3 Implement visual feedback and performance baseline
    - Add loading spinners and optimistic UI updates so primary actions provide visual feedback within 200ms
    - Configure Vite code-splitting and lazy loading for route-level components to target ≤ 3s initial load on 4G
    - _Requirements: 19.4, 19.5_

  - [x] 5.4 Implement multi-language support (i18n)
    - Integrate `react-i18next`; create `en.json` and one additional locale (e.g., `fr.json` or `es.json`) covering all UI labels, error messages, and system strings
    - Auto-detect device locale on first launch; allow language selection in profile settings
    - Fall back to English for any untranslated string
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [x] 6. Authentication UI
  - Build registration form (email, password ≥ 8 chars, display name) with inline validation
  - Build login form with generic error display (no field disclosure)
  - Build password reset request and confirmation screens
  - Add "Continue with Google" OAuth button
  - Wire all forms to Auth_Service API endpoints
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.8_

- [x] 7. Profile UI
  - Build profile creation/edit form: display name, bio (with live character counter at 300), sports multi-select with skill level dropdowns
  - Build photo upload component with drag-and-drop, format/size validation feedback, and thumbnail preview
  - Display earned achievement badges on the profile page
  - Wire all components to Profile API endpoints
  - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 16.3_

- [x] 8. Checkpoint — Foundation complete
  - Ensure the app runs end-to-end: register → login → create profile → upload photo → select sports
  - Verify responsive layout on 320px, 768px, and 1440px viewports
  - Ensure all tests pass; ask the user if questions arise before proceeding

- [x] 9. Availability system ("ShowUpToday?")
  - [x] 9.1 Implement availability API
    - `POST /availability` — record a Yes/No response for the authenticated user with timestamp; mark user available/unavailable for matching
    - `PUT /availability/:id` — allow changing response before matching runs
    - `GET /availability/today` — return current day's response for the user
    - Store availability history in `availability_responses` table
    - _Requirements: 4.3, 4.4, 4.7, 4.8_

  - [x] 9.2 Implement scheduled availability prompt dispatch
    - Create a cron job (configurable time, default 08:00 local) that sends Availability_Prompts to all users with complete profiles
    - After 2 hours without response, dispatch one follow-up reminder via Notification_Service
    - _Requirements: 4.1, 4.5_

  - [x] 9.3 Build "ShowUpToday?" UI
    - Build a prominent Yes/No prompt card on the dashboard; single-tap interaction
    - Allow sport-specific availability selection after tapping Yes
    - Show current availability status and allow toggling before matching
    - _Requirements: 4.2, 4.6, 4.7_

  - [ ]* 9.4 Write property tests for availability system
    - **Property 3: Response immutability after matching** — once a user is matched, their availability response cannot be changed
    - **Property 4: Single response per user per day** — no user has more than one active availability response per calendar day
    - **Validates: Requirements 4.3, 4.7**

- [x] 10. Smart matching engine
  - [x] 10.1 Implement core matching algorithm
    - Group available users by shared sport preference
    - Enforce group-size constraints per sport (Football 10–14, Basketball 6–10, Tennis 2–4, configurable for others)
    - Prioritize users with higher mutual Compatibility_Scores when assembling groups
    - Apply proximity filter (default 10 km radius) where location data is available
    - Queue users below minimum group size and retry at next scheduled interval
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 10.2 Implement matching scheduler and group finalization
    - Schedule matching engine to run once per day at a configurable time after the availability window closes
    - When a group reaches minimum size, finalize the group and trigger match notifications within 30 seconds
    - _Requirements: 5.5, 5.7, 5.8_

  - [x] 10.3 Implement team balancing by skill level
    - For team sports (Football, Basketball), distribute members across two teams such that average skill level per team differs by ≤ 1 tier
    - Expose team assignments via `GET /groups/:id/teams`
    - _Requirements: 15.1_

  - [ ]* 10.4 Write property tests for matching engine
    - **Property 5: Group size invariant** — every finalized group has `min_size <= member_count <= max_size` for its sport
    - **Property 6: No duplicate members** — no user appears in more than one active group for the same sport on the same day
    - **Property 7: Team balance** — for team sports, `|avg_skill_team_A - avg_skill_team_B| <= 1`
    - **Validates: Requirements 5.2, 5.3, 15.1**

- [x] 11. Match confirmation workflow
  - [x] 11.1 Implement confirmation API
    - `POST /groups/:id/confirm` — record user confirmation; update confirmed-member count
    - `POST /groups/:id/decline` — remove user from group; trigger vacancy fill from queue
    - Background job: after 30-minute deadline, remove non-responders and attempt one re-fill; dissolve group if minimum not reached
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x] 11.2 Implement group state transitions
    - Group states: `Pending → Active → Dissolved`
    - Transition to `Active` when all minimum-required members confirm; create Group_Chat on transition
    - Transition to `Dissolved` if re-fill fails; notify affected users
    - _Requirements: 6.4, 6.5, 6.6_

  - [x] 11.3 Build confirmation UI
    - Show match notification card with group details, sport, and matched members
    - Confirm/Decline buttons with 30-minute countdown timer
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 12. Captain selection and coordination tools
  - [x] 12.1 Implement captain assignment
    - On group transition to Active, randomly select one confirmed member as Captain
    - `PUT /groups/:id/captain` — allow Captain to reassign role to another confirmed member
    - Background job: if Captain has not initiated coordination within 2 hours, send reminder notification
    - _Requirements: 7.1, 7.4, 7.5_

  - [x] 12.2 Build captain coordination UI
    - Captain dashboard within group view: initiate poll, suggest venues, set proposed event time, send announcements
    - Show "You are the Captain" banner with coordination action buttons
    - Allow Captain to manually adjust team assignments; display system message in chat on change
    - _Requirements: 7.2, 7.3, 15.3, 15.4_

- [x] 13. Real-time infrastructure (WebSocket)
  - [x] 13.1 Implement WebSocket server
    - Set up `ws` or `socket.io` server; authenticate connections via JWT on handshake
    - Implement rooms per group/event for targeted message broadcast
    - Use Redis pub/sub to fan out messages across multiple server instances
    - _Requirements: 20.2_

  - [x] 13.2 Implement automatic reconnection with exponential backoff
    - Client-side WebSocket wrapper: on disconnect, retry with exponential backoff (1s, 2s, 4s, 8s, 16s — up to 5 retries)
    - Display a "Reconnecting…" banner in the UI during reconnection attempts
    - _Requirements: 20.3_

  - [ ]* 13.3 Write property tests for WebSocket reconnection
    - **Property 8: Backoff monotonicity** — each successive retry delay is strictly greater than the previous
    - **Property 9: Retry bound** — total retry attempts never exceed 5
    - **Validates: Requirements 20.3**

- [x] 14. Group chat
  - [x] 14.1 Implement chat message API and persistence
    - `POST /groups/:id/messages` — persist message with sender, timestamp, content
    - `GET /groups/:id/messages` — paginated message history
    - Broadcast new messages to all group members via WebSocket room
    - Deliver messages with latency < 1 second under normal conditions
    - Persist message history for event duration + 24 hours
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

  - [x] 14.2 Implement system messages for member join/leave
    - Emit system messages when a member joins or leaves the group
    - Display system messages inline in the chat with distinct styling
    - _Requirements: 8.4, 8.5_

  - [x] 14.3 Implement inline polls in chat
    - `POST /groups/:id/polls` — create poll with options and duration (default 30 min)
    - `POST /polls/:id/vote` — cast one vote per member per poll
    - Broadcast live tally updates via WebSocket; display winning option when poll closes and notify Captain
    - _Requirements: 8.7, 9.4, 9.5_

  - [x] 14.4 Build chat UI
    - Real-time message list with sender avatar, display name, and timestamp
    - Message input with send button; optimistic message rendering
    - Inline poll cards with vote buttons and live progress bars
    - Push notification for new messages when chat is not in focus
    - _Requirements: 8.2, 8.3, 8.7, 8.8_

- [x] 15. Checkpoint — Core features complete
  - Ensure end-to-end flow works: availability → matching → confirmation → captain assignment → group chat → poll
  - Verify WebSocket reconnection behavior
  - Ensure all tests pass; ask the user if questions arise before proceeding

- [x] 16. Notification service
  - [x] 16.1 Implement notification dispatch infrastructure
    - Build `NotificationService` with methods for each trigger: availability prompt, match found, confirmation request, captain assignment, new chat message, poll result, event reminder, achievement unlocked
    - Integrate Web Push API (VAPID) for browser push notifications
    - Deliver push notifications within 5 seconds of trigger; within 2 seconds for new chat messages
    - Include deep links in all push notification payloads
    - _Requirements: 11.1, 11.3, 11.4, 11.6_

  - [x] 16.2 Implement in-app notifications and preferences
    - When user is active in the app, display in-app toast/banner instead of push notification
    - `GET /notifications/preferences` / `PUT /notifications/preferences` — per-type opt-in/opt-out settings
    - Build notification preferences screen in settings
    - _Requirements: 11.2, 11.5_

- [x] 17. Event planning assistance and venue suggestions
  - [x] 17.1 Implement Location_Service — venue search
    - `GET /venues?sport=&lat=&lng=&radius=` — query nearby venues via Google Places API (or equivalent)
    - Return ≥ 3 venues with name, address, distance from group centroid, and pricing info where available
    - If no venues found, expand search radius by 5 km increments up to 3 times; notify Captain of expanded radius
    - _Requirements: 9.1, 9.2, 9.8_

  - [x] 17.2 Implement weather integration
    - `GET /weather?lat=&lng=&datetime=` — fetch forecast from OpenWeatherMap (or equivalent)
    - Display forecast alongside venue suggestions; show advisory banner for rain, heat > 35°C, or wind > 50 km/h
    - Send weather alert notification to all participants ≥ 3 hours before event start
    - Refresh forecast every 3 hours for events within 48 hours
    - _Requirements: 9.7, 14.1, 14.2, 14.3, 14.4_

  - [x] 17.3 Build venue suggestion and event planning UI
    - Captain view: venue cards with name, address, distance, price, and "Add to Poll" button
    - Weather forecast widget alongside venue list
    - Interactive map (Leaflet or Google Maps) showing venue pins and user's approximate location
    - "Get Directions" tap action that opens device navigation app with venue address
    - _Requirements: 9.3, 9.6, 12.1, 12.2, 12.3_

- [x] 18. Maps and location assistance
  - [x] 18.1 Implement Location_Service — user location and permissions
    - Request browser geolocation permission with explanation of why it is needed
    - Store last known location for proximity matching when user is not active
    - `GET /events/nearby?lat=&lng=` — return active events near the user
    - _Requirements: 12.3, 12.4, 12.5, 12.6_

  - [x] 18.2 Build discovery map screen
    - Full-screen map view (`/discover`) showing pins for all active nearby events
    - Tap a pin to open event detail card with join/request action
    - _Requirements: 12.6_

- [x] 19. Manual event creation
  - [x] 19.1 Implement manual event API
    - `POST /events` — create event (required: sport, date/time, min/max participants, title; optional: venue, description, invited users)
    - Creating user is assigned as Captain; send invitations to specified users
    - `POST /events/:id/invite-response` — accept or decline invitation; update participant list and Group_Chat
    - Close registration when max participants reached; notify Captain
    - `GET /events` — public event listing filterable by sport, date, proximity
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x] 19.2 Build event creation and discovery UI
    - Event creation form with all required and optional fields, date/time picker, sport selector
    - Public event listing page with sport/date/proximity filters
    - Event detail screen with participant list, Group_Chat link, and Captain controls
    - _Requirements: 10.1, 10.2, 10.8_

- [x] 20. Social sharing and invites
  - [x] 20.1 Implement shareable event links
    - `GET /events/:id/share-link` — generate a shareable URL for the event
    - When a non-registered user opens the link, redirect to registration with event context preserved
    - When a registered user opens the link, add them to the join request queue and notify Captain
    - _Requirements: 17.1, 17.3, 17.4_

  - [x] 20.2 Build share UI
    - "Share Event" button on event detail screen
    - Share sheet with: copy link, native OS share, direct invite by email/username
    - _Requirements: 17.2_

- [x] 21. Checkpoint — Event coordination complete
  - Verify full event lifecycle: auto-match → captain → venue suggestion → poll → weather → manual event creation → sharing
  - Ensure all tests pass; ask the user if questions arise before proceeding

- [x] 22. AI enrichment service — NLP from bio
  - [x] 22.1 Implement NLP sport detection from bio
    - On `POST /profiles` or `PUT /profiles/:userId` with a non-empty bio, call an LLM/NLP API (e.g., OpenAI) to extract sport interests
    - Return suggestions within 5 seconds; store raw suggestions in `ai_suggestions` table
    - `POST /profiles/:userId/ai-suggestions/:suggestionId/accept` — add suggested sport to user's preferences
    - `POST /profiles/:userId/ai-suggestions/:suggestionId/dismiss` — mark suggestion dismissed
    - If no sports detected, return a "no suggestions found" response
    - _Requirements: 3.1, 3.3, 3.4_

  - [ ]* 22.2 Write unit tests for NLP suggestion flow
    - Test: bio with clear sport keywords returns ≥ 1 suggestion
    - Test: empty bio returns "no suggestions found" response
    - Test: accepted suggestion is added to user's sport preferences
    - Test: dismissed suggestion does not appear again
    - _Requirements: 3.1, 3.3, 3.4_

- [x] 23. AI enrichment service — vision AI from photo
  - [x] 23.1 Implement vision AI sport detection from profile photo
    - On photo upload, call a vision AI API (e.g., Google Vision, OpenAI Vision) to infer sports from image content
    - Return suggestions within 10 seconds; surface them in the same suggestion UI as NLP suggestions
    - _Requirements: 3.2, 3.3, 3.4_

  - [ ]* 23.2 Write unit tests for vision AI suggestion flow
    - Test: photo upload triggers vision AI call and returns suggestions
    - Test: vision AI timeout/error is handled gracefully without blocking photo save
    - _Requirements: 3.2, 3.4_

- [x] 24. AI compatibility scoring and smart recommendations
  - [x] 24.1 Implement Compatibility_Score computation
    - Compute a numeric compatibility score between two users for a shared sport based on: skill level match, bio NLP similarity, and inferred interests overlap
    - Store scores in a `compatibility_scores` table; recompute when either user's profile changes
    - Expose `GET /users/:id/compatibility/:otherId?sport=` endpoint
    - _Requirements: 3.5_

  - [x] 24.2 Wire Compatibility_Score into matching engine
    - Update `Matching_Engine` (Task 10.1) to rank and select users by highest mutual Compatibility_Score when assembling groups
    - _Requirements: 3.6, 5.3_

  - [x] 24.3 Implement smart teammate recommendations
    - `GET /users/:id/recommendations?sport=` — return top-N compatible users available today for the given sport
    - Display recommendations on the dashboard as "People you might want to play with"
    - _Requirements: 3.6_

  - [ ]* 24.4 Write property tests for compatibility scoring
    - **Property 10: Score symmetry** — `compatibility(A, B) == compatibility(B, A)` for all user pairs
    - **Property 11: Score bounds** — compatibility score is always in range `[0.0, 1.0]`
    - **Validates: Requirements 3.5**

- [x] 25. Checkpoint — AI features complete
  - Verify NLP suggestions appear after bio save, vision AI suggestions after photo upload, and compatibility scores influence matching
  - Ensure all tests pass; ask the user if questions arise before proceeding

- [x] 26. Gamification and achievements
  - [x] 26.1 Implement achievement system
    - Define and seed achievements: First Event Attended, 5 Events Attended, 10 Events Attended, First Captain Role, Played 3 Different Sports, Invited a Friend
    - Background job: after each event attendance or role assignment, evaluate all achievement criteria for the user; grant any newly met achievements
    - On achievement grant, send "Achievement unlocked" push notification
    - _Requirements: 16.1, 16.2_

  - [x] 26.2 Implement leaderboard
    - `GET /leaderboard?sport=` — return users ranked by total achievement count, optionally filtered by sport
    - Build leaderboard screen accessible from the main navigation
    - _Requirements: 16.4_

  - [x] 26.3 Build achievements UI
    - Display earned achievement badges on the profile page
    - Leaderboard screen with sport filter and rank display
    - _Requirements: 16.3, 16.4_

- [x] 27. Calendar integration
  - [x] 27.1 Implement Calendar_Service
    - `POST /events/:id/calendar` — create calendar entry via Google Calendar API (or generate ICS file as fallback)
    - Include event title, sport, venue address, start/end time in the calendar entry
    - On event time or venue update, update the corresponding calendar entry if one was previously created
    - If calendar API fails, offer ICS file download
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 27.2 Build "Add to Calendar" UI
    - "Add to Calendar" button on event detail screen (visible once event is confirmed for the user)
    - Show success confirmation or error with ICS fallback option
    - _Requirements: 13.1, 13.3_

- [x] 28. Team balancing UI and captain team management
  - Display team composition in Group_Chat after matching (Team A / Team B with member names and skill levels)
  - Captain can drag-and-drop members between teams in the coordination view
  - On Captain adjustment, emit a system message in Group_Chat with updated team composition
  - _Requirements: 15.2, 15.3, 15.4_

- [x] 29. Final integration and wiring
  - [x] 29.1 Wire all services end-to-end
    - Ensure the complete user journey works without manual intervention: register → profile → AI enrichment → availability → matching → confirmation → captain → venue → poll → weather → chat → event → calendar → achievements
    - Verify deep links in push notifications navigate to the correct screens
    - Verify all WebSocket rooms are cleaned up when groups/events are dissolved or expired
    - _Requirements: 11.4, 20.2_

  - [x] 29.2 Wire team balancing into matching engine output
    - After group finalization, automatically compute and store team assignments for team sports
    - Post team composition as the first system message in the Group_Chat
    - _Requirements: 15.1, 15.2_

  - [ ]* 29.3 Write end-to-end integration tests
    - Test: full availability → match → confirm → chat flow using test users
    - Test: manual event creation → invite → accept → chat creation
    - Test: AI suggestion accept → sport added to profile → influences next match
    - _Requirements: 5.1, 6.4, 8.1, 10.5_

- [x] 30. Final checkpoint — All features complete
  - Run the full test suite; ensure all non-optional tests pass
  - Verify responsive layout, WCAG contrast, and touch interactions on mobile viewport
  - Verify environment variables are documented and no secrets are hardcoded
  - Ensure all tests pass; ask the user if questions arise before proceeding

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (Tasks 8, 15, 21, 25, 30) are natural demo milestones for the hackathon
- Property tests validate universal correctness invariants; unit tests validate specific examples and edge cases
- The AI enrichment tasks (22–24) are designed to be independently deployable — the app functions without them if API keys are unavailable
- Bonus features (calendar, weather, gamification, social sharing, multi-language) are in Tasks 20, 26, 27 and can be deferred if time is short
