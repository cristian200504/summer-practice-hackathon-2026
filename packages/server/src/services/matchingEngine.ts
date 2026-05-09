import { Group, SkillLevel } from '../types';
import { getAvailableUsers, lockResponsesForMatching } from './availabilityService';
import {
  createGroupWithMembers,
  updateGroupState,
  findGroupById,
  findMembersByGroupId,
  findConfirmedMembersByGroupId,
  addMemberToGroup,
  updateMemberTeam,
  fetchCompatibilityScores,
  avgCompatibility,
  filterUsersBySport,
  fetchSkillLevels,
  fetchAllSports,
} from '../repositories/groupRepository';

/**
 * Smart Matching Engine
 *
 * Groups available users into sport-appropriate groups based on:
 * - Shared sport preferences
 * - Group-size constraints per sport
 * - Mutual compatibility scores (higher = better match)
 * - Proximity (TODO: deferred to Task 18 when lat/lng is available)
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.6
 */

// ── Skill level numeric mapping (for team balancing) ─────────────────────────

const SKILL_TIER: Record<SkillLevel, number> = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
};

function skillTier(level: SkillLevel | null | undefined): number {
  return level ? (SKILL_TIER[level] ?? 2) : 2; // default to Intermediate
}

// ── Core matching cycle ───────────────────────────────────────────────────────

/**
 * Run a full matching cycle for the given date.
 *
 * 1. Lock availability responses so they can no longer be changed.
 * 2. For each sport, collect available users who have that sport in their preferences.
 * 3. Sort candidates by average mutual compatibility score (descending).
 * 4. Greedily fill groups up to max_size.
 * 5. Finalize groups that meet min_size; skip (queue) the rest.
 *
 * Returns the list of newly created groups.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.6
 */
export async function runMatchingCycle(date: Date): Promise<Group[]> {
  console.info(`[matchingEngine] Starting matching cycle for ${date.toISOString().slice(0, 10)}`);

  // Step 1: Lock availability responses
  await lockResponsesForMatching(date);

  // Step 2: Load all sports
  const sports = await fetchAllSports();
  const createdGroups: Group[] = [];

  for (const sport of sports) {
    try {
      const groups = await matchSport(date, sport);
      createdGroups.push(...groups);
    } catch (err) {
      console.error(`[matchingEngine] Error matching sport ${sport.name}:`, err);
    }
  }

  console.info(`[matchingEngine] Cycle complete — created ${createdGroups.length} group(s)`);
  return createdGroups;
}

/**
 * Run matching for a single sport.
 * Returns the groups created for that sport.
 */
async function matchSport(
  date: Date,
  sport: { id: string; name: string; minGroupSize: number; maxGroupSize: number },
): Promise<Group[]> {
  // Get all available users for this sport on this date
  const availableForSport = await getAvailableUsers(date, sport.id);

  // Also include users who are available with no sport filter (all preferred sports)
  const availableAll = await getAvailableUsers(date);

  // Merge and deduplicate
  const candidateSet = new Set([...availableForSport, ...availableAll]);

  // Filter to users who actually have this sport in their preferences
  const candidates = await filterUsersBySport(Array.from(candidateSet), sport.id);

  if (candidates.length < sport.minGroupSize) {
    console.info(
      `[matchingEngine] Sport "${sport.name}": only ${candidates.length} candidate(s), ` +
      `need ${sport.minGroupSize} — queuing for next cycle`,
    );
    return [];
  }

  // Fetch compatibility scores for all candidate pairs
  const scores = await fetchCompatibilityScores(candidates, sport.id);

  // Greedy group assembly
  const remaining = new Set(candidates);
  const groups: Group[] = [];

  while (remaining.size >= sport.minGroupSize) {
    const groupMembers: string[] = [];

    // Pick the first candidate as the seed
    const [seed] = remaining;
    groupMembers.push(seed);
    remaining.delete(seed);

    // Fill up to max_size by picking the most compatible remaining candidate
    while (groupMembers.length < sport.maxGroupSize && remaining.size > 0) {
      let bestCandidate: string | null = null;
      let bestScore = -1;

      for (const candidate of remaining) {
        const score = avgCompatibility(candidate, groupMembers, scores);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }

      if (bestCandidate) {
        groupMembers.push(bestCandidate);
        remaining.delete(bestCandidate);
      } else {
        break;
      }
    }

    if (groupMembers.length >= sport.minGroupSize) {
      // Create the group in the database
      const group = await createGroupWithMembers(sport.id, groupMembers);
      groups.push(group);
      console.info(
        `[matchingEngine] Created group ${group.id} for sport "${sport.name}" ` +
        `with ${groupMembers.length} member(s)`,
      );
    } else {
      // Not enough members — put them back in the remaining pool
      // (they'll be queued for the next cycle)
      console.info(
        `[matchingEngine] Sport "${sport.name}": assembled group of ${groupMembers.length} ` +
        `below minimum ${sport.minGroupSize} — queuing`,
      );
    }
  }

  return groups;
}

