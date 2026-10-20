import { useState, memo } from 'react';
import type { Channel } from '../types/channel';
import './ChannelIcon.css';

interface ChannelIconProps {
  channel: Channel;
  size?: number;
  className?: string;
}

export const ChannelIcon = memo(function ChannelIcon({
  channel,
  size = 46,
  className = '',
}: ChannelIconProps) {
  const [hasError, setHasError] = useState(false);
  const initials = channel.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const radius = Math.round(size * 0.26);

  return (
    <div
      className={`channel-icon-tile ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: radius,
      }}
    >
      {channel.logo && !hasError ? (
        <img
          src={channel.logo}
          alt={channel.name}
          className="channel-icon-img"
          loading="lazy"
          decoding="async"
          onError={() => setHasError(true)}
        />
      ) : (
        <span
          className="channel-icon-initials"
          style={{ fontSize: Math.max(10, Math.round(size * 0.36)) }}
        >
          {initials || 'TV'}
        </span>
      )}
    </div>
  );
});
