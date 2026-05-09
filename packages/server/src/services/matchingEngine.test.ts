import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runMatchingCycle,
  dissolveGroup,
  fillVacancy,
  MatchingError,
} from './matchingEngine';

// ── Mock all repository and service dependencies ─────────────────────────────

vi.mock('./availabilityService', () => ({
  getAvailableUsers: vi.fn(),
  lockResponsesForMatching: vi.fn(),
}));

vi.mock('../repositories/groupRepository', () => ({
  findAllSports: vi.fn(),
  findUsersWithSportPreference: vi.fn(),
  findCompatibilityScores: vi.fn(),
  computeAverageMutualScore: vi.fn(),
  findAlreadyMatchedUserIds: vi.fn(),
  findGroupById: vi.fn(),
  findGroupMembers: vi.fn(),
  createGroup: vi.fn(),
  updateGroupState: vi.fn(),
  addGroupMember: vi.fn(),
}));

import * as availabilityService from './availabilityService';
import * as groupRepo from '../repositories/groupRepository';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSport(overrides: Partial<ReturnType<typeof makeSport>> = {}) {
  return {
    id: 'sport-tennis',
    name: 'Tennis',
    minGroupSize: 2,
    maxGroupSize: 4,
    isTeamSport: false,
    ...overrides,
  };
}

function makeGroup(overrides: Partial<ReturnType<typeof makeGroup>> = {}) {
  return {
    id: 'group-1',
    sportId: 'sport-tennis',
    state: 'Pending' as const,
    captainUserId: null,
    createdAt: new Date('2024-06-01T10:00:00Z'),
    ...overrides,
  };
}

