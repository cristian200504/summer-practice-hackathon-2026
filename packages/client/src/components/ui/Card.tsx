import { HTMLAttributes } from 'react';
import './Card.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Surface container with consistent padding and shadow.
 * Requirement 19.2
 */
export default function Card({ padding = 'md', className = '', children, ...props }: CardProps) {
  return (
    <div className={`card card--padding-${padding} ${className}`} {...props}>
      {children}
    </div>
  );
}
