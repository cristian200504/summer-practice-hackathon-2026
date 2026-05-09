import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui';
import { calendar } from '../services/api';

interface AddToCalendarButtonProps {
  eventId: string;
  eventTitle: string;
}

/**
 * "Add to Calendar" button for confirmed events.
 * Tries Google Calendar first; falls back to ICS download on failure.
 *
 * Requirements: 13.1, 13.3
 */
export default function AddToCalendarButton({ eventId }: AddToCalendarButtonProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await calendar.addToCalendar(eventId);

      if (result.success) {
        setAdded(true);
        return;
      }

      // ICS fallback — trigger browser download
      if (result.icsContent && result.filename) {
        const blob = new Blob([result.icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
        setAdded(true);
      }
    } catch {
      setError(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [eventId, t]);

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAdd}
        loading={loading}
        disabled={added}
        aria-label={t('events.detail.addToCalendar')}
      >
        {added ? '✅ Added' : `📅 ${t('events.detail.addToCalendar')}`}
      </Button>
      {error && (
        <p className="add-calendar__error" role="alert" style={{ fontSize: 'var(--font-size-xs)', color: '#dc2626', marginTop: 'var(--space-1)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
