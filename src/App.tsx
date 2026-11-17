import React, { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  Coins,
  DoorOpen,
  Globe,
  HelpCircle,
  KeyRound,
  LogIn,
  PlusCircle,
  Settings,
  Sparkles,
  Trophy,
  User,
  Users,
  WifiOff,
} from 'lucide-react';
import {
  ComputerSetupModal,
  HowToPlayModal,
  OnlineMatchmakingModal,
  PrivateRoomModal,
  SettingsModal,
  AuthModal,
} from './components/GameModals';
import { GameMatchView } from './components/GameMatchView';
import { PlayerAvatar } from './components/PlayerAvatar';
import { LeaderboardModal, ProfileModal } from './components/ProfileAndLeaderboard';
import { wsClient } from './services/wsClient';
import {
  createInitialMatchState,
  DEFAULT_LUDO_RULES,
  getColorsForPlayerCount,
} from './shared/ludoEngine';
import type {
  AIDifficulty,
  LudoMatchState,
  LudoRulesConfig,
  MatchHistoryEntry,
  MatchPlayer,
  PlayerColor,
  RoomInfo,
  UserProfile,
} from './shared/types';
import { APP_ICON_SRC, HERO_BACKDROP_SRC } from './utils/avatars';
import { registerBackButtonHandler } from './utils/capacitorBridge';
import { soundEngine } from './utils/soundEngine';

type ActiveModal =
  | null
  | 'computer'
  | 'online'
  | 'private_create'
  | 'private_join'
  | 'how_to_play'
  | 'leaderboard'
  | 'profile'
  | 'settings'
  | 'auth';

const SESSION_KEY = 'xludo_session_token';
const LOCAL_HISTORY_KEY = 'xludo_local_history';

