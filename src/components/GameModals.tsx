import React, { useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Globe,
  HelpCircle,
  KeyRound,
  LogIn,
  Music,
  Play,
  Share2,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import type { AIDifficulty, LudoRulesConfig, RoomInfo, UserProfile } from '../shared/types';
import { COLOR_PALETTE } from '../shared/ludoEngine';
import { PlayerAvatar } from './PlayerAvatar';

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const ModalShell: React.FC<ModalShellProps> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-40 bg-black/75 flex items-end sm:items-center justify-center p-0 sm:p-4">
    <div className="w-full sm:max-w-md max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#26130A] border-t sm:border border-amber-600/40 shadow-2xl overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-amber-900/50 bg-[#1E0E07]">
        <h2 className="font-display text-lg font-bold text-amber-200">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-2 rounded-lg text-amber-200/75 hover:text-amber-50 hover:bg-white/10 min-w-[40px] min-h-[40px] flex items-center justify-center transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </div>
  </div>
);

/* 1. Play with Computer Modal */
interface ComputerSetupModalProps {
  onClose: () => void;
  onStart: (opponentCount: 1 | 2 | 3, difficulty: AIDifficulty) => void;
}

export const ComputerSetupModal: React.FC<ComputerSetupModalProps> = ({ onClose, onStart }) => {
  const [opponents, setOpponents] = useState<1 | 2 | 3>(1);
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');

  return (
    <ModalShell title="Play with Computer" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-amber-200/80 mb-2">
            Computer Opponents
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setOpponents(count)}
                className={`py-3 px-2 rounded-xl border text-center transition min-h-[48px] ${
                  opponents === count
                    ? 'bg-amber-500 text-[#1A0D07] border-amber-300 font-bold'
                    : 'bg-black/25 text-amber-100 border-amber-900/50 hover:bg-white/5'
                }`}
              >
                <div className="text-sm font-bold">{count + 1} Players</div>
                <div className="text-[11px] opacity-80">vs {count} AI</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-amber-200/80 mb-2">
            AI Difficulty
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'easy', label: 'Easy', desc: 'Casual' },
              { id: 'medium', label: 'Medium', desc: 'Balanced' },
              { id: 'hard', label: 'Hard', desc: 'Tactical' },
            ] as const).map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setDifficulty(lvl.id)}
                className={`py-3 px-2 rounded-xl border text-center transition min-h-[48px] ${
                  difficulty === lvl.id
                    ? 'bg-amber-500 text-[#1A0D07] border-amber-300 font-bold'
                    : 'bg-black/25 text-amber-100 border-amber-900/50 hover:bg-white/5'
                }`}
              >
                <div className="text-sm font-bold">{lvl.label}</div>
                <div className="text-[11px] opacity-80">{lvl.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onStart(opponents, difficulty)}
          className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1A0D07] font-bold text-sm flex items-center justify-center gap-2 transition min-h-[48px]"
        >
          <Bot className="w-4 h-4" />
          <span>Start Match</span>
        </button>
      </div>
    </ModalShell>
  );
};

/* 2. Online Matchmaking Modal */
interface OnlineMatchmakingModalProps {
  wsConnected: boolean;
  queueStatus: { playerCount: 2 | 4; waitingCount: number; neededCount: number } | null;
  onJoinQueue: (playerCount: 2 | 4) => void;
  onLeaveQueue: () => void;
  onClose: () => void;
}

