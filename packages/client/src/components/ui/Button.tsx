import { ButtonHTMLAttributes, forwardRef } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * Accessible button component.
 *
 * - All variants meet WCAG 2.1 AA contrast ratio (≥ 4.5:1 for normal text).
 * - Keyboard-navigable with visible focus indicator.
 * - Communicates loading state to screen readers via aria-busy.
 *
 * Requirement 19.2
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      children,
      className = '',
      ...props
    },
    ref,
  ) => {
    const classes = [
      'btn',
      `btn--${variant}`,
      `btn--${size}`,
      fullWidth ? 'btn--full' : '',
      loading ? 'btn--loading' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="btn__spinner" aria-hidden="true" />
        )}
        <span className={loading ? 'btn__label--hidden' : undefined}>{children}</span>
        {loading && <span className="sr-only">Loading…</span>}
      </button>
    );
  },
);

Button.displayName = 'Button';
export default Button;
