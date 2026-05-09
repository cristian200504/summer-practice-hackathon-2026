import { InputHTMLAttributes, forwardRef, useId } from 'react';
import './Input.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  /** Hide the visible label (still accessible to screen readers) */
  hideLabel?: boolean;
}

/**
 * Accessible text input with label, error, and hint support.
 *
 * - Label is always associated with the input via htmlFor/id.
 * - Error messages are linked via aria-describedby.
 * - Error state communicated via aria-invalid.
 * - Meets WCAG 2.1 AA contrast requirements.
 *
 * Requirement 19.2
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, hideLabel = false, className = '', id: externalId, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    const describedBy = [error ? errorId : null, hint ? hintId : null]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className="input-field">
        <label
          htmlFor={id}
          className={`input-field__label${hideLabel ? ' sr-only' : ''}`}
        >
          {label}
        </label>

        <input
          ref={ref}
          id={id}
          className={`input-field__input${error ? ' input-field__input--error' : ''} ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...props}
        />

        {hint && !error && (
          <p id={hintId} className="input-field__hint">
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} className="input-field__error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
export default Input;
