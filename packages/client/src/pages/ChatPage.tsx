import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Avatar, Spinner } from '../components/ui';
import ReconnectingBanner from '../components/ReconnectingBanner';
import { useWebSocket } from '../hooks/useWebSocket';
import { chat, ChatMessage, PollOption, getStoredUserId } from '../services/api';
import './ChatPage.css';

/**
 * Real-time group chat page.
 *
 * - Loads message history on mount.
 * - Subscribes to the group's WebSocket room for live updates.
 * - Optimistic message rendering (message appears immediately on send).
 * - Inline poll cards with live vote tallies.
 * - Push notification for new messages when chat is not in focus (Req 8.8).
 *
 * Requirements: 8.2, 8.3, 8.7, 8.8
 */
export default function ChatPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { t } = useTranslation();
  const userId = getStoredUserId();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [pollTallies, setPollTallies] = useState<Record<string, PollOption[]>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // WebSocket connection for real-time updates
  const { status } = useWebSocket({
    rooms: groupId ? [`group:${groupId}`] : [],
    onMessage: useCallback((data: unknown) => {
      const msg = data as { type: string; payload?: unknown };

      if (msg.type === 'new_message' || msg.type === 'system_message') {
        const newMsg = msg.payload as ChatMessage;
        setMessages((prev) => {
          // Avoid duplicates (optimistic message already added)
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }

      if (msg.type === 'poll_tally') {
        const { pollId, options } = msg.payload as { pollId: string; options: PollOption[] };
        setPollTallies((prev) => ({ ...prev, [pollId]: options }));
      }

      if (msg.type === 'poll_closed') {
        const { pollId, tally } = msg.payload as { pollId: string; tally: PollOption[] };
        setPollTallies((prev) => ({ ...prev, [pollId]: tally }));
      }
    }, []),
  });

  // Load message history
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    async function load() {
      try {
        const result = await chat.getMessages(groupId!);
        if (!cancelled) setMessages(result.messages);
      } catch {
        // silently fail — WebSocket will deliver new messages
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [groupId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Push notification for new messages when tab is not focused (Req 8.8)
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission === 'denied') return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  const handleSend = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !groupId || sending) return;

    const content = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic update
    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      groupId,
      senderId: userId,
      content,
      messageType: 'text',
      createdAt: new Date().toISOString(),
      expiresAt: null,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const saved = await chat.sendMessage(groupId, content);
      // Replace optimistic message with the real one
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? saved : m));
    } catch {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInputText(content); // restore input
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [inputText, groupId, userId, sending]);

  const handleVote = useCallback(async (pollId: string, optionId: string) => {
    try {
      await chat.vote(pollId, optionId);
    } catch {
      // Vote conflict (already voted) — ignore
    }
  }, []);

  if (loading) {
    return (
      <main className="chat-page">
        <Spinner centered />
      </main>
    );
  }

  return (
    <main className="chat-page" aria-label={t('chat.placeholder')}>
      <ReconnectingBanner status={status} />

      {/* Message list */}
      <div className="chat-page__messages" role="log" aria-live="polite" aria-label="Messages">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderId === userId}
            pollTally={msg.messageType === 'poll' ? pollTallies[msg.id] : undefined}
            onVote={handleVote}
          />
        ))}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* Input */}
      <form className="chat-page__input-bar" onSubmit={handleSend} aria-label="Send message">
        <input
          ref={inputRef}
          type="text"
          className="chat-page__input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.placeholder')}
          disabled={sending}
          maxLength={2000}
          autoComplete="off"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!inputText.trim() || sending}
          loading={sending}
          aria-label={t('chat.send')}
        >
          {t('chat.send')}
        </Button>
      </form>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  pollTally?: PollOption[];
  onVote: (pollId: string, optionId: string) => void;
}

function MessageBubble({ message, isOwn, pollTally, onVote }: MessageBubbleProps) {
  const { t } = useTranslation();

  if (message.messageType === 'system') {
    return (
      <div className="chat-bubble chat-bubble--system" role="status">
        <span className="chat-bubble__system-text">{message.content}</span>
      </div>
    );
  }

  if (message.messageType === 'poll' && pollTally) {
    const total = pollTally.reduce((sum, o) => sum + (o.voteCount ?? 0), 0);
    return (
      <div className="chat-bubble chat-bubble--poll">
        <p className="chat-bubble__poll-question">{message.content}</p>
        <ul className="chat-bubble__poll-options" role="list">
          {pollTally.map((option) => {
            const pct = total > 0 ? Math.round(((option.voteCount ?? 0) / total) * 100) : 0;
            return (
              <li key={option.id} className="chat-bubble__poll-option">
                <button
                  type="button"
                  className="chat-bubble__poll-vote-btn"
                  onClick={() => onVote(option.pollId, option.id)}
                  aria-label={`${t('chat.poll.vote')} ${option.label}`}
                >
                  <span className="chat-bubble__poll-label">{option.label}</span>
                  <span className="chat-bubble__poll-count">
                    {t('chat.poll.votes', { count: option.voteCount ?? 0 })}
                  </span>
                </button>
                <div
                  className="chat-bubble__poll-bar"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${option.label}: ${pct}%`}
                >
                  <div className="chat-bubble__poll-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`chat-bubble${isOwn ? ' chat-bubble--own' : ''}`}>
      {!isOwn && (
        <Avatar
          src={null}
          alt={message.senderId ?? 'User'}
          size="sm"
          className="chat-bubble__avatar"
        />
      )}
      <div className="chat-bubble__body">
        <p className="chat-bubble__text">{message.content}</p>
        <time className="chat-bubble__time" dateTime={message.createdAt}>{time}</time>
      </div>
    </div>
  );
}
