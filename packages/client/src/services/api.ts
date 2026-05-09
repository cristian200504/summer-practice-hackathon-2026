/**
 * Thin API client for the ShowUp2Move backend.
 * All requests include the JWT from localStorage when available.
 */

const BASE_URL = '/api';

function getToken(): string | null {
  return localStorage.getItem('showup2move_token');
}

export { getToken };

export function setToken(token: string): void {
  localStorage.setItem('showup2move_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('showup2move_token');
}

/**
 * Decode the stored JWT and return the userId claim.
 * Returns null if no token is stored or the token is malformed.
 */
export function getStoredUserId(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    // JWT payload is the second base64url-encoded segment
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return (payload as { userId?: string }).userId ?? null;
  } catch {
    return null;
  }
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, ...init } = options;
  const headers = new Headers(init.headers);

  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data?.message ?? 'Request failed');
    (err as Error & { code?: string; status?: number }).code = data?.error;
    (err as Error & { code?: string; status?: number }).status = res.status;
    throw err;
  }

  return data as T;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  register: (email: string, password: string) =>
    request<{ userId: string; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    }),

  login: (email: string, password: string) =>
    request<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    }),

  logout: () =>
    request<void>('/auth/logout', { method: 'POST' }),

  requestPasswordReset: (email: string) =>
    request<{ message: string }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    }),

  confirmPasswordReset: (token: string, newPassword: string) =>
    request<{ message: string }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
      skipAuth: true,
    }),
};

// ── Profiles ─────────────────────────────────────────────────────────────────

export const profiles = {
  create: (data: { displayName: string; bio?: string; sports?: Array<{ sportId: string; skillLevel?: string }> }) =>
    request<unknown>('/profiles', { method: 'POST', body: JSON.stringify(data) }),

  update: (userId: string, data: { displayName?: string; bio?: string; sports?: Array<{ sportId: string; skillLevel?: string }> }) =>
    request<unknown>(`/profiles/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),

  get: (userId: string) =>
    request<unknown>(`/profiles/${userId}`),

  uploadPhoto: (userId: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    return request<{ url: string; thumbnailUrl: string }>(`/profiles/${userId}/photo`, {
      method: 'POST',
      body: form,
    });
  },

  updateSports: (userId: string, sports: Array<{ sportId: string; skillLevel?: string }>) =>
    request<unknown>(`/profiles/${userId}/sports`, { method: 'PUT', body: JSON.stringify(sports) }),
};

// ── Sports ────────────────────────────────────────────────────────────────────

export interface Sport {
  id: string;
  name: string;
  minGroupSize: number;
  maxGroupSize: number;
  isTeamSport: boolean;
}

export const sports = {
  list: () => request<Sport[]>('/sports'),
};

// ── Availability ─────────────────────────────────────────────────────────────

export interface AvailabilityResponse {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  available: boolean;
  sportIds: string[];
  lockedForMatching: boolean;
  createdAt: string;
  updatedAt: string;
}

export const availability = {
  /** Record a Yes/No availability response for today. */
  record: (available: boolean, sportIds?: string[]) =>
    request<AvailabilityResponse>('/availability', {
      method: 'POST',
      body: JSON.stringify({ available, sportIds: sportIds ?? [] }),
    }),

  /** Update an existing availability response (before matching lock). */
  update: (id: string, available: boolean, sportIds?: string[]) =>
    request<AvailabilityResponse>(`/availability/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ available, sportIds: sportIds ?? [] }),
    }),

  /** Fetch the current user's availability response for today, or null if none. */
  getToday: () =>
    request<AvailabilityResponse | null>('/availability/today'),
};

// ── Achievements ──────────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string;
  iconUrl: string | null;
  grantedAt: string;
}

export const achievements = {
  getForUser: (userId: string) =>
    request<Achievement[]>(`/users/${userId}/achievements`),
};

