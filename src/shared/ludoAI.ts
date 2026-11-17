import {
  getLegalMoves,
  getTrackIndex,
  SAFE_TRACK_INDICES,
} from './ludoEngine';
import type { AIDifficulty, LudoMatchState, PlayerColor } from './types';

function isDangerSpot(
  state: LudoMatchState,
  myColor: PlayerColor,
  progress: number
): boolean {
  if (progress < 0 || progress > 50) return false;
  const myTrackIdx = getTrackIndex(myColor, progress)!;
  if (state.rules.safeSquaresEnabled && SAFE_TRACK_INDICES.has(myTrackIdx)) {
    return false;
  }

  for (const oppColor of state.activeColors) {
    if (oppColor === myColor) continue;
    for (const oppToken of state.tokens[oppColor]) {
      if (oppToken.progress >= 0 && oppToken.progress <= 50) {
        const oppTrackIdx = getTrackIndex(oppColor, oppToken.progress)!;
        const dist = (myTrackIdx - oppTrackIdx + 52) % 52;
        if (dist >= 1 && dist <= 6) {
          return true;
        }
      }
    }
  }
  return false;
}

function findCapturesAtProgress(
  state: LudoMatchState,
  myColor: PlayerColor,
  progress: number
): { count: number; maxOppProgress: number } {
  if (progress < 0 || progress > 50) return { count: 0, maxOppProgress: 0 };
  const destIdx = getTrackIndex(myColor, progress)!;
  if (state.rules.safeSquaresEnabled && SAFE_TRACK_INDICES.has(destIdx)) {
    return { count: 0, maxOppProgress: 0 };
  }

  let count = 0;
  let maxOppProgress = 0;
  for (const oppColor of state.activeColors) {
    if (oppColor === myColor) continue;
    for (const oppToken of state.tokens[oppColor]) {
      if (oppToken.progress >= 0 && oppToken.progress <= 50) {
        if (getTrackIndex(oppColor, oppToken.progress) === destIdx) {
          count++;
          if (oppToken.progress > maxOppProgress) {
            maxOppProgress = oppToken.progress;
          }
        }
      }
    }
  }
  return { count, maxOppProgress };
}

export function chooseAIMove(
  state: LudoMatchState,
  color: PlayerColor,
  difficulty: AIDifficulty
): number {
  const dice = state.diceValue ?? 1;
  const legal = getLegalMoves(state, color, dice);
  if (legal.length === 0) {
    throw new Error('No legal moves for AI');
  }
  if (legal.length === 1) return legal[0];

  if (difficulty === 'easy') {
    // Easy: mostly random, mild tendency to exit yard
    const yardMoves = legal.filter((id) => state.tokens[color][id].progress === -1);
    if (yardMoves.length > 0 && Math.random() < 0.65) {
      return yardMoves[0];
    }
    return legal[Math.floor(Math.random() * legal.length)];
  }

  let bestId = legal[0];
  let bestScore = -Infinity;

  for (const tokenId of legal) {
    const token = state.tokens[color][tokenId];
    const fromProgress = token.progress;
    const toProgress = fromProgress === -1 ? 0 : Math.min(56, fromProgress + dice);
    let score = 0;

    // 1. Exiting yard
    if (fromProgress === -1) {
      score += difficulty === 'hard' ? 70 : 50;
    }

    // 2. Reaching exact Home
    if (toProgress === 56) {
      score += difficulty === 'hard' ? 130 : 95;
    }

    // 3. Entering safe home stretch (51..55)
    if (fromProgress <= 50 && toProgress >= 51 && toProgress <= 55) {
      score += difficulty === 'hard' ? 85 : 55;
    }

    // 4. Capturing opponent token
    const cap = findCapturesAtProgress(state, color, toProgress);
    if (cap.count > 0) {
      score += 140 * cap.count + (difficulty === 'hard' ? cap.maxOppProgress * 1.4 : 0);
    }

    // 5. Safe square landing
    if (toProgress >= 0 && toProgress <= 50) {
      const destIdx = getTrackIndex(color, toProgress)!;
      if (state.rules.safeSquaresEnabled && SAFE_TRACK_INDICES.has(destIdx)) {
        score += difficulty === 'hard' ? 50 : 30;
      }
    }

    if (difficulty === 'hard') {
      // 6. Escaping immediate capture threat
      if (isDangerSpot(state, color, fromProgress)) {
        score += 55 + fromProgress * 0.6;
      }

      // 7. Avoiding landing in opponent strike range
      if (isDangerSpot(state, color, toProgress)) {
        score -= 50 + toProgress * 0.7;
      }

      // 8. Slight preference to advance leading tokens safely
      score += toProgress * 0.45;
    } else {
      // Medium: gentle progress bias + tiny noise
      score += toProgress * 0.25 + Math.random() * 8;
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = tokenId;
    }
  }

  return bestId;
}
