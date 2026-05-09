/**
 * Availability Prompt Job
 *
 * Cron job that:
 *  1. Queries all users with complete profiles.
 *  2. Sends each an Availability_Prompt via the NotificationService.
 *  3. Schedules a one-time follow-up reminder 2 hours later for any user who
 *     has not yet submitted an availability response for today.
 *
 * Requirements: 4.1, 4.5
 */

import cron from 'node-cron';
import { env } from '../config/env';
import { query } from '../infrastructure/database';
import { notificationService } from '../services/notificationService';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the current date as a YYYY-MM-DD string in the server's local time.
 */
function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetch all user IDs whose profiles are marked complete.
 */
async function fetchUsersWithCompleteProfiles(): Promise<string[]> {
  const result = await query<{ user_id: string }>(
    `SELECT user_id FROM profiles WHERE is_complete = TRUE`,
  );
  return result.rows.map((r) => r.user_id);
}

/**
 * Check whether a user has already submitted an availability response for today.
 */
async function hasRespondedToday(userId: string, date: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    `SELECT id FROM availability_responses WHERE user_id = $1 AND date = $2 LIMIT 1`,
    [userId, date],
  );
  return result.rows.length > 0;
}

// ── Core dispatch logic ───────────────────────────────────────────────────────

/**
 * Send availability prompts to all users with complete profiles and schedule
 * follow-up reminders for non-responders after 2 hours.
 *
 * Exported so it can be called directly in tests or manual triggers.
 */
export async function dispatchAvailabilityPrompts(): Promise<void> {
  console.info('[availabilityPromptJob] Starting availability prompt dispatch');

  let userIds: string[];
  try {
    userIds = await fetchUsersWithCompleteProfiles();
  } catch (err) {
    console.error('[availabilityPromptJob] Failed to fetch users with complete profiles:', err);
    return;
  }

  if (userIds.length === 0) {
    console.info('[availabilityPromptJob] No users with complete profiles found — skipping');
    return;
  }

  console.info(`[availabilityPromptJob] Dispatching prompts to ${userIds.length} user(s)`);

  // Send prompts concurrently; individual failures are logged but do not abort the batch.
  await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        await notificationService.sendAvailabilityPrompt(userId);
      } catch (err) {
        console.error(
          `[availabilityPromptJob] Failed to send prompt to user ${userId}:`,
          err,
        );
      }
    }),
  );

  // Schedule a one-time follow-up reminder 2 hours later for non-responders.
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  setTimeout(async () => {
    console.info('[availabilityPromptJob] Running follow-up reminder check');
    const date = todayDateString();

    await Promise.allSettled(
      userIds.map(async (userId) => {
        try {
          const responded = await hasRespondedToday(userId, date);
          if (!responded) {
            await notificationService.sendFollowUpReminder(userId);
          }
        } catch (err) {
          console.error(
            `[availabilityPromptJob] Failed to send follow-up reminder to user ${userId}:`,
            err,
          );
        }
      }),
    );

    console.info('[availabilityPromptJob] Follow-up reminder check complete');
  }, TWO_HOURS_MS);

  console.info('[availabilityPromptJob] Availability prompt dispatch complete');
}

// ── Cron registration ─────────────────────────────────────────────────────────

/**
 * Register the availability prompt cron job.
 * Schedule is read from the AVAILABILITY_PROMPT_CRON env var (default: '0 8 * * *').
 */
export function registerAvailabilityPromptJob(): void {
  const schedule = env.AVAILABILITY_PROMPT_CRON;

  if (!cron.validate(schedule)) {
    console.error(
      `[availabilityPromptJob] Invalid cron expression "${schedule}" — job not registered`,
    );
    return;
  }

  cron.schedule(schedule, () => {
    dispatchAvailabilityPrompts().catch((err: unknown) => {
      console.error('[availabilityPromptJob] Unhandled error during dispatch:', err);
    });
  });

  console.info(
    `[availabilityPromptJob] Registered with schedule "${schedule}"`,
  );
}
