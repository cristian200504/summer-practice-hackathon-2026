/**
 * Shared domain types for the ShowUp2Move server.
 * These types mirror the database schema and are used across all layers.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type GroupState = 'Pending' | 'Active' | 'Dissolved';

export type ConfirmationStatus = 'Pending' | 'Confirmed' | 'Declined';

export type MessageType = 'user' | 'system';

export type NotificationType =
  | 'availability_prompt'
  | 'match_found'
  | 'match_confirmation'
  | 'captain_assigned'
  | 'new_message'
  | 'poll_result'
  | 'event_reminder'
  | 'achievement_unlocked'
  | 'weather_alert';

export type AISuggestionSource = 'bio' | 'photo';

export type AISuggestionStatus = 'pending' | 'accepted' | 'dismissed';

export type EventState = 'open' | 'full' | 'cancelled' | 'completed';

// ── Domain entities ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  passwordHash: string | null;
  oauthProvider: string | null;
  oauthId: string | null;
  createdAt: Date;
}

export interface Profile {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  photoUrl: string | null;
  thumbnailUrl: string | null;
  isComplete: boolean;
  updatedAt: Date;
}

export interface Sport {
  id: string;
  name: string;
  minGroupSize: number;
  maxGroupSize: number;
  isTeamSport: boolean;
}

export interface UserSport {
  id: string;
  userId: string;
  sportId: string;
  skillLevel: SkillLevel | null;
}

export interface AvailabilityResponse {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  available: boolean;
  lockedForMatching: boolean;
  sportIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id: string;
  sportId: string;
  state: GroupState;
  captainUserId: string | null;
  createdAt: Date;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  confirmationStatus: ConfirmationStatus;
  team: 'A' | 'B' | null;
  confirmedAt: Date | null;
}

export interface Event {
  id: string;
  groupId: string | null;
  sportId: string;
  captainUserId: string;
  title: string;
  description: string | null;
  venueName: string | null;
  venueAddress: string | null;
  venueLat: number | null;
  venueLng: number | null;
  startTime: Date;
  endTime: Date | null;
  minParticipants: number;
  maxParticipants: number;
  isPublic: boolean;
  state: EventState;
  createdAt: Date;
}

export interface Message {
  id: string;
  groupId: string;
  senderId: string | null;
  content: string;
  messageType: MessageType;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface Poll {
  id: string;
  groupId: string;
  creatorId: string;
  question: string;
  closesAt: Date;
  isClosed: boolean;
}

export interface PollOption {
  id: string;
  pollId: string;
  label: string;
}

export interface PollVote {
  id: string;
  pollId: string;
  optionId: string;
  userId: string;
  votedAt: Date;
}

export interface AISuggestion {
  id: string;
  userId: string;
  sportId: string;
  source: AISuggestionSource;
  confidence: number;
  status: AISuggestionStatus;
  createdAt: Date;
}

export interface CompatibilityScore {
  id: string;
  userAId: string;
  userBId: string;
  sportId: string;
  score: number; // [0.0, 1.0]
  computedAt: Date;
}

export interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string;
  iconUrl: string | null;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  grantedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  deepLink: string;
  isRead: boolean;
  createdAt: Date;
}

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
}

// ── API response helpers ─────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
  correlationId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}