export const OnlineMatchmakingModal: React.FC<OnlineMatchmakingModalProps> = ({
  wsConnected,
  queueStatus,
  onJoinQueue,
  onLeaveQueue,
  onClose,
}) => {
  const [selectedCount, setSelectedCount] = useState<2 | 4>(2);

  return (
    <ModalShell title="Play Online" onClose={onClose}>
      <div className="space-y-5">
        {!wsConnected && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
            Connecting to the authoritative multiplayer server. Please ensure the Node.js WebSocket server is running and you are online.
          </div>
        )}

        {queueStatus ? (
          <div className="p-5 rounded-2xl bg-black/30 border border-amber-500/40 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center">
              <Globe className="w-6 h-6 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <div>
              <h3 className="font-bold text-base text-amber-100">
                Searching for {queueStatus.playerCount}-Player Match
              </h3>
              <p className="text-xs text-amber-200/80 mt-1 font-mono-num">
                Players in queue: {queueStatus.waitingCount} / {queueStatus.neededCount}
              </p>
            </div>
            <p className="text-xs text-amber-100/65 leading-relaxed">
              Real-time matchmaking waits for genuine connected players. Open a second browser tab or another device to join immediately.
            </p>
            <button
              type="button"
              onClick={onLeaveQueue}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-amber-100 text-sm font-semibold transition min-h-[44px]"
            >
              Cancel Search
            </button>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-amber-200/80 mb-2">
                Select Match Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([2, 4] as const).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setSelectedCount(count)}
                    className={`py-3.5 px-3 rounded-xl border text-center transition min-h-[52px] ${
                      selectedCount === count
                        ? 'bg-amber-500 text-[#1A0D07] border-amber-300 font-bold'
                        : 'bg-black/25 text-amber-100 border-amber-900/50 hover:bg-white/5'
                    }`}
                  >
                    <div className="text-sm font-bold">{count} Players</div>
                    <div className="text-[11px] opacity-80">Server-Verified</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/25 border border-amber-900/40 text-xs text-amber-100/75 leading-relaxed">
              Dice rolls, turn validation, and victory rankings are strictly computed on the server. Completed matches update the verified leaderboard.
            </div>

            <button
              type="button"
              disabled={!wsConnected}
              onClick={() => onJoinQueue(selectedCount)}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-[#1A0D07] font-bold text-sm flex items-center justify-center gap-2 transition min-h-[48px]"
            >
              <Globe className="w-4 h-4" />
              <span>Find {selectedCount}-Player Match</span>
            </button>
          </>
        )}
      </div>
    </ModalShell>
  );
};

/* 3. Private Room Modal (Create / Join / Play with Friends) */
interface PrivateRoomModalProps {
  initialTab: 'create' | 'join';
  wsConnected: boolean;
  room: RoomInfo | null;
  roomError: string | null;
  localUid: string;
  onCreateRoom: (maxPlayers: 2 | 4) => void;
  onJoinRoom: (code: string) => void;
  onToggleReady: (code: string, ready: boolean) => void;
  onStartRoom: (code: string) => void;
  onLeaveRoom: (code: string) => void;
  onClose: () => void;
}

