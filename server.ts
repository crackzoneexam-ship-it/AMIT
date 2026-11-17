import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
  applyDiceRoll,
  applyTokenMove,
  createInitialMatchState,
  DEFAULT_LUDO_RULES,
  forfeitPlayerInState,
  getColorsForPlayerCount,
  getCurrentPlayer,
  getLegalMoves,
} from './src/shared/ludoEngine';
import type {
  LeaderboardEntry,
  LudoMatchState,
  LudoRulesConfig,
  MatchHistoryEntry,
  MatchPlayer,
  RoomInfo,
  UserProfile,
} from './src/shared/types';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'xludo-store.json');

interface StoredUser extends UserProfile {
  sessionToken: string;
}

interface PersistedStore {
  users: Record<string, StoredUser>;
  matchHistory: MatchHistoryEntry[];
  gameSettings: LudoRulesConfig;
}

const DEFAULT_AVATARS = ['royal', 'queen', 'warrior', 'sage'];

function ensureStore(): PersistedStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedStore>;
      return {
        users: parsed.users || {},
        matchHistory: parsed.matchHistory || [],
        gameSettings: { ...DEFAULT_LUDO_RULES, ...(parsed.gameSettings || {}) },
      };
    } catch {
      // Fall back to fresh store if corrupted
    }
  }
  const initial: PersistedStore = {
    users: {},
    matchHistory: [],
    gameSettings: { ...DEFAULT_LUDO_RULES },
  };
  fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2));
  return initial;
}

const store: PersistedStore = ensureStore();

function saveStore() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

function generatePlayerId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[crypto.randomInt(0, chars.length)];
  }
  return `XLD-${suffix}`;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

function sanitizeProfile(u: StoredUser): UserProfile {
  const { sessionToken: _removed, ...pub } = u;
  return pub;
}

function recalculateRanks() {
  const sorted = Object.values(store.users).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.coins - a.coins;
  });
  sorted.forEach((user, idx) => {
    user.rank = idx + 1;
  });
}

function findUserByToken(token: string | undefined | null): StoredUser | null {
  if (!token) return null;
  for (const user of Object.values(store.users)) {
    if (user.sessionToken === token) return user;
  }
  return null;
}

// Active runtime multiplayer state (server-authoritative)
const socketsByUid = new Map<string, Set<WebSocket>>();
const uidBySocket = new Map<WebSocket, string>();
const queues: Record<2 | 4, string[]> = { 2: [], 4: [] };
const rooms = new Map<string, RoomInfo>();
const activeMatches = new Map<string, LudoMatchState>();
const matchByUid = new Map<string, string>();