// ── Groups ────────────────────────────────────────────────────────────────────

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  confirmationStatus: 'Pending' | 'Confirmed' | 'Declined';
  team: 'A' | 'B' | null;
  confirmedAt: string | null;
}

export interface Group {
  id: string;
  sportId: string;
  state: 'Pending' | 'Active' | 'Dissolved';
  captainUserId: string | null;
  createdAt: string;
}

export const groups = {
  get: (groupId: string) =>
    request<{ group: Group; members: GroupMember[] }>(`/groups/${groupId}`),

  confirm: (groupId: string) =>
    request<{ message: string }>(`/groups/${groupId}/confirm`, { method: 'POST' }),

  decline: (groupId: string) =>
    request<{ message: string }>(`/groups/${groupId}/decline`, { method: 'POST' }),

  getTeams: (groupId: string) =>
    request<{ teamA: string[]; teamB: string[] }>(`/groups/${groupId}/teams`),
};

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string | null;
  content: string;
  messageType: 'text' | 'system' | 'poll';
  createdAt: string;
  expiresAt: string | null;
}

export interface PollOption {
  id: string;
  pollId: string;
  label: string;
  voteCount?: number;
}

export interface ChatPoll {
  id: string;
  groupId: string;
  creatorId: string;
  question: string;
  closesAt: string;
  isClosed: boolean;
}

export const chat = {
  getMessages: (groupId: string, limit = 50, cursor?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return request<{ messages: ChatMessage[]; cursor: string | null }>(
      `/groups/${groupId}/messages?${params}`,
    );
  },

  sendMessage: (groupId: string, content: string) =>
    request<ChatMessage>(`/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  createPoll: (groupId: string, question: string, options: string[], durationMinutes = 30) =>
    request<{ poll: ChatPoll; options: PollOption[] }>(`/groups/${groupId}/polls`, {
      method: 'POST',
      body: JSON.stringify({ question, options, durationMinutes }),
    }),

  vote: (pollId: string, optionId: string) =>
    request<{ message: string }>(`/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionId }),
    }),
};

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'availability_prompt' | 'match_found' | 'match_confirmation' | 'captain_assigned'
  | 'new_message' | 'poll_result' | 'event_reminder' | 'achievement_unlocked' | 'weather_alert';

export const notifications = {
  getPreferences: () =>
    request<Record<NotificationType, boolean>>('/notifications/preferences'),

  updatePreferences: (prefs: Partial<Record<NotificationType, boolean>>) =>
    request<{ message: string }>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),

  getVapidPublicKey: () =>
    request<{ publicKey: string | null }>('/notifications/vapid-public-key', { skipAuth: true }),

  subscribe: (subscription: PushSubscriptionJSON) =>
    request<{ message: string }>('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    }),
};

// ── Venues & Weather ──────────────────────────────────────────────────────────

export interface Venue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  pricing?: string;
}

export interface WeatherForecast {
  datetime: string;
  description: string;
  tempCelsius: number;
  windSpeedKmh: number;
  isRaining: boolean;
  advisory: string | null;
}

export const venues = {
  search: (sport: string, lat: number, lng: number, radius?: number) => {
    const params = new URLSearchParams({ sport, lat: String(lat), lng: String(lng) });
    if (radius) params.set('radius', String(radius));
    return request<{ venues: Venue[]; expandedRadius: number | null }>(`/venues?${params}`);
  },
};

export const weather = {
  getForecast: (lat: number, lng: number, datetime?: string) => {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (datetime) params.set('datetime', datetime);
    return request<WeatherForecast>(`/weather?${params}`);
  },
};

// ── Events ────────────────────────────────────────────────────────────────────

export interface EventData {
  id: string;
  sportId: string;
  captainUserId: string;
  title: string;
  description: string | null;
  venueName: string | null;
  venueAddress: string | null;
  venueLat?: number;
  venueLng?: number;
  startTime: string;
  minParticipants: number;
  maxParticipants: number;
  isPublic: boolean;
  state: string;
  createdAt: string;
}