export const PrivateRoomModal: React.FC<PrivateRoomModalProps> = ({
  initialTab,
  wsConnected,
  room,
  roomError,
  localUid,
  onCreateRoom,
  onJoinRoom,
  onToggleReady,
  onStartRoom,
  onLeaveRoom,
  onClose,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>(initialTab);
  const [maxPlayers, setMaxPlayers] = useState<2 | 4>(2);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleShareCode = async (code: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my X Ludo Private Room',
          text: `Join my X Ludo match! Room Code: ${code}`,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    handleCopyCode(code);
  };

  if (room) {
    const isHost = room.hostUid === localUid;
    const me = room.players.find((p) => p.uid === localUid);
    const allGuestsReady = room.players.every((p) => p.uid === room.hostUid || p.ready);
    const canStart = isHost && room.players.length >= 2 && allGuestsReady;

    return (
      <ModalShell title="Private Room Lobby" onClose={onClose}>
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-black/35 border border-amber-500/40 text-center">
            <div className="text-xs text-amber-200/75">Share 6-Character Room Code</div>
            <div className="font-mono-num text-3xl font-bold tracking-[0.25em] text-amber-300 mt-1">
              {room.roomCode}
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => handleCopyCode(room.roomCode)}
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-amber-100 inline-flex items-center gap-1.5 min-h-[38px]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleShareCode(room.roomCode)}
                className="px-3.5 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold text-amber-200 inline-flex items-center gap-1.5 min-h-[38px]"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>

          {roomError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
              {roomError}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between text-xs text-amber-200/75 mb-2">
              <span>Players ({room.players.length}/{room.maxPlayers})</span>
              <span>{room.maxPlayers}-Player Match</span>
            </div>
            <div className="space-y-2">
              {room.players.map((p) => (
                <div
                  key={p.uid}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-black/25 border border-amber-900/40"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PlayerAvatar avatarId={p.avatar} name={p.name} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-amber-50 truncate">
                        {p.name} {p.uid === room.hostUid ? '(Host)' : ''}
                      </div>
                      <div className="text-[11px] text-amber-200/70 flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: COLOR_PALETTE[p.color].hex }}
                        />
                        <span>{COLOR_PALETTE[p.color].label}</span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      p.ready ? 'text-emerald-400' : 'text-amber-300/70'
                    }`}
                  >
                    {p.uid === room.hostUid ? 'Host' : p.ready ? 'Ready' : 'Waiting'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            {isHost ? (
              <button
                type="button"
                disabled={!canStart}
                onClick={() => onStartRoom(room.roomCode)}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-[#1A0D07] font-bold text-sm flex items-center justify-center gap-2 transition min-h-[48px]"
              >
                <Play className="w-4 h-4" />
                <span>
                  {room.players.length < 2
                    ? 'Waiting for Friends to Join...'
                    : !allGuestsReady
                      ? 'Waiting for Ready Check...'
                      : 'Start Match'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onToggleReady(room.roomCode, !me?.ready)}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition min-h-[48px] ${
                  me?.ready
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-amber-500 text-[#1A0D07] hover:bg-amber-400'
                }`}
              >
                {me?.ready ? 'Ready (Tap to Unready)' : 'Mark Ready'}
              </button>
            )}

            <button
              type="button"
              onClick={() => onLeaveRoom(room.roomCode)}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-amber-100 text-sm font-semibold transition min-h-[44px]"
            >
              Leave Room
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Play with Friends" onClose={onClose}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/35 border border-amber-900/40">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`py-2.5 rounded-lg text-xs font-bold transition min-h-[40px] ${
              tab === 'create' ? 'bg-amber-500 text-[#1A0D07]' : 'text-amber-100/80 hover:text-white'
            }`}
          >
            Create Private Room
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`py-2.5 rounded-lg text-xs font-bold transition min-h-[40px] ${
              tab === 'join' ? 'bg-amber-500 text-[#1A0D07]' : 'text-amber-100/80 hover:text-white'
            }`}
          >
            Join Private Room
          </button>
        </div>

        {roomError && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
            {roomError}
          </div>
        )}

        {tab === 'create' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-amber-200/80 mb-2">
                Room Capacity
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([2, 4] as const).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setMaxPlayers(count)}
                    className={`py-3 rounded-xl border text-center transition min-h-[48px] ${
                      maxPlayers === count
                        ? 'bg-amber-500 text-[#1A0D07] border-amber-300 font-bold'
                        : 'bg-black/25 text-amber-100 border-amber-900/50 hover:bg-white/5'
                    }`}
                  >
                    {count} Players
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={!wsConnected}
              onClick={() => onCreateRoom(maxPlayers)}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-[#1A0D07] font-bold text-sm flex items-center justify-center gap-2 transition min-h-[48px]"
            >
              <Users className="w-4 h-4" />
              <span>Generate Room Code</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-amber-200/80 mb-2">
                Enter 6-Character Room Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="e.g. X7K9P2"
                className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-amber-700/50 text-amber-100 font-mono-num text-center text-xl tracking-[0.25em] focus:outline-none focus:border-amber-400"
              />
            </div>
            <button
              type="button"
              disabled={!wsConnected || joinCode.length !== 6}
              onClick={() => onJoinRoom(joinCode)}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-[#1A0D07] font-bold text-sm flex items-center justify-center gap-2 transition min-h-[48px]"
            >
              <KeyRound className="w-4 h-4" />
              <span>Join Room</span>
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  );
};

