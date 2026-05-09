import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge } from '../components/ui';
import { dm, DmConversation, users, UserSearchResult } from '../services/api';
import './MessagesPage.css';

/**
 * Messages inbox.
 *
 * Flow:
 *  1. Type in the search bar → debounced results appear below it.
 *  2. Click a result → a "selected user" card appears with a "Message" button.
 *  3. Click "Message" → conversation is created (or fetched), search is cleared,
 *     and the conversation appears in the list below.
 *  4. When the search bar is empty the conversation list is always visible.
 */
export default function MessagesPage() {
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // The user the searcher has clicked on (pending "Message" action)
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [startingConv, setStartingConv] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load conversations ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const convs = await dm.listConversations();
        if (!cancelled) setConversations(convs);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoadingConvs(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // ── Debounced search ────────────────────────────────────────────────────────

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    // Clear selected user whenever the query changes
    setSelectedUser(null);

    if (searchQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await users.search(searchQuery.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  /** Step 1: user clicks a search result → show the card with "Message" button */
  const handleSelectUser = useCallback((user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchResults([]); // hide the dropdown
  }, []);

  /** Step 2: user clicks "Message" on the card → navigate to /messages/:username--:userId */
  const handleStartConversation = useCallback(async () => {
    if (!selectedUser) return;
    setStartingConv(true);
    try {
      // Navigate immediately — DmChatPage will create the conversation on load
      const slug = slugify(selectedUser.displayName) || 'user';
      navigate(`/messages/${slug}--${selectedUser.userId}`);
    } catch {
      // silently fail
    } finally {
      setStartingConv(false);
    }
  }, [selectedUser, navigate]);

  const handleOpenConversation = useCallback((conv: DmConversation) => {
    const slug = slugify(conv.otherDisplayName) || 'user';
    navigate(`/messages/${slug}--${conv.otherUserId}`);
  }, [navigate]);

  const handleClearSelection = useCallback(() => {
    setSelectedUser(null);
    setSearchQuery('');
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const showConversations = searchQuery.trim().length === 0 && !selectedUser;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="messages-page" aria-label="Direct messages">
      <header className="messages-page__header">
        <h1 className="messages-page__title">
          Messages
          {totalUnread > 0 && (
            <Badge variant="danger" className="messages-page__unread-badge">
              {totalUnread}
            </Badge>
          )}
        </h1>
      </header>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <section className="messages-page__search-section" aria-label="Start new conversation">
        <div className="messages-page__search-wrapper">
          <input
            type="search"
            className="messages-page__search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search people to message"
            autoComplete="off"
          />
          {searching && (
            <span className="messages-page__search-spinner" aria-hidden="true">
              <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} />
            </span>
          )}
        </div>

        {/* Dropdown results */}
        {searchResults.length > 0 && (
          <ul className="messages-page__search-results" role="listbox" aria-label="Search results">
            {searchResults.map((user) => (
              <li key={user.userId} role="option" aria-selected="false">
                <button
                  type="button"
                  className="messages-page__search-result"
                  onClick={() => handleSelectUser(user)}
                  aria-label={`Select ${user.displayName} (${user.email})`}
                >
                  <Avatar src={user.thumbnailUrl} alt={user.displayName} size="sm" />
                  <div className="messages-page__search-user-info">
                    <span className="messages-page__search-name">{user.displayName}</span>
                    <span className="messages-page__search-email">{user.email}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {searchQuery.trim().length >= 1 && !searching && searchResults.length === 0 && !selectedUser && (
          <p className="messages-page__no-results">No users found for "{searchQuery}"</p>
        )}
      </section>

      {/* ── Selected user card ─────────────────────────────────────────────── */}
      {selectedUser && (
        <div className="messages-page__selected-card" role="region" aria-label="Selected user">
          <div className="messages-page__selected-info">
            <Avatar src={selectedUser.thumbnailUrl} alt={selectedUser.displayName} size="md" />
            <div className="messages-page__selected-text">
              <span className="messages-page__selected-name">{selectedUser.displayName}</span>
              <span className="messages-page__selected-email">{selectedUser.email}</span>
            </div>
          </div>
          <div className="messages-page__selected-actions">
            <button
              type="button"
              className="messages-page__message-btn"
              onClick={handleStartConversation}
              disabled={startingConv}
              aria-label={`Message ${selectedUser.displayName}`}
            >
              {startingConv ? (
                <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} aria-hidden="true" />
              ) : (
                '💬 Message'
              )}
            </button>
            <button
              type="button"
              className="messages-page__cancel-btn"
              onClick={handleClearSelection}
              aria-label="Cancel"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Conversation list (only when search is empty) ──────────────────── */}
      {showConversations && (
        <section aria-label="Conversations">
          {loadingConvs ? (
            <div className="messages-page__loading" aria-busy="true">
              <span className="spinner" aria-hidden="true" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="messages-page__empty">
              <p className="messages-page__empty-icon" aria-hidden="true">💬</p>
              <p className="messages-page__empty-text">No conversations yet.</p>
              <p className="messages-page__empty-hint">Search for someone above to start chatting.</p>
            </div>
          ) : (
            <ul className="messages-page__conv-list" role="list">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <ConversationItem
                    conversation={conv}
                    onClick={() => handleOpenConversation(conv)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

// ── ConversationItem ──────────────────────────────────────────────────────────

interface ConversationItemProps {
  conversation: DmConversation;
  onClick: () => void;
}

function ConversationItem({ conversation, onClick }: ConversationItemProps) {
  const hasUnread = conversation.unreadCount > 0;
  const timeLabel = conversation.lastMessageAt
    ? formatRelativeTime(new Date(conversation.lastMessageAt))
    : '';

  return (
    <button
      type="button"
      className={`conv-item${hasUnread ? ' conv-item--unread' : ''}`}
      onClick={onClick}
      aria-label={`Conversation with ${conversation.otherDisplayName}${hasUnread ? `, ${conversation.unreadCount} unread` : ''}`}
    >
      <div className="conv-item__avatar-wrapper">
        <Avatar src={conversation.otherThumbnailUrl} alt={conversation.otherDisplayName} size="md" />
        {hasUnread && <span className="conv-item__unread-dot" aria-hidden="true" />}
      </div>

      <div className="conv-item__body">
        <div className="conv-item__top-row">
          <span className="conv-item__name">{conversation.otherDisplayName}</span>
          {timeLabel && <span className="conv-item__time">{timeLabel}</span>}
        </div>
        <div className="conv-item__bottom-row">
          <span className="conv-item__preview">
            {conversation.lastMessageContent
              ? truncate(conversation.lastMessageContent, 50)
              : 'No messages yet'}
          </span>
          {hasUnread && (
            <span className="conv-item__badge" aria-label={`${conversation.unreadCount} unread`}>
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Convert a display name to a URL-safe slug: "John Doe" → "john-doe" */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
