import React, { useMemo } from 'react';
import {
  COLOR_PALETTE,
  getTokenBoardCoord,
} from '../shared/ludoEngine';
import type { LudoMatchState, PlayerColor, TokenState } from '../shared/types';

interface LudoBoardProps {
  state: LudoMatchState;
  legalTokenIds: number[];
  localColor: PlayerColor | null;
  onSelectToken: (tokenId: number) => void;
}

const SAFE_STAR_COORDS = new Set([
  '6,1',
  '2,6',
  '1,8',
  '6,12',
  '8,13',
  '12,8',
  '13,6',
  '8,2',
]);

const START_CELL_COLOR: Record<string, PlayerColor> = {
  '13,6': 'red',
  '6,1': 'green',
  '1,8': 'yellow',
  '8,13': 'blue',
};

function getHomeStretchColor(r: number, c: number): PlayerColor | null {
  if (c === 7 && r >= 9 && r <= 13) return 'red';
  if (r === 7 && c >= 1 && c <= 5) return 'green';
  if (c === 7 && r >= 1 && r <= 5) return 'yellow';
  if (r === 7 && c >= 9 && c <= 13) return 'blue';
  return null;
}

function isYardCell(r: number, c: number): boolean {
  return (r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8);
}

function isCenterCell(r: number, c: number): boolean {
  return r >= 6 && r <= 8 && c >= 6 && c <= 8;
}

const STACK_OFFSETS: [number, number][] = [
  [-0.18, -0.18],
  [0.18, -0.18],
  [-0.18, 0.18],
  [0.18, 0.18],
  [0, -0.22],
  [0, 0.22],
];

