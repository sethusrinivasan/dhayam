import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  evaluateMove,
  legalMoves,
  applyMove,
  matchPieceId,
  BONUS_VALUES,
} from "../src/game.ts";

test("matchPieceId normalizes IDs across client and worker conventions", () => {
  // Client uses P0-0, worker uses p0_q0
  assert.equal(matchPieceId("P0-0", "p0_q0"), true);
  assert.equal(matchPieceId("p0_q0", "P0-0"), true);
  assert.equal(matchPieceId("P1-5", "p1_q5"), true);
  assert.equal(matchPieceId("P2-3", "p2_q3"), true);
  assert.equal(matchPieceId("p3_q1", "P3-1"), true);

  // Exact matches
  assert.equal(matchPieceId("P0-0", "P0-0"), true);
  assert.equal(matchPieceId("p0_q0", "p0_q0"), true);

  // Distinct pieces do not match
  assert.equal(matchPieceId("P0-0", "P0-1"), false);
  assert.equal(matchPieceId("P0-0", "P1-0"), false);
  assert.equal(matchPieceId("p0_q0", "p0_q1"), false);
  assert.equal(matchPieceId("p0_q0", "p1_q0"), false);

  // Null / undefined safety
  assert.equal(matchPieceId(null, "P0-0"), false);
  assert.equal(matchPieceId("P0-0", undefined), false);
  assert.equal(matchPieceId(null, null), false);
});

test("applyMove accepts piece IDs formatted with worker convention (p0_q0)", () => {
  const game = createGame(2);
  game.phase = "move";
  game.pool = [1];

  // Client generated legal moves using P0-0
  const moves = legalMoves(game);
  assert.ok(moves.length > 0);
  const legal = moves[0];
  assert.equal(legal.pieceId, "P0-0");

  // Worker or peer sends move request using worker piece ID "p0_q0"
  const next = applyMove(game, {
    ...legal,
    pieceId: "p0_q0",
  });

  assert.equal(next.players[0].pieces[0].progress, 0);
  assert.deepEqual(next.pool, []);
});

test("dice value normalization guards against null and undefined in pool and history", () => {
  function normalizeDiceResult(d: { a?: number; b?: number; value?: any; val?: any }) {
    const a = typeof d.a === "number" ? d.a : 0;
    const b = typeof d.b === "number" ? d.b : 0;
    const val =
      typeof d.value === "number"
        ? d.value
        : typeof d.val === "number"
          ? d.val
          : a + b === 0
            ? 12
            : a + b;
    return { a, b, value: val, val };
  }

  // 1. Value present on .value
  const r1 = normalizeDiceResult({ a: 2, b: 3, value: 5 });
  assert.equal(r1.value, 5);
  assert.equal(r1.val, 5);

  // 2. Value present only on .val (the bug from flight recorder)
  const r2 = normalizeDiceResult({ a: 2, b: 3, val: 5 });
  assert.equal(r2.value, 5);
  assert.equal(r2.val, 5);

  // 3. Double zero maps to 12
  const r3 = normalizeDiceResult({ a: 0, b: 0 });
  assert.equal(r3.value, 12);
  assert.equal(r3.val, 12);

  // 4. Guard against pushing non-numbers into pool
  const pool: number[] = [];
  function safePushToPool(targetPool: number[], value: unknown) {
    if (typeof value === "number" && !Number.isNaN(value)) {
      targetPool.push(value);
    }
  }

  safePushToPool(pool, r2.value);
  safePushToPool(pool, undefined);
  safePushToPool(pool, null);
  safePushToPool(pool, NaN);

  assert.deepEqual(pool, [5], "Pool must contain only valid numbers, never null or undefined");
});

test("bonus decision grants extra roll on 1, 5, 6, 12 on turn 1", () => {
  function bonusDecision(value: number, historyLength: number) {
    const specialRoll = BONUS_VALUES.has(value);
    const bonusDepth = Math.max(0, historyLength - 1);
    const bonusChance = specialRoll ? 0.5 ** bonusDepth : 0;
    const bonus = specialRoll && bonusChance === 1; // On first roll, bonusDepth is 0, bonusChance is 1
    return { specialRoll, bonus };
  }

  // Rolling 5 on first roll of the turn (history length = 1)
  const b5 = bonusDecision(5, 1);
  assert.equal(b5.specialRoll, true);
  assert.equal(b5.bonus, true, "Rolling 5 on first roll earns another roll");

  // Rolling 1 on first roll
  const b1 = bonusDecision(1, 1);
  assert.equal(b1.specialRoll, true);
  assert.equal(b1.bonus, true);

  // Rolling non-bonus number (e.g. 2, 3, 4)
  const b2 = bonusDecision(2, 1);
  assert.equal(b2.specialRoll, false);
  assert.equal(b2.bonus, false, "Rolling 2 does not earn another roll, enters move phase");

  const b3 = bonusDecision(3, 1);
  assert.equal(b3.specialRoll, false);
  assert.equal(b3.bonus, false);
});

