import React, { useState } from 'react';
import { getAvatarOption } from '../utils/avatars';

interface PlayerAvatarProps {
  avatarId: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  ringColor?: string;
}

const SIZE_CLASSES = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
};

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  avatarId,
  name,
  size = 'md',
  ringColor,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const option = getAvatarOption(avatarId);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || option.initials;

  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold text-amber-50 bg-gradient-to-br ${option.accentBg} ${SIZE_CLASSES[size]} ${
        ringColor ? 'ring-2' : 'ring-1 ring-amber-400/40'
      }`}
      style={ringColor ? { ['--tw-ring-color' as string]: ringColor } : undefined}
    >
      {option.imageSrc && !imgFailed ? (
        <img
          src={option.imageSrc}
          alt={`${name} avatar`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="tracking-wide select-none">{initials}</span>
      )}
    </div>
  );
};
