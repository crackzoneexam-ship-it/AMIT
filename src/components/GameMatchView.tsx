import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Crown,
  Music,
  RotateCcw,
  Share2,
  Trophy,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { chooseAIMove } from '../shared/ludoAI';
import {
  applyDiceRoll,
  applyTokenMove,
  COLOR_PALETTE,
  getCurrentPlayer,
  getLegalMoves,
} from '../shared/ludoEngine';
import type { LudoMatchState, MatchPlayer, PlayerColor } from '../shared/types';
import { soundEngine } from '../utils/soundEngine';
import { Dice3D } from './Dice3D';
import { LudoBoard } from './LudoBoard';
import { PlayerAvatar } from './PlayerAvatar';

interface GameMatchViewProps {
  matchState: LudoMatchState;
  localUid: string;
  onUpdateLocalState?: (next: LudoMatchState) => void;
  onServerRoll?: (matchId: string, expectedSeq: number) => void;
  onServerMove?: (matchId: string, tokenId: number, expectedSeq: number) => void;
  onExitMatch: (forfeit: boolean) => void;
  onPlayAgainAI?: () => void;
  muted: boolean;
  musicEnabled: boolean;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onMatchFinishedLocal?: (state: LudoMatchState) => void;
}

const CONFETTI_COLORS = ['#D92B2B', '#15803D', '#EAB308', '#1D4ED8', '#F59E0B', '#FDE047'];