// ── Group lifecycle ───────────────────────────────────────────────────────────

/**
 * Finalize a group — transition it to Pending state (already set at creation).
 * This is a no-op for groups created by runMatchingCycle but is exposed for
 * manual finalization flows.
 */
export async function finalizeGroup(groupId: string): Promise<void> {
  await updateGroupState(groupId, 'Pending');
}

/**
 * Attempt to fill a vacancy in a group by finding a queued user for the sport.
 * Returns true if a vacancy was filled, false otherwise.
 *
 * Requirements: 5.6, 6.3
 */
export async function fillVacancy(groupId: string): Promise<boolean> {
  const group = await findGroupById(groupId);
  if (!group) return false;

  const members = await findMembersByGroupId(groupId);
  const activeMemberIds = members
    .filter((m) => m.confirmationStatus !== 'Declined')
    .map((m) => m.userId);

  const sport = (await fetchAllSports()).find((s) => s.id === group.sportId);
  if (!sport) return false;

  if (activeMemberIds.length >= sport.maxGroupSize) return false;

  // Find available users for this sport who are not already in the group
  const today = new Date();
  const available = await getAvailableUsers(today, group.sportId);
  const candidates = await filterUsersBySport(available, group.sportId);
  const eligible = candidates.filter((id) => !activeMemberIds.includes(id));

  if (eligible.length === 0) return false;

  // Pick the most compatible candidate
  const scores = await fetchCompatibilityScores([...activeMemberIds, ...eligible], group.sportId);
  let bestCandidate = eligible[0];
  let bestScore = avgCompatibility(eligible[0], activeMemberIds, scores);

  for (const candidate of eligible.slice(1)) {
    const score = avgCompatibility(candidate, activeMemberIds, scores);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  await addMemberToGroup(groupId, bestCandidate);
  return true;
}

/**
 * Dissolve a group — set its state to Dissolved.
 *
 * Requirements: 6.5
 */
export async function dissolveGroup(groupId: string): Promise<void> {
  await updateGroupState(groupId, 'Dissolved');
}

// ── Team balancing ────────────────────────────────────────────────────────────

export interface TeamAssignment {
  teamA: string[];
  teamB: string[];
}

/**
 * Balance confirmed group members into two teams such that the average skill
 * level of each team differs by at most 1 tier.
 *
 * Algorithm: sort members by skill tier descending, then alternate assignment
 * (snake draft: A, B, B, A, A, B, B, A, …) to produce balanced teams.
 *
 * Requirements: 15.1
 */
export async function balanceTeams(groupId: string): Promise<TeamAssignment> {
  const members = await findConfirmedMembersByGroupId(groupId);
  const group = await findGroupById(groupId);
  if (!group) throw new Error(`Group ${groupId} not found`);

  const skillMap = await fetchSkillLevels(
    members.map((m) => m.userId),
    group.sportId,
  );

  // Sort by skill tier descending
  const sorted = [...members].sort(
    (a, b) => skillTier(skillMap.get(b.userId)) - skillTier(skillMap.get(a.userId)),
  );

  const teamA: string[] = [];
  const teamB: string[] = [];

  // Snake draft: positions 0,3,4,7,8,… → A; positions 1,2,5,6,9,10,… → B
  for (let i = 0; i < sorted.length; i++) {
    const userId = sorted[i].userId;
    const posInPair = i % 4;
    if (posInPair === 0 || posInPair === 3) {
      teamA.push(userId);
    } else {
      teamB.push(userId);
    }
  }

  // Persist team assignments
  for (const userId of teamA) {
    await updateMemberTeam(groupId, userId, 'A');
  }
  for (const userId of teamB) {
    await updateMemberTeam(groupId, userId, 'B');
  }

  return { teamA, teamB };
}