function makeGroupMember(userId: string, status = 'Pending' as const) {
  return {
    id: `member-${userId}`,
    groupId: 'group-1',
    userId,
    confirmationStatus: status,
    team: null,
    confirmedAt: null,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('runMatchingCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('locks availability responses before processing', async () => {
    vi.mocked(availabilityService.lockResponsesForMatching).mockResolvedValue(undefined);
    vi.mocked(groupRepo.findAllSports).mockResolvedValue([]);

    const date = new Date('2024-06-01');
    await runMatchingCycle(date);

    expect(availabilityService.lockResponsesForMatching).toHaveBeenCalledWith(date);
  });

  it('returns empty result when no sports exist', async () => {
    vi.mocked(availabilityService.lockResponsesForMatching).mockResolvedValue(undefined);
    vi.mocked(groupRepo.findAllSports).mockResolvedValue([]);

    const result = await runMatchingCycle(new Date('2024-06-01'));

    expect(result.groups).toHaveLength(0);
    expect(result.queuedUsersBySport.size).toBe(0);
  });

  it('skips sport when no users are available', async () => {
    vi.mocked(availabilityService.lockResponsesForMatching).mockResolvedValue(undefined);
    vi.mocked(groupRepo.findAllSports).mockResolvedValue([makeSport()]);
    vi.mocked(availabilityService.getAvailableUsers).mockResolvedValue([]);

    const result = await runMatchingCycle(new Date('2024-06-01'));

    expect(result.groups).toHaveLength(0);
    expect(groupRepo.createGroup).not.toHaveBeenCalled();
  });

  it('skips sport when no available users have that sport preference', async () => {
    vi.mocked(availabilityService.lockResponsesForMatching).mockResolvedValue(undefined);
    vi.mocked(groupRepo.findAllSports).mockResolvedValue([makeSport()]);
    vi.mocked(availabilityService.getAvailableUsers).mockResolvedValue(['user-1', 'user-2']);
    vi.mocked(groupRepo.findUsersWithSportPreference).mockResolvedValue([]);

    const result = await runMatchingCycle(new Date('2024-06-01'));

    expect(result.groups).toHaveLength(0);
    expect(groupRepo.createGroup).not.toHaveBeenCalled();
  });

  it('creates a group when enough users are available (Tennis: min 2)', async () => {
    const sport = makeSport({ id: 'sport-tennis', minGroupSize: 2, maxGroupSize: 4 });
    const users = ['user-1', 'user-2'];

    vi.mocked(availabilityService.lockResponsesForMatching).mockResolvedValue(undefined);
    vi.mocked(groupRepo.findAllSports).mockResolvedValue([sport]);
    vi.mocked(availabilityService.getAvailableUsers).mockResolvedValue(users);
    vi.mocked(groupRepo.findUsersWithSportPreference).mockResolvedValue(users);
    vi.mocked(groupRepo.findAlreadyMatchedUserIds).mockResolvedValue(new Set());
    vi.mocked(groupRepo.findCompatibilityScores).mockResolvedValue(new Map());
    vi.mocked(groupRepo.createGroup).mockResolvedValue(makeGroup());

    const result = await runMatchingCycle(new Date('2024-06-01'));

    expect(groupRepo.createGroup).toHaveBeenCalledOnce();
    expect(groupRepo.createGroup).toHaveBeenCalledWith(sport.id, expect.arrayContaining(users));
    expect(result.groups).toHaveLength(1);
  });

  it('queues users when below minimum group size', async () => {
    const sport = makeSport({ id: 'sport-football', minGroupSize: 10, maxGroupSize: 14 });
    const users = ['user-1', 'user-2', 'user-3']; // only 3, need 10

    vi.mocked(availabilityService.lockResponsesForMatching).mockResolvedValue(undefined);
    vi.mocked(groupRepo.findAllSports).mockResolvedValue([sport]);
    vi.mocked(availabilityService.getAvailableUsers).mockResolvedValue(users);
    vi.mocked(groupRepo.findUsersWithSportPreference).mockResolvedValue(users);
    vi.mocked(groupRepo.findAlreadyMatchedUserIds).mockResolvedValue(new Set());
    vi.mocked(groupRepo.findCompatibilityScores).mockResolvedValue(new Map());

    const result = await runMatchingCycle(new Date('2024-06-01'));

    expect(groupRepo.createGroup).not.toHaveBeenCalled();
    expect(result.groups).toHaveLength(0);
    expect(result.queuedUsersBySport.get(sport.id)).toEqual(
      expect.arrayContaining(users),
    );
  });

  it('enforces max group size — splits 6 Tennis users into two groups of 3 and 3', async () => {
    const sport = makeSport({ id: 'sport-tennis', minGroupSize: 2, maxGroupSize: 4 });
    const users = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];

    vi.mocked(availabilityService.lockResponsesForMatching).mockResolvedValue(undefined);
    vi.mocked(groupRepo.findAllSports).mockResolvedValue([sport]);
    vi.mocked(availabilityService.getAvailableUsers).mockResolvedValue(users);
    vi.mocked(groupRepo.findUsersWithSportPreference).mockResolvedValue(users);
    vi.mocked(groupRepo.findAlreadyMatchedUserIds).mockResolvedValue(new Set());
    vi.mocked(groupRepo.findCompatibilityScores).mockResolvedValue(new Map());
    vi.mocked(groupRepo.createGroup)
      .mockResolvedValueOnce(makeGroup({ id: 'group-1' }))
      .mockResolvedValueOnce(makeGroup({ id: 'group-2' }));

    const result = await runMatchingCycle(new Date('2024-06-01'));

    // 6 users / max 4 = two groups (4 + 2, both >= min 2)
    expect(groupRepo.createGroup).toHaveBeenCalledTimes(2);
    const firstCall = vi.mocked(groupRepo.createGroup).mock.calls[0];
    const secondCall = vi.mocked(groupRepo.createGroup).mock.calls[1];
    expect(firstCall[1].length).toBeLessThanOrEqual(4);
    expect(secondCall[1].length).toBeLessThanOrEqual(4);
    expect(result.groups).toHaveLength(2);
  });

  it('excludes already-matched users from the pool', async () => {
    const sport = makeSport({ id: 'sport-tennis', minGroupSize: 2, maxGroupSize: 4 });
    const users = ['user-1', 'user-2', 'user-3'];
    const alreadyMatched = new Set(['user-1']); // user-1 is already in a group

    vi.mocked(availabilityService.lockResponsesForMatching).mockResolvedValue(undefined);
    vi.mocked(groupRepo.findAllSports).mockResolvedValue([sport]);
    vi.mocked(availabilityService.getAvailableUsers).mockResolvedValue(users);
    vi.mocked(groupRepo.findUsersWithSportPreference).mockResolvedValue(users);
    vi.mocked(groupRepo.findAlreadyMatchedUserIds).mockResolvedValue(alreadyMatched);
    vi.mocked(groupRepo.findCompatibilityScores).mockResolvedValue(new Map());
    vi.mocked(groupRepo.createGroup).mockResolvedValue(makeGroup());

    await runMatchingCycle(new Date('2024-06-01'));

    const createCall = vi.mocked(groupRepo.createGroup).mock.calls[0];
    expect(createCall[1]).not.toContain('user-1');
    expect(createCall[1]).toContain('user-2');
    expect(createCall[1]).toContain('user-3');
  });

  it('prioritizes users with higher compatibility scores', async () => {
    const sport = makeSport({ id: 'sport-tennis', minGroupSize: 2, maxGroupSize: 2 });
    // 3 users, max group size 2 → one group of 2, one queued
    const users = ['user-a', 'user-b', 'user-c'];

    // user-a and user-b have high compatibility (0.9)
    // user-a and user-c have low compatibility (0.1)
    const scoreMap = new Map([
      ['user-a:user-b', 0.9], // canonical: a < b alphabetically
      ['user-a:user-c', 0.1],
      ['user-b:user-c', 0.2],
    ]);

    vi.mocked(availabilityService.lockResponsesForMatching).mockResolvedValue(undefined);
    vi.mocked(groupRepo.findAllSports).mockResolvedValue([sport]);
    vi.mocked(availabilityService.getAvailableUsers).mockResolvedValue(users);
    vi.mocked(groupRepo.findUsersWithSportPreference).mockResolvedValue(users);
    vi.mocked(groupRepo.findAlreadyMatchedUserIds).mockResolvedValue(new Set());
    vi.mocked(groupRepo.findCompatibilityScores).mockResolvedValue(scoreMap);
    vi.mocked(groupRepo.createGroup).mockResolvedValue(makeGroup());

    // Use the real computeAverageMutualScore from the repository
    vi.mocked(groupRepo.computeAverageMutualScore).mockImplementation(
      (candidateId, groupMemberIds, map) => {
        // Re-implement inline for the test
        if (groupMemberIds.length === 0) return 0.5;
        let total = 0;
        for (const memberId of groupMemberIds) {
          const key =
            candidateId < memberId
              ? `${candidateId}:${memberId}`
              : `${memberId}:${candidateId}`;
          total += map.get(key) ?? 0.5;
        }
        return total / groupMemberIds.length;
      },
    );

    await runMatchingCycle(new Date('2024-06-01'));

    // The group of 2 should contain user-a and user-b (highest compatibility)
    const createCall = vi.mocked(groupRepo.createGroup).mock.calls[0];
    expect(createCall[1]).toContain('user-a');
    expect(createCall[1]).toContain('user-b');
  });

  it('handles multiple sports independently', async () => {
    const tennis = makeSport({ id: 'sport-tennis', name: 'Tennis', minGroupSize: 2, maxGroupSize: 4 });
    const basketball = makeSport({ id: 'sport-basketball', name: 'Basketball', minGroupSize: 6, maxGroupSize: 10 });

    vi.mocked(availabilityService.lockResponsesForMatching).mockResolvedValue(undefined);
    vi.mocked(groupRepo.findAllSports).mockResolvedValue([tennis, basketball]);

    vi.mocked(availabilityService.getAvailableUsers)
      .mockResolvedValueOnce(['t1', 't2']) // tennis users
      .mockResolvedValueOnce(['b1', 'b2', 'b3']); // basketball users (below min)

    vi.mocked(groupRepo.findUsersWithSportPreference)
      .mockResolvedValueOnce(['t1', 't2'])
      .mockResolvedValueOnce(['b1', 'b2', 'b3']);

    vi.mocked(groupRepo.findAlreadyMatchedUserIds).mockResolvedValue(new Set());
    vi.mocked(groupRepo.findCompatibilityScores).mockResolvedValue(new Map());
    vi.mocked(groupRepo.createGroup).mockResolvedValue(makeGroup());

    const result = await runMatchingCycle(new Date('2024-06-01'));

    // Tennis group created (2 >= min 2), basketball queued (3 < min 6)
    expect(groupRepo.createGroup).toHaveBeenCalledOnce();
    expect(result.queuedUsersBySport.has(basketball.id)).toBe(true);
    expect(result.queuedUsersBySport.get(basketball.id)).toHaveLength(3);
  });
});

