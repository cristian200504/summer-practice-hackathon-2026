# Requirements Document

## Introduction

ShowUp2Move is a smart social sports-matching platform that enables users to spontaneously organize sports activities with nearby people. Users create lightweight profiles, declare daily availability with a single tap, get automatically matched into sport-appropriate groups, coordinate logistics through group chat and AI-assisted venue suggestions, and ultimately show up and play. The platform targets busy individuals who want to stay active without the overhead of fixed schedules or manual coordination.

The system is designed as a working prototype for a hackathon, prioritizing a frictionless mobile-friendly experience, real-time communication, AI-powered matching and profile enrichment, and comprehensive event coordination tools.

---

## Glossary

- **User**: A registered person using the ShowUp2Move platform.
- **Profile**: A User's personal record containing description, photo, sports preferences, skill levels, and location.
- **Sport**: A physical activity category (e.g., Football, Basketball, Tennis) with defined group-size constraints.
- **Availability_Prompt**: The periodic "ShowUpToday?" notification sent to Users to collect same-day or upcoming availability.
- **Availability_Response**: A User's Yes or No answer to an Availability_Prompt, optionally scoped to specific sports.
- **Matching_Engine**: The system component that groups available Users into sport-appropriate groups based on preferences, skill, proximity, and group-size rules.
- **Group**: A set of Users matched together for a specific Sport, with a defined size range.
- **Captain**: The User randomly selected within a Group to coordinate event logistics.
- **Group_Chat**: A real-time messaging channel dedicated to a specific Group or Event.
- **Event**: A confirmed sports activity with a defined sport, location, time, and participant list.
- **Venue**: A physical location suitable for a Sport, sourced from maps/location services.
- **Poll**: A structured vote within a Group_Chat for deciding event details such as time or location.
- **AI_Enrichment_Service**: The system component that uses NLP and vision AI to extract sports interests from profile text and photos.
- **Compatibility_Score**: A numeric value computed by the AI_Enrichment_Service representing how well two Users complement each other for a Sport.
- **Notification_Service**: The system component responsible for delivering push notifications, reminders, and real-time alerts to Users.
- **Auth_Service**: The system component handling user registration, login, and session management.
- **Location_Service**: The system component that resolves User coordinates and queries nearby Venues.
- **Calendar_Service**: The system component that integrates with external calendar providers (Google Calendar, Apple Calendar) to sync Events.
- **Weather_Service**: The system component that retrieves weather forecasts for a given location and date.
- **Achievement**: A gamification reward granted to a User upon completing defined milestones.
- **Skill_Level**: A User-defined or AI-inferred proficiency rating for a Sport (Beginner, Intermediate, Advanced).
- **Prototype**: The working hackathon deliverable of the ShowUp2Move platform.

---

## Requirements

### Requirement 1: User Registration and Authentication

**User Story:** As a new visitor, I want to register an account and log in securely, so that I can access the platform and have my data persisted across sessions.

#### Acceptance Criteria

1. THE Auth_Service SHALL provide registration via email and password.
2. THE Auth_Service SHALL provide registration via OAuth 2.0 social login (Google and/or Apple).
3. WHEN a User submits a registration form with a valid email and password of at least 8 characters, THE Auth_Service SHALL create a new User account and issue an authenticated session token.
4. IF a User submits a registration form with an email that already exists, THEN THE Auth_Service SHALL return a descriptive error message indicating the email is already in use.
5. WHEN a User submits valid login credentials, THE Auth_Service SHALL issue a session token valid for at least 7 days.
6. IF a User submits invalid login credentials, THEN THE Auth_Service SHALL return an error message without revealing which field is incorrect.
7. WHEN a User's session token expires, THE Auth_Service SHALL redirect the User to the login screen.
8. THE Auth_Service SHALL support password reset via a time-limited email link valid for 1 hour.

---

### Requirement 2: User Profile Creation and Management

**User Story:** As a registered User, I want to create and edit my profile with a description, photo, sports preferences, and skill levels, so that the platform can match me with compatible players.

#### Acceptance Criteria

