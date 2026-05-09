import {
  findGroupById,
  findMembersByGroupId,
  findConfirmedMembersByGroupId,
  updateMemberConfirmation,
  updateGroupState,
  setGroupCaptain,
  fetchAllSports,
} from '../repositories/groupRepository';
import { fillVacancy, dissolveGroup, balanceTeams } from './matchingEngine';
import { notificationService } from './notificationService';
import { scheduleCaptainReminder } from './captainReminderService';
import { sendSystemMessage } from './chatService';

/**
 * Match Confirmation Service
 *
 * Handles the confirmation/decline workflow after a group is matched.
 * Groups transition: Pending → Active (all min members confirmed) or Dissolved.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

export class ConfirmationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ConfirmationError';
  }
}

const CONFIRMATION_DEADLINE_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Record a user's confirmation for a group match.
 * If all minimum-required members have confirmed, transitions the group to Active.
 *
 * Requirements: 6.2, 6.4
 */
export async function confirmMatch(groupId: string, userId: string): Promise<void> {
  const group = await findGroupById(groupId);
  if (!group) throw new ConfirmationError('group_not_found', 'Group not found.', 404);
  if (group.state === 'Dissolved') {
    throw new ConfirmationError('group_dissolved', 'This group has been dissolved.', 400);
  }
  if (group.state === 'Active') {
    throw new ConfirmationError('group_already_active', 'This group is already active.', 400);
  }

  const members = await findMembersByGroupId(groupId);
  const isMember = members.some((m) => m.userId === userId);
  if (!isMember) {
    throw new ConfirmationError('not_a_member', 'You are not a member of this group.', 403);
  }

  await updateMemberConfirmation(groupId, userId, 'Confirmed');

  // Check if minimum members have confirmed
  const confirmed = await findConfirmedMembersByGroupId(groupId);
  const sports = await fetchAllSports();
  const sport = sports.find((s) => s.id === group.sportId);
  const minSize = sport?.minGroupSize ?? 2;

  if (confirmed.length >= minSize) {
    await activateGroup(groupId);
  }
}

/**
 * Record a user's decline for a group match.
 * Attempts to fill the vacancy; if re-fill fails and group drops below minimum,
 * dissolves the group.
 *
 * Requirements: 6.3, 6.5
 */
export async function declineMatch(groupId: string, userId: string): Promise<void> {
  const group = await findGroupById(groupId);
  if (!group) throw new ConfirmationError('group_not_found', 'Group not found.', 404);
  if (group.state !== 'Pending') {
    throw new ConfirmationError('group_not_pending', 'Group is not in Pending state.', 400);
  }

  await updateMemberConfirmation(groupId, userId, 'Declined');

  // Attempt one re-fill
  const filled = await fillVacancy(groupId);
  if (filled) {
    // Notify the new member
    const members = await findMembersByGroupId(groupId);
    const newMember = members.find(
      (m) => m.confirmationStatus === 'Pending' && m.userId !== userId,
    );
    if (newMember) {
      await notificationService.sendMatchConfirmation(newMember.userId, groupId, 30);
      // System message: new member joined (Req 8.4)
      await sendSystemMessage(groupId, `A new player has joined the group.`).catch(() => {});
    }
    return;
  }

  // Check if group still meets minimum
  const sports = await fetchAllSports();
  const sport = sports.find((s) => s.id === group.sportId);
  const minSize = sport?.minGroupSize ?? 2;

  const activeMembers = (await findMembersByGroupId(groupId)).filter(
    (m) => m.confirmationStatus !== 'Declined',
  );

  if (activeMembers.length < minSize) {
    await dissolveGroup(groupId);
    // Notify all affected members
    await Promise.allSettled(
      activeMembers.map((m) =>
        notificationService.sendGroupDissolved(m.userId, groupId),
      ),
    );
  }
}

/**
 * Transition a group to Active state, create the group chat, and assign a captain.
 * Called when all minimum-required members have confirmed.
 *
 * Requirements: 6.4, 7.1
 */
async function activateGroup(groupId: string): Promise<void> {
  await updateGroupState(groupId, 'Active');

  // Randomly select a captain from confirmed members
  const confirmed = await findConfirmedMembersByGroupId(groupId);
  if (confirmed.length > 0) {
    const captain = confirmed[Math.floor(Math.random() * confirmed.length)];
    await setGroupCaptain(groupId, captain.userId);
    await notificationService.sendCaptainAssigned(captain.userId, groupId);
    // Schedule a 2-hour reminder if captain hasn't started coordination (Req 7.5)
    scheduleCaptainReminder(groupId, captain.userId);
  }

  // System message: group is now active (Req 8.4)
  await sendSystemMessage(groupId, '🎉 Group is now active! Start coordinating.').catch(() => {});

  // Auto-compute team assignments for team sports (Req 15.1, 15.2, 29.2)
  const sports = await fetchAllSports();
  const group = await findGroupById(groupId);
  const sport = sports.find((s) => s.id === group?.sportId);
  if (sport?.isTeamSport) {
    try {
      const teams = await balanceTeams(groupId);
      const teamMsg =
        `⚽ Teams assigned:\n` +
        `Team A: ${teams.teamA.length} players\n` +
        `Team B: ${teams.teamB.length} players`;
      await sendSystemMessage(groupId, teamMsg).catch(() => {});
    } catch (err) {
      console.error(`[confirmationService] Team balancing failed for group ${groupId}:`, err);
    }
  }

  console.info(`[confirmationService] Group ${groupId} is now Active`);
}

/**
 * Background job: after the 30-minute confirmation deadline, remove
 * non-responders and attempt one re-fill. Dissolve if minimum not reached.
 *
 * Requirements: 6.3, 6.5
 */
export async function processConfirmationDeadline(groupId: string): Promise<void> {
  const group = await findGroupById(groupId);
  if (!group || group.state !== 'Pending') return;

  const members = await findMembersByGroupId(groupId);
  const nonResponders = members.filter((m) => m.confirmationStatus === 'Pending');

  // Remove non-responders
  for (const member of nonResponders) {
    await updateMemberConfirmation(groupId, member.userId, 'Declined');
  }

  // Attempt re-fill for each vacancy
  for (let i = 0; i < nonResponders.length; i++) {
    await fillVacancy(groupId);
  }

  // Check if group still meets minimum
  const sports = await fetchAllSports();
  const sport = sports.find((s) => s.id === group.sportId);
  const minSize = sport?.minGroupSize ?? 2;

  const activeMembers = (await findMembersByGroupId(groupId)).filter(
    (m) => m.confirmationStatus !== 'Declined',
  );

  if (activeMembers.length >= minSize) {
    await activateGroup(groupId);
  } else {
    await dissolveGroup(groupId);
    await Promise.allSettled(
      activeMembers.map((m) =>
        notificationService.sendGroupDissolved(m.userId, groupId),
      ),
    );
  }
}

export { CONFIRMATION_DEADLINE_MS };
