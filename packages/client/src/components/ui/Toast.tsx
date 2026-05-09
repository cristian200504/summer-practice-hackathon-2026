import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './Toast.css';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  message: string;
  variant?: ToastVariant;
  /** Duration in ms before auto-dismiss. 0 = no auto-dismiss. Default: 4000 */
  duration?: number;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { id, message, variant = 'info', duration = 4000 } = toast;

  useEffect(() => {
    if (duration === 0) return;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const icons: Record<ToastVariant, string> = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };

  return (
    <div
      className={`toast toast--${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className="toast__icon" aria-hidden="true">
        {icons[variant]}
      </span>
      <span className="toast__message">{message}</span>
      <button
        type="button"
        className="toast__close"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

/**
 * Toast notification container.
 *
 * - Uses role="status" (polite) for info/success/warning.
 * - Uses role="alert" (assertive) for errors.
 * - Provides visual feedback within 200ms (Req 19.4).
 * - Meets WCAG 2.1 AA contrast requirements (Req 19.2).
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-container" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

/**
 * Hook for managing toast notifications.
 *
 * Usage:
 * ```tsx
 * const { toasts, addToast, dismissToast } = useToast();
 * addToast({ message: 'Saved!', variant: 'success' });
 * ```
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function addToast(toast: Omit<ToastMessage, 'id'>) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, addToast, dismissToast };
}

export default ToastContainer;