1. THE Profile SHALL store a display name, short bio (up to 300 characters), optional profile picture, list of preferred Sports, and optional Skill_Level per Sport.
2. WHEN a User saves a Profile with a display name and at least one preferred Sport, THE Profile SHALL be marked complete and eligible for matching.
3. IF a User submits a bio exceeding 300 characters, THEN THE Profile SHALL reject the input and display a character-limit error.
4. WHEN a User uploads a profile picture, THE Profile SHALL accept JPEG, PNG, and WebP formats up to 5 MB and store a resized thumbnail.
5. IF a User uploads a file that is not JPEG, PNG, or WebP, or exceeds 5 MB, THEN THE Profile SHALL reject the upload and display a descriptive error.
6. THE Profile SHALL allow a User to select one or more Sports from a predefined list of at least 10 sports.
7. THE Profile SHALL allow a User to optionally assign a Skill_Level (Beginner, Intermediate, Advanced) to each selected Sport.
8. WHEN a User updates their Profile, THE Profile SHALL persist the changes and reflect them immediately in the UI.

---

### Requirement 3: AI-Powered Profile Enrichment

**User Story:** As a User, I want the platform to automatically detect my sports interests from my bio and profile photo, so that my profile is enriched without manual effort.

#### Acceptance Criteria

1. WHEN a User saves a bio containing text, THE AI_Enrichment_Service SHALL analyze the text using NLP and suggest Sports that match detected interests within 5 seconds.
2. WHEN a User uploads a profile picture, THE AI_Enrichment_Service SHALL analyze the image using vision AI and suggest Sports inferred from visual content within 10 seconds.
3. WHEN the AI_Enrichment_Service produces sport suggestions, THE Profile SHALL display the suggestions to the User with an option to accept or dismiss each suggestion individually.
4. IF the AI_Enrichment_Service cannot determine any sports from the bio or photo, THEN THE Profile SHALL display a message indicating no suggestions were found and prompt the User to select sports manually.
5. THE AI_Enrichment_Service SHALL compute a Compatibility_Score between two Users for a shared Sport based on Skill_Level, bio content, and inferred interests.
6. WHEN the Matching_Engine assembles a Group, THE Matching_Engine SHALL use Compatibility_Scores to rank and select the most compatible available Users.

---

### Requirement 4: Availability System ("ShowUpToday?")

**User Story:** As a User, I want to receive a daily availability prompt and respond with a single tap, so that the platform knows when I am free to play without requiring manual scheduling.

#### Acceptance Criteria

1. THE Notification_Service SHALL send an Availability_Prompt to each User with a complete Profile at a configurable time each day (default: 08:00 local time).
2. WHEN a User receives an Availability_Prompt, THE Availability_Response interface SHALL present a Yes button and a No button requiring a single interaction to submit.
3. WHEN a User taps Yes on an Availability_Prompt, THE Availability_Response SHALL be recorded with a timestamp and the User SHALL be marked available for matching for that day.
4. WHEN a User taps No on an Availability_Prompt, THE Availability_Response SHALL be recorded and the User SHALL be excluded from same-day matching.
5. IF a User does not respond to an Availability_Prompt within 2 hours, THEN THE Notification_Service SHALL send one follow-up reminder.
6. WHEN a User responds Yes, THE Availability_Response interface SHALL optionally allow the User to specify which Sports they are available for that day.
7. THE Availability_Response SHALL allow a User to change their response from Yes to No or No to Yes at any time before matching occurs.
8. THE Availability_Response SHALL track availability history per User to support future smart recommendations.

---

### Requirement 5: Smart Group Matching

**User Story:** As an available User, I want to be automatically matched into a sport-appropriate group with compatible players nearby, so that I can join an activity without manually searching for teammates.

#### Acceptance Criteria

1. WHEN the Matching_Engine runs, THE Matching_Engine SHALL group available Users by their shared Sport preferences.
2. THE Matching_Engine SHALL enforce the following group-size constraints per Sport: Football 10–14 players, Basketball 6–10 players, Tennis 2–4 players, and configurable ranges for other Sports.
3. WHEN the Matching_Engine assembles a Group, THE Matching_Engine SHALL prioritize Users with higher mutual Compatibility_Scores.
4. WHERE proximity data is available, THE Matching_Engine SHALL prefer to match Users within a configurable radius (default: 10 km).
5. WHEN a Group reaches the minimum required size for its Sport, THE Matching_Engine SHALL finalize the Group and notify all matched Users.
6. IF the number of available Users for a Sport is below the minimum group size, THEN THE Matching_Engine SHALL queue those Users and retry matching at the next scheduled interval.
7. WHEN a User is matched into a Group, THE Notification_Service SHALL send a match notification to the User within 30 seconds of Group finalization.
8. THE Matching_Engine SHALL run at least once per day at a configurable time after the Availability_Prompt response window closes.

---

### Requirement 6: Match Confirmation Workflow

