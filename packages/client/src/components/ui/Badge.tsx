import { HTMLAttributes } from 'react';
import './Badge.css';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/**
 * Small inline label for status, categories, or achievements.
 * All variants meet WCAG 2.1 AA contrast (≥ 4.5:1). Requirement 19.2
 */
export default function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span className={`badge badge--${variant} ${className}`} {...props}>
      {children}
    </span>
  );
}
