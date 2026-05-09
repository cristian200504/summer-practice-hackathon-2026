import './Avatar.css';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: AvatarSize;
  className?: string;
}

/**
 * Circular user avatar with fallback initials.
 * Always has a meaningful alt text for screen readers. Requirement 19.2
 */
export default function Avatar({ src, alt, size = 'md', className = '' }: AvatarProps) {
  const initials = alt
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className={`avatar avatar--${size} ${className}`} aria-label={alt} role="img">
      {src ? (
        <img src={src} alt={alt} className="avatar__img" />
      ) : (
        <span className="avatar__initials" aria-hidden="true">
          {initials}
        </span>
      )}
    </div>
  );
}