**User Story:** As a matched User, I want to confirm or decline my group match, so that the group is composed only of committed participants.

#### Acceptance Criteria

1. WHEN a Group is finalized, THE Matching_Engine SHALL send each matched User a confirmation request with a deadline of 30 minutes.
2. WHEN a User confirms their match, THE Group SHALL record the User as confirmed and update the Group's confirmed-member count.
3. IF a User declines their match or does not respond within the confirmation deadline, THEN THE Matching_Engine SHALL remove the User from the Group and attempt to fill the vacancy from the queue.
4. WHEN all minimum-required members of a Group have confirmed, THE Group SHALL transition to the Active state and the Group_Chat SHALL be created.
5. IF a Group cannot reach minimum confirmed members after one re-fill attempt, THEN THE Matching_Engine SHALL dissolve the Group and notify affected Users.
6. WHEN a Group is dissolved, THE Notification_Service SHALL inform affected Users and invite them to remain available for the next matching cycle.

---

### Requirement 7: Captain Selection and Coordination Tools

**User Story:** As a group member, I want a captain to be automatically assigned so that someone is responsible for coordinating the event logistics.

#### Acceptance Criteria

1. WHEN a Group transitions to the Active state, THE Matching_Engine SHALL randomly select one confirmed member as the Captain.
2. WHEN a Captain is assigned, THE Notification_Service SHALL notify the Captain of their role and provide a link to the coordination tools.
3. THE Captain SHALL have access to coordination tools including: initiating a Poll, suggesting Venues, setting a proposed event time, and sending announcements to the Group_Chat.
4. WHEN a Captain is unable to fulfill the role, THE Captain SHALL be able to reassign the Captain role to another confirmed Group member.
5. IF the Captain does not initiate event coordination within 2 hours of assignment, THEN THE Notification_Service SHALL send a reminder to the Captain.

---

### Requirement 8: Group Chat

**User Story:** As a group member, I want a real-time group chat for my matched group, so that we can coordinate event details and communicate before and during the activity.

#### Acceptance Criteria

1. WHEN a Group transitions to the Active state, THE Group_Chat SHALL be created automatically and all confirmed members SHALL be added.
2. THE Group_Chat SHALL support real-time text messaging with delivery latency under 1 second under normal network conditions.
3. THE Group_Chat SHALL display each message with the sender's display name, profile thumbnail, and timestamp.
4. WHEN a new member joins a Group, THE Group_Chat SHALL add the member and display a system message announcing their arrival.
5. WHEN a member leaves a Group, THE Group_Chat SHALL remove the member and display a system message announcing their departure.
6. THE Group_Chat SHALL persist message history for the duration of the Event plus 24 hours after the Event end time.
7. WHEN a Poll is created in the Group_Chat, THE Group_Chat SHALL display the Poll inline with voting options and a live tally visible to all members.
8. THE Group_Chat SHALL support push notifications for new messages when the User is not actively viewing the chat.

---

### Requirement 9: Event Planning Assistance and Venue Suggestions

**User Story:** As a Captain, I want the platform to suggest nearby venues with pricing information and help the group vote on a location and time, so that event logistics are resolved quickly.

#### Acceptance Criteria

1. WHEN a Captain requests venue suggestions, THE Location_Service SHALL query nearby Venues suitable for the Group's Sport within the configured proximity radius.
2. THE Location_Service SHALL return at least 3 Venue options when available, each including name, address, distance from the group's centroid location, and available pricing information.
3. WHEN Venue options are returned, THE Captain SHALL be able to share one or more Venues to the Group_Chat as a Poll.
4. WHEN a Poll is active, THE Group_Chat SHALL allow each confirmed member to cast one vote per Poll option.
5. WHEN a Poll closes (after a configurable duration, default 30 minutes), THE Group_Chat SHALL display the winning option and notify the Captain.
6. THE Location_Service SHALL display Venue locations on an interactive map within the Event planning view.
7. WHERE weather data is available, THE Weather_Service SHALL display the forecast for the proposed event date and location alongside Venue suggestions.
8. IF no Venues are found within the proximity radius, THEN THE Location_Service SHALL expand the search radius by 5 km increments up to 3 times and notify the Captain of the expanded radius.

---

### Requirement 10: Manual Event Creation

**User Story:** As a User, I want to manually create a sports event and invite others, so that I can organize planned activities outside of the automatic matching flow.

#### Acceptance Criteria