export const GameMatchView: React.FC<GameMatchViewProps> = ({
  matchState,
  localUid,
  onUpdateLocalState,
  onServerRoll,
  onServerMove,
  onExitMatch,
  onPlayAgainAI,
  muted,
  musicEnabled,
  onToggleMute,
  onToggleMusic,
  onMatchFinishedLocal,
}) => {
  const [rollingAnim, setRollingAnim] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const prevSeqRef = useRef<number>(matchState.actionSeq);
  const finishedNotifiedRef = useRef<string | null>(null);

  const isLocalAI = matchState.mode === 'ai';
  const currentPlayer = getCurrentPlayer(matchState);
  const localPlayer = matchState.players.find((p) => p.uid === localUid) || null;
  const localColor: PlayerColor | null = localPlayer ? localPlayer.color : null;
  const isMyTurn = currentPlayer.uid === localUid && matchState.phase !== 'FINISHED';

  const legalTokenIds = useMemo(() => {
    if (matchState.phase !== 'MOVE' || matchState.diceValue === null) return [];
    return getLegalMoves(matchState, currentPlayer.color, matchState.diceValue);
  }, [matchState, currentPlayer.color]);

  // Countdown tick for turn deadline
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  // Sound feedback when authoritative state advances (online or local)
  useEffect(() => {
    if (matchState.actionSeq !== prevSeqRef.current) {
      prevSeqRef.current = matchState.actionSeq;
      const latestLog = matchState.moveLog[0];
      if (matchState.phase === 'FINISHED') {
        soundEngine.playVictory();
      } else if (latestLog && latestLog.seq === matchState.actionSeq) {
        if (latestLog.captured.length > 0) {
          soundEngine.playCapture();
        } else if (latestLog.reachedHome) {
          soundEngine.playHome();
        } else if (latestLog.tokenId !== null) {
          soundEngine.playStep();
        }
      }
    }
  }, [matchState.actionSeq, matchState.phase, matchState.moveLog]);

  // Notify local AI stats saver once per completed match
  useEffect(() => {
    if (
      isLocalAI &&
      matchState.phase === 'FINISHED' &&
      finishedNotifiedRef.current !== matchState.matchId
    ) {
      finishedNotifiedRef.current = matchState.matchId;
      onMatchFinishedLocal?.(matchState);
    }
  }, [isLocalAI, matchState, onMatchFinishedLocal]);

  // AI Turn Driver for local "Play with Computer" mode
  useEffect(() => {
    if (!isLocalAI || matchState.phase === 'FINISHED') return;
    if (!currentPlayer.isAI) return;

    let cancelled = false;

    if (matchState.phase === 'ROLL') {
      setRollingAnim(true);
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        soundEngine.playDiceRoll();
        const dice = Math.floor(Math.random() * 6) + 1;
        const rolled = applyDiceRoll(matchState, currentPlayer.color, dice);
        setRollingAnim(false);
        onUpdateLocalState?.(rolled.state);
      }, 650);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    if (matchState.phase === 'MOVE' && matchState.diceValue !== null) {
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        const chosenId = chooseAIMove(
          matchState,
          currentPlayer.color,
          currentPlayer.aiDifficulty || 'medium'
        );
        const moved = applyTokenMove(matchState, currentPlayer.color, chosenId);
        onUpdateLocalState?.(moved.state);
      }, 600);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
  }, [isLocalAI, matchState, currentPlayer, onUpdateLocalState]);

  const handleRollDice = () => {
    if (!isMyTurn || matchState.phase !== 'ROLL' || rollingAnim) return;
    soundEngine.playDiceRoll();
    setRollingAnim(true);

    if (isLocalAI) {
      window.setTimeout(() => {
        const dice = Math.floor(Math.random() * 6) + 1;
        const rolled = applyDiceRoll(matchState, currentPlayer.color, dice);
        setRollingAnim(false);
        onUpdateLocalState?.(rolled.state);
      }, 380);
    } else {
      onServerRoll?.(matchState.matchId, matchState.actionSeq);
      window.setTimeout(() => setRollingAnim(false), 450);
    }
  };

  const handleSelectToken = (tokenId: number) => {
    if (!isMyTurn || matchState.phase !== 'MOVE') return;
    if (!legalTokenIds.includes(tokenId)) return;

    if (isLocalAI) {
      const moved = applyTokenMove(matchState, currentPlayer.color, tokenId);
      onUpdateLocalState?.(moved.state);
    } else {
      onServerMove?.(matchState.matchId, tokenId, matchState.actionSeq);
    }
  };

  const getPlayerByColor = (c: PlayerColor): MatchPlayer | undefined =>
    matchState.players.find((p) => p.color === c);

  const secondsLeft = matchState.turnDeadline
    ? Math.max(0, Math.ceil((matchState.turnDeadline - nowMs) / 1000))
    : null;

  const renderPlayerChip = (color: PlayerColor, align: 'left' | 'right') => {
    const player = getPlayerByColor(color);
    if (!player) {
      return <div className="flex-1" />;
    }
    const palette = COLOR_PALETTE[color];
    const isActive = currentPlayer.color === color && matchState.phase !== 'FINISHED';
    const homeCount = matchState.tokens[color].filter((t) => t.progress === 56).length;

    return (
      <div
        className={`flex-1 max-w-[49%] flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all duration-200 ${
          align === 'right' ? 'flex-row-reverse text-right' : 'text-left'
        } ${
          isActive
            ? 'bg-[#3D2214] border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.3)]'
            : 'bg-[#28150C]/90 border-amber-900/50 opacity-85'
        } ${player.forfeited ? 'opacity-45 grayscale' : ''}`}
      >
        <PlayerAvatar
          avatarId={player.avatar}
          name={player.name}
          size="sm"
          ringColor={isActive ? '#FBBF24' : palette.hex}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 justify-start" style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/50"
              style={{ backgroundColor: palette.hex }}
            />
            <span className="text-xs font-semibold text-amber-50 truncate">
              {player.name}
            </span>
          </div>
          <div className="text-[11px] text-amber-200/70 font-mono-num flex items-center gap-1.5" style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
            <span>Home {homeCount}/4</span>
            {!player.connected && !player.isAI && (
              <span className="inline-flex items-center gap-0.5 text-rose-400">
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </span>
            )}
            {player.isAI && <span>· {player.aiDifficulty?.toUpperCase()}</span>}
          </div>
        </div>
      </div>
    );
  };

  const winnerPlayer = matchState.winnerColor
    ? getPlayerByColor(matchState.winnerColor)
    : null;

  return (
    <div className="h-[100dvh] w-full flex flex-col justify-between bg-[#1A0D07] text-[#FBF7EE] overflow-hidden select-none">
      {/* Compact Top Header */}
      <header className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-amber-900/40 bg-[#23120B]/95">
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            if (matchState.phase === 'FINISHED') {
              onExitMatch(false);
            } else {
              setConfirmLeave(true);
            }
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium text-amber-100 hover:bg-white/10 active:scale-95 transition min-h-[40px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit</span>
        </button>

        <div className="text-center min-w-0 px-2">
          <div className="text-xs font-semibold tracking-wide text-amber-300 truncate">
            {matchState.mode === 'ai'
              ? 'Play with Computer'
              : matchState.mode === 'private' && matchState.roomCode
                ? `Room ${matchState.roomCode}`
                : 'Online Match'}
          </div>
          {secondsLeft !== null && matchState.phase !== 'FINISHED' && !isLocalAI && (
            <div className="text-[11px] text-amber-200/75 font-mono-num">
              Turn Timer: {secondsLeft}s
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onToggleMusic();
            }}
            aria-label={musicEnabled ? 'Disable music' : 'Enable music'}
            className={`p-2 rounded-lg transition min-w-[40px] min-h-[40px] flex items-center justify-center ${
              musicEnabled ? 'text-amber-300 bg-amber-500/15' : 'text-amber-200/50 hover:bg-white/10'
            }`}
          >
            <Music className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleMute();
            }}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="p-2 rounded-lg text-amber-200/80 hover:bg-white/10 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Playfield */}
      <main className="flex-1 flex flex-col justify-center gap-2 px-2.5 py-2 max-w-[500px] w-full mx-auto min-h-0">
        {/* Top Opponents Row (Green TL / Yellow TR) */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          {renderPlayerChip('green', 'left')}
          {renderPlayerChip('yellow', 'right')}
        </div>

        {/* Center 15x15 Ludo Board */}
        <div className="w-full flex items-center justify-center shrink-0">
          <LudoBoard
            state={matchState}
            legalTokenIds={legalTokenIds}
            localColor={localColor}
            onSelectToken={handleSelectToken}
          />
        </div>

        {/* Bottom Players Row (Red BL / Blue BR) */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          {renderPlayerChip('red', 'left')}
          {renderPlayerChip('blue', 'right')}
        </div>
      </main>

      {/* Bottom Dice & Turn Control Tray */}
      <footer className="shrink-0 border-t border-amber-900/50 bg-[#23120B]/95 px-3 py-2.5">
        <div className="max-w-[500px] mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLOR_PALETTE[currentPlayer.color].hex }}
              />
              <span className="text-xs font-bold text-amber-200 truncate">
                {isMyTurn
                  ? matchState.phase === 'ROLL'
                    ? 'Your Turn — Tap Dice to Roll'
                    : 'Your Turn — Tap Highlighted Token'
                  : `${currentPlayer.name}'s Turn`}
              </span>
            </div>
            <p className="text-[11px] text-amber-100/70 truncate mt-0.5">
              {matchState.lastEvent}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {matchState.diceValue !== null && matchState.phase === 'MOVE' && (
              <span className="text-xs font-mono-num font-bold text-amber-300">
                Rolled {matchState.diceValue}
              </span>
            )}
            <Dice3D
              value={matchState.diceValue}
              rolling={rollingAnim}
              canRoll={isMyTurn && matchState.phase === 'ROLL'}
              accentHex={COLOR_PALETTE[currentPlayer.color].hex}
              onRoll={handleRollDice}
            />
          </div>
        </div>
      </footer>

      {/* Leave Confirmation Dialog */}
      {confirmLeave && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#2A160D] border border-amber-600/40 p-5 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-amber-100">
              Leave Active Match?
            </h3>
            <p className="text-sm text-amber-100/75 mt-1.5">
              {isLocalAI
                ? 'Your current offline match progress will be lost.'
                : 'Leaving an active online match counts as a forfeit for your seat.'}
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-amber-100 bg-white/10 hover:bg-white/15 transition"
              >
                Stay in Match
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmLeave(false);
                  onExitMatch(true);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-700 hover:bg-rose-600 transition"
              >
                Leave Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Celebration Modal */}
      {matchState.phase === 'FINISHED' && winnerPlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-hidden">
          {/* Confetti Burst */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 28 }).map((_, i) => (
              <span
                key={i}
                className="confetti-piece absolute top-0 w-2.5 h-4 rounded-sm"
                style={{
                  left: `${(i * 3.7) % 100}%`,
                  backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  animationDelay: `${(i % 7) * 0.15}s`,
                }}
              />
            ))}
          </div>

          <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#361D11] to-[#211008] border border-amber-500/60 p-6 shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border border-amber-400/60 flex items-center justify-center mb-3">
              <Crown className="w-8 h-8 text-amber-300" />
            </div>

            <h2 className="font-display text-2xl font-bold text-amber-200">
              {winnerPlayer.uid === localUid ? 'Victory!' : 'Match Complete'}
            </h2>
            <p className="text-sm text-amber-100/80 mt-1">
              {winnerPlayer.name} ({COLOR_PALETTE[winnerPlayer.color].label}) conquered the board
            </p>

            {/* Rankings */}
            <div className="mt-5 space-y-2 text-left">
              {matchState.rankings.map((color, idx) => {
                const pl = getPlayerByColor(color);
                if (!pl) return null;
                return (
                  <div
                    key={color}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
                      idx === 0
                        ? 'bg-amber-500/15 border-amber-400/50'
                        : 'bg-black/25 border-amber-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono-num text-xs font-bold text-amber-300 w-5">
                        #{idx + 1}
                      </span>
                      <PlayerAvatar avatarId={pl.avatar} name={pl.name} size="xs" />
                      <span className="text-sm font-semibold text-amber-50 truncate">
                        {pl.name}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-amber-200/75">
                      {idx === 0 ? '+100 pts' : '+25 pts'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              {isLocalAI && onPlayAgainAI && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onPlayAgainAI();
                  }}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1A0D07] font-bold text-sm flex items-center justify-center gap-2 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Play Again</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onExitMatch(false);
                }}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-amber-100 font-semibold text-sm flex items-center justify-center gap-2 transition"
              >
                <Trophy className="w-4 h-4" />
                <span>Return to Home</span>
              </button>
              {matchState.mode !== 'ai' && (
                <p className="text-[11px] text-amber-200/60 flex items-center justify-center gap-1 mt-1">
                  <Share2 className="w-3 h-3" />
                  <span>Verified result saved to server leaderboard</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
