import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dm, DmMessage, DmConversation, getStoredUserId } from '../services/api';
import './DmChatPage.css';

/**
 * Direct message chat page — chatbot-style UI.
 *
 * Route: /messages/:handle  (handle = "<slug>--<userId>")
 *
 * Deliberately avoids WebSocket so it works even when the WS server is down.
 * New messages are picked up via a lightweight poll every 3 seconds.
 */
export default function DmChatPage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const myUserId = getStoredUserId();

  const [conversation, setConversation] = useState<DmConversation | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const convIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const otherUserId = extractUserId(username ?? '');
  const displayName = conversation?.otherDisplayName ?? displayNameFromHandle(username ?? '');

  // ── Load conversation + messages ──────────────────────────────────────────

  useEffect(() => {
    if (!otherUserId) {
      setError('Invalid conversation link.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const conv = await dm.getOrCreateConversation(otherUserId!);
        if (cancelled) return;
        convIdRef.current = conv.id;
        setConversation(conv);

        const result = await dm.getMessages(conv.id);
        if (!cancelled) setMessages(result.messages);
      } catch {
        if (!cancelled) setError('Could not load conversation. Make sure the server is running.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [otherUserId]);

  // ── Poll for new messages every 3 s ──────────────────────────────────────

  useEffect(() => {
    if (!convIdRef.current) return;

    pollRef.current = setInterval(async () => {
      const convId = convIdRef.current;
      if (!convId) return;
      try {
        const result = await dm.getMessages(convId);
        setMessages(result.messages);
      } catch {
        // silently ignore poll failures
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [conversation]); // re-run once conversation is set

  // ── Scroll to bottom ──────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Focus input once loaded ───────────────────────────────────────────────

  useEffect(() => {
    if (!loading && !error) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, error]);

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const convId = convIdRef.current;
    if (!inputText.trim() || !convId || sending) return;

    const content = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic bubble
    const optimistic: DmMessage = {
      id: `optimistic-${Date.now()}`,
      conversationId: convId,
      senderId: myUserId ?? '',
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const saved = await dm.sendMessage(convId, content);
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? saved : m));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInputText(content);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [inputText, myUserId, sending]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="dm-page" aria-label="Direct message conversation">

      {/* ── Header (chatbot-style gradient) ─────────────────────────────── */}
      <div className="dm-page__header">
        <button
          type="button"
          className="dm-page__back"
          onClick={() => navigate('/messages')}
          aria-label="Back to messages"
        >
          ←
        </button>
        <div className="dm-page__header-info">
          <span className="dm-page__avatar" aria-hidden="true">💬</span>
          <div>
            <p className="dm-page__name">{displayName}</p>
            <p className="dm-page__status">
              <span className="dm-page__status-dot" aria-hidden="true" />
              Direct message
            </p>
          </div>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div
        className="dm-page__messages"
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        {loading ? (
          <div className="dm-page__center">
            <span className="spinner" aria-hidden="true" />
          </div>
        ) : error ? (
          <div className="dm-page__center dm-page__error">
            <p>⚠️ {error}</p>
            <button
              type="button"
              className="dm-page__retry"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <p className="dm-page__empty">No messages yet. Say hello! 👋</p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === myUserId;
            const time = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div
                key={msg.id}
                className={`dm-msg${isOwn ? ' dm-msg--own' : ' dm-msg--other'}`}
              >
                {!isOwn && (
                  <span className="dm-msg__avatar" aria-hidden="true">👤</span>
                )}
                <div className="dm-msg__bubble">
                  <p className="dm-msg__text">{msg.content}</p>
                  <time className="dm-msg__time" dateTime={msg.createdAt}>{time}</time>
                </div>
              </div>
            );
          })
        )}

        {sending && (
          <div className="dm-msg dm-msg--own">
            <div className="dm-msg__bubble dm-msg__bubble--typing">
              <span className="dm-typing-dot" />
              <span className="dm-typing-dot" />
              <span className="dm-typing-dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      {!error && (
        <form className="dm-page__input-bar" onSubmit={handleSend} aria-label="Send message">
          <input
            ref={inputRef}
            type="text"
            className="dm-page__input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message ${displayName}…`}
            aria-label="Type a message"
            disabled={sending || loading}
            maxLength={2000}
            autoComplete="off"
          />
          <button
            type="submit"
            className="dm-page__send"
            disabled={!inputText.trim() || sending || loading}
            aria-label="Send"
          >
            {sending ? '⏳' : '➤'}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractUserId(handle: string): string | null {
  const match = handle.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return match ? match[0] : null;
}

function displayNameFromHandle(handle: string): string {
  const withoutId = handle.replace(/--[0-9a-f-]{36}$/i, '');
  return withoutId.replace(/-/g, ' ');
}
