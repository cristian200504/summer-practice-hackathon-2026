import cron from 'node-cron';
import { env } from '../config/env';
import { runMatchingCycle } from '../services/matchingEngine';
import { notificationService } from '../services/notificationService';
import { findMembersByGroupId } from '../repositories/groupRepository';

/**
 * Matching Engine Job
 *
 * Cron job that:
 * 1. Runs the matching cycle once per day at the configured time.
 * 2. For each finalized group, sends match notifications to all members
 *    within 30 seconds of group finalization (Req 5.7).
 *
 * Requirements: 5.5, 5.7, 5.8
 */

/**
 * Run the matching cycle and dispatch match notifications.
 * Exported for direct invocation in tests or manual triggers.
 */
export async function runMatchingJob(): Promise<void> {
  console.info('[matchingEngineJob] Starting matching engine run');

  const today = new Date();
  let groups;

  try {
    groups = await runMatchingCycle(today);
  } catch (err) {
    console.error('[matchingEngineJob] Matching cycle failed:', err);
    return;
  }

  if (groups.length === 0) {
    console.info('[matchingEngineJob] No groups created — nothing to notify');
    return;
  }

  // Send match notifications to all members of each new group.
  // Notifications must be delivered within 30 seconds of group finalization (Req 5.7).
  await Promise.allSettled(
    groups.map(async (group) => {
      try {
        const members = await findMembersByGroupId(group.id);
        await Promise.allSettled(
          members.map((member) =>
            notificationService.sendMatchFound(member.userId, group.id),
          ),
        );
        console.info(
          `[matchingEngineJob] Notified ${members.length} member(s) for group ${group.id}`,
        );
      } catch (err) {
        console.error(
          `[matchingEngineJob] Failed to notify members of group ${group.id}:`,
          err,
        );
      }
    }),
  );

  console.info(`[matchingEngineJob] Matching run complete — ${groups.length} group(s) created`);
}

/**
 * Register the matching engine cron job.
 * Schedule is read from the MATCHING_ENGINE_CRON env var (default: '0 12 * * *').
 */
export function registerMatchingEngineJob(): void {
  const schedule = env.MATCHING_ENGINE_CRON;

  if (!cron.validate(schedule)) {
    console.error(
      `[matchingEngineJob] Invalid cron expression "${schedule}" — job not registered`,
    );
    return;
  }

  cron.schedule(schedule, () => {
    runMatchingJob().catch((err: unknown) => {
      console.error('[matchingEngineJob] Unhandled error during matching run:', err);
    });
  });

  console.info(`[matchingEngineJob] Registered with schedule "${schedule}"`);
}