export const events = {
  list: (sportId?: string) => {
    const params = new URLSearchParams();
    if (sportId) params.set('sportId', sportId);
    return request<EventData[]>(`/events?${params}`);
  },

  get: (id: string) => request<EventData>(`/events/${id}`),

  create: (data: {
    sportId: string; title: string; startTime: string;
    minParticipants: number; maxParticipants: number;
    description?: string; venueName?: string; venueAddress?: string;
    invitedUserIds?: string[];
  }) => request<EventData>('/events', { method: 'POST', body: JSON.stringify(data) }),

  respondToInvite: (id: string, accept: boolean) =>
    request<{ message: string }>(`/events/${id}/invite-response`, {
      method: 'POST', body: JSON.stringify({ accept }),
    }),

  getShareLink: (id: string) =>
    request<{ url: string }>(`/events/${id}/share-link`),
};

// ── Compatibility & Recommendations ──────────────────────────────────────────

export interface Recommendation {
  userId: string;
  score: number;
  displayName: string;
  thumbnailUrl: string | null;
}

export const compatibility = {
  getRecommendations: (userId: string, sportId?: string) => {
    const params = new URLSearchParams();
    if (sportId) params.set('sport', sportId);
    return request<Recommendation[]>(`/users/${userId}/recommendations?${params}`);
  },

  getScore: (userId: string, otherId: string, sportId?: string) => {
    const params = new URLSearchParams();
    if (sportId) params.set('sport', sportId);
    return request<{ score: number } | Array<{ sportId: string; sportName: string; score: number }>>(
      `/users/${userId}/compatibility/${otherId}?${params}`,
    );
  },
};

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  thumbnailUrl: string | null;
  achievementCount: number;
}

export const leaderboard = {
  get: (sportId?: string) => {
    const params = new URLSearchParams();
    if (sportId) params.set('sport', sportId);
    return request<LeaderboardEntry[]>(`/leaderboard?${params}`);
  },
};

// ── Calendar ──────────────────────────────────────────────────────────────────

export const calendar = {
  addToCalendar: (eventId: string, accessToken?: string) =>
    request<{ success: boolean; entryId?: string; fallback?: string; icsContent?: string; filename?: string }>(
      `/events/${eventId}/calendar`,
      {
        method: 'POST',
        body: JSON.stringify(accessToken ? { provider: 'google', accessToken } : {}),
      },
    ),

  getIcsUrl: (eventId: string) => `/api/events/${eventId}/calendar.ics`,
};

// ── Direct Messages ───────────────────────────────────────────────────────────

export interface DmConversation {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
  otherUserId: string;
  otherDisplayName: string;
  otherThumbnailUrl: string | null;
  unreadCount: number;
  lastMessageContent: string | null;
  lastMessageAt: string | null;
}

export interface DmMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface UserSearchResult {
  userId: string;
  email: string;
  displayName: string;
  thumbnailUrl: string | null;
}

export const dm = {
  /** List all DM conversations for the current user. */
  listConversations: () =>
    request<DmConversation[]>('/dm/conversations'),

  /** Get or create a conversation with another user. */
  getOrCreateConversation: (otherUserId: string) =>
    request<DmConversation>('/dm/conversations', {
      method: 'POST',
      body: JSON.stringify({ otherUserId }),
    }),

  /** Get paginated message history for a conversation. */
  getMessages: (conversationId: string, limit = 50, cursor?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return request<{ messages: DmMessage[]; cursor: string | null }>(
      `/dm/conversations/${conversationId}/messages?${params}`,
    );
  },

  /** Send a DM in a conversation. */
  sendMessage: (conversationId: string, content: string) =>
    request<DmMessage>(`/dm/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

export const users = {
  /** Search users by display name (for starting new DM conversations). */
  search: (q: string) => {
    const params = new URLSearchParams({ q });
    return request<UserSearchResult[]>(`/users/search?${params}`);
  },
};
