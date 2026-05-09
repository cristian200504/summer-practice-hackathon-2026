import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Badge } from './ui';
import './CaptainDashboard.css';

interface CaptainDashboardProps {
  groupId: string;
  isCaptain: boolean;
  onInitiatePoll?: () => void;
  onSuggestVenue?: () => void;
  onSetTime?: () => void;
  onSendAnnouncement?: () => void;
}

/**
 * Captain coordination dashboard shown inside the group view.
 *
 * Displays a "You are the Captain" banner and action buttons for:
 * - Initiating a poll
 * - Suggesting venues
 * - Setting a proposed event time
 * - Sending announcements to the group chat
 *
 * Requirements: 7.2, 7.3
 */
export default function CaptainDashboard({
  groupId,
  isCaptain,
  onInitiatePoll,
  onSuggestVenue,
  onSetTime,
  onSendAnnouncement,
}: CaptainDashboardProps) {
  const { t } = useTranslation();
  const [announcementText, setAnnouncementText] = useState('');
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);

  if (!isCaptain) return null;

  function handleSendAnnouncement() {
    if (!announcementText.trim()) return;
    onSendAnnouncement?.();
    setAnnouncementText('');
    setShowAnnouncementForm(false);
  }

  return (
    <Card className="captain-dashboard" aria-label={t('captain.dashboard', 'Captain dashboard')}>
      {/* Captain banner */}
      <div className="captain-dashboard__banner">
        <span className="captain-dashboard__crown" aria-hidden="true">👑</span>
        <div>
          <Badge variant="warning" className="captain-dashboard__badge">
            {t('captain.role', 'Captain')}
          </Badge>
          <p className="captain-dashboard__subtitle">
            {t('captain.subtitle', 'You are the captain — coordinate the event below.')}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="captain-dashboard__actions">
        <Button
          variant="primary"
          size="md"
          onClick={onInitiatePoll}
          aria-label={t('captain.initiatePoll', 'Initiate poll')}
        >
          📊 {t('captain.initiatePoll', 'Initiate poll')}
        </Button>

        <Button
          variant="secondary"
          size="md"
          onClick={onSuggestVenue}
          aria-label={t('captain.suggestVenue', 'Suggest venue')}
        >
          📍 {t('captain.suggestVenue', 'Suggest venue')}
        </Button>

        <Button
          variant="ghost"
          size="md"
          onClick={onSetTime}
          aria-label={t('captain.setTime', 'Set event time')}
        >
          🕐 {t('captain.setTime', 'Set event time')}
        </Button>

        <Button
          variant="ghost"
          size="md"
          onClick={() => setShowAnnouncementForm((v) => !v)}
          aria-label={t('captain.announce', 'Send announcement')}
          aria-expanded={showAnnouncementForm}
        >
          📢 {t('captain.announce', 'Send announcement')}
        </Button>
      </div>

      {/* Announcement form */}
      {showAnnouncementForm && (
        <div className="captain-dashboard__announcement">
          <label
            htmlFor={`announcement-${groupId}`}
            className="captain-dashboard__announcement-label"
          >
            {t('captain.announcementLabel', 'Announcement message')}
          </label>
          <textarea
            id={`announcement-${groupId}`}
            className="captain-dashboard__announcement-textarea"
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
            placeholder={t('captain.announcementPlaceholder', 'Type your announcement…')}
            rows={3}
            maxLength={500}
            aria-describedby={`announcement-counter-${groupId}`}
          />
          <div
            id={`announcement-counter-${groupId}`}
            className="captain-dashboard__announcement-counter"
            aria-live="polite"
          >
            {announcementText.length}/500
          </div>
          <div className="captain-dashboard__announcement-actions">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendAnnouncement}
              disabled={!announcementText.trim()}
            >
              {t('common.submit')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAnnouncementForm(false)}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