export const LudoBoard: React.FC<LudoBoardProps> = ({
  state,
  legalTokenIds,
  localColor,
  onSelectToken,
}) => {
  const currentColor = state.activeColors[state.currentTurnIndex];

  // Collect all active tokens and group by rounded coordinate for stacking offsets
  const positionedTokens = useMemo(() => {
    const allTokens: TokenState[] = [];
    for (const color of state.activeColors) {
      allTokens.push(...state.tokens[color]);
    }

    const groups = new Map<string, TokenState[]>();
    for (const t of allTokens) {
      const [row, col] = getTokenBoardCoord(t);
      const key = `${row.toFixed(2)},${col.toFixed(2)}`;
      const arr = groups.get(key) || [];
      arr.push(t);
      groups.set(key, arr);
    }

    return allTokens.map((t) => {
      const [baseRow, baseCol] = getTokenBoardCoord(t);
      const key = `${baseRow.toFixed(2)},${baseCol.toFixed(2)}`;
      const siblings = groups.get(key) || [t];
      const idx = siblings.findIndex((s) => s.color === t.color && s.id === t.id);

      let offsetR = 0;
      let offsetC = 0;
      let scale = 1;
      if (siblings.length > 1 && t.progress !== -1) {
        const off = STACK_OFFSETS[idx % STACK_OFFSETS.length];
        offsetR = off[0];
        offsetC = off[1];
        scale = siblings.length >= 3 ? 0.78 : 0.86;
      }

      const isCurrentTurn = t.color === currentColor;
      const isLegal =
        state.phase === 'MOVE' &&
        isCurrentTurn &&
        (localColor === null || localColor === t.color) &&
        legalTokenIds.includes(t.id);

      return {
        token: t,
        topPct: ((baseRow + 0.5 + offsetR) / 15) * 100,
        leftPct: ((baseCol + 0.5 + offsetC) / 15) * 100,
        scale,
        isLegal,
        isCurrentTurn,
      };
    });
  }, [state.activeColors, state.tokens, state.phase, currentColor, localColor, legalTokenIds]);

  const cells = useMemo(() => {
    const items: React.ReactNode[] = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (isYardCell(r, c) || isCenterCell(r, c)) {
          continue;
        }
        const key = `${r},${c}`;
        const startColor = START_CELL_COLOR[key];
        const stretchColor = getHomeStretchColor(r, c);
        const isStar = SAFE_STAR_COORDS.has(key);

        let bg = '#FBF7EE';
        let borderColor = 'rgba(72, 42, 22, 0.22)';
        let iconColor = '#B07D32';

        if (startColor) {
          bg = COLOR_PALETTE[startColor].hex;
          iconColor = '#FFFDF7';
          borderColor = 'rgba(0,0,0,0.2)';
        } else if (stretchColor) {
          bg = COLOR_PALETTE[stretchColor].hex;
          borderColor = 'rgba(0,0,0,0.18)';
        }

        items.push(
          <div
            key={key}
            style={{
              gridRow: r + 1,
              gridColumn: c + 1,
              backgroundColor: bg,
              borderColor,
            }}
            className="border-[0.75px] flex items-center justify-center relative select-none"
          >
            {isStar && (
              <svg
                viewBox="0 0 24 24"
                className="w-[64%] h-[64%] opacity-90"
                fill="none"
                stroke={iconColor}
                strokeWidth="1.7"
              >
                <polygon
                  points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6"
                  fill={startColor ? 'rgba(255,255,255,0.22)' : 'rgba(217,155,45,0.22)'}
                />
              </svg>
            )}
          </div>
        );
      }
    }
    return items;
  }, []);

  const renderYard = (
    color: PlayerColor,
    rowStart: number,
    colStart: number
  ) => {
    const palette = COLOR_PALETTE[color];
    const isActiveInMatch = state.activeColors.includes(color);
    const isTurn = currentColor === color && state.phase !== 'FINISHED';

    return (
      <div
        key={`yard-${color}`}
        style={{
          gridRow: `${rowStart} / span 6`,
          gridColumn: `${colStart} / span 6`,
          backgroundColor: palette.hex,
        }}
        className={`relative p-[12%] border border-black/25 flex items-center justify-center transition-opacity duration-200 ${
          isActiveInMatch ? 'opacity-100' : 'opacity-45 grayscale-[35%]'
        }`}
      >
        {isTurn && (
          <div className="absolute inset-1 rounded-lg border-2 border-amber-300 shadow-[inset_0_0_16px_rgba(253,224,71,0.55)] pointer-events-none" />
        )}
        <div className="w-full h-full bg-[#FBF7EE] rounded-xl border-2 border-black/15 shadow-inner grid grid-cols-2 grid-rows-2 p-[14%] gap-[18%]">
          {[0, 1, 2, 3].map((slot) => (
            <div
              key={slot}
              style={{
                borderColor: palette.hex,
                backgroundColor: `${palette.hex}18`,
              }}
              className="rounded-full border-2 shadow-inner"
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full aspect-square max-w-[460px] mx-auto select-none">
      {/* Handcrafted teak/rosewood outer frame */}
      <div className="w-full h-full rounded-2xl p-1.5 sm:p-2 bg-gradient-to-br from-[#4D2C1A] via-[#341B0E] to-[#231108] border border-amber-500/40 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
        <div className="relative w-full h-full rounded-xl overflow-hidden border border-amber-950/80 bg-[#FBF7EE]">
          {/* 15x15 Grid */}
          <div className="grid grid-cols-15 grid-rows-15 w-full h-full">
            {renderYard('green', 1, 1)}
            {renderYard('yellow', 1, 10)}
            {renderYard('red', 10, 1)}
            {renderYard('blue', 10, 10)}

            {cells}

            {/* Center 3x3 Home Sanctuary */}
            <div
              style={{
                gridRow: '7 / span 3',
                gridColumn: '7 / span 3',
              }}
              className="relative border border-black/30 overflow-hidden"
            >
              <svg viewBox="0 0 100 100" className="w-full h-full block">
                {/* Top triangle: Yellow */}
                <polygon points="0,0 100,0 50,50" fill={COLOR_PALETTE.yellow.hex} stroke="#231108" strokeWidth="1.2" />
                {/* Right triangle: Blue */}
                <polygon points="100,0 100,100 50,50" fill={COLOR_PALETTE.blue.hex} stroke="#231108" strokeWidth="1.2" />
                {/* Bottom triangle: Red */}
                <polygon points="0,100 100,100 50,50" fill={COLOR_PALETTE.red.hex} stroke="#231108" strokeWidth="1.2" />
                {/* Left triangle: Green */}
                <polygon points="0,0 0,100 50,50" fill={COLOR_PALETTE.green.hex} stroke="#231108" strokeWidth="1.2" />
                {/* Center golden lotus crest */}
                <circle cx="50" cy="50" r="14" fill="#FFFDF7" stroke="#B45309" strokeWidth="2.5" />
                <polygon
                  points="50,39 53,47 61,50 53,53 50,61 47,53 39,50 47,47"
                  fill="#D97706"
                />
              </svg>
            </div>
          </div>

          {/* Animated Tokens Layer */}
          <div className="absolute inset-0 pointer-events-none">
            {positionedTokens.map(({ token, topPct, leftPct, scale, isLegal, isCurrentTurn }) => {
              const palette = COLOR_PALETTE[token.color];
              return (
                <button
                  key={`${token.color}-${token.id}`}
                  type="button"
                  disabled={!isLegal}
                  onClick={() => isLegal && onSelectToken(token.id)}
                  aria-label={`${palette.label} token ${token.id + 1}`}
                  style={{
                    top: `${topPct}%`,
                    left: `${leftPct}%`,
                    transform: `translate(-50%, -50%) scale(${scale})`,
                    zIndex: isLegal ? 35 : isCurrentTurn ? 20 : 12,
                  }}
                  className={`absolute w-[6.1%] h-[6.1%] min-w-[20px] min-h-[20px] flex items-center justify-center transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    isLegal ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
                  }`}
                >
                  {/* Invisible touch target expansion for legal moves */}
                  {isLegal && (
                    <span className="absolute -inset-2.5 rounded-full bg-amber-300/35 ring-2 ring-amber-300 animate-token-ready" />
                  )}

                  {/* Sculpted Indian Ludo Pawn */}
                  <span
                    className="relative w-full h-full rounded-full flex items-center justify-center shadow-[0_3px_6px_rgba(0,0,0,0.45)] border-[1.5px] border-white"
                    style={{
                      background: `radial-gradient(circle at 32% 30%, #FFFFFF55 0%, ${palette.hex} 48%, ${palette.darkHex} 100%)`,
                    }}
                  >
                    <span className="w-[46%] h-[46%] rounded-full bg-white/90 shadow-inner border border-black/15" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
