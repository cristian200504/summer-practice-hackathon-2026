import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui';
import { events } from '../services/api';

interface ShareEventButtonProps {
  eventId: string;
  eventTitle: string;
}

/**
 * Share event button with copy link, native OS share, and direct invite options.
 * Requirements: 17.1, 17.2
 */
export default function ShareEventButton({ eventId, eventTitle }: ShareEventButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleShare = useCallback(async () => {
    setLoading(true);
    try {
      const { url } = await events.getShareLink(eventId);

      // Try native OS share sheet first (mobile)
      if (navigator.share) {
        await navigator.share({
          title: eventTitle,
          text: `Join me for ${eventTitle} on ShowUp2Move!`,
          url,
        });
        return;
      }

      // Fall back to clipboard copy
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // User cancelled share or clipboard failed — silently ignore
    } finally {
      setLoading(false);
    }
  }, [eventId, eventTitle]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleShare}
      loading={loading}
      aria-label={t('events.detail.share')}
    >
      {copied ? '✅ Copied!' : `🔗 ${t('events.detail.share')}`}
    </Button>
  );
}
