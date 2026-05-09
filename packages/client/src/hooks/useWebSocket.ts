import { useEffect, useRef, useCallback, useState } from 'react';
import { getToken } from '../services/api';

/**
 * WebSocket connection states.
 */
export type WsStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface UseWebSocketOptions {
  /** Called when a message is received. */
  onMessage?: (data: unknown) => void;
  /** Rooms to join immediately after connecting. */
  rooms?: string[];
}

const WS_BASE_URL = window.location.origin.replace(/^http/, 'ws') + '/api';

// Exponential backoff delays: 1s, 2s, 4s, 8s, 16s (max 5 retries — Req 20.3)
const BACKOFF_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];
const MAX_RETRIES = 5;

/**
 * React hook for a managed WebSocket connection with exponential backoff
 * reconnection (up to 5 retries).
 *
 * - Authenticates via JWT token in the `?token=` query parameter.
 * - Automatically joins the specified rooms on connect.
 * - Exposes `status` so the UI can show a "Reconnecting…" banner.
 * - Exposes `send` to publish messages to the server.
 *
 * Requirements: 20.3
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onMessage, rooms = [] } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<WsStatus>('connecting');

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const token = getToken();
    const url = `${WS_BASE_URL}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      retryCountRef.current = 0;
      setStatus('connected');

      // Join requested rooms
      for (const room of rooms) {
        ws.send(JSON.stringify({ type: 'join', room }));
      }
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data as string) as unknown;
        onMessage?.(data);
      } catch {
        // Non-JSON message — ignore
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;

      const attempt = retryCountRef.current;
      if (attempt >= MAX_RETRIES) {
        setStatus('disconnected');
        return;
      }

      // Exponential backoff — delay is strictly greater than the previous (Req 20.3)
      const delay = BACKOFF_DELAYS_MS[attempt];
      retryCountRef.current = attempt + 1;
      setStatus('reconnecting');

      retryTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror — reconnection is handled there
    };
  }, [onMessage, rooms]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Send a message to the WebSocket server. */
  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  /** Join a room after initial connection. */
  const joinRoom = useCallback((room: string) => {
    send({ type: 'join', room });
  }, [send]);

  /** Leave a room. */
  const leaveRoom = useCallback((room: string) => {
    send({ type: 'leave', room });
  }, [send]);

  return { status, send, joinRoom, leaveRoom };
}
