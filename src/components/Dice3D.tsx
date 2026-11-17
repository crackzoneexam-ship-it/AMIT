import React from 'react';

interface Dice3DProps {
  value: number | null;
  rolling: boolean;
  canRoll: boolean;
  accentHex?: string;
  onRoll?: () => void;
  size?: 'sm' | 'md';
}

const PIP_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 24],
    [72, 24],
    [28, 50],
    [72, 50],
    [28, 76],
    [72, 76],
  ],
};

export const Dice3D: React.FC<Dice3DProps> = ({
  value,
  rolling,
  canRoll,
  accentHex = '#D97706',
  onRoll,
  size = 'md',
}) => {
  const displayVal = value && value >= 1 && value <= 6 ? value : 6;
  const pips = PIP_POSITIONS[displayVal];
  const dim = size === 'sm' ? 'w-12 h-12' : 'w-14 h-14';

  return (
    <button
      type="button"
      onClick={canRoll && !rolling ? onRoll : undefined}
      disabled={!canRoll || rolling}
      aria-label={canRoll ? 'Roll dice' : `Dice showing ${displayVal}`}
      className={`relative ${dim} rounded-xl flex items-center justify-center transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-amber-400 ${
        canRoll && !rolling
          ? 'cursor-pointer hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.45)]'
          : 'cursor-default opacity-90'
      }`}
      style={{
        background: 'linear-gradient(145deg, #FFFDF7 0%, #EFE4CE 100%)',
        border: `2.5px solid ${canRoll ? accentHex : '#B08D57'}`,
        boxShadow: canRoll
          ? `0 6px 18px rgba(0,0,0,0.45), inset 0 2px 3px rgba(255,255,255,0.9), 0 0 0 3px ${accentHex}44`
          : '0 4px 10px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.8)',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full p-1.5 ${rolling ? 'animate-dice-roll' : ''}`}
      >
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="16"
          fill="none"
          stroke="#D4B483"
          strokeWidth="2"
        />
        {pips.map(([cx, cy], idx) => (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r={displayVal === 1 ? 13 : 9.5}
            fill={displayVal === 1 || displayVal === 6 ? '#B91C1C' : '#29170D'}
          />
        ))}
      </svg>
    </button>
  );
};
