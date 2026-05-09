import { PoolClient } from 'pg';
import { query, withTransaction } from '../infrastructure/database';
import { Group, GroupMember, GroupState, ConfirmationStatus, SkillLevel } from '../types';

/**
 * Data access layer for the `groups` and `group_members` tables.
 * All queries are parameterised to prevent SQL injection.
 */

// ── Row types ────────────────────────────────────────────────────────────────

interface GroupRow {
  id: string;
  sport_id: string;
  state: GroupState;
  captain_user_id: string | null;
  created_at: Date;
}

interface GroupMemberRow {
  id: string;
  group_id: string;
  user_id: string;
  confirmation_status: ConfirmationStatus;
  team: 'A' | 'B' | null;
  confirmed_at: Date | null;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    sportId: row.sport_id,
    state: row.state,
    captainUserId: row.captain_user_id,
    createdAt: row.created_at,
  };
}

function mapMember(row: GroupMemberRow): GroupMember {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    confirmationStatus: row.confirmation_status,
    team: row.team,
    confirmedAt: row.confirmed_at,
  };
}

// ── Group queries ─────────────────────────────────────────────────────────────

export async function findGroupById(groupId: string): Promise<Group | null> {
  const result = await query<GroupRow>(
    `SELECT id, sport_id, state, captain_user_id, created_at
     FROM groups WHERE id = $1 LIMIT 1`,
    [groupId],
  );
  if (result.rows.length === 0) return null;
  return mapGroup(result.rows[0]);
}

export async function findGroupsByState(state: GroupState): Promise<Group[]> {
  const result = await query<GroupRow>(
    `SELECT id, sport_id, state, captain_user_id, created_at
     FROM groups WHERE state = $1 ORDER BY created_at DESC`,
    [state],
  );
  return result.rows.map(mapGroup);
}

/**
 * Create a new group and add the initial set of members in a transaction.
 */
export async function createGroupWithMembers(
  sportId: string,
  memberUserIds: string[],
): Promise<Group> {
  return withTransaction(async (client) => {
    const groupResult = await client.query<GroupRow>(
      `INSERT INTO groups (sport_id, state)
       VALUES ($1, 'Pending')
       RETURNING id, sport_id, state, captain_user_id, created_at`,
      [sportId],
    );
    const group = mapGroup(groupResult.rows[0]);

    for (const userId of memberUserIds) {
      await client.query(
        `INSERT INTO group_members (group_id, user_id, confirmation_status)
         VALUES ($1, $2, 'Pending')`,
        [group.id, userId],
      );
    }

    return group;
  });
}

export async function updateGroupState(
  groupId: string,
  state: GroupState,
  client?: PoolClient,
): Promise<void> {
  if (client) {
    await client.query(`UPDATE groups SET state = $1 WHERE id = $2`, [state, groupId]);
  } else {
    await query(`UPDATE groups SET state = $1 WHERE id = $2`, [state, groupId]);
  }
}

export async function setGroupCaptain(groupId: string, captainUserId: string): Promise<void> {
  await query(`UPDATE groups SET captain_user_id = $1 WHERE id = $2`, [captainUserId, groupId]);
}

// ── Group member queries ──────────────────────────────────────────────────────

export async function findMembersByGroupId(groupId: string): Promise<GroupMember[]> {
  const result = await query<GroupMemberRow>(
    `SELECT id, group_id, user_id, confirmation_status, team, confirmed_at
     FROM group_members WHERE group_id = $1`,
    [groupId],
  );
  return result.rows.map(mapMember);
}

export async function findConfirmedMembersByGroupId(groupId: string): Promise<GroupMember[]> {
  const result = await query<GroupMemberRow>(
    `SELECT id, group_id, user_id, confirmation_status, team, confirmed_at
     FROM group_members WHERE group_id = $1 AND confirmation_status = 'Confirmed'`,
    [groupId],
  );
  return result.rows.map(mapMember);
}

export async function updateMemberConfirmation(
  groupId: string,
  userId: string,
  status: ConfirmationStatus,
): Promise<void> {
  const confirmedAt = status === 'Confirmed' ? new Date() : null;
  await query(
    `UPDATE group_members
     SET confirmation_status = $1, confirmed_at = $2
     WHERE group_id = $3 AND user_id = $4`,
    [status, confirmedAt, groupId, userId],
  );
}

