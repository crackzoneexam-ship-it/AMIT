import type {
  LudoMatchState,
  LudoRulesConfig,
  MatchMode,
  MatchPlayer,
  MoveRecord,
  PlayerColor,
  TokenState,
} from './types';

export const DEFAULT_LUDO_RULES: LudoRulesConfig = {
  requireSixToExit: true,
  bonusTurnOnSix: true,
  bonusTurnOnCapture: true,
  bonusTurnOnHome: true,
  threeSixesRule: 'forfeit',
  exactRollToHome: true,
  safeSquaresEnabled: true,
  turnTimeoutSeconds: 25,
};

export const ALL_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

/**
 * 52 outer track cells on the 15x15 grid [row, col], clockwise.
 * Starts at [6,1] (Green's start) -> walks clockwise around all 4 arms.
 */
export const OUTER_TRACK_COORDS: readonly [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], // 0..4 (Green arm right)
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], // 5..10 (Top arm up)
  [0, 7], [0, 8], // 11..12 (Top turn)
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], // 13..17 (Top arm down)
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], // 18..23 (Right arm right)
  [7, 14], [8, 14], // 24..25 (Right turn)
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], // 26..30 (Right arm left)
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], // 31..36 (Bottom arm down)
  [14, 7], [14, 6], // 37..38 (Bottom turn)
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], // 39..43 (Bottom arm up)
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], // 44..49 (Left arm left)
  [7, 0], [6, 0], // 50..51 (Left turn)
];

/**
 * Start indices for each corner color (clockwise: Red BL -> Green TL -> Yellow TR -> Blue BR)
 */
export const START_TRACK_INDEX: Record<PlayerColor, number> = {
  red: 39,
  green: 0,
  yellow: 13,
  blue: 26,
};

/**
 * Standard Indian Ludo 8 safe track cells (4 start squares + 4 star squares)
 */
export const SAFE_TRACK_INDICES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);

export const HOME_STRETCH_COORDS: Record<PlayerColor, readonly [number, number][]> = {
  red: [
    [13, 7], [12, 7], [11, 7], [10, 7], [9, 7],
  ],
  green: [
    [7, 1], [7, 2], [7, 3], [7, 4], [7, 5],
  ],
  yellow: [
    [1, 7], [2, 7], [3, 7], [4, 7], [5, 7],
  ],
  blue: [
    [7, 13], [7, 12], [7, 11], [7, 10], [7, 9],
  ],
};

export const YARD_SLOT_COORDS: Record<PlayerColor, readonly [number, number][]> = {
  red: [
    [10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5],
  ],
  green: [
    [1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5],
  ],
  yellow: [
    [1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5],
  ],
  blue: [
    [10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5],
  ],
};

export const CENTER_HOME_COORDS: Record<PlayerColor, [number, number]> = {
  red: [7.95, 7],
  green: [7, 6.05],
  yellow: [6.05, 7],
  blue: [7, 7.95],
};

export const COLOR_PALETTE: Record<
  PlayerColor,
  { label: string; hex: string; darkHex: string; lightHex: string; textClass: string; bgClass: string }
> = {
  red: {
    label: 'Red',
    hex: '#D92B2B',
    darkHex: '#991B1B',
    lightHex: '#FEE2E2',
    textClass: 'text-red-400',
    bgClass: 'bg-red-600',
  },
  green: {
    label: 'Green',
    hex: '#15803D',
    darkHex: '#14532D',
    lightHex: '#DCFCE7',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-700',
  },
  yellow: {
    label: 'Yellow',
    hex: '#D97706',
    darkHex: '#92400E',
    lightHex: '#FEF3C7',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-500',
  },
  blue: {
    label: 'Blue',
    hex: '#1D4ED8',
    darkHex: '#1E3A8A',
    lightHex: '#DBEAFE',
    textClass: 'text-blue-400',
    bgClass: 'bg-blue-600',
  },
};