/* 4. How to Play Modal */
export const HowToPlayModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <ModalShell title="How to Play Classic Ludo" onClose={onClose}>
    <div className="space-y-3 text-sm text-amber-100/85 leading-relaxed">
      <div className="p-3.5 rounded-xl bg-black/25 border border-amber-900/40">
        <div className="font-bold text-amber-300 flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          <span>1. Leaving the Yard</span>
        </div>
        <p className="text-xs mt-1 text-amber-100/75">
          Each player has 4 tokens. Roll a 6 to bring a token out of your colored yard onto your starting star square.
        </p>
      </div>
      <div className="p-3.5 rounded-xl bg-black/25 border border-amber-900/40">
        <div className="font-bold text-amber-300">2. Bonus Turns & Three-Sixes Rule</div>
        <p className="text-xs mt-1 text-amber-100/75">
          Rolling a 6, capturing an opponent token, or guiding a token Home grants an extra roll. Rolling three 6s in a row forfeits the turn!
        </p>
      </div>
      <div className="p-3.5 rounded-xl bg-black/25 border border-amber-900/40">
        <div className="font-bold text-amber-300">3. Safe Squares & Capturing</div>
        <p className="text-xs mt-1 text-amber-100/75">
          Landing on an opponent token sends it back to its yard unless it is resting on one of the 8 Safe Star squares.
        </p>
      </div>
      <div className="p-3.5 rounded-xl bg-black/25 border border-amber-900/40">
        <div className="font-bold text-amber-300">4. Exact Roll to Win</div>
        <p className="text-xs mt-1 text-amber-100/75">
          Guide all 4 tokens clockwise into your colored home lane and reach the center sanctuary with an exact dice roll to win!
        </p>
      </div>
    </div>
  </ModalShell>
);

/* 5. Auth Modal (Guest & Google / Firebase Instructions) */
interface AuthModalProps {
  user: UserProfile | null;
  firebaseConfigured: boolean;
  onContinueGuest: () => void;
  onLogout: () => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  user,
  firebaseConfigured,
  onContinueGuest,
  onLogout,
  onClose,
}) => {
  const [showGoogleGuide, setShowGoogleGuide] = useState(false);

  return (
    <ModalShell title="Account & Authentication" onClose={onClose}>
      <div className="space-y-4">
        {user && (
          <div className="p-3.5 rounded-xl bg-black/30 border border-amber-600/40 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <PlayerAvatar avatarId={user.avatar} name={user.name} size="md" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-amber-100 truncate">{user.name}</div>
                <div className="text-xs text-amber-300/80 font-mono-num">{user.playerId}</div>
              </div>
            </div>
            <span className="text-xs font-semibold text-amber-200">
              {user.authProvider === 'google' ? 'Google' : 'Guest'}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowGoogleGuide((v) => !v)}
          className="w-full py-3.5 px-4 rounded-xl bg-white text-slate-900 hover:bg-amber-50 font-bold text-sm flex items-center justify-center gap-2.5 transition min-h-[48px]"
        >
          <LogIn className="w-4 h-4" />
          <span>{user ? 'Upgrade Guest to Google Account' : 'Continue with Google'}</span>
        </button>

        {showGoogleGuide && (
          <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-100/85 space-y-2 leading-relaxed">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                {firebaseConfigured
                  ? 'Firebase Ready'
                  : 'Firebase Auth Not Provisioned Yet'}
              </span>
            </div>
            <p>
              Google Sign-In and Guest-to-Google account linking (`linkWithPopup`) require Firebase Authentication to be provisioned for this project. Because Firebase setup was skipped, Google Sign-In is disabled instead of simulated.
            </p>
            <p className="text-amber-200/80">
              To enable Google Login & Cloud Firestore: add your `firebase-applet-config.json`, enable Google & Anonymous providers in Firebase Console, and deploy the included `firestore.rules`.
            </p>
          </div>
        )}

        {!user ? (
          <button
            type="button"
            onClick={onContinueGuest}
            className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1A0D07] font-bold text-sm flex items-center justify-center gap-2 transition min-h-[48px]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Continue as Guest (Unique ID)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-3 px-4 rounded-xl bg-rose-900/50 hover:bg-rose-800/70 border border-rose-500/40 text-rose-100 font-semibold text-sm transition min-h-[44px]"
          >
            Logout
          </button>
        )}
      </div>
    </ModalShell>
  );
};

