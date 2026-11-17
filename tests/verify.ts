import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {
  applyDiceRoll,
  applyTokenMove,
  createInitialMatchState,
  getCurrentPlayer,
  getLegalMoves,
} from '../src/shared/ludoEngine';
import { chooseAIMove } from '../src/shared/ludoAI';
import type { LudoMatchState, MatchPlayer, RoomInfo } from '../src/shared/types';

function testOfflineEngineAndAI() {
  const players: MatchPlayer[] = [
    { uid: 'p1', playerId: 'XLD-P1', name: 'P1', avatar: 'royal', color: 'red', isAI: true, aiDifficulty: 'hard', connected: true },
    { uid: 'p2', playerId: 'XLD-P2', name: 'P2', avatar: 'queen', color: 'yellow', isAI: true, aiDifficulty: 'medium', connected: true },
  ];

  // 1. Test 3 consecutive sixes forfeit
  let s = createInitialMatchState({ matchId: 't_3six', mode: 'ai', players });
  const r1 = applyDiceRoll(s, 'red', 6);
  assert.equal(r1.state.phase, 'MOVE');
  s = applyTokenMove(r1.state, 'red', 0).state; // bonus turn on 6
  const r2 = applyDiceRoll(s, 'red', 6);
  assert.equal(r2.state.phase, 'MOVE');
  s = applyTokenMove(r2.state, 'red', 0).state; // bonus turn on 6
  const r3 = applyDiceRoll(s, 'red', 6);
  assert.equal(r3.forfeitedThreeSixes, true);
  assert.equal(r3.state.activeColors[r3.state.currentTurnIndex], 'yellow');

  // 2. Test full simulated AI vs AI match to completion
  let sim = createInitialMatchState({ matchId: 't_full', mode: 'ai', players });
  let steps = 0;
  while (sim.phase !== 'FINISHED' && steps < 4000) {
    const cur = getCurrentPlayer(sim);
    const dice = Math.floor(Math.random() * 6) + 1;
    const rolled = applyDiceRoll(sim, cur.color, dice);
    sim = rolled.state;
    if (!rolled.autoPassed && sim.phase === 'MOVE') {
      const legal = getLegalMoves(sim, cur.color, dice);
      assert.ok(legal.length > 0);
      const tokenId = chooseAIMove(sim, cur.color, cur.aiDifficulty || 'medium');
      assert.ok(legal.includes(tokenId));
      sim = applyTokenMove(sim, cur.color, tokenId).state;
    }
    steps++;
  }
  assert.equal(sim.phase, 'FINISHED', 'Full AI match should reach victory');
  assert.ok(sim.winnerColor !== null);
  console.log(`[PASS] Offline Ludo rules & AI full match completed in ${steps} turns (Winner: ${sim.winnerColor})`);
}

async function createGuest(name: string) {
  const res = await fetch('http://127.0.0.1:3000/api/auth/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  assert.equal(res.status, 200);
  return (await res.json()) as { user: { uid: string; playerId: string; name: string }; sessionToken: string };
}

function connectWs(token: string): Promise<{ ws: WebSocket; messages: Array<{ type: string; payload: any }> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:3000/ws');
    const messages: Array<{ type: string; payload: any }> = [];
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      messages.push(msg);
      if (msg.type === 'auth:ok') {
        resolve({ ws, messages });
      }
    });
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', payload: { sessionToken: token } }));
    });
    ws.on('error', reject);
  });
}

async function waitFor<T>(fn: () => T | undefined, timeoutMs = 4000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const val = fn();
    if (val !== undefined) return val;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error('Timed out waiting for condition');
}