const AI_OPPONENT_PRESETS = [
  { name: 'Raja Vikram', avatar: 'royal' },
  { name: 'Rani Padma', avatar: 'queen' },
  { name: 'Senapati Veer', avatar: 'warrior' },
];

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    localStorage.getItem(SESSION_KEY)
  );
  const [rules, setRules] = useState<LudoRulesConfig>(DEFAULT_LUDO_RULES);
  const [firebaseConfigured, setFirebaseConfigured] = useState(false);

  const [wsConnected, setWsConnected] = useState(false);
  const [isOnlineNet, setIsOnlineNet] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [inspectProfileUid, setInspectProfileUid] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<LudoMatchState | null>(null);
  const [lastAiSetup, setLastAiSetup] = useState<{
    opponents: 1 | 2 | 3;
    difficulty: AIDifficulty;
  }>({ opponents: 1, difficulty: 'medium' });

  const [queueStatus, setQueueStatus] = useState<{
    playerCount: 2 | 4;
    waitingCount: number;
    neededCount: number;
  } | null>(null);
  const [activeRoom, setActiveRoom] = useState<RoomInfo | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [muted, setMuted] = useState(() => soundEngine.isMuted());
  const [musicEnabled, setMusicEnabled] = useState(() => soundEngine.isMusicEnabled());
  const [localHistory, setLocalHistory] = useState<MatchHistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
      return raw ? (JSON.parse(raw) as MatchHistoryEntry[]) : [];
    } catch {
      return [];
    }
  });

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Network connectivity listener
  useEffect(() => {
    const onOnline = () => setIsOnlineNet(true);
    const onOffline = () => setIsOnlineNet(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Boot sequence: check backend status, rules, and restore session if present
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const [statusRes, rulesRes] = await Promise.all([
          fetch('/api/backend-status').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/rules').then((r) => (r.ok ? r.json() : null)),
        ]);
        if (!active) return;
        if (statusRes) {
          setFirebaseConfigured(Boolean(statusRes.firebaseConfigured));
        }
        if (rulesRes?.rules) {
          setRules(rulesRes.rules);
        }

        const savedToken = localStorage.getItem(SESSION_KEY);
        if (savedToken) {
          const authRes = await fetch('/api/auth/guest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ existingToken: savedToken }),
          });
          if (authRes.ok && active) {
            const data = await authRes.json();
            setUser(data.user);
            setSessionToken(data.sessionToken);
            localStorage.setItem(SESSION_KEY, data.sessionToken);
          }
        }
      } catch {
        // Offline fallback handled cleanly in UI
      } finally {
        if (active) setBooting(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  // WebSocket Lifecycle & Subscriptions
  useEffect(() => {
    if (!sessionToken || !user) {
      wsClient.disconnect();
      setWsConnected(false);
      setOnlineCount(null);
      return;
    }

    wsClient.connect(sessionToken);

    const unsubs = [
      wsClient.on('connection:status', (p) => {
        setWsConnected(Boolean(p?.connected));
        if (!p?.connected) setOnlineCount(null);
      }),
      wsClient.on('auth:ok', (p) => {
        if (p?.user) setUser(p.user);
        if (typeof p?.onlineCount === 'number') setOnlineCount(p.onlineCount);
      }),
      wsClient.on('presence:count', (p) => {
        if (typeof p?.onlineCount === 'number') setOnlineCount(p.onlineCount);
      }),
      wsClient.on('profile:updated', (u) => {
        if (u?.uid) setUser(u);
      }),
      wsClient.on('queue:status', (status) => {
        setQueueStatus(status);
      }),
      wsClient.on('queue:left', () => {
        setQueueStatus(null);
      }),
      wsClient.on('room:state', (room: RoomInfo) => {
        setRoomError(null);
        if (room.status === 'closed') {
          setActiveRoom(null);
        } else {
          setActiveRoom(room);
        }
      }),
      wsClient.on('room:left', () => {
        setActiveRoom(null);
        setRoomError(null);
      }),
      wsClient.on('room:error', (p) => {
        setRoomError(p?.message || 'Room error');
      }),
      wsClient.on('match:state', (match: LudoMatchState) => {
        setQueueStatus(null);
        setActiveRoom(null);
        setActiveModal(null);
        setActiveMatch(match);
      }),
      wsClient.on('error', (p) => {
        if (p?.message) showToast(p.message);
      }),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [sessionToken, user?.uid, showToast]);

  // Capacitor Android Hardware Back Button Handling
  useEffect(() => {
    return registerBackButtonHandler(() => {
      if (activeModal !== null) {
        setActiveModal(null);
        return true;
      }
      if (activeMatch) {
        if (activeMatch.phase === 'FINISHED') {
          setActiveMatch(null);
        } else {
          // Return true so user uses Exit confirmation inside GameMatchView
          showToast('Tap Exit in the top bar to leave the active match');
        }
        return true;
      }
      return false;
    });
  }, [activeModal, activeMatch, showToast]);

  const handleContinueAsGuest = async () => {
    soundEngine.playClick();
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Unable to create guest session');
      const data = await res.json();
      setUser(data.user);
      setSessionToken(data.sessionToken);
      localStorage.setItem(SESSION_KEY, data.sessionToken);
      setActiveModal(null);
    } catch {
      showToast('Server unavailable. Please check your connection.');
    }
  };

  const handleLogout = () => {
    soundEngine.playClick();
    wsClient.disconnect();
    localStorage.removeItem(SESSION_KEY);
    setSessionToken(null);
    setUser(null);
    setActiveMatch(null);
    setActiveRoom(null);
    setQueueStatus(null);
    setActiveModal(null);
  };

  const handleUpdateProfile = async (name: string, avatar: string) => {
    if (!sessionToken) return;
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ name, avatar }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update profile');
    }
    setUser(data.user);
    showToast('Profile updated');
  };

  const startLocalAIMatch = (opponentCount: 1 | 2 | 3, difficulty: AIDifficulty) => {
    if (!user) return;
    soundEngine.playClick();
    setLastAiSetup({ opponents: opponentCount, difficulty });

    const colors: PlayerColor[] =
      opponentCount === 1
        ? getColorsForPlayerCount(2)
        : opponentCount === 2
          ? ['red', 'green', 'yellow']
          : getColorsForPlayerCount(4);

    const players: MatchPlayer[] = [
      {
        uid: user.uid,
        playerId: user.playerId,
        name: user.name,
        avatar: user.avatar,
        color: colors[0],
        isAI: false,
        connected: true,
        ready: true,
      },
      ...Array.from({ length: opponentCount }).map((_, idx) => {
        const preset = AI_OPPONENT_PRESETS[idx % AI_OPPONENT_PRESETS.length];
        return {
          uid: `ai_${idx + 1}`,
          playerId: `BOT-${idx + 1}`,
          name: preset.name,
          avatar: preset.avatar,
          color: colors[idx + 1],
          isAI: true,
          aiDifficulty: difficulty,
          connected: true,
          ready: true,
        };
      }),
    ];

    const match = createInitialMatchState({
      matchId: `local_${Date.now()}`,
      mode: 'ai',
      players,
      rules,
    });
    setActiveModal(null);
    setActiveMatch(match);
  };

  const handleLocalMatchFinished = useCallback((finished: LudoMatchState) => {
    if (!finished.winnerColor) return;
    const winner = finished.players.find((p) => p.color === finished.winnerColor);
    if (!winner) return;

    const entry: MatchHistoryEntry = {
      matchId: finished.matchId,
      mode: 'ai',
      playerCount: finished.playerCount,
      winnerUid: winner.uid,
      winnerName: winner.name,
      winnerColor: winner.color,
      participants: finished.players.map((p) => ({
        uid: p.uid,
        name: p.name,
        color: p.color,
        isAI: p.isAI,
        placement: Math.max(1, finished.rankings.indexOf(p.color) + 1),
      })),
      durationSeconds: Math.max(1, Math.round((Date.now() - finished.createdAt) / 1000)),
      completedAt: Date.now(),
      verified: false,
    };

    setLocalHistory((prev) => {
      const next = [entry, ...prev].slice(0, 25);
      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleToggleMute = () => {
    const next = !muted;
    soundEngine.setMuted(next);
    setMuted(next);
  };

  const handleToggleMusic = () => {
    const next = !musicEnabled;
    soundEngine.setMusicEnabled(next);
    setMusicEnabled(next);
  };

  // Loading Screen
  if (booting) {
    return (
      <div className="h-[100dvh] w-full bg-[#1A0D07] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-amber-500/60 shadow-2xl mb-5 bg-[#2A150B]">
          <img
            src={APP_ICON_SRC}
            alt="X Ludo crest"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-wider text-amber-200">
          X LUDO
        </h1>
        <p className="text-xs text-amber-200/70 mt-2">
          Preparing board & multiplayer engine...
        </p>
      </div>
    );
  }

  // Active Match Screen
  if (activeMatch && user) {
    return (
      <GameMatchView
        matchState={activeMatch}
        localUid={user.uid}
        onUpdateLocalState={(next) => setActiveMatch(next)}
        onServerRoll={(matchId, expectedSeq) => {
          wsClient.send('match:roll', { matchId, expectedSeq });
        }}
        onServerMove={(matchId, tokenId, expectedSeq) => {
          wsClient.send('match:move', { matchId, tokenId, expectedSeq });
        }}
        onExitMatch={(forfeit) => {
          if (forfeit && activeMatch.mode !== 'ai') {
            wsClient.send('match:forfeit', { matchId: activeMatch.matchId });
          }
          setActiveMatch(null);
        }}
        onPlayAgainAI={() => startLocalAIMatch(lastAiSetup.opponents, lastAiSetup.difficulty)}
        muted={muted}
        musicEnabled={musicEnabled}
        onToggleMute={handleToggleMute}
        onToggleMusic={handleToggleMusic}
        onMatchFinishedLocal={handleLocalMatchFinished}
      />
    );
  }

  const winRate =
    user && user.totalGames > 0 ? Math.round((user.wins / user.totalGames) * 100) : 0;

  return (
    <div className="min-h-[100dvh] w-full bg-[#140904] flex justify-center overflow-x-hidden">
      {/* Mobile-first Portrait Shell (full-screen on phones, framed console on wide desktop) */}
      <div className="relative w-full max-w-[480px] min-h-[100dvh] flex flex-col bg-[#1E0E07] sm:border-x sm:border-amber-900/50 shadow-2xl overflow-hidden">
        {/* Atmospheric Indian Rosewood Backdrop */}
        <img
          src={HERO_BACKDROP_SRC}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[#160A05]/80 via-[#1E0E07]/75 to-[#120703]/95 pointer-events-none"
        />

        {/* Connectivity & Toast Banners */}
        {!isOnlineNet && (
          <div className="relative z-20 bg-rose-900/95 text-rose-100 text-xs font-medium px-4 py-2 flex items-center justify-center gap-2">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline — Play with Computer remains available</span>
          </div>
        )}

        {toastMsg && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-amber-500 text-[#1A0D07] text-xs font-bold shadow-xl">
            {toastMsg}
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-between p-4 pb-6 gap-4">
          {/* Top Brand + Player Identity Bar */}
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-11 h-11 rounded-xl overflow-hidden border border-amber-400/60 shadow-lg shrink-0 bg-[#2E180D]">
                <img
                  src={APP_ICON_SRC}
                  alt="X Ludo logo"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-xl font-extrabold tracking-wide text-amber-200 leading-none">
                  X LUDO
                </h1>
                <div className="text-[11px] text-amber-200/70 mt-1 truncate">
                  {onlineCount !== null ? (
                    <span className="font-mono-num">{onlineCount} Online Now</span>
                  ) : (
                    <span>Classic Indian Board</span>
                  )}
                </div>
              </div>
            </div>

            {user ? (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setInspectProfileUid(user.uid);
                  setActiveModal('profile');
                }}
                className="flex items-center gap-2.5 pl-2.5 pr-1.5 py-1.5 rounded-2xl bg-black/35 hover:bg-black/50 border border-amber-600/40 transition min-h-[44px]"
              >
                <div className="text-right min-w-0">
                  <div className="text-xs font-bold text-amber-50 max-w-[110px] truncate">
                    {user.name}
                  </div>
                  <div className="text-[11px] font-mono-num text-amber-300 flex items-center justify-end gap-1">
                    <Coins className="w-3 h-3" />
                    <span>{user.coins}</span>
                  </div>
                </div>
                <PlayerAvatar avatarId={user.avatar} name={user.name} size="sm" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setActiveModal('auth');
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 text-[#1A0D07] text-xs font-bold min-h-[40px]"
              >
                Sign In
              </button>
            )}
          </header>

          {/* Authenticated Home Screen vs Unauthenticated Welcome Gate */}
          {!user ? (
            <main className="flex-1 flex flex-col justify-center gap-5 py-6">
              <div className="rounded-3xl bg-[#26130A]/90 border border-amber-500/40 p-6 text-center space-y-4 shadow-2xl">
                <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden border-2 border-amber-400/70 shadow-xl">
                  <img
                    src={APP_ICON_SRC}
                    alt="X Ludo emblem"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-amber-100">
                    Welcome to X Ludo
                  </h2>
                  <p className="text-xs text-amber-100/75 mt-1.5 leading-relaxed">
                    Experience classic four-colour Indian Ludo with smart AI bots, real-time online matchmaking, and private friend rooms.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleContinueAsGuest}
                    className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1A0D07] font-bold text-sm flex items-center justify-center gap-2 transition min-h-[48px]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Continue as Guest</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setActiveModal('auth');
                    }}
                    className="w-full py-3.5 px-4 rounded-xl bg-white text-slate-900 hover:bg-amber-50 font-bold text-sm flex items-center justify-center gap-2 transition min-h-[48px]"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Continue with Google</span>
                  </button>
                </div>
              </div>
            </main>
          ) : (
            <main className="flex-1 flex flex-col justify-center gap-4">
              {/* Compact Player Statistics Strip */}
              <section
                aria-label="Player Statistics"
                className="grid grid-cols-4 gap-2 p-3 rounded-2xl bg-black/35 border border-amber-700/35 text-center"
              >
                <div>
                  <div className="font-mono-num text-base font-bold text-amber-300">
                    {user.totalGames}
                  </div>
                  <div className="text-[11px] text-amber-200/70">Games</div>
                </div>
                <div>
                  <div className="font-mono-num text-base font-bold text-amber-300">
                    {user.wins}
                  </div>
                  <div className="text-[11px] text-amber-200/70">Wins</div>
                </div>
                <div>
                  <div className="font-mono-num text-base font-bold text-amber-300">
                    {winRate}%
                  </div>
                  <div className="text-[11px] text-amber-200/70">Win Rate</div>
                </div>
                <div>
                  <div className="font-mono-num text-base font-bold text-amber-300">
                    #{user.rank || 1}
                  </div>
                  <div className="text-[11px] text-amber-200/70">Rank</div>
                </div>
              </section>

              {/* Primary Mode Cards (Buttons 1-3) */}
              <section className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setActiveModal('online');
                  }}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-[#1A0D07] shadow-lg flex items-center justify-between transition active:scale-[0.99] min-h-[64px]"
                >
                  <div className="flex items-center gap-3.5 text-left">
                    <div className="w-11 h-11 rounded-xl bg-[#1A0D07]/15 flex items-center justify-center shrink-0">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-base leading-tight">Play Online</div>
                      <div className="text-xs font-medium opacity-80 mt-0.5">
                        2P or 4P Server-Authoritative Matchmaking
                      </div>
                    </div>
                  </div>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setActiveModal('computer');
                    }}
                    className="p-3.5 rounded-2xl bg-[#341B0F]/95 hover:bg-[#3F2214] border border-amber-500/40 text-left flex flex-col gap-2 transition active:scale-[0.98] min-h-[96px]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-amber-50">Play with Computer</div>
                      <div className="text-[11px] text-amber-200/70">Easy · Medium · Hard</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setRoomError(null);
                      setActiveModal('private_create');
                    }}
                    className="p-3.5 rounded-2xl bg-[#341B0F]/95 hover:bg-[#3F2214] border border-amber-500/40 text-left flex flex-col gap-2 transition active:scale-[0.98] min-h-[96px]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-amber-50">Play with Friends</div>
                      <div className="text-[11px] text-amber-200/70">2P or 4P Private Match</div>
                    </div>
                  </button>
                </div>

                {/* Room Actions (Buttons 4-5) */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setRoomError(null);
                      setActiveModal('private_join');
                    }}
                    className="px-3.5 py-3 rounded-xl bg-black/35 hover:bg-white/10 border border-amber-700/40 flex items-center justify-center gap-2 text-xs font-bold text-amber-100 transition min-h-[48px]"
                  >
                    <DoorOpen className="w-4 h-4 text-amber-400" />
                    <span>Join Private Room</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setRoomError(null);
                      setActiveModal('private_create');
                    }}
                    className="px-3.5 py-3 rounded-xl bg-black/35 hover:bg-white/10 border border-amber-700/40 flex items-center justify-center gap-2 text-xs font-bold text-amber-100 transition min-h-[48px]"
                  >
                    <PlusCircle className="w-4 h-4 text-amber-400" />
                    <span>Create Private Room</span>
                  </button>
                </div>
              </section>

              {/* Utility Navigation Row (Buttons 6-9) */}
              <nav
                aria-label="Game Menu"
                className="grid grid-cols-4 gap-2 pt-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setActiveModal('how_to_play');
                  }}
                  className="p-2.5 rounded-xl bg-black/30 hover:bg-white/10 border border-amber-900/40 flex flex-col items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-100 transition min-h-[60px]"
                >
                  <HelpCircle className="w-4 h-4 text-amber-300" />
                  <span className="truncate w-full text-center">How to Play</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setActiveModal('leaderboard');
                  }}
                  className="p-2.5 rounded-xl bg-black/30 hover:bg-white/10 border border-amber-900/40 flex flex-col items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-100 transition min-h-[60px]"
                >
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <span className="truncate w-full text-center">Leaderboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setInspectProfileUid(user.uid);
                    setActiveModal('profile');
                  }}
                  className="p-2.5 rounded-xl bg-black/30 hover:bg-white/10 border border-amber-900/40 flex flex-col items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-100 transition min-h-[60px]"
                >
                  <User className="w-4 h-4 text-amber-300" />
                  <span className="truncate w-full text-center">My Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setActiveModal('settings');
                  }}
                  className="p-2.5 rounded-xl bg-black/30 hover:bg-white/10 border border-amber-900/40 flex flex-col items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-100 transition min-h-[60px]"
                >
                  <Settings className="w-4 h-4 text-amber-300" />
                  <span className="truncate w-full text-center">Settings</span>
                </button>
              </nav>
            </main>
          )}

          {/* Quiet Footer Note */}
          <footer className="text-center text-[11px] text-amber-200/55">
            Demo Coins are non-purchasable play points · Classic Indian Ludo
          </footer>
        </div>
      </div>

      {/* Modals */}
      {activeModal === 'computer' && (
        <ComputerSetupModal
          onClose={() => setActiveModal(null)}
          onStart={startLocalAIMatch}
        />
      )}

      {activeModal === 'online' && (
        <OnlineMatchmakingModal
          wsConnected={wsConnected}
          queueStatus={queueStatus}
          onJoinQueue={(count) => {
            soundEngine.playClick();
            wsClient.send('queue:join', { playerCount: count });
          }}
          onLeaveQueue={() => {
            soundEngine.playClick();
            wsClient.send('queue:leave');
            setQueueStatus(null);
          }}
          onClose={() => {
            if (queueStatus) {
              wsClient.send('queue:leave');
              setQueueStatus(null);
            }
            setActiveModal(null);
          }}
        />
      )}

      {(activeModal === 'private_create' || activeModal === 'private_join') && user && (
        <PrivateRoomModal
          initialTab={activeModal === 'private_join' ? 'join' : 'create'}
          wsConnected={wsConnected}
          room={activeRoom}
          roomError={roomError}
          localUid={user.uid}
          onCreateRoom={(maxPlayers) => {
            soundEngine.playClick();
            setRoomError(null);
            wsClient.send('room:create', { maxPlayers });
          }}
          onJoinRoom={(roomCode) => {
            soundEngine.playClick();
            setRoomError(null);
            wsClient.send('room:join', { roomCode });
          }}
          onToggleReady={(roomCode, ready) => {
            soundEngine.playClick();
            wsClient.send('room:ready', { roomCode, ready });
          }}
          onStartRoom={(roomCode) => {
            soundEngine.playClick();
            wsClient.send('room:start', { roomCode });
          }}
          onLeaveRoom={(roomCode) => {
            soundEngine.playClick();
            wsClient.send('room:leave', { roomCode });
            setActiveRoom(null);
          }}
          onClose={() => {
            if (activeRoom) {
              wsClient.send('room:leave', { roomCode: activeRoom.roomCode });
              setActiveRoom(null);
            }
            setActiveModal(null);
          }}
        />
      )}

      {activeModal === 'how_to_play' && (
        <HowToPlayModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'leaderboard' && (
        <LeaderboardModal
          onSelectPlayer={(uid) => {
            soundEngine.playClick();
            setInspectProfileUid(uid);
            setActiveModal('profile');
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'profile' && user && (
        <ProfileModal
          targetUid={inspectProfileUid || user.uid}
          isSelf={(inspectProfileUid || user.uid) === user.uid}
          localProfile={user}
          localMatchHistory={localHistory}
          onUpdateProfile={handleUpdateProfile}
          onOpenAuth={() => setActiveModal('auth')}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          muted={muted}
          musicEnabled={musicEnabled}
          rules={rules}
          firebaseConfigured={firebaseConfigured}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
          onOpenAuth={() => setActiveModal('auth')}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'auth' && (
        <AuthModal
          user={user}
          firebaseConfigured={firebaseConfigured}
          onContinueGuest={handleContinueAsGuest}
          onLogout={handleLogout}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