function sendWs(ws: WebSocket, type: string, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function sendToUid(uid: string, type: string, payload: unknown) {
  const set = socketsByUid.get(uid);
  if (!set) return;
  for (const ws of set) {
    sendWs(ws, type, payload);
  }
}

function broadcastOnlineCount() {
  const count = socketsByUid.size;
  for (const set of socketsByUid.values()) {
    for (const ws of set) {
      sendWs(ws, 'presence:count', { onlineCount: count });
    }
  }
}

function broadcastMatchState(state: LudoMatchState) {
  for (const player of state.players) {
    if (!player.isAI) {
      sendToUid(player.uid, 'match:state', state);
    }
  }
}

function broadcastRoomState(room: RoomInfo) {
  for (const p of room.players) {
    sendToUid(p.uid, 'room:state', room);
  }
}

function broadcastQueueStatus(size: 2 | 4) {
  const list = queues[size];
  list.forEach((uid, index) => {
    sendToUid(uid, 'queue:status', {
      playerCount: size,
      waitingCount: list.length,
      neededCount: size,
      position: index + 1,
    });
  });
}

function removeFromQueues(uid: string) {
  for (const size of [2, 4] as const) {
    const before = queues[size].length;
    queues[size] = queues[size].filter((id) => id !== uid);
    if (queues[size].length !== before) {
      broadcastQueueStatus(size);
    }
  }
}

function recordVerifiedMatchCompletion(state: LudoMatchState) {
  if (!state.winnerColor || state.phase !== 'FINISHED') return;
  if (store.matchHistory.some((m) => m.matchId === state.matchId)) return;

  const winnerPlayer = state.players.find((p) => p.color === state.winnerColor);
  if (!winnerPlayer) return;

  const durationSeconds = Math.max(1, Math.round((Date.now() - state.createdAt) / 1000));
  const participants = state.players.map((p) => {
    const placement = Math.max(1, state.rankings.indexOf(p.color) + 1);
    return {
      uid: p.uid,
      name: p.name,
      color: p.color,
      isAI: p.isAI,
      placement,
    };
  });

  const entry: MatchHistoryEntry = {
    matchId: state.matchId,
    mode: state.mode,
    playerCount: state.playerCount,
    winnerUid: winnerPlayer.uid,
    winnerName: winnerPlayer.name,
    winnerColor: winnerPlayer.color,
    participants,
    durationSeconds,
    completedAt: Date.now(),
    verified: true,
  };

  store.matchHistory.unshift(entry);
  if (store.matchHistory.length > 500) {
    store.matchHistory = store.matchHistory.slice(0, 500);
  }

  for (const p of state.players) {
    const user = store.users[p.uid];
    if (!user) continue;
    user.totalGames += 1;
    if (p.uid === winnerPlayer.uid) {
      user.wins += 1;
      user.coins += 100;
    } else {
      user.losses += 1;
      user.coins += 25;
    }
  }

  recalculateRanks();
  saveStore();

  // Notify participants of updated profiles
  for (const p of state.players) {
    const user = store.users[p.uid];
    if (user) {
      sendToUid(p.uid, 'profile:updated', sanitizeProfile(user));
    }
    matchByUid.delete(p.uid);
  }

  if (state.roomCode) {
    const room = rooms.get(state.roomCode);
    if (room) {
      room.status = 'closed';
      broadcastRoomState(room);
      rooms.delete(state.roomCode);
    }
  }
}

function startMatchFromUsers(
  uids: string[],
  mode: 'online' | 'private',
  roomCode?: string,
  customRules?: LudoRulesConfig
) {
  const playerCount: 2 | 4 = uids.length <= 2 ? 2 : 4;
  const colors = getColorsForPlayerCount(playerCount);
  const players: MatchPlayer[] = uids.map((uid, idx) => {
    const user = store.users[uid];
    return {
      uid,
      playerId: user?.playerId || 'XLD-PLAYER',
      name: user?.name || `Player ${idx + 1}`,
      avatar: user?.avatar || 'royal',
      color: colors[idx],
      isAI: false,
      connected: (socketsByUid.get(uid)?.size || 0) > 0,
      disconnectedAt: null,
      forfeited: false,
      ready: true,
    };
  });

  const matchId = `m_${crypto.randomUUID()}`;
  const state = createInitialMatchState({
    matchId,
    mode,
    players,
    roomCode,
    rules: customRules || store.gameSettings,
  });

  activeMatches.set(matchId, state);
  for (const p of players) {
    matchByUid.set(p.uid, matchId);
  }

  broadcastMatchState(state);
  return state;
}

// Server authoritative turn timeout & disconnect watchdog (1s tick)
setInterval(() => {
  const now = Date.now();
  for (const [matchId, state] of activeMatches.entries()) {
    if (state.phase === 'FINISHED') {
      if (now - state.updatedAt > 120_000) {
        activeMatches.delete(matchId);
      }
      continue;
    }

    // Check if ALL human players have been disconnected for > 60s -> abandon cleanly
    const allDisconnectedLong = state.players.every(
      (p) => !p.connected && p.disconnectedAt && now - p.disconnectedAt > 60_000
    );
    if (allDisconnectedLong) {
      for (const p of state.players) {
        matchByUid.delete(p.uid);
      }
      if (state.roomCode) rooms.delete(state.roomCode);
      activeMatches.delete(matchId);
      continue;
    }

    // Check if any disconnected player exceeded 45s reconnect window -> forfeit them
    let updatedState = state;
    for (const p of updatedState.players) {
      if (!p.forfeited && !p.connected && p.disconnectedAt && now - p.disconnectedAt > 45_000) {
        updatedState = forfeitPlayerInState(updatedState, p.uid, `${p.name} disconnected`, now);
        matchByUid.delete(p.uid);
      }
    }

    if (updatedState !== state) {
      activeMatches.set(matchId, updatedState);
      broadcastMatchState(updatedState);
      if (updatedState.phase === 'FINISHED') {
        recordVerifiedMatchCompletion(updatedState);
        continue;
      }
    }

    // Turn timeout auto-advance to prevent stalling
    if (updatedState.turnDeadline && now > updatedState.turnDeadline) {
      const current = getCurrentPlayer(updatedState);
      try {
        if (updatedState.phase === 'ROLL') {
          const dice = crypto.randomInt(1, 7);
          const rolled = applyDiceRoll(updatedState, current.color, dice, now);
          updatedState = rolled.state;
          if (!rolled.autoPassed && updatedState.phase === 'MOVE') {
            const legal = getLegalMoves(updatedState, current.color, dice);
            if (legal.length > 0) {
              const moved = applyTokenMove(updatedState, current.color, legal[0], now);
              updatedState = moved.state;
            }
          }
        } else if (updatedState.phase === 'MOVE' && updatedState.diceValue !== null) {
          const legal = getLegalMoves(updatedState, current.color, updatedState.diceValue);
          if (legal.length > 0) {
            const moved = applyTokenMove(updatedState, current.color, legal[0], now);
            updatedState = moved.state;
          }
        }
        updatedState.lastEvent = `${current.name} timed out — auto-played. ${updatedState.lastEvent}`;
        activeMatches.set(matchId, updatedState);
        broadcastMatchState(updatedState);
        if (updatedState.phase === 'FINISHED') {
          recordVerifiedMatchCompletion(updatedState);
        }
      } catch (err) {
        console.error('Turn timeout tick error:', err);
      }
    }
  }
}, 1000);

async function bootstrap() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // REST API routes
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      onlineCount: socketsByUid.size,
      activeMatches: activeMatches.size,
      activeRooms: rooms.size,
      timestamp: Date.now(),
    });
  });

  app.get('/api/backend-status', (_req, res) => {
    const firebaseConfigured = fs.existsSync(path.resolve(process.cwd(), 'firebase-applet-config.json'));
    res.json({
      nodeMultiplayerReady: true,
      firebaseConfigured,
      googleAuthConfigured: firebaseConfigured,
      onlineCount: socketsByUid.size,
    });
  });

  app.post('/api/auth/guest', (req, res) => {
    const { existingToken, name, avatar } = req.body || {};
    const existing = findUserByToken(existingToken);
    if (existing) {
      return res.json({
        user: sanitizeProfile(existing),
        sessionToken: existing.sessionToken,
      });
    }

    const uid = `guest_${crypto.randomUUID()}`;
    const playerId = generatePlayerId();
    const sessionToken = crypto.randomBytes(24).toString('hex');
    const cleanName =
      typeof name === 'string' && name.trim().length >= 2
        ? name.trim().slice(0, 20)
        : `Raja_${playerId.slice(-4)}`;
    const chosenAvatar =
      typeof avatar === 'string' && DEFAULT_AVATARS.includes(avatar)
        ? avatar
        : DEFAULT_AVATARS[crypto.randomInt(0, DEFAULT_AVATARS.length)];

    const newUser: StoredUser = {
      uid,
      playerId,
      sessionToken,
      name: cleanName,
      avatar: chosenAvatar,
      authProvider: 'guest',
      email: null,
      coins: 500,
      totalGames: 0,
      wins: 0,
      losses: 0,
      rank: Object.keys(store.users).length + 1,
      createdAt: Date.now(),
    };

    store.users[uid] = newUser;
    recalculateRanks();
    saveStore();

    res.json({
      user: sanitizeProfile(newUser),
      sessionToken,
    });
  });

  app.patch('/api/profile', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = findUserByToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized session' });
    }

    const { name, avatar } = req.body || {};
    if (typeof name === 'string') {
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 20) {
        return res.status(400).json({ error: 'Name must be between 2 and 20 characters.' });
      }
      user.name = trimmed;
    }
    if (typeof avatar === 'string' && DEFAULT_AVATARS.includes(avatar)) {
      user.avatar = avatar;
    }

    saveStore();
    res.json({ user: sanitizeProfile(user) });
  });

  app.get('/api/profile/:uid', (req, res) => {
    const user = store.users[req.params.uid];
    if (!user) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const history = store.matchHistory
      .filter((m) => m.participants.some((p) => p.uid === user.uid))
      .slice(0, 25);

    res.json({
      user: sanitizeProfile(user),
      matchHistory: history,
    });
  });

  app.get('/api/leaderboard', (req, res) => {
    const period = String(req.query.period || 'all');
    const now = Date.now();
    const cutoff =
      period === 'daily'
        ? now - 24 * 60 * 60 * 1000
        : period === 'weekly'
          ? now - 7 * 24 * 60 * 60 * 1000
          : 0;

    if (cutoff === 0) {
      const entries: LeaderboardEntry[] = Object.values(store.users)
        .filter((u) => u.totalGames > 0)
        .sort((a, b) => (b.wins !== a.wins ? b.wins - a.wins : b.coins - a.coins))
        .slice(0, 50)
        .map((u, idx) => ({
          uid: u.uid,
          playerId: u.playerId,
          name: u.name,
          avatar: u.avatar,
          wins: u.wins,
          totalGames: u.totalGames,
          winRate: u.totalGames > 0 ? Math.round((u.wins / u.totalGames) * 100) : 0,
          coins: u.coins,
          rank: idx + 1,
        }));
      return res.json({ period, entries });
    }

    // Aggregate strictly from verified completed matches in period
    const agg = new Map<string, { wins: number; totalGames: number }>();
    for (const match of store.matchHistory) {
      if (!match.verified || match.completedAt < cutoff) continue;
      for (const part of match.participants) {
        if (part.isAI) continue;
        const curr = agg.get(part.uid) || { wins: 0, totalGames: 0 };
        curr.totalGames += 1;
        if (part.uid === match.winnerUid) curr.wins += 1;
        agg.set(part.uid, curr);
      }
    }

    const entries: LeaderboardEntry[] = Array.from(agg.entries())
      .map(([uid, stats]) => {
        const u = store.users[uid];
        if (!u) return null;
        return {
          uid: u.uid,
          playerId: u.playerId,
          name: u.name,
          avatar: u.avatar,
          wins: stats.wins,
          totalGames: stats.totalGames,
          winRate: stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0,
          coins: u.coins,
          rank: 0,
        };
      })
      .filter((x): x is LeaderboardEntry => x !== null)
      .sort((a, b) => (b.wins !== a.wins ? b.wins - a.wins : b.winRate - a.winRate))
      .slice(0, 50)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

    res.json({ period, entries });
  });

  app.get('/api/rules', (_req, res) => {
    res.json({ rules: store.gameSettings });
  });

  app.post('/api/admin/rules', (req, res) => {
    const configuredSecret = process.env.ADMIN_SECRET;
    const providedSecret = req.headers['x-admin-secret'];
    if (!configuredSecret || providedSecret !== configuredSecret) {
      return res.status(403).json({
        error: 'Server-side admin authorization required. Set ADMIN_SECRET in environment.',
      });
    }
    const incoming = req.body || {};
    store.gameSettings = {
      ...store.gameSettings,
      requireSixToExit: Boolean(incoming.requireSixToExit ?? store.gameSettings.requireSixToExit),
      bonusTurnOnSix: Boolean(incoming.bonusTurnOnSix ?? store.gameSettings.bonusTurnOnSix),
      bonusTurnOnCapture: Boolean(incoming.bonusTurnOnCapture ?? store.gameSettings.bonusTurnOnCapture),
      bonusTurnOnHome: Boolean(incoming.bonusTurnOnHome ?? store.gameSettings.bonusTurnOnHome),
      threeSixesRule: incoming.threeSixesRule === 'none' ? 'none' : 'forfeit',
      exactRollToHome: Boolean(incoming.exactRollToHome ?? store.gameSettings.exactRollToHome),
      safeSquaresEnabled: Boolean(incoming.safeSquaresEnabled ?? store.gameSettings.safeSquaresEnabled),
      turnTimeoutSeconds: Math.min(60, Math.max(10, Number(incoming.turnTimeoutSeconds || store.gameSettings.turnTimeoutSeconds))),
    };
    saveStore();
    res.json({ rules: store.gameSettings });
  });

  // Frontend middleware (Vite in dev, static dist in prod)
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg: { type: string; payload?: Record<string, unknown> };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return sendWs(ws, 'error', { message: 'Invalid JSON payload' });
      }

      const { type, payload = {} } = msg;

      if (type === 'auth') {
        const user = findUserByToken(String(payload.sessionToken || ''));
        if (!user) {
          return sendWs(ws, 'auth:error', { message: 'Invalid session token' });
        }

        uidBySocket.set(ws, user.uid);
        if (!socketsByUid.has(user.uid)) {
          socketsByUid.set(user.uid, new Set());
        }
        socketsByUid.get(user.uid)!.add(ws);

        sendWs(ws, 'auth:ok', {
          user: sanitizeProfile(user),
          onlineCount: socketsByUid.size,
        });
        broadcastOnlineCount();

        // Check if user has an active match to reconnect into
        const activeMatchId = matchByUid.get(user.uid);
        if (activeMatchId) {
          const match = activeMatches.get(activeMatchId);
          if (match && match.phase !== 'FINISHED') {
            const updated: LudoMatchState = {
              ...match,
              players: match.players.map((p) =>
                p.uid === user.uid ? { ...p, connected: true, disconnectedAt: null } : p
              ),
              updatedAt: Date.now(),
            };
            activeMatches.set(activeMatchId, updated);
            broadcastMatchState(updated);
          }
        }
        return;
      }

      const uid = uidBySocket.get(ws);
      if (!uid || !store.users[uid]) {
        return sendWs(ws, 'error', { message: 'Authenticate first' });
      }
      const user = store.users[uid];

      if (type === 'queue:join') {
        if (matchByUid.has(uid)) {
          const existing = activeMatches.get(matchByUid.get(uid)!);
          if (existing && existing.phase !== 'FINISHED') {
            return sendWs(ws, 'match:state', existing);
          }
        }

        removeFromQueues(uid);
        const size: 2 | 4 = payload.playerCount === 4 ? 4 : 2;
        queues[size].push(uid);
        broadcastQueueStatus(size);

        if (queues[size].length >= size) {
          const matchedUids = queues[size].splice(0, size);
          broadcastQueueStatus(size);
          startMatchFromUsers(matchedUids, 'online');
        }
        return;
      }

      if (type === 'queue:leave') {
        removeFromQueues(uid);
        sendWs(ws, 'queue:left', {});
        return;
      }

      if (type === 'room:create') {
        removeFromQueues(uid);
        const maxPlayers: 2 | 4 = payload.maxPlayers === 4 ? 4 : 2;
        let code = generateRoomCode();
        while (rooms.has(code)) code = generateRoomCode();

        const colors = getColorsForPlayerCount(maxPlayers);
        const room: RoomInfo = {
          roomCode: code,
          hostUid: uid,
          maxPlayers,
          status: 'waiting',
          players: [
            {
              uid: user.uid,
              playerId: user.playerId,
              name: user.name,
              avatar: user.avatar,
              color: colors[0],
              ready: true,
              connected: true,
            },
          ],
          rules: { ...store.gameSettings },
          createdAt: Date.now(),
        };
        rooms.set(code, room);
        broadcastRoomState(room);
        return;
      }

      if (type === 'room:join') {
        removeFromQueues(uid);
        const code = String(payload.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room || room.status !== 'waiting') {
          return sendWs(ws, 'room:error', { message: 'Room not found or match already started.' });
        }
        const already = room.players.find((p) => p.uid === uid);
        if (already) {
          already.connected = true;
          return broadcastRoomState(room);
        }
        if (room.players.length >= room.maxPlayers) {
          return sendWs(ws, 'room:error', { message: 'Private room is already full.' });
        }
        const colors = getColorsForPlayerCount(room.maxPlayers);
        const usedColors = new Set(room.players.map((p) => p.color));
        const nextColor = colors.find((c) => !usedColors.has(c)) || colors[room.players.length];
        room.players.push({
          uid: user.uid,
          playerId: user.playerId,
          name: user.name,
          avatar: user.avatar,
          color: nextColor,
          ready: false,
          connected: true,
        });
        broadcastRoomState(room);
        return;
      }

      if (type === 'room:ready') {
        const code = String(payload.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) return;
        const p = room.players.find((pl) => pl.uid === uid);
        if (!p) return;
        p.ready = Boolean(payload.ready);
        broadcastRoomState(room);
        return;
      }

      if (type === 'room:leave') {
        const code = String(payload.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) return;
        room.players = room.players.filter((pl) => pl.uid !== uid);
        if (room.players.length === 0) {
          rooms.delete(code);
        } else {
          if (room.hostUid === uid) {
            room.hostUid = room.players[0].uid;
            room.players[0].ready = true;
          }
          broadcastRoomState(room);
        }
        sendWs(ws, 'room:left', { roomCode: code });
        return;
      }

      if (type === 'room:start') {
        const code = String(payload.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room || room.status !== 'waiting') {
          return sendWs(ws, 'room:error', { message: 'Room is unavailable.' });
        }
        if (room.hostUid !== uid) {
          return sendWs(ws, 'room:error', { message: 'Only the room host can start the match.' });
        }
        if (room.players.length < 2) {
          return sendWs(ws, 'room:error', { message: 'At least 2 players are needed to start.' });
        }
        if (room.players.some((p) => !p.ready && p.uid !== room.hostUid)) {
          return sendWs(ws, 'room:error', { message: 'Waiting for all joined players to mark Ready.' });
        }

        room.status = 'in_match';
        const match = startMatchFromUsers(
          room.players.map((p) => p.uid),
          'private',
          room.roomCode,
          room.rules
        );
        room.matchId = match.matchId;
        broadcastRoomState(room);
        return;
      }

      if (type === 'match:roll') {
        const matchId = String(payload.matchId || matchByUid.get(uid) || '');
        const match = activeMatches.get(matchId);
        if (!match) return sendWs(ws, 'error', { message: 'Match not found' });

        if (typeof payload.expectedSeq === 'number' && payload.expectedSeq !== match.actionSeq) {
          return sendWs(ws, 'match:state', match); // Idempotent resync on duplicate/stale click
        }

        const current = getCurrentPlayer(match);
        if (current.uid !== uid) {
          return sendWs(ws, 'error', { message: 'Not your turn' });
        }
        if (match.phase !== 'ROLL') {
          return sendWs(ws, 'error', { message: 'Already rolled this turn' });
        }

        const serverDice = crypto.randomInt(1, 7);
        const result = applyDiceRoll(match, current.color, serverDice);
        activeMatches.set(matchId, result.state);
        broadcastMatchState(result.state);
        return;
      }

      if (type === 'match:move') {
        const matchId = String(payload.matchId || matchByUid.get(uid) || '');
        const match = activeMatches.get(matchId);
        if (!match) return sendWs(ws, 'error', { message: 'Match not found' });

        if (typeof payload.expectedSeq === 'number' && payload.expectedSeq !== match.actionSeq) {
          return sendWs(ws, 'match:state', match);
        }

        const current = getCurrentPlayer(match);
        if (current.uid !== uid) {
          return sendWs(ws, 'error', { message: 'Not your turn' });
        }

        const tokenId = Number(payload.tokenId);
        try {
          const moved = applyTokenMove(match, current.color, tokenId);
          activeMatches.set(matchId, moved.state);
          broadcastMatchState(moved.state);
          if (moved.matchFinished) {
            recordVerifiedMatchCompletion(moved.state);
          }
        } catch (err) {
          sendWs(ws, 'error', { message: err instanceof Error ? err.message : 'Invalid move' });
        }
        return;
      }

      if (type === 'match:forfeit') {
        const matchId = String(payload.matchId || matchByUid.get(uid) || '');
        const match = activeMatches.get(matchId);
        if (!match || match.phase === 'FINISHED') return;

        const updated = forfeitPlayerInState(match, uid, `${user.name} left the match`);
        matchByUid.delete(uid);
        activeMatches.set(matchId, updated);
        broadcastMatchState(updated);
        if (updated.phase === 'FINISHED') {
          recordVerifiedMatchCompletion(updated);
        }
        return;
      }
    });

    ws.on('close', () => {
      const uid = uidBySocket.get(ws);
      uidBySocket.delete(ws);
      if (!uid) return;

      const set = socketsByUid.get(uid);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          socketsByUid.delete(uid);
          removeFromQueues(uid);

          // Update any waiting private room
          for (const room of rooms.values()) {
            const rp = room.players.find((p) => p.uid === uid);
            if (rp) {
              rp.connected = false;
              broadcastRoomState(room);
            }
          }

          // Mark disconnected in active match (45s reconnect grace period)
          const activeMatchId = matchByUid.get(uid);
          if (activeMatchId) {
            const match = activeMatches.get(activeMatchId);
            if (match && match.phase !== 'FINISHED') {
              const updated: LudoMatchState = {
                ...match,
                players: match.players.map((p) =>
                  p.uid === uid ? { ...p, connected: false, disconnectedAt: Date.now() } : p
                ),
                lastEvent: `${store.users[uid]?.name || 'Player'} disconnected — waiting up to 45s for reconnection...`,
                updatedAt: Date.now(),
              };
              activeMatches.set(activeMatchId, updated);
              broadcastMatchState(updated);
            }
          }
        }
      }
      broadcastOnlineCount();
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`X Ludo authoritative server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start X Ludo server:', err);
  process.exit(1);
});