1. THE Event creation form SHALL require: Sport, proposed date and time, minimum and maximum participant count, and a title.
2. THE Event creation form SHALL optionally accept: Venue name or address, description, and a list of invited Users by username or email.
3. WHEN a User submits a valid Event creation form, THE Event SHALL be created and the creating User SHALL be assigned as the Captain.
4. WHEN an Event is created, THE Notification_Service SHALL send invitations to all specified invited Users.
5. WHEN an invited User accepts an Event invitation, THE Event SHALL add the User to the participant list and THE Group_Chat SHALL be created or updated.
6. IF an invited User declines an Event invitation, THEN THE Event SHALL record the decline and THE Captain SHALL be notified.
7. WHEN the Event participant count reaches the maximum, THE Event SHALL close registration and notify the Captain.
8. THE Event SHALL be discoverable by other Users via a public event listing filtered by Sport, date, and proximity.

---

### Requirement 11: Notifications and Real-Time Updates

**User Story:** As a User, I want to receive timely push notifications and see real-time updates in the app, so that I never miss a match, message, or event update.

#### Acceptance Criteria

1. THE Notification_Service SHALL deliver push notifications to mobile and web clients for the following triggers: Availability_Prompt, match found, match confirmation request, Captain assignment, new Group_Chat message, Poll result, Event reminder, and Achievement unlocked.
2. WHEN a User is actively viewing the app, THE Notification_Service SHALL display in-app notifications instead of push notifications for the same triggers.
3. THE Notification_Service SHALL deliver push notifications within 5 seconds of the triggering event under normal network conditions.
4. WHEN a User receives a push notification, THE Notification_Service SHALL include a deep link that navigates the User to the relevant screen upon tap.
5. THE Notification_Service SHALL allow a User to configure which notification types they receive via a notification preferences screen.
6. WHEN a Group_Chat receives a new message, all Group members not currently viewing the chat SHALL receive a notification within 2 seconds.

---

### Requirement 12: Maps and Location Assistance

**User Story:** As a User, I want to see event locations on a map and get directions, so that I can easily find the venue on the day of the activity.

#### Acceptance Criteria

1. THE Location_Service SHALL display an interactive map showing the confirmed Event Venue pin within the Event detail screen.
2. WHEN a User taps the Venue pin on the map, THE Location_Service SHALL provide a "Get Directions" action that opens the device's default navigation application with the Venue address pre-filled.
3. THE Location_Service SHALL display the User's approximate location on the map when location permission is granted.
4. WHERE location permission is not granted, THE Location_Service SHALL prompt the User to grant permission and explain why it is needed for matching and venue suggestions.
5. THE Location_Service SHALL use the User's last known location for proximity-based matching when the User is not actively using the app.
6. THE Location_Service SHALL display a map view of all active Events near the User on a discovery screen.

---

### Requirement 13: Calendar Integration

**User Story:** As a User, I want to add confirmed events to my device calendar, so that I can keep track of my sports activities alongside my other commitments.

#### Acceptance Criteria

1. WHEN an Event is confirmed for a User, THE Calendar_Service SHALL display an "Add to Calendar" button in the Event detail screen.
2. WHEN a User taps "Add to Calendar", THE Calendar_Service SHALL create a calendar entry with the Event title, Sport, Venue address, start time, and end time in the User's chosen calendar provider (Google Calendar or Apple Calendar).
3. IF the calendar provider integration fails, THEN THE Calendar_Service SHALL display a descriptive error and offer the User an option to download an ICS file instead.
4. WHEN an Event time or Venue is updated, THE Calendar_Service SHALL update the corresponding calendar entry if one was previously created.

---

### Requirement 14: Weather-Aware Recommendations

**User Story:** As a User, I want to see weather forecasts for my upcoming events, so that I can prepare appropriately or reschedule if conditions are unsuitable.

#### Acceptance Criteria

1. WHEN an Event has a confirmed date, time, and Venue, THE Weather_Service SHALL display the weather forecast for that location and time in the Event detail screen.
2. WHEN the forecast indicates rain, extreme heat above 35°C, or wind speed above 50 km/h, THE Weather_Service SHALL display a weather advisory banner in the Event detail screen.
3. WHEN a weather advisory is triggered, THE Notification_Service SHALL send a weather alert notification to all Event participants at least 3 hours before the Event start time.
4. THE Weather_Service SHALL refresh the forecast at least every 3 hours for Events scheduled within the next 48 hours.

---

### Requirement 15: Team Balancing by Skill

**User Story:** As a Captain, I want the matching engine to balance teams by skill level, so that the game is fair and enjoyable for all participants.

