export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export type MatchMode = 'ai' | 'online' | 'private';

export type TurnPhase = 'ROLL' | 'MOVE' | 'FINISHED';

export interface LudoRulesConfig {
  requireSixToExit: boolean;
  bonusTurnOnSix: boolean;
  bonusTurnOnCapture: boolean;
  bonusTurnOnHome: boolean;
  threeSixesRule: 'forfeit' | 'none';
  exactRollToHome: boolean;
  safeSquaresEnabled: boolean;
  turnTimeoutSeconds: number;
}

export interface TokenState {
  id: number; // 0..3
  color: PlayerColor;
  /**
   * -1 = in yard
   * 0..50 = steps along outer 52-cell track from player's startOffset
   * 51..55 = home stretch (5 colored squares)
   * 56 = reached center home
   */
  progress: number;
}

export interface MatchPlayer {
  uid: string;
  playerId: string;
  name: string;
  avatar: string;
  color: PlayerColor;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
  connected: boolean;
  disconnectedAt?: number | null;
  forfeited?: boolean;
  ready?: boolean;
}

export interface MoveRecord {
  seq: number;
  color: PlayerColor;
  playerName: string;
  dice: number;
  tokenId: number | null; // null if no legal move or 3-sixes forfeit
  fromProgress: number;
  toProgress: number;
  captured: { color: PlayerColor; tokenId: number }[];
  reachedHome: boolean;
  reason?: string;
  timestamp: number;
}

export interface LudoMatchState {
  matchId: string;
  mode: MatchMode;
  roomCode?: string;
  playerCount: 2 | 4;
  players: MatchPlayer[];
  tokens: Record<PlayerColor, TokenState[]>;
  activeColors: PlayerColor[];
  currentTurnIndex: number;
  phase: TurnPhase;
  diceValue: number | null;
  consecutiveSixes: number;
  winnerColor: PlayerColor | null;
  rankings: PlayerColor[]; // first to finish -> last
  turnDeadline: number | null;
  actionSeq: number;
  lastEvent: string;
  moveLog: MoveRecord[];
  rules: LudoRulesConfig;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  playerId: string;
  name: string;
  avatar: string;
  authProvider: 'guest' | 'google';
  email?: string | null;
  coins: number; // Non-purchasable demo points
  totalGames: number;
  wins: number;
  losses: number;
  rank: number;
  createdAt: number;
}

export interface MatchHistoryEntry {
  matchId: string;
  mode: MatchMode;
  playerCount: 2 | 4;
  winnerUid: string;
  winnerName: string;
  winnerColor: PlayerColor;
  participants: {
    uid: string;
    name: string;
    color: PlayerColor;
    isAI: boolean;
    placement: number;
  }[];
  durationSeconds: number;
  completedAt: number;
  verified: boolean;
}

export interface LeaderboardEntry {
  uid: string;
  playerId: string;
  name: string;
  avatar: string;
  wins: number;
  totalGames: number;
  winRate: number;
  coins: number;
  rank: number;
}

export interface RoomInfo {
  roomCode: string;
  hostUid: string;
  maxPlayers: 2 | 4;
  status: 'waiting' | 'in_match' | 'closed';
  matchId?: string;
  players: {
    uid: string;
    playerId: string;
    name: string;
    avatar: string;
    color: PlayerColor;
    ready: boolean;
    connected: boolean;
  }[];
  rules: LudoRulesConfig;
  createdAt: number;
}