async function testOnlineMultiplayer() {
  // Health & Admin auth check
  const health = await fetch('http://127.0.0.1:3000/api/health').then((r) => r.json());
  assert.equal(health.ok, true);

  const adminDenied = await fetch('http://127.0.0.1:3000/api/admin/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requireSixToExit: false }),
  });
  assert.equal(adminDenied.status, 403, 'Admin route must deny unauthorized requests');

  // 1. Two-player online matchmaking + server roll + disconnect/reconnect + forfeit completion
  const g1 = await createGuest('ArjunTest');
  const g2 = await createGuest('MeeraTest');
  const c1 = await connectWs(g1.sessionToken);
  const c2 = await connectWs(g2.sessionToken);

  c1.ws.send(JSON.stringify({ type: 'queue:join', payload: { playerCount: 2 } }));
  c2.ws.send(JSON.stringify({ type: 'queue:join', payload: { playerCount: 2 } }));

  const match1 = await waitFor<LudoMatchState>(() =>
    c1.messages.find((m) => m.type === 'match:state')?.payload
  );
  assert.equal(match1.playerCount, 2);
  assert.equal(match1.phase, 'ROLL');

  // Non-turn player roll must be rejected
  const nonTurnClient = match1.players[match1.currentTurnIndex].uid === g1.user.uid ? c2 : c1;
  const turnClient = match1.players[match1.currentTurnIndex].uid === g1.user.uid ? c1 : c2;
  nonTurnClient.ws.send(JSON.stringify({ type: 'match:roll', payload: { matchId: match1.matchId, expectedSeq: match1.actionSeq } }));
  const errMsg = await waitFor(() => nonTurnClient.messages.find((m) => m.type === 'error')?.payload);
  assert.equal(errMsg.message, 'Not your turn');

  // Turn player rolls authoritatively
  turnClient.ws.send(JSON.stringify({ type: 'match:roll', payload: { matchId: match1.matchId, expectedSeq: match1.actionSeq } }));
  const rolledState = await waitFor<LudoMatchState>(() =>
    turnClient.messages.filter((m) => m.type === 'match:state').find((m) => m.payload.actionSeq > match1.actionSeq)?.payload
  );
  assert.ok(rolledState.diceValue !== null && rolledState.diceValue >= 1 && rolledState.diceValue <= 6);

  // Reconnection test: close c2 and reconnect
  c2.ws.close();
  await new Promise((r) => setTimeout(r, 150));
  const c2Reconnected = await connectWs(g2.sessionToken);
  const resynced = await waitFor<LudoMatchState>(() =>
    c2Reconnected.messages.find((m) => m.type === 'match:state')?.payload
  );
  assert.equal(resynced.matchId, match1.matchId);
  assert.equal(resynced.players.find((p) => p.uid === g2.user.uid)?.connected, true);

  // Forfeit to complete verified match & test leaderboard
  c2Reconnected.ws.send(JSON.stringify({ type: 'match:forfeit', payload: { matchId: match1.matchId } }));
  const finishedState = await waitFor<LudoMatchState>(() =>
    c1.messages.filter((m) => m.type === 'match:state').find((m) => m.payload.phase === 'FINISHED')?.payload
  );
  assert.equal(finishedState.winnerColor, match1.players.find((p) => p.uid === g1.user.uid)?.color);

  const lb = await fetch('http://127.0.0.1:3000/api/leaderboard?period=daily').then((r) => r.json());
  assert.ok(lb.entries.some((e: any) => e.uid === g1.user.uid && e.wins >= 1));

  c1.ws.close();
  c2Reconnected.ws.close();
  console.log('[PASS] 2P Online matchmaking, server dice, turn validation, reconnect & verified leaderboard');

  // 2. Four-player private room code test
  const pUsers = await Promise.all(['HostA', 'FriendB', 'FriendC', 'FriendD'].map(createGuest));
  const pConns = await Promise.all(pUsers.map((u) => connectWs(u.sessionToken)));

  pConns[0].ws.send(JSON.stringify({ type: 'room:create', payload: { maxPlayers: 4 } }));
  const roomCreated = await waitFor<RoomInfo>(() =>
    pConns[0].messages.find((m) => m.type === 'room:state')?.payload
  );
  assert.equal(roomCreated.roomCode.length, 6);

  for (let i = 1; i < 4; i++) {
    pConns[i].ws.send(JSON.stringify({ type: 'room:join', payload: { roomCode: roomCreated.roomCode } }));
    pConns[i].ws.send(JSON.stringify({ type: 'room:ready', payload: { roomCode: roomCreated.roomCode, ready: true } }));
  }

  await waitFor(() => {
    const latest = [...pConns[0].messages].reverse().find((m) => m.type === 'room:state')?.payload as RoomInfo | undefined;
    return latest && latest.players.length === 4 && latest.players.every((p) => p.ready) ? latest : undefined;
  });

  pConns[0].ws.send(JSON.stringify({ type: 'room:start', payload: { roomCode: roomCreated.roomCode } }));
  const fourPlayerMatch = await waitFor<LudoMatchState>(() =>
    pConns[3].messages.find((m) => m.type === 'match:state')?.payload
  );
  assert.equal(fourPlayerMatch.playerCount, 4);
  assert.equal(fourPlayerMatch.roomCode, roomCreated.roomCode);

  pConns.forEach((c) => c.ws.close());
  console.log(`[PASS] 4P Private Room (${roomCreated.roomCode}) join, ready check, and authoritative start`);
}

async function main() {
  testOfflineEngineAndAI();
  await testOnlineMultiplayer();
  console.log('ALL X LUDO QUALITY TESTS PASSED');
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