export function getColorsForPlayerCount(count: 2 | 4): PlayerColor[] {
  return count === 2 ? ['red', 'yellow'] : ['red', 'green', 'yellow', 'blue'];
}

export function getTrackIndex(color: PlayerColor, progress: number): number | null {
  if (progress < 0 || progress > 50) return null;
  return (START_TRACK_INDEX[color] + progress) % 52;
}

export function getTokenBoardCoord(token: TokenState): [number, number] {
  if (token.progress === -1) {
    return YARD_SLOT_COORDS[token.color][token.id];
  }
  if (token.progress >= 0 && token.progress <= 50) {
    const idx = getTrackIndex(token.color, token.progress)!;
    return OUTER_TRACK_COORDS[idx];
  }
  if (token.progress >= 51 && token.progress <= 55) {
    return HOME_STRETCH_COORDS[token.color][token.progress - 51];
  }
  return CENTER_HOME_COORDS[token.color];
}

export function createInitialTokens(activeColors: PlayerColor[]): Record<PlayerColor, TokenState[]> {
  const tokens: Record<PlayerColor, TokenState[]> = {
    red: [],
    green: [],
    yellow: [],
    blue: [],
  };

  for (const color of ALL_COLORS) {
    const isActive = activeColors.includes(color);
    tokens[color] = [0, 1, 2, 3].map((id) => ({
      id,
      color,
      progress: isActive ? -1 : -1,
    }));
  }

  return tokens;
}

export function createInitialMatchState(params: {
  matchId: string;
  mode: MatchMode;
  players: MatchPlayer[];
  roomCode?: string;
  rules?: Partial<LudoRulesConfig>;
}): LudoMatchState {
  const rules: LudoRulesConfig = { ...DEFAULT_LUDO_RULES, ...(params.rules || {}) };
  const playerCount: 2 | 4 = params.players.length <= 2 ? 2 : 4;
  const activeColors = params.players.map((p) => p.color);
  const now = Date.now();

  return {
    matchId: params.matchId,
    mode: params.mode,
    roomCode: params.roomCode,
    playerCount,
    players: params.players,
    tokens: createInitialTokens(activeColors),
    activeColors,
    currentTurnIndex: 0,
    phase: 'ROLL',
    diceValue: null,
    consecutiveSixes: 0,
    winnerColor: null,
    rankings: [],
    turnDeadline: now + rules.turnTimeoutSeconds * 1000,
    actionSeq: 0,
    lastEvent: `${params.players[0].name}'s turn to roll`,
    moveLog: [],
    rules,
    createdAt: now,
    updatedAt: now,
  };
}

export function getCurrentPlayer(state: LudoMatchState): MatchPlayer {
  const color = state.activeColors[state.currentTurnIndex];
  return state.players.find((p) => p.color === color) || state.players[0];
}

export function getLegalMoves(state: LudoMatchState, color: PlayerColor, dice: number): number[] {
  if (state.phase === 'FINISHED' || dice < 1 || dice > 6) return [];
  const playerTokens = state.tokens[color];
  const legalIds: number[] = [];

  for (const token of playerTokens) {
    if (token.progress === 56) continue; // already home

    if (token.progress === -1) {
      if (!state.rules.requireSixToExit || dice === 6) {
        legalIds.push(token.id);
      }
      continue;
    }

    const nextProgress = token.progress + dice;
    if (nextProgress <= 56) {
      legalIds.push(token.id);
    } else if (!state.rules.exactRollToHome && token.progress < 56) {
      legalIds.push(token.id);
    }
  }

  return legalIds;
}

export function advanceTurnIndex(state: LudoMatchState): number {
  const total = state.activeColors.length;
  for (let offset = 1; offset <= total; offset++) {
    const idx = (state.currentTurnIndex + offset) % total;
    const color = state.activeColors[idx];
    const player = state.players.find((p) => p.color === color);
    const hasFinished = state.rankings.includes(color);
    if (player && !player.forfeited && !hasFinished) {
      return idx;
    }
  }
  return state.currentTurnIndex;
}