#### Acceptance Criteria

1. WHEN the Matching_Engine assembles a Group for a Sport that involves two opposing teams (e.g., Football, Basketball), THE Matching_Engine SHALL distribute members across teams such that the average Skill_Level of each team differs by no more than one Skill_Level tier.
2. WHEN team assignments are finalized, THE Group_Chat SHALL display the team composition to all Group members.
3. THE Captain SHALL be able to manually adjust team assignments within the Group coordination tools.
4. WHEN a Captain adjusts team assignments, THE Group_Chat SHALL display a system message reflecting the updated team composition.

---

### Requirement 16: Gamification and Achievements

**User Story:** As a User, I want to earn achievements for participating in activities, so that I stay motivated and engaged with the platform.

#### Acceptance Criteria

1. THE Achievement system SHALL define at least the following milestones: First Event Attended, 5 Events Attended, 10 Events Attended, First Captain Role, Played 3 Different Sports, and Invited a Friend.
2. WHEN a User meets the criteria for an Achievement, THE Achievement system SHALL grant the Achievement to the User and THE Notification_Service SHALL send an Achievement unlocked notification.
3. THE Profile SHALL display all earned Achievements as badges visible to other Users.
4. THE Achievement system SHALL maintain a leaderboard ranking Users by total Achievement count, filterable by Sport.

---

### Requirement 17: Social Sharing and Invites

**User Story:** As a User, I want to share events and invite friends via social channels, so that I can grow my sports network and fill groups faster.

#### Acceptance Criteria

1. THE Event detail screen SHALL provide a "Share Event" action that generates a shareable link to the Event.
2. WHEN a User taps "Share Event", THE Event detail screen SHALL present sharing options including copy link, share via native OS share sheet, and direct invite by email or username.
3. WHEN a non-registered User opens a shared Event link, THE Auth_Service SHALL present a registration prompt before allowing the User to join the Event.
4. WHEN a registered User opens a shared Event link, THE Event SHALL add the User to the Event's join request queue and notify the Captain.

---

### Requirement 18: Multi-Language Support

**User Story:** As a User who prefers a language other than English, I want the platform UI to be available in my language, so that I can use the platform comfortably.

#### Acceptance Criteria

1. THE Prototype SHALL support at least 2 languages: English and one additional language (e.g., French, Spanish, or Arabic).
2. WHEN a User selects a preferred language in their profile settings, THE Prototype SHALL render all UI labels, error messages, and system notifications in the selected language.
3. WHEN a User's device locale matches a supported language, THE Prototype SHALL default to that language on first launch.
4. IF a UI string is not yet translated for the selected language, THEN THE Prototype SHALL fall back to the English string.

---

### Requirement 19: Responsive and Mobile-Friendly UI

**User Story:** As a User on any device, I want the platform to be fully usable on mobile, tablet, and desktop screens, so that I can access it from wherever I am.

#### Acceptance Criteria

1. THE Prototype SHALL render correctly on viewport widths from 320px (mobile) to 1440px (desktop) without horizontal scrolling.
2. THE Prototype SHALL meet WCAG 2.1 AA color contrast requirements for all text and interactive elements.
3. THE Prototype SHALL support touch interactions (tap, swipe) for all primary user flows on mobile devices.
4. WHEN a User performs a primary action (submit form, send message, respond to prompt), THE Prototype SHALL provide visual feedback within 200ms.
5. THE Prototype SHALL load the initial screen within 3 seconds on a 4G mobile connection.

---

### Requirement 20: Clean Architecture and Real-Time Infrastructure

**User Story:** As a developer and judge, I want the codebase to follow clean architecture principles and support real-time features, so that the platform is maintainable, scalable, and production-ready.

#### Acceptance Criteria

1. THE Prototype SHALL separate concerns into at least three distinct layers: presentation, business logic, and data access.
2. THE Prototype SHALL use a real-time transport protocol (WebSocket or Server-Sent Events) for Group_Chat messages and match notifications.
3. WHEN a WebSocket connection is lost, THE Prototype SHALL attempt automatic reconnection with exponential backoff up to 5 retries.
4. THE Prototype SHALL include a README with setup instructions, architecture overview, and environment variable documentation.
5. THE Prototype SHALL use environment variables for all secrets, API keys, and environment-specific configuration values.
6. THE Prototype SHALL not store plaintext passwords; THE Auth_Service SHALL hash passwords using bcrypt or an equivalent algorithm with a cost factor of at least 12.
