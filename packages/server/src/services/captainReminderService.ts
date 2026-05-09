import { notificationService } from './notificationService';
import { findGroupById } from '../repositories/groupRepository';

/**
 * Schedule a reminder to the captain if they have not initiated coordination
 * within 2 hours of assignment.
 *
 * For the hackathon prototype, "initiated coordination" is approximated by
 * checking whether the group is still in Active state (not yet Dissolved).
 * A full implementation would track a `coordination_started_at` timestamp.
 *
 * Requirements: 7.5
 */
export function scheduleCaptainReminder(groupId: string, captainUserId: string): void {
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  setTimeout(async () => {
    try {
      const group = await findGroupById(groupId);
      if (!group || group.state !== 'Active') return;
      // Captain is still assigned and group is active — send reminder
      if (group.captainUserId === captainUserId) {
        await notificationService.sendCaptainAssigned(captainUserId, groupId);
        console.info(`[captainReminder] Sent coordination reminder to captain ${captainUserId} for group ${groupId}`);
      }
    } catch (err) {
      console.error(`[captainReminder] Failed to send reminder for group ${groupId}:`, err);
    }
  }, TWO_HOURS_MS);
}