export function applyDiceRoll(
  state: LudoMatchState,
  actorColor: PlayerColor,
  rolledValue: number,
  now = Date.now()
): { state: LudoMatchState; autoPassed: boolean; forfeitedThreeSixes: boolean } {
  if (state.phase !== 'ROLL') {
    throw new Error('Cannot roll dice outside ROLL phase');
  }
  const currentColor = state.activeColors[state.currentTurnIndex];
  if (currentColor !== actorColor) {
    throw new Error('Not this player turn');
  }
  if (rolledValue < 1 || rolledValue > 6) {
    throw new Error('Invalid dice value');
  }

  const nextSixCount = rolledValue === 6 ? state.consecutiveSixes + 1 : 0;
  const player = getCurrentPlayer(state);

  // Check 3 consecutive sixes rule
  if (state.rules.threeSixesRule === 'forfeit' && nextSixCount >= 3) {
    const nextIdx = advanceTurnIndex(state);
    const nextPlayer = state.players.find((p) => p.color === state.activeColors[nextIdx])!;
    const logEntry: MoveRecord = {
      seq: state.actionSeq + 1,
      color: actorColor,
      playerName: player.name,
      dice: rolledValue,
      tokenId: null,
      fromProgress: -1,
      toProgress: -1,
      captured: [],
      reachedHome: false,
      reason: 'Three consecutive 6s — turn forfeited',
      timestamp: now,
    };
    return {
      autoPassed: true,
      forfeitedThreeSixes: true,
      state: {
        ...state,
        diceValue: rolledValue,
        consecutiveSixes: 0,
        currentTurnIndex: nextIdx,
        phase: 'ROLL',
        turnDeadline: now + state.rules.turnTimeoutSeconds * 1000,
        actionSeq: state.actionSeq + 1,
        lastEvent: `${player.name} rolled three 6s in a row! Turn passed to ${nextPlayer.name}.`,
        moveLog: [logEntry, ...state.moveLog].slice(0, 40),
        updatedAt: now,
      },
    };
  }

  const legalMoves = getLegalMoves(state, actorColor, rolledValue);
  if (legalMoves.length === 0) {
    const nextIdx = advanceTurnIndex(state);
    const nextPlayer = state.players.find((p) => p.color === state.activeColors[nextIdx])!;
    const logEntry: MoveRecord = {
      seq: state.actionSeq + 1,
      color: actorColor,
      playerName: player.name,
      dice: rolledValue,
      tokenId: null,
      fromProgress: -1,
      toProgress: -1,
      captured: [],
      reachedHome: false,
      reason: 'No legal moves available',
      timestamp: now,
    };
    return {
      autoPassed: true,
      forfeitedThreeSixes: false,
      state: {
        ...state,
        diceValue: rolledValue,
        consecutiveSixes: 0,
        currentTurnIndex: nextIdx,
        phase: 'ROLL',
        turnDeadline: now + state.rules.turnTimeoutSeconds * 1000,
        actionSeq: state.actionSeq + 1,
        lastEvent: `${player.name} rolled ${rolledValue} — no legal move. ${nextPlayer.name}'s turn.`,
        moveLog: [logEntry, ...state.moveLog].slice(0, 40),
        updatedAt: now,
      },
    };
  }

  return {
    autoPassed: false,
    forfeitedThreeSixes: false,
    state: {
      ...state,
      diceValue: rolledValue,
      consecutiveSixes: nextSixCount,
      phase: 'MOVE',
      turnDeadline: now + state.rules.turnTimeoutSeconds * 1000,
      actionSeq: state.actionSeq + 1,
      lastEvent: `${player.name} rolled ${rolledValue}! Select a highlighted token.`,
      updatedAt: now,
    },
  };
}