/* 6. Settings & Setup Status Modal */
interface SettingsModalProps {
  muted: boolean;
  musicEnabled: boolean;
  rules: LudoRulesConfig;
  firebaseConfigured: boolean;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onOpenAuth: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  muted,
  musicEnabled,
  rules,
  firebaseConfigured,
  onToggleMute,
  onToggleMusic,
  onOpenAuth,
  onClose,
}) => {
  const [tab, setTab] = useState<'audio' | 'rules' | 'setup'>('audio');

  return (
    <ModalShell title="Settings & Configuration" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/35 border border-amber-900/40">
          {(
            [
              { id: 'audio', label: 'Audio & Account' },
              { id: 'rules', label: 'Match Rules' },
              { id: 'setup', label: 'Android & Cloud' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition min-h-[38px] ${
                tab === t.id ? 'bg-amber-500 text-[#1A0D07]' : 'text-amber-100/80 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'audio' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onToggleMute}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-black/25 border border-amber-900/40 min-h-[52px]"
            >
              <span className="flex items-center gap-2.5 text-sm font-semibold text-amber-100">
                <Volume2 className="w-4 h-4 text-amber-300" />
                <span>Sound Effects</span>
              </span>
              <span className={`text-xs font-bold ${muted ? 'text-rose-400' : 'text-emerald-400'}`}>
                {muted ? 'Muted' : 'Enabled'}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleMusic}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-black/25 border border-amber-900/40 min-h-[52px]"
            >
              <span className="flex items-center gap-2.5 text-sm font-semibold text-amber-100">
                <Music className="w-4 h-4 text-amber-300" />
                <span>Background Music</span>
              </span>
              <span className={`text-xs font-bold ${musicEnabled ? 'text-emerald-400' : 'text-amber-200/60'}`}>
                {musicEnabled ? 'On' : 'Off'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-amber-100 font-semibold text-sm transition min-h-[44px]"
            >
              Manage Authentication / Logout
            </button>
          </div>
        )}

        {tab === 'rules' && (
          <div className="space-y-2 text-xs text-amber-100/85">
            <div className="flex justify-between py-2 border-b border-amber-900/40">
              <span>Roll 6 Required to Exit Yard</span>
              <span className="font-bold text-amber-300">{rules.requireSixToExit ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-amber-900/40">
              <span>Bonus Turn on 6 / Capture / Home</span>
              <span className="font-bold text-amber-300">{rules.bonusTurnOnSix ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-amber-900/40">
              <span>Three Consecutive 6s</span>
              <span className="font-bold text-amber-300">
                {rules.threeSixesRule === 'forfeit' ? 'Forfeit Turn' : 'Allowed'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-amber-900/40">
              <span>8 Safe Star Squares</span>
              <span className="font-bold text-amber-300">{rules.safeSquaresEnabled ? 'Active' : 'Off'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-amber-900/40">
              <span>Exact Roll to Reach Home</span>
              <span className="font-bold text-amber-300">{rules.exactRollToHome ? 'Required' : 'No'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span>Online Turn Timeout</span>
              <span className="font-mono-num font-bold text-amber-300">{rules.turnTimeoutSeconds}s</span>
            </div>
          </div>
        )}

        {tab === 'setup' && (
          <div className="space-y-3 text-xs text-amber-100/80 leading-relaxed">
            <div className="p-3 rounded-xl bg-black/30 border border-amber-900/40">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                <span>Android Capacitor Packaging (com.xludo.game)</span>
              </div>
              <p className="mt-1">
                Configured via `capacitor.config.ts` with portrait lock, hardware back button handling, and offline detection. Run `npm run build && npx cap add android && npx cap sync android && npx cap open android` to build debug/release APKs in Android Studio.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-amber-900/40">
              <div className="font-bold text-amber-300">Backend & Database Status</div>
              <p className="mt-1">
                Node.js WebSocket Multiplayer Server: <strong className="text-emerald-400">Active</strong>
                <br />
                Firebase Cloud Firestore & Google Login:{' '}
                <strong className={firebaseConfigured ? 'text-emerald-400' : 'text-amber-300'}>
                  {firebaseConfigured ? 'Configured' : 'Not Configured (Guest + Node Store Active)'}
                </strong>
              </p>
              {!firebaseConfigured && (
                <p className="mt-1.5 text-amber-200/70">
                  See `DEPLOYMENT_AND_ANDROID_GUIDE.md` along with `firebase-blueprint.json` and `firestore.rules` to attach a Firebase project for Google Sign-In.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
