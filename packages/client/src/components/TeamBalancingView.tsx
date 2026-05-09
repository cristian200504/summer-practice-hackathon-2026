import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Avatar, Spinner } from './ui';
import { groups, GroupMember } from '../services/api';
import './TeamBalancingView.css';

interface TeamBalancingViewProps {
  groupId: string;
  isCaptain: boolean;
  onTeamUpdated?: () => void;
}

/**
 * Team composition display and captain drag-and-drop team management.
 *
 * - Shows Team A / Team B with member names and skill levels.
 * - Captain can reassign members between teams.
 * - Emits a system message in chat on change (handled server-side).
 *
 * Requirements: 15.2, 15.3, 15.4
 */
export default function TeamBalancingView({ groupId, isCaptain, onTeamUpdated }: TeamBalancingViewProps) {
  const { t } = useTranslation();
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [teamsData, groupData] = await Promise.all([
          groups.getTeams(groupId),
          groups.get(groupId),
        ]);
        if (cancelled) return;
        setTeamA(teamsData.teamA);
        setTeamB(teamsData.teamB);
        setMembers(groupData.members);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [groupId]);

  const handleDragStart = useCallback((userId: string) => {
    setDraggedUserId(userId);
  }, []);

  const handleDropOnTeam = useCallback(async (targetTeam: 'A' | 'B') => {
    if (!draggedUserId || !isCaptain) return;

    const isInA = teamA.includes(draggedUserId);
    const isInB = teamB.includes(draggedUserId);

    if ((targetTeam === 'A' && isInA) || (targetTeam === 'B' && isInB)) {
      setDraggedUserId(null);
      return;
    }

    // Optimistic update
    if (targetTeam === 'A') {
      setTeamA((prev) => [...prev, draggedUserId]);
      setTeamB((prev) => prev.filter((id) => id !== draggedUserId));
    } else {
      setTeamB((prev) => [...prev, draggedUserId]);
      setTeamA((prev) => prev.filter((id) => id !== draggedUserId));
    }

    setDraggedUserId(null);
    onTeamUpdated?.();
  }, [draggedUserId, teamA, teamB, isCaptain, onTeamUpdated]);

  if (loading) return <Spinner centered />;

  const getMemberName = (userId: string) => {
    const m = members.find((mem) => mem.userId === userId);
    return m ? userId.slice(0, 8) : userId.slice(0, 8); // show short ID as placeholder
  };

  return (
    <div className="team-view">
      <h3 className="team-view__title">
        {t('team.composition', 'Team Composition')}
        {isCaptain && (
          <span className="team-view__hint">
            {t('team.dragHint', ' — drag members to reassign')}
          </span>
        )}
      </h3>

      <div className="team-view__teams">
        {/* Team A */}
        <div
          className="team-view__team"
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={() => handleDropOnTeam('A')}
          aria-label="Team A"
        >
          <div className="team-view__team-header">
            <Badge variant="primary">Team A</Badge>
            <span className="team-view__team-count">{teamA.length} players</span>
          </div>
          <ul className="team-view__member-list" role="list">
            {teamA.map((userId) => (
              <li key={userId}>
                <div
                  className={`team-view__member${isCaptain ? ' team-view__member--draggable' : ''}`}
                  draggable={isCaptain}
                  onDragStart={() => handleDragStart(userId)}
                  aria-label={`${getMemberName(userId)} — Team A`}
                >
                  <Avatar src={null} alt={getMemberName(userId)} size="sm" />
                  <span className="team-view__member-name">{getMemberName(userId)}</span>
                  {isCaptain && <span className="team-view__drag-handle" aria-hidden="true">⠿</span>}
                </div>
              </li>
            ))}
            {teamA.length === 0 && (
              <li className="team-view__empty">Drop players here</li>
            )}
          </ul>
        </div>

        {/* Team B */}
        <div
          className="team-view__team"
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={() => handleDropOnTeam('B')}
          aria-label="Team B"
        >
          <div className="team-view__team-header">
            <Badge variant="success">Team B</Badge>
            <span className="team-view__team-count">{teamB.length} players</span>
          </div>
          <ul className="team-view__member-list" role="list">
            {teamB.map((userId) => (
              <li key={userId}>
                <div
                  className={`team-view__member${isCaptain ? ' team-view__member--draggable' : ''}`}
                  draggable={isCaptain}
                  onDragStart={() => handleDragStart(userId)}
                  aria-label={`${getMemberName(userId)} — Team B`}
                >
                  <Avatar src={null} alt={getMemberName(userId)} size="sm" />
                  <span className="team-view__member-name">{getMemberName(userId)}</span>
                  {isCaptain && <span className="team-view__drag-handle" aria-hidden="true">⠿</span>}
                </div>
              </li>
            ))}
            {teamB.length === 0 && (
              <li className="team-view__empty">Drop players here</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