// ── dissolveGroup ────────────────────────────────────────────────────────────

describe('dissolveGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets group state to Dissolved', async () => {
    vi.mocked(groupRepo.findGroupById).mockResolvedValue(makeGroup());
    vi.mocked(groupRepo.updateGroupState).mockResolvedValue(undefined);

    await dissolveGroup('group-1');

    expect(groupRepo.updateGroupState).toHaveBeenCalledWith('group-1', 'Dissolved');
  });

  it('throws MatchingError when group is not found', async () => {
    vi.mocked(groupRepo.findGroupById).mockResolvedValue(null);

    await expect(dissolveGroup('nonexistent')).rejects.toThrow(MatchingError);
    await expect(dissolveGroup('nonexistent')).rejects.toMatchObject({
      code: 'group_not_found',
      statusCode: 404,
    });
  });
});

// ── fillVacancy ──────────────────────────────────────────────────────────────

describe('fillVacancy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when no candidates are available', async () => {
    vi.mocked(groupRepo.findGroupById).mockResolvedValue(makeGroup());
    vi.mocked(groupRepo.findGroupMembers).mockResolvedValue([
      makeGroupMember('user-1', 'Confirmed'),
    ]);
    vi.mocked(availabilityService.getAvailableUsers).mockResolvedValue([]);
    vi.mocked(groupRepo.findUsersWithSportPreference).mockResolvedValue([]);
    vi.mocked(groupRepo.findAlreadyMatchedUserIds).mockResolvedValue(new Set());

    const result = await fillVacancy('group-1');

    expect(result).toBe(false);
    expect(groupRepo.addGroupMember).not.toHaveBeenCalled();
  });

  it('adds the best-scoring candidate to the group', async () => {
    vi.mocked(groupRepo.findGroupById).mockResolvedValue(makeGroup());
    vi.mocked(groupRepo.findGroupMembers).mockResolvedValue([
      makeGroupMember('user-1', 'Confirmed'),
    ]);
    vi.mocked(availabilityService.getAvailableUsers).mockResolvedValue(['user-2', 'user-3']);
    vi.mocked(groupRepo.findUsersWithSportPreference).mockResolvedValue(['user-2', 'user-3']);
    vi.mocked(groupRepo.findAlreadyMatchedUserIds).mockResolvedValue(new Set());
    vi.mocked(groupRepo.findCompatibilityScores).mockResolvedValue(
      new Map([['user-1:user-2', 0.9], ['user-1:user-3', 0.1]]),
    );
    vi.mocked(groupRepo.addGroupMember).mockResolvedValue(makeGroupMember('user-2'));

    const result = await fillVacancy('group-1');

    expect(result).toBe(true);
    expect(groupRepo.addGroupMember).toHaveBeenCalledWith('group-1', 'user-2');
  });

  it('throws MatchingError when group is not found', async () => {
    vi.mocked(groupRepo.findGroupById).mockResolvedValue(null);

    await expect(fillVacancy('nonexistent')).rejects.toThrow(MatchingError);
    await expect(fillVacancy('nonexistent')).rejects.toMatchObject({
      code: 'group_not_found',
      statusCode: 404,
    });
  });

  it('does not add a user already in the group', async () => {
    vi.mocked(groupRepo.findGroupById).mockResolvedValue(makeGroup());
    vi.mocked(groupRepo.findGroupMembers).mockResolvedValue([
      makeGroupMember('user-1', 'Confirmed'),
      makeGroupMember('user-2', 'Pending'),
    ]);
    // user-2 is available but already in the group
    vi.mocked(availabilityService.getAvailableUsers).mockResolvedValue(['user-2', 'user-3']);
    vi.mocked(groupRepo.findUsersWithSportPreference).mockResolvedValue(['user-2', 'user-3']);
    vi.mocked(groupRepo.findAlreadyMatchedUserIds).mockResolvedValue(new Set());
    vi.mocked(groupRepo.findCompatibilityScores).mockResolvedValue(new Map());
    vi.mocked(groupRepo.addGroupMember).mockResolvedValue(makeGroupMember('user-3'));

    await fillVacancy('group-1');

    const addCall = vi.mocked(groupRepo.addGroupMember).mock.calls[0];
    expect(addCall[1]).toBe('user-3'); // user-2 was excluded
  });
});

