import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Spinner } from './ui';
import { notifications, NotificationType } from '../services/api';
import './NotificationPreferences.css';

const ALL_TYPES: NotificationType[] = [
  'availability_prompt', 'match_found', 'match_confirmation', 'captain_assigned',
  'new_message', 'poll_result', 'event_reminder', 'achievement_unlocked', 'weather_alert',
];

/**
 * Notification preferences screen.
 * Allows users to opt in/out of each notification type.
 * Requirements: 11.5
 */
export default function NotificationPreferences() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<Record<NotificationType, boolean> | null>(null);
  const [saving, setSaving] = useState<NotificationType | null>(null);

  useEffect(() => {
    notifications.getPreferences()
      .then(setPrefs)
      .catch(() => {});
  }, []);

  async function handleToggle(type: NotificationType) {
    if (!prefs) return;
    const newValue = !prefs[type];
    setPrefs((p) => p ? { ...p, [type]: newValue } : p);
    setSaving(type);
    try {
      await notifications.updatePreferences({ [type]: newValue });
    } catch {
      // Revert on failure
      setPrefs((p) => p ? { ...p, [type]: !newValue } : p);
    } finally {
      setSaving(null);
    }
  }

  if (!prefs) return <Spinner centered />;

  return (
    <Card className="notif-prefs">
      <h2 className="notif-prefs__title">{t('notifications.preferences')}</h2>
      <ul className="notif-prefs__list" role="list">
        {ALL_TYPES.map((type) => (
          <li key={type} className="notif-prefs__item">
            <label className="notif-prefs__label" htmlFor={`notif-${type}`}>
              {t(`notifications.types.${type}`, type)}
            </label>
            <button
              id={`notif-${type}`}
              type="button"
              role="switch"
              aria-checked={prefs[type]}
              className={`notif-prefs__toggle${prefs[type] ? ' notif-prefs__toggle--on' : ''}`}
              onClick={() => handleToggle(type)}
              disabled={saving === type}
              aria-label={`${t(`notifications.types.${type}`, type)}: ${prefs[type] ? t('common.yes') : t('common.no')}`}
            >
              <span className="notif-prefs__toggle-thumb" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
