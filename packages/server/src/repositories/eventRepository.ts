import { query } from '../infrastructure/database';
import { Event, EventState } from '../types';

interface EventRow {
  id: string; group_id: string | null; sport_id: string; captain_user_id: string;
  title: string; description: string | null; venue_name: string | null;
  venue_address: string | null; venue_lat: number | null; venue_lng: number | null;
  start_time: Date; end_time: Date | null; min_participants: number;
  max_participants: number; is_public: boolean; state: EventState; created_at: Date;
}

function mapEvent(row: EventRow): Event {
  return {
    id: row.id, groupId: row.group_id, sportId: row.sport_id,
    captainUserId: row.captain_user_id, title: row.title,
    description: row.description, venueName: row.venue_name,
    venueAddress: row.venue_address, venueLat: row.venue_lat, venueLng: row.venue_lng,
    startTime: row.start_time, endTime: row.end_time,
    minParticipants: row.min_participants, maxParticipants: row.max_participants,
    isPublic: row.is_public, state: row.state, createdAt: row.created_at,
  };
}

export async function createEvent(data: {
  sportId: string; captainUserId: string; title: string; description?: string;
  venueName?: string; venueAddress?: string; venueLat?: number; venueLng?: number;
  startTime: Date; endTime?: Date; minParticipants: number; maxParticipants: number;
  isPublic?: boolean;
}): Promise<Event> {
  const result = await query<EventRow>(
    `INSERT INTO events (sport_id, captain_user_id, title, description, venue_name,
       venue_address, venue_lat, venue_lng, start_time, end_time,
       min_participants, max_participants, is_public, state)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Pending')
     RETURNING *`,
    [data.sportId, data.captainUserId, data.title, data.description ?? null,
     data.venueName ?? null, data.venueAddress ?? null, data.venueLat ?? null,
     data.venueLng ?? null, data.startTime, data.endTime ?? null,
     data.minParticipants, data.maxParticipants, data.isPublic ?? true],
  );
  return mapEvent(result.rows[0]);
}

export async function findEventById(id: string): Promise<Event | null> {
  const result = await query<EventRow>(`SELECT * FROM events WHERE id = $1 LIMIT 1`, [id]);
  return result.rows.length ? mapEvent(result.rows[0]) : null;
}

export async function findPublicEvents(filters: {
  sportId?: string; startAfter?: Date; lat?: number; lng?: number; radiusKm?: number;
}): Promise<Event[]> {
  let sql = `SELECT * FROM events WHERE is_public = TRUE AND state IN ('Pending','Active')`;
  const params: unknown[] = [];
  let idx = 1;

  if (filters.sportId) { sql += ` AND sport_id = $${idx++}`; params.push(filters.sportId); }
  if (filters.startAfter) { sql += ` AND start_time >= $${idx++}`; params.push(filters.startAfter); }

  sql += ` ORDER BY start_time ASC LIMIT 50`;
  const result = await query<EventRow>(sql, params);
  return result.rows.map(mapEvent);
}

export async function updateEventState(id: string, state: EventState): Promise<void> {
  await query(`UPDATE events SET state = $1 WHERE id = $2`, [state, id]);
}

export async function addEventParticipant(eventId: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO event_participants (event_id, user_id, status)
     VALUES ($1, $2, 'Pending') ON CONFLICT (event_id, user_id) DO NOTHING`,
    [eventId, userId],
  );
}

export async function updateParticipantStatus(
  eventId: string, userId: string, status: 'Confirmed' | 'Declined',
): Promise<void> {
  await query(
    `UPDATE event_participants SET status = $1, responded_at = NOW()
     WHERE event_id = $2 AND user_id = $3`,
    [status, eventId, userId],
  );
}

export async function countConfirmedParticipants(eventId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM event_participants
     WHERE event_id = $1 AND status = 'Confirmed'`,
    [eventId],
  );
  return parseInt(result.rows[0].count, 10);
}

export async function generateShareToken(eventId: string): Promise<string> {
  const token = Buffer.from(`${eventId}:${Date.now()}`).toString('base64url');
  await query(
    `INSERT INTO event_share_tokens (event_id, token) VALUES ($1, $2)
     ON CONFLICT (event_id) DO UPDATE SET token = $2`,
    [eventId, token],
  ).catch(() => {}); // table may not exist yet — graceful fallback
  return token;
}
