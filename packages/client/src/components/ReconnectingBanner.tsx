import { useTranslation } from 'react-i18next';
import { WsStatus } from '../hooks/useWebSocket';
import './ReconnectingBanner.css';

interface ReconnectingBannerProps {
  status: WsStatus;
}

/**
 * Banner shown during WebSocket reconnection attempts.
 * Disappears when the connection is restored.
 *
 * Requirements: 20.3
 */
export default function ReconnectingBanner({ status }: ReconnectingBannerProps) {
  if (status === 'connected') return null;

  const { t } = useTranslation();

  const isDisconnected = status === 'disconnected';

  return (
    <div
      className={`reconnecting-banner${isDisconnected ? ' reconnecting-banner--error' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={isDisconnected ? t('errors.offline') : t('errors.reconnecting')}
    >
      {!isDisconnected && (
        <span className="reconnecting-banner__spinner" aria-hidden="true" />
      )}
      <span className="reconnecting-banner__text">
        {isDisconnected ? t('errors.offline') : t('errors.reconnecting')}
      </span>
    </div>
  );
}