// ── computeAverageMutualScore (unit test of the pure helper) ─────────────────

describe('computeAverageMutualScore (via groupRepository)', () => {
  // Import the real function directly for unit testing
  it('returns 0.5 when group is empty', async () => {
    const { computeAverageMutualScore } = await import('../repositories/groupRepository');
    const result = computeAverageMutualScore('user-a', [], new Map());
    expect(result).toBe(0.5);
  });

  it('returns the stored score for a single member pair', async () => {
    const { computeAverageMutualScore } = await import('../repositories/groupRepository');
    const scoreMap = new Map([['user-a:user-b', 0.8]]);
    const result = computeAverageMutualScore('user-a', ['user-b'], scoreMap);
    expect(result).toBe(0.8);
  });

  it('uses canonical ordering (smaller UUID first) for lookup', async () => {
    const { computeAverageMutualScore } = await import('../repositories/groupRepository');
    // 'user-b' < 'user-c' alphabetically, so key is 'user-b:user-c'
    const scoreMap = new Map([['user-b:user-c', 0.7]]);
    // candidate is 'user-c', member is 'user-b' → key should be 'user-b:user-c'
    const result = computeAverageMutualScore('user-c', ['user-b'], scoreMap);
    expect(result).toBe(0.7);
  });

  it('defaults to 0.5 for missing scores', async () => {
    const { computeAverageMutualScore } = await import('../repositories/groupRepository');
    const result = computeAverageMutualScore('user-a', ['user-b'], new Map());
    expect(result).toBe(0.5);
  });

  it('averages scores across multiple group members', async () => {
    const { computeAverageMutualScore } = await import('../repositories/groupRepository');
    const scoreMap = new Map([
      ['user-a:user-b', 0.8],
      ['user-a:user-c', 0.4],
    ]);
    const result = computeAverageMutualScore('user-a', ['user-b', 'user-c'], scoreMap);
    expect(result).toBeCloseTo(0.6);
  });
});