export function applyTokenMove(
  state: LudoMatchState,
  actorColor: PlayerColor,
  tokenId: number,
  now = Date.now()
): {
  state: LudoMatchState;
  captured: { color: PlayerColor; tokenId: number }[];
  reachedHome: boolean;
  bonusTurn: boolean;
  matchFinished: boolean;
} {
  if (state.phase !== 'MOVE' || state.diceValue === null) {
    throw new Error('Cannot move token outside MOVE phase');
  }
  const currentColor = state.activeColors[state.currentTurnIndex];
  if (currentColor !== actorColor) {
    throw new Error('Not this player turn');
  }

  const dice = state.diceValue;
  const legalMoves = getLegalMoves(state, actorColor, dice);
  if (!legalMoves.includes(tokenId)) {
    throw new Error('Illegal token move');
  }

  const player = getCurrentPlayer(state);
  const nextTokens: Record<PlayerColor, TokenState[]> = {
    red: state.tokens.red.map((t) => ({ ...t })),
    green: state.tokens.green.map((t) => ({ ...t })),
    yellow: state.tokens.yellow.map((t) => ({ ...t })),
    blue: state.tokens.blue.map((t) => ({ ...t })),
  };

  const movingToken = nextTokens[actorColor][tokenId];
  const fromProgress = movingToken.progress;
  let toProgress = fromProgress === -1 ? 0 : fromProgress + dice;
  if (toProgress > 56) toProgress = 56;
  movingToken.progress = toProgress;

  const reachedHome = toProgress === 56;
  const captured: { color: PlayerColor; tokenId: number }[] = [];

  // Check captures on outer track (0..50) if destination is not a safe square
  if (toProgress >= 0 && toProgress <= 50) {
    const destTrackIdx = getTrackIndex(actorColor, toProgress)!;
    const isSafe = state.rules.safeSquaresEnabled && SAFE_TRACK_INDICES.has(destTrackIdx);

    if (!isSafe) {
      for (const oppColor of state.activeColors) {
        if (oppColor === actorColor) continue;
        for (const oppToken of nextTokens[oppColor]) {
          if (oppToken.progress >= 0 && oppToken.progress <= 50) {
            const oppTrackIdx = getTrackIndex(oppColor, oppToken.progress);
            if (oppTrackIdx === destTrackIdx) {
              oppToken.progress = -1;
              captured.push({ color: oppColor, tokenId: oppToken.id });
            }
          }
        }
      }
    }
  }

  // Check if all 4 tokens of actorColor reached home (progress === 56)
  const allHome = nextTokens[actorColor].every((t) => t.progress === 56);
  const nextRankings = [...state.rankings];
  if (allHome && !nextRankings.includes(actorColor)) {
    nextRankings.push(actorColor);
  }

  // Standard Ludo: first player to get all 4 tokens home wins immediately
  const matchFinished = allHome;
  const winnerColor = matchFinished ? nextRankings[0] : state.winnerColor;

  if (matchFinished) {
    // Append remaining non-forfeited players to rankings by progress
    const remaining = state.activeColors
      .filter((c) => !nextRankings.includes(c))
      .sort((a, b) => {
        const sumA = nextTokens[a].reduce((acc, t) => acc + Math.max(0, t.progress + 1), 0);
        const sumB = nextTokens[b].reduce((acc, t) => acc + Math.max(0, t.progress + 1), 0);
        return sumB - sumA;
      });
    nextRankings.push(...remaining);
  }

  const bonusTurn =
    !matchFinished &&
    ((dice === 6 && state.rules.bonusTurnOnSix) ||
      (captured.length > 0 && state.rules.bonusTurnOnCapture) ||
      (reachedHome && state.rules.bonusTurnOnHome));

  let nextTurnIndex = state.currentTurnIndex;
  let nextConsecutiveSixes = state.consecutiveSixes;
  if (!bonusTurn && !matchFinished) {
    nextTurnIndex = advanceTurnIndex(state);
    nextConsecutiveSixes = 0;
  } else if (bonusTurn && dice !== 6) {
    nextConsecutiveSixes = 0;
  }

  const nextPlayer = state.players.find((p) => p.color === state.activeColors[nextTurnIndex])!;

  let eventSummary = `${player.name} moved token ${tokenId + 1}`;
  if (fromProgress === -1) eventSummary = `${player.name} deployed a token onto the board!`;
  if (captured.length > 0) eventSummary = `${player.name} captured ${captured.length} opponent token${captured.length > 1 ? 's' : ''}! Bonus turn!`;
  else if (reachedHome) eventSummary = `${player.name} reached Home! Bonus turn!`;
  else if (dice === 6 && bonusTurn) eventSummary = `${player.name} rolled a 6 and gets another turn!`;
  else if (!matchFinished) eventSummary = `${nextPlayer.name}'s turn to roll`;

  if (matchFinished) {
    eventSummary = `${player.name} wins the match!`;
  }

  const logEntry: MoveRecord = {
    seq: state.actionSeq + 1,
    color: actorColor,
    playerName: player.name,
    dice,
    tokenId,
    fromProgress,
    toProgress,
    captured,
    reachedHome,
    timestamp: now,
  };

  return {
    captured,
    reachedHome,
    bonusTurn,
    matchFinished,
    state: {
      ...state,
      tokens: nextTokens,
      currentTurnIndex: nextTurnIndex,
      phase: matchFinished ? 'FINISHED' : 'ROLL',
      diceValue: matchFinished ? dice : null,
      consecutiveSixes: nextConsecutiveSixes,
      winnerColor,
      rankings: nextRankings,
      turnDeadline: matchFinished ? null : now + state.rules.turnTimeoutSeconds * 1000,
      actionSeq: state.actionSeq + 1,
      lastEvent: eventSummary,
      moveLog: [logEntry, ...state.moveLog].slice(0, 40),
      updatedAt: now,
    },
  };
}

