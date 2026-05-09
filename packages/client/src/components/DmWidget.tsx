import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge } from './ui';
import { dm, DmConversation } from '../services/api';
import './DmWidget.css';

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Dashboard DM widget — shows recent conversations with unread counts.
 * Clicking a conversation opens the DM chat page.
 * Clicking "See all" navigates to the full Messages inbox.
 */
export default function DmWidget() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const convs = await dm.listConversations();
        if (!cancelled) setConversations(convs.slice(0, 5)); // show top 5 on dashboard
      } catch {
        // silently fail — widget is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <section className="dm-widget" aria-label="Direct messages">
      <div className="dm-widget__header">
        <h2 className="dm-widget__title">
          Messages
          {totalUnread > 0 && (
            <Badge variant="danger" className="dm-widget__badge">
              {totalUnread > 99 ? '99+' : totalUnread}
            </Badge>
          )}
        </h2>
        <button
          type="button"
          className="dm-widget__see-all"
          onClick={() => navigate('/messages')}
          aria-label="See all messages"
        >
          See all →
        </button>
      </div>

      {loading ? (
        <div className="dm-widget__loading" aria-busy="true">
          <span className="spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px' }} aria-hidden="true" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="dm-widget__empty">
          <p className="dm-widget__empty-text">No messages yet.</p>
          <button
            type="button"
            className="dm-widget__start-btn"
            onClick={() => navigate('/messages')}
          >
            💬 Start a conversation
          </button>
        </div>
      ) : (
        <ul className="dm-widget__list" role="list">
          {conversations.map((conv) => (
            <li key={conv.id}>
              <button
                type="button"
                className={`dm-widget__item${conv.unreadCount > 0 ? ' dm-widget__item--unread' : ''}`}
                onClick={() => navigate(`/messages/${slugify(conv.otherDisplayName) || 'user'}--${conv.otherUserId}`)}
                aria-label={`${conv.otherDisplayName}${conv.unreadCount > 0 ? `, ${conv.unreadCount} unread` : ''}`}
              >
                <div className="dm-widget__avatar-wrap">
                  <Avatar
                    src={conv.otherThumbnailUrl}
                    alt={conv.otherDisplayName}
                    size="sm"
                  />
                  {conv.unreadCount > 0 && (
                    <span className="dm-widget__dot" aria-hidden="true" />
                  )}
                </div>
                <div className="dm-widget__item-body">
                  <span className="dm-widget__item-name">{conv.otherDisplayName}</span>
                  <span className="dm-widget__item-preview">
                    {conv.lastMessageContent
                      ? truncate(conv.lastMessageContent, 40)
                      : 'No messages yet'}
                  </span>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="dm-widget__count" aria-hidden="true">
                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}