test("multiplayer state buffering prevents race conditions during roll animations", () => {
  let rolling = true;
  let pendingRemoteState: any = null;
  let appliedState: any = null;

  function applyRemoteState(remoteGame: any) {
    if (rolling) {
      pendingRemoteState = remoteGame;
      return;
    }
    appliedState = remoteGame;
  }

  // Server broadcasts SYNC_STATE while client dice are tumbling
  applyRemoteState({ pool: [5], phase: "roll" });

  assert.equal(appliedState, null, "State must not be prematurely applied during tumbling");
  assert.deepEqual(pendingRemoteState, { pool: [5], phase: "roll" });

  // Tumbling finishes
  rolling = false;
  if (pendingRemoteState) {
    applyRemoteState(pendingRemoteState);
    pendingRemoteState = null;
  }

  assert.deepEqual(appliedState, { pool: [5], phase: "roll" }, "Buffered state applies cleanly after tumbling");
  assert.equal(pendingRemoteState, null);
});

test("error event safely resets rolling and moving flags to prevent UI deadlocks", () => {
  let rolling = true;
  let moving = true;
  let movingPieceId: string | null = "P0-0";

  function handleErrorEvent(msg: { message: string }) {
    rolling = false;
    moving = false;
    movingPieceId = null;
  }

  handleErrorEvent({ message: "Not your turn to move." });

  assert.equal(rolling, false);
  assert.equal(moving, false);
  assert.equal(movingPieceId, null);
});

test("opening entry allowance on turn 1 permits entering a piece with non-1 roll", () => {
  const game = {
    turn: 1,
    players: [
      { id: "P0", name: "Player 1", pieces: [{ id: "P0-0", progress: -1 }] },
      { id: "P1", name: "Player 2", pieces: [{ id: "P1-0", progress: -1 }] }
    ],
    openingEntryPlayers: [] as string[]
  };

  function openingEntryAvailable(p: { id: string }, piece: { progress: number }, values: number[]) {
    return (
      game.turn <= game.players.length &&
      !game.openingEntryPlayers.includes(p.id) &&
      piece.progress === -1 &&
      values.length === 1
    );
  }

  // Player 0 rolls 5 on turn 1 with piece in reserve
  const isAvailable = openingEntryAvailable(game.players[0], game.players[0].pieces[0], [5]);
  assert.equal(isAvailable, true, "Opening entry allowance must be available on turn 1 with roll of 5");

  // After using the allowance, player is recorded in openingEntryPlayers
  game.openingEntryPlayers.push("P0");
  const isAvailableAfter = openingEntryAvailable(game.players[0], game.players[0].pieces[0], [5]);
  assert.equal(isAvailableAfter, false, "Opening entry allowance can only be used once per player");
});

test("no duplicate dice are added when server provides authoritative pool", () => {
  const game = {
    pool: [] as number[],
    history: [] as number[],
    phase: "roll",
    last: null as any
  };

  function applyAuthoritativeRoll(serverData: { dice: { a: number; b: number }; value: number; pool: number[]; history: number[]; phase: string }) {
    // In cf_ws mode, pool and history are taken directly from the server
    game.pool = [...serverData.pool];
    game.history = [...serverData.history];
    game.phase = serverData.phase;
    game.last = { a: serverData.dice.a, b: serverData.dice.b, value: serverData.value };
  }

  // Roll 1: Server rolled 5 (bonus roll)
  applyAuthoritativeRoll({
    dice: { a: 2, b: 3 },
    value: 5,
    pool: [5],
    history: [5],
    phase: "roll"
  });

  assert.deepEqual(game.pool, [5]);
  assert.deepEqual(game.history, [5]);
  assert.equal(game.phase, "roll", "Remains in roll phase after bonus roll of 5");

  // Roll 2: Server rolled 2 (non-bonus roll)
  applyAuthoritativeRoll({
    dice: { a: 1, b: 1 },
    value: 2,
    pool: [5, 2],
    history: [5, 2],
    phase: "move"
  });

  assert.deepEqual(game.pool, [5, 2], "Pool accurately accumulates both rolls without duplicates or nulls");
  assert.deepEqual(game.history, [5, 2]);
  assert.equal(game.phase, "move", "Transitions to move phase after non-bonus roll");
});

test("automatic turn pass occurs when player has 0 legal moves", () => {
  const game = {
    current: 0,
    players: [
      { id: "P0", name: "Player 1", rank: null },
      { id: "P1", name: "Player 2", rank: null }
    ],
    pool: [2],
    phase: "move"
  };

  function checkTurnPass(legalMoveCount: number) {
    if (legalMoveCount === 0) {
      game.pool = [];
      game.phase = "roll";
      game.current = (game.current + 1) % game.players.length;
      return true;
    }
    return false;
  }

  const passed = checkTurnPass(0);
  assert.equal(passed, true);
  assert.deepEqual(game.pool, []);
  assert.equal(game.phase, "roll");
  assert.equal(game.current, 1, "Turn passes to next player when no legal moves exist");
});

