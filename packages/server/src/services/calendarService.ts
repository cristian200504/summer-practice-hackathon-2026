import { Event } from '../types';

/**
 * Calendar Service — Google Calendar API integration with ICS fallback.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

// ── ICS generation ────────────────────────────────────────────────────────────

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}

/**
 * Generate an ICS file string for an event.
 * Used as fallback when Google Calendar API fails (Req 13.3).
 */
export function generateICS(event: Event): string {
  const now = formatICSDate(new Date());
  const start = formatICSDate(event.startTime);
  const end = event.endTime ? formatICSDate(event.endTime) : formatICSDate(
    new Date(event.startTime.getTime() + 2 * 60 * 60 * 1000), // default 2h duration
  );

  const location = [event.venueName, event.venueAddress].filter(Boolean).join(', ');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ShowUp2Move//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@showup2move`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(event.title)}`,
    event.description ? `DESCRIPTION:${escapeICS(event.description)}` : '',
    location ? `LOCATION:${escapeICS(location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

// ── Google Calendar API ───────────────────────────────────────────────────────

interface CalendarEntry {
  entryId: string;
  provider: 'google';
}

/**
 * Create a Google Calendar event for a user.
 * Requires a valid OAuth access token for the user.
 *
 * Falls back gracefully — callers should offer ICS download on failure.
 * Requirements: 13.1, 13.2
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  event: Event,
): Promise<CalendarEntry> {
  const endTime = event.endTime ?? new Date(event.startTime.getTime() + 2 * 60 * 60 * 1000);

  const body = {
    summary: event.title,
    description: event.description ?? '',
    location: [event.venueName, event.venueAddress].filter(Boolean).join(', '),
    start: { dateTime: event.startTime.toISOString() },
    end: { dateTime: endTime.toISOString() },
  };

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Google Calendar API error: ${res.status}`);
  }

  const data = await res.json() as { id: string };
  return { entryId: data.id, provider: 'google' };
}

/**
 * Update an existing Google Calendar event.
 * Requirements: 13.4
 */
export async function updateGoogleCalendarEvent(
  accessToken: string,
  entryId: string,
  event: Event,
): Promise<void> {
  const endTime = event.endTime ?? new Date(event.startTime.getTime() + 2 * 60 * 60 * 1000);

  const body = {
    summary: event.title,
    description: event.description ?? '',
    location: [event.venueName, event.venueAddress].filter(Boolean).join(', '),
    start: { dateTime: event.startTime.toISOString() },
    end: { dateTime: endTime.toISOString() },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${entryId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    throw new Error(`Google Calendar update error: ${res.status}`);
  }
}
