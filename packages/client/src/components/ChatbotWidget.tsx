import { useState, useRef, useEffect, FormEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { request } from '../services/api';
import './ChatbotWidget.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

/**
 * Floating chatbot widget for the dashboard.
 *
 * Uses the Python g4f microservice (via the Node.js proxy at POST /chatbot)
 * to provide a sports assistant chatbot.
 *
 * - Floating button in the bottom-right corner.
 * - Opens a chat panel with message history.
 * - Maintains conversation context across messages.
 * - Accessible: keyboard-navigable, ARIA labels, focus management.
 */
export default function ChatbotWidget() {
  const { t: _t } = useTranslation(); // reserved for future i18n
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hey! I'm your ShowUp2Move sports assistant 🏃 Ask me anything about sports, training tips, or how to get the most out of the platform!",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleSend = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      // Build history for context (exclude welcome message, last 10)
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-10)
        .map(({ role, content }) => ({ role, content }));

      const data = await request<{ reply: string }>('/chatbot', {
        method: 'POST',
        body: JSON.stringify({ message: text, history }),
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: "Sorry, I'm having a quick timeout! Try again in a moment. 🏃",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [inputText, loading, messages]);

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="chatbot-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Sports assistant chatbot"
        >
          {/* Header */}
          <div className="chatbot-panel__header">
            <div className="chatbot-panel__header-info">
              <span className="chatbot-panel__avatar" aria-hidden="true">🤖</span>
              <div>
                <p className="chatbot-panel__name">Sports Assistant</p>
                <p className="chatbot-panel__status">
                  <span className="chatbot-panel__status-dot" aria-hidden="true" />
                  Online
                </p>
              </div>
            </div>
            <button
              type="button"
              className="chatbot-panel__close"
              onClick={() => setIsOpen(false)}
              aria-label="Close chatbot"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            className="chatbot-panel__messages"
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chatbot-msg chatbot-msg--${msg.role}`}
              >
                {msg.role === 'assistant' && (
                  <span className="chatbot-msg__avatar" aria-hidden="true">🤖</span>
                )}
                <div className="chatbot-msg__bubble">
                  <p className="chatbot-msg__text">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="chatbot-msg chatbot-msg--assistant">
                <span className="chatbot-msg__avatar" aria-hidden="true">🤖</span>
                <div className="chatbot-msg__bubble chatbot-msg__bubble--typing">
                  <span className="chatbot-typing-dot" />
                  <span className="chatbot-typing-dot" />
                  <span className="chatbot-typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} aria-hidden="true" />
          </div>

          {/* Quick suggestions */}
          {messages.length === 1 && (
            <div className="chatbot-panel__suggestions">
              {[
                'How do I improve my stamina?',
                'Best sports for beginners?',
                'Tips for my first match',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="chatbot-suggestion"
                  onClick={() => {
                    setInputText(suggestion);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form className="chatbot-panel__input-bar" onSubmit={handleSend}>
            <input
              ref={inputRef}
              type="text"
              className="chatbot-panel__input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask me about sports..."
              aria-label="Type your message"
              disabled={loading}
              maxLength={500}
              autoComplete="off"
            />
            <button
              type="submit"
              className="chatbot-panel__send"
              disabled={!inputText.trim() || loading}
              aria-label="Send message"
            >
              {loading ? '⏳' : '➤'}
            </button>
          </form>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        type="button"
        className={`chatbot-fab${isOpen ? ' chatbot-fab--open' : ''}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Close sports assistant' : 'Open sports assistant'}
        aria-expanded={isOpen}
      >
        <span className="chatbot-fab__icon" aria-hidden="true">
          {isOpen ? '✕' : '🤖'}
        </span>
        {!isOpen && (
          <span className="chatbot-fab__label">Ask AI</span>
        )}
      </button>
    </>
  );
}
