import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Badge, Spinner } from './ui';
import { groups, Group, GroupMember, sports as sportsApi, Sport } from '../services/api';
import './MatchConfirmationCard.css';

interface MatchConfirmationCardProps {
  groupId: string;
  onConfirmed?: () => void;
  onDeclined?: () => void;
}

const DEADLINE_MINUTES = 30;

/**
 * Match confirmation card shown to a user after being matched into a group.
 *
 * - Displays group details, sport, and matched members.
 * - Confirm/Decline buttons with a 30-minute countdown timer.
 * - Optimistic UI: buttons disable immediately on click.
 *
 * Requirements: 6.1, 6.2, 6.3
 */
export default function MatchConfirmationCard({
  groupId,
  onConfirmed,
  onDeclined,
}: MatchConfirmationCardProps) {
  const { t } = useTranslation();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [sport, setSport] = useState<Sport | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(DEADLINE_MINUTES * 60);

  // Load group data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [groupData, sportList] = await Promise.all([
          groups.get(groupId),
          sportsApi.list(),
        ]);
        if (cancelled) return;
        setGroup(groupData.group);
        setMembers(groupData.members);
        const matchedSport = sportList.find((s) => s.id === groupData.group.sportId);
        setSport(matchedSport ?? null);
      } catch {
        if (!cancelled) setError(t('errors.generic'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [groupId, t]);

  // Countdown timer
  useEffect(() => {
    if (loading || !group || group.state !== 'Pending') return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, group]);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    setError('');
    try {
      await groups.confirm(groupId);
      onConfirmed?.();
    } catch {
      setError(t('errors.generic'));
      setSubmitting(false);
    }
  }, [groupId, onConfirmed, t]);

  const handleDecline = useCallback(async () => {
    setSubmitting(true);
    setError('');
    try {
      await groups.decline(groupId);
      onDeclined?.();
    } catch {
      setError(t('errors.generic'));
      setSubmitting(false);
    }
  }, [groupId, onDeclined, t]);

  if (loading) {
    return (
      <Card className="match-card">
        <Spinner centered />
      </Card>
    );
  }

  if (!group) {
    return (
      <Card className="match-card">
        <p className="match-card__error" role="alert">{error || t('errors.generic')}</p>
      </Card>
    );
  }

  const confirmedCount = members.filter((m) => m.confirmationStatus === 'Confirmed').length;
  const totalCount = members.filter((m) => m.confirmationStatus !== 'Declined').length;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const timerUrgent = secondsLeft < 300; // < 5 minutes

  return (
    <Card className="match-card" aria-label={t('events.detail.confirm')}>
      <div className="match-card__header">
        <Badge variant="primary" className="match-card__sport-badge">
          {sport?.name ?? '—'}
        </Badge>
        <h2 className="match-card__title">{t('match.found', 'Match found!')}</h2>
      </div>

      <div className="match-card__meta">
        <span className="match-card__members">
          {t('match.members', '{{count}} players', { count: totalCount })}
        </span>
        <span className="match-card__confirmed">
          {t('match.confirmed', '{{count}} confirmed', { count: confirmedCount })}
        </span>
      </div>

      {group.state === 'Pending' && secondsLeft > 0 && (
        <div
          className={`match-card__timer${timerUrgent ? ' match-card__timer--urgent' : ''}`}
          aria-live="polite"
          aria-label={t('match.timeLeft', 'Time left: {{time}}', { time: timerLabel })}
        >
          <span className="match-card__timer-icon" aria-hidden="true">⏱</span>
          <span className="match-card__timer-value">{timerLabel}</span>
        </div>
      )}

      {group.state === 'Active' && (
        <Badge variant="success" className="match-card__status-badge">
          {t('match.active', 'Group active!')}
        </Badge>
      )}

      {group.state === 'Dissolved' && (
        <Badge variant="danger" className="match-card__status-badge">
          {t('match.dissolved', 'Group dissolved')}
        </Badge>
      )}

      {error && (
        <p className="match-card__error" role="alert">{error}</p>
      )}

      {group.state === 'Pending' && secondsLeft > 0 && (
        <div className="match-card__actions">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleConfirm}
            loading={submitting}
            disabled={submitting}
            aria-label={t('events.detail.confirm')}
          >
            {t('events.detail.confirm')}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            onClick={handleDecline}
            disabled={submitting}
            aria-label={t('events.detail.decline')}
          >
            {t('events.detail.decline')}
          </Button>
        </div>
      )}
    </Card>
  );
}