export async function addMemberToGroup(groupId: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO group_members (group_id, user_id, confirmation_status)
     VALUES ($1, $2, 'Pending')
     ON CONFLICT (group_id, user_id) DO NOTHING`,
    [groupId, userId],
  );
}

export async function removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
  await query(
    `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId],
  );
}

export async function updateMemberTeam(
  groupId: string,
  userId: string,
  team: 'A' | 'B',
): Promise<void> {
  await query(
    `UPDATE group_members SET team = $1 WHERE group_id = $2 AND user_id = $3`,
    [team, groupId, userId],
  );
}

// ── Compatibility score queries ───────────────────────────────────────────────

interface CompatibilityRow {
  user_a_id: string;
  user_b_id: string;
  score: number;
}

/**
 * Fetch all compatibility scores between a set of users for a given sport.
 * Returns a map: `${userAId}:${userBId}` → score (canonical ordering: a < b).
 */
export async function fetchCompatibilityScores(
  userIds: string[],
  sportId: string,
): Promise<Map<string, number>> {
  if (userIds.length < 2) return new Map();

  const result = await query<CompatibilityRow>(
    `SELECT user_a_id, user_b_id, score
     FROM compatibility_scores
     WHERE sport_id = $1
       AND user_a_id = ANY($2::uuid[])
       AND user_b_id = ANY($2::uuid[])`,
    [sportId, userIds],
  );

  const map = new Map<string, number>();
  for (const row of result.rows) {
    map.set(`${row.user_a_id}:${row.user_b_id}`, row.score);
  }
  return map;
}

/**
 * Compute the average mutual compatibility score for a candidate user
 * against an existing group of users.
 * Defaults to 0.5 (neutral) when no score exists.
 */
export function avgCompatibility(
  candidateId: string,
  groupUserIds: string[],
  scores: Map<string, number>,
): number {
  if (groupUserIds.length === 0) return 0.5;

  let total = 0;
  for (const memberId of groupUserIds) {
    const [a, b] = candidateId < memberId
      ? [candidateId, memberId]
      : [memberId, candidateId];
    total += scores.get(`${a}:${b}`) ?? 0.5;
  }
  return total / groupUserIds.length;
}

// ── User sport queries ────────────────────────────────────────────────────────

interface UserSportRow {
  user_id: string;
  sport_id: string;
  skill_level: SkillLevel | null;
}

/**
 * For a given sport, return the user IDs (from the candidate list) who have
 * that sport in their preferences.
 */
export async function filterUsersBySport(
  userIds: string[],
  sportId: string,
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const result = await query<UserSportRow>(
    `SELECT user_id FROM user_sports
     WHERE sport_id = $1 AND user_id = ANY($2::uuid[])`,
    [sportId, userIds],
  );
  return result.rows.map((r) => r.user_id);
}

/**
 * Fetch skill levels for a set of users for a given sport.
 * Returns a map: userId → skillLevel (null if not set).
 */
export async function fetchSkillLevels(
  userIds: string[],
  sportId: string,
): Promise<Map<string, SkillLevel | null>> {
  if (userIds.length === 0) return new Map();

  const result = await query<UserSportRow>(
    `SELECT user_id, skill_level FROM user_sports
     WHERE sport_id = $1 AND user_id = ANY($2::uuid[])`,
    [sportId, userIds],
  );

  const map = new Map<string, SkillLevel | null>();
  for (const row of result.rows) {
    map.set(row.user_id, row.skill_level);
  }
  return map;
}

// ── All sports query ──────────────────────────────────────────────────────────

interface SportRow {
  id: string;
  name: string;
  min_group_size: number;
  max_group_size: number;
  is_team_sport: boolean;
}

export async function fetchAllSports(): Promise<Array<{
  id: string;
  name: string;
  minGroupSize: number;
  maxGroupSize: number;
  isTeamSport: boolean;
}>> {
  const result = await query<SportRow>(
    `SELECT id, name, min_group_size, max_group_size, is_team_sport FROM sports ORDER BY name`,
  );
  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    minGroupSize: r.min_group_size,
    maxGroupSize: r.max_group_size,
    isTeamSport: r.is_team_sport,
  }));
}
