import webpush from 'web-push';
import { env } from '../config/env';
import { query } from '../infrastructure/database';
import { publishToRoom } from '../infrastructure/websocket';
import { NotificationType } from '../types';

/**
 * Notification Service — full VAPID Web Push implementation.
 *
 * Delivers push notifications to subscribed clients via the Web Push API.
 * When a user is active in the app, in-app notifications are delivered via
 * WebSocket instead (Req 11.2).
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.6
 */

// ── VAPID configuration ───────────────────────────────────────────────────────

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface NotificationPreferencesRow {
  type: string;
  enabled: boolean;
}

interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  deepLink: string;
  data?: Record<string, unknown>;
}

// ── Repository helpers ────────────────────────────────────────────────────────

async function getPushSubscriptions(userId: string): Promise<PushSubscriptionRow[]> {
  const result = await query<PushSubscriptionRow>(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId],
  );
  return result.rows;
}

async function isNotificationEnabled(userId: string, type: NotificationType): Promise<boolean> {
  // If no preference row exists, default to enabled
  const result = await query<NotificationPreferencesRow>(
    `SELECT enabled FROM notification_preferences WHERE user_id = $1 AND type = $2 LIMIT 1`,
    [userId, type],
  );
  if (result.rows.length === 0) return true;
  return result.rows[0].enabled;
}

async function persistNotification(userId: string, payload: NotificationPayload): Promise<void> {
  await query(
    `INSERT INTO notifications (user_id, type, title, body, deep_link)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, payload.type, payload.title, payload.body, payload.deepLink],
  ).catch(() => {}); // non-critical — don't block delivery
}

// ── Core delivery ─────────────────────────────────────────────────────────────

/**
 * Send a push notification to a user.
 * - Persists the notification to the DB.
 * - Delivers via Web Push (VAPID) to all registered subscriptions.
 * - Also broadcasts via WebSocket for in-app delivery (Req 11.2).
 * - Delivery SLA: ≤ 5 seconds (Req 11.3).
 */
async function sendNotification(userId: string, payload: NotificationPayload): Promise<void> {
  // Check user preference
  const enabled = await isNotificationEnabled(userId, payload.type).catch(() => true);
  if (!enabled) return;

  // Persist to DB
  await persistNotification(userId, payload);

  // In-app delivery via WebSocket (Req 11.2)
  await publishToRoom(`user:${userId}`, {
    type: 'notification',
    payload,
  }).catch(() => {});

  // Push notification via VAPID (Req 11.1, 11.3, 11.4)
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.info(`[NotificationService] VAPID not configured — skipping push for user ${userId}`);
    return;
  }

  const subscriptions = await getPushSubscriptions(userId).catch(() => []);
  if (subscriptions.length === 0) return;

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: { deepLink: payload.deepLink, ...payload.data },
  });

  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        pushPayload,
      ).catch((err: unknown) => {
        // Remove expired/invalid subscriptions
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [sub.endpoint]).catch(() => {});
        }
      }),
    ),
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export class NotificationService {
  async sendAvailabilityPrompt(userId: string): Promise<void> {
    await sendNotification(userId, {
      type: 'availability_prompt',
      title: 'ShowUpToday? 🏃',
      body: 'Are you available to play today? Tap to respond.',
      deepLink: '/dashboard',
    });
  }

  async sendFollowUpReminder(userId: string): Promise<void> {
    await sendNotification(userId, {
      type: 'availability_prompt',
      title: 'Still available? ⏰',
      body: "Don't forget to respond to today's availability prompt.",
      deepLink: '/dashboard',
    });
  }

  async sendMatchFound(userId: string, groupId: string): Promise<void> {
    await sendNotification(userId, {
      type: 'match_found',
      title: 'Match found! 🎉',
      body: 'You have been matched into a group. Confirm your spot now.',
      deepLink: `/dashboard`,
      data: { groupId },
    });
  }

  async sendMatchConfirmation(userId: string, groupId: string, deadlineMinutes: number): Promise<void> {
    await sendNotification(userId, {
      type: 'match_confirmation',
      title: 'Confirm your match ✅',
      body: `You have ${deadlineMinutes} minutes to confirm your spot.`,
      deepLink: `/dashboard`,
      data: { groupId },
    });
  }

  async sendCaptainAssigned(userId: string, groupId: string): Promise<void> {
    await sendNotification(userId, {
      type: 'captain_assigned',
      title: "You're the Captain! 👑",
      body: 'Coordinate the event for your group.',
      deepLink: `/chat/${groupId}`,
      data: { groupId },
    });
  }

  async sendGroupDissolved(userId: string, groupId: string): Promise<void> {
    await sendNotification(userId, {
      type: 'match_found',
      title: 'Group dissolved 😔',
      body: 'Your group could not be confirmed. Stay available for the next cycle.',
      deepLink: '/dashboard',
      data: { groupId },
    });
  }

  async sendNewMessage(userId: string, groupId: string, senderName: string): Promise<void> {
    await sendNotification(userId, {
      type: 'new_message',
      title: `New message from ${senderName}`,
      body: 'Tap to view the group chat.',
      deepLink: `/chat/${groupId}`,
      data: { groupId },
    });
  }

  async sendPollResult(userId: string, groupId: string, winner: string): Promise<void> {
    await sendNotification(userId, {
      type: 'poll_result',
      title: 'Poll closed 📊',
      body: `Winner: ${winner}`,
      deepLink: `/chat/${groupId}`,
      data: { groupId },
    });
  }

  async sendEventReminder(userId: string, eventId: string, eventTitle: string): Promise<void> {
    await sendNotification(userId, {
      type: 'event_reminder',
      title: `Reminder: ${eventTitle} 📅`,
      body: 'Your event is coming up soon.',
      deepLink: `/events/${eventId}`,
      data: { eventId },
    });
  }

  async sendAchievementUnlocked(userId: string, achievementTitle: string): Promise<void> {
    await sendNotification(userId, {
      type: 'achievement_unlocked',
      title: 'Achievement unlocked! 🏅',
      body: achievementTitle,
      deepLink: '/profile',
    });
  }

  async sendWeatherAlert(userId: string, eventId: string, advisory: string): Promise<void> {
    await sendNotification(userId, {
      type: 'weather_alert',
      title: 'Weather alert ⚠️',
      body: advisory,
      deepLink: `/events/${eventId}`,
      data: { eventId },
    });
  }
}

export const notificationService = new NotificationService();