export function forfeitPlayerInState(
  state: LudoMatchState,
  forfeitUid: string,
  reason = 'Player left match',
  now = Date.now()
): LudoMatchState {
  const updatedPlayers = state.players.map((p) =>
    p.uid === forfeitUid ? { ...p, forfeited: true, connected: false } : p
  );
  const remainingPlayers = updatedPlayers.filter((p) => !p.forfeited);

  if (remainingPlayers.length <= 1) {
    const winner = remainingPlayers[0] || updatedPlayers[0];
    const rankings = [
      winner.color,
      ...updatedPlayers.filter((p) => p.color !== winner.color).map((p) => p.color),
    ];
    return {
      ...state,
      players: updatedPlayers,
      phase: 'FINISHED',
      winnerColor: winner.color,
      rankings,
      turnDeadline: null,
      actionSeq: state.actionSeq + 1,
      lastEvent: `${winner.name} wins! (${reason})`,
      updatedAt: now,
    };
  }

  const nextState: LudoMatchState = {
    ...state,
    players: updatedPlayers,
    actionSeq: state.actionSeq + 1,
    updatedAt: now,
  };

  const currentColor = nextState.activeColors[nextState.currentTurnIndex];
  const currentPlayer = updatedPlayers.find((p) => p.color === currentColor);
  if (currentPlayer?.forfeited) {
    const nextIdx = advanceTurnIndex(nextState);
    const nextPlayer = updatedPlayers.find((p) => p.color === nextState.activeColors[nextIdx])!;
    nextState.currentTurnIndex = nextIdx;
    nextState.phase = 'ROLL';
    nextState.diceValue = null;
    nextState.consecutiveSixes = 0;
    nextState.turnDeadline = now + nextState.rules.turnTimeoutSeconds * 1000;
    nextState.lastEvent = `${currentPlayer.name} forfeited. ${nextPlayer.name}'s turn.`;
  }

  return nextState;
}
