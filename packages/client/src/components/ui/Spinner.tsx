import './Spinner.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  /** Center the spinner in its container */
  centered?: boolean;
}

/**
 * Loading spinner for async operations.
 * Provides visual feedback within 200ms (Req 19.4).
 * Accessible via role="status" and aria-label.
 */
export default function Spinner({ size = 'md', label = 'Loading…', centered = false }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`spinner-wrapper${centered ? ' spinner-wrapper--centered' : ''}`}
    >
      <span className={`spinner spinner--${size}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
