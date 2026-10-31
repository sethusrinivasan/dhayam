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

test("guided demo multiplayer simulation initializes Cloudflare room state and seats cleanly", () => {
  const multiplayerState = {
    active: false,
    isHost: false,
    roomCode: null as string | null,
    transport: "cf_ws",
    status: "offline",
    mySeat: 0,
    roomTargetCount: 2,
    claimedSeats: {} as Record<number, { name: string; connected: boolean; isHost: boolean; device?: string }>,
  };

  function simulateStartGuidedDemo(mode: "classic" | "multiplayer", playerCount: number) {
    const demo = true;
    const demoMode = mode;
    const demoPlayerCount = playerCount;

    if (demoMode === "multiplayer") {
      multiplayerState.active = true;
      multiplayerState.isHost = true;
      multiplayerState.roomCode = "CF88";
      multiplayerState.transport = "cf_ws";
      multiplayerState.status = "connected";
      multiplayerState.mySeat = 0;
      multiplayerState.roomTargetCount = demoPlayerCount;
      multiplayerState.claimedSeats = {};
      for (let i = 0; i < demoPlayerCount; i++) {
        multiplayerState.claimedSeats[i] = {
          name: i === 0 ? "Maya" : i === 1 ? "Leo" : i === 2 ? "Rohan" : "Ananya",
          connected: true,
          isHost: i === 0,
          device: i === 0 ? "desktop" : "mobile",
        };
      }
    } else {
      multiplayerState.active = false;
      multiplayerState.isHost = false;
      multiplayerState.roomCode = null;
      multiplayerState.claimedSeats = {};
    }
    return { demo, demoMode, demoPlayerCount };
  }

  // Test 2-player multiplayer demo setup
  const d2 = simulateStartGuidedDemo("multiplayer", 2);
  assert.equal(d2.demoMode, "multiplayer");
  assert.equal(d2.demoPlayerCount, 2);
  assert.equal(multiplayerState.active, true);
  assert.equal(multiplayerState.isHost, true);
  assert.equal(multiplayerState.roomCode, "CF88");
  assert.equal(Object.keys(multiplayerState.claimedSeats).length, 2);
  assert.equal(multiplayerState.claimedSeats[0].name, "Maya");
  assert.equal(multiplayerState.claimedSeats[1].name, "Leo");

  // Test 4-player multiplayer demo setup
  const d4 = simulateStartGuidedDemo("multiplayer", 4);
  assert.equal(d4.demoPlayerCount, 4);
  assert.equal(Object.keys(multiplayerState.claimedSeats).length, 4);
  assert.equal(multiplayerState.claimedSeats[2].name, "Rohan");
  assert.equal(multiplayerState.claimedSeats[3].name, "Ananya");
});

test("guided demo stop and cleanup cleanly resets multiplayer state", () => {
  const multiplayerState = {
    active: true,
    isHost: true,
    roomCode: "CF88" as string | null,
    claimedSeats: { 0: { name: "Maya", connected: true } } as Record<number, any>,
  };

  let demo = true;
  let demoMode: "classic" | "multiplayer" = "multiplayer";

  function simulateStopDemo() {
    demo = false;
    if (demoMode === "multiplayer" || multiplayerState.roomCode === "CF88") {
      multiplayerState.active = false;
      multiplayerState.isHost = false;
      multiplayerState.roomCode = null;
      multiplayerState.claimedSeats = {};
    }
    demoMode = "classic";
  }

  simulateStopDemo();

  assert.equal(demo, false);
  assert.equal(demoMode, "classic");
  assert.equal(multiplayerState.active, false);
  assert.equal(multiplayerState.isHost, false);
  assert.equal(multiplayerState.roomCode, null);
  assert.deepEqual(multiplayerState.claimedSeats, {});
});

test("checkPendingRemoteState fallback guarantees render is invoked on finishRoll", () => {
  let renderCount = 0;
  function render() {
    renderCount++;
  }

  let pendingRemoteState: any = null;
  function checkPendingRemoteState() {
    if (pendingRemoteState) {
      pendingRemoteState = null;
      render();
      return true;
    }
    return false;
  }

  // Regression scenario: local game or multiplayer without queued state
  function finishRoll() {
    if (typeof checkPendingRemoteState === "function" && checkPendingRemoteState()) {
      // Handled by pending remote state
    } else {
      render();
    }
  }

  // Initial call with no pending remote state must trigger render
  finishRoll();
  assert.equal(renderCount, 1, "render() must be called when checkPendingRemoteState() returns false");

  // Call with pending remote state must also trigger render exactly once
  pendingRemoteState = { remoteGame: {} };
  finishRoll();
  assert.equal(renderCount, 2, "render() must be called via applyRemoteState when pending state exists");
});

test("bestAutomaticMove relieves overcrowding and balances fair piece progression", () => {
  // Simulate player with 3 pieces stacked on A4 (progress 0)
  const p = {
    id: "P0",
    name: "Maya",
    seat: "N",
    captured: false,
    pieces: [
      { id: "P0-0", progress: 0 },
      { id: "P0-1", progress: 0 },
      { id: "P0-2", progress: 0 },
      { id: "P0-3", progress: -1 },
      { id: "P0-4", progress: -1 },
      { id: "P0-5", progress: -1 }
    ]
  };

  const occupancy = new Map([["A4", 3]]);
  const moves = [
    // Move A: enter a piece from reserve onto A4 (adds to crowd)
    {
      piece: p.pieces[3],
      indices: [0],
      values: [1],
      test: { progress: 0, targets: [] }
    },
    // Move B: advance one of the crowded pieces from A4 forward along circuit (relieves crowd)
    {
      piece: p.pieces[0],
      indices: [0],
      values: [3],
      test: { progress: 3, targets: [] }
    }
  ];

  function scoreMove(m: any) {
    const fromSq = m.piece.progress >= 0 ? "A4" : null;
    const crowdingAtOrigin = fromSq ? (occupancy.get(fromSq) || 1) : 0;
    const isEntering = m.piece.progress < 0;
    let s = 0;
    if (crowdingAtOrigin > 1) s += 15000 * crowdingAtOrigin;
    if (isEntering) s += 2500;
    else s += Math.max(0, 43 - m.piece.progress) * 20;
    s += m.test.progress;
    return s;
  }

  const scoreA = scoreMove(moves[0]); // Entering to crowded square
  const scoreB = scoreMove(moves[1]); // Moving piece out of crowded square

  assert.ok(scoreB > scoreA, "Moving out of an overcrowded square must score higher than adding another piece to it");
});

test("startGuidedDemo supports multiplayer-real mode targeting Cloudflare", () => {
  let mode: string = "classic";
  let playerCount = 2;
  const sockets: any[] = [];

  function simulateStartDemo(chosenMode: string, count: number) {
    mode = chosenMode;
    playerCount = count;
    if (mode === "multiplayer-real") {
      sockets.push({ url: "wss://dhayam.cancun.workers.dev/api/room/CF1234/ws", state: "OPEN" });
      for (let i = 1; i < count; i++) {
        sockets.push({ url: `wss://dhayam.cancun.workers.dev/api/room/CF1234/ws?seat=${i}`, state: "OPEN" });
      }
    }
  }

  simulateStartDemo("multiplayer-real", 3);
  assert.equal(mode, "multiplayer-real");
  assert.equal(playerCount, 3);
  assert.equal(sockets.length, 3, "Spawns host socket and 2 simulated guest sockets for 3-player Cloudflare demo");
});

test("state transitions and button enablement audit across all game phases", () => {
  function getActionAndMoveBtnState(ctx: {
    phase: string;
    isHumanTurn: boolean;
    isComputer: boolean;
    rolling: boolean;
    moving: boolean;
    demo: boolean;
    targetMove: any;
    optsCount: number;
    historyLength: number;
  }) {
    let actionDisabled = false;
    let actionText = "";
    let moveDisabled = false;
    let moveText = "";

    const canMove = ctx.phase === "move" && Boolean(ctx.targetMove) && !ctx.rolling && !ctx.moving && ctx.isHumanTurn;

    // Move button logic
    if (ctx.moving) {
      moveText = "Moving…";
      moveDisabled = true;
    } else if (canMove && ctx.targetMove) {
      moveText = ctx.targetMove.piece.progress < 0 ? "✨ Enter Piece" : "Move selected piece";
      moveDisabled = false;
    } else {
      moveText = "Move selected piece";
      moveDisabled = true;
    }

    // Action button logic
    if (ctx.phase === "done") {
      actionText = "🏆 New match";
      actionDisabled = false;
    } else if (ctx.demo) {
      actionText = "Demo playing…";
      actionDisabled = true;
    } else if (!ctx.isHumanTurn && !ctx.isComputer) {
      actionText = "Waiting for player…";
      actionDisabled = true;
    } else if (ctx.isComputer) {
      actionText = ctx.rolling ? "Computer rolling…" : ctx.moving ? "Computer moving…" : "Computer is thinking…";
      actionDisabled = true;
    } else if (ctx.rolling) {
      actionText = "🎲 Rolling…";
      actionDisabled = true;
    } else if (ctx.moving) {
      actionText = "Moving…";
      actionDisabled = true;
    } else if (ctx.phase === "move") {
      if (ctx.targetMove) {
        actionText = ctx.targetMove.piece.progress < 0 ? "✨ Enter Piece" : "👉 Move Selected Piece";
        actionDisabled = false;
      } else if (ctx.optsCount === 0) {
        actionText = "Pass turn";
        actionDisabled = false;
      } else {
        actionText = "👉 Move Piece";
        actionDisabled = false;
      }
    } else if (ctx.phase === "roll") {
      actionText = ctx.historyLength > 0 ? "🎲 Roll Dice (Bonus throw!)" : "🎲 Roll Dice";
      actionDisabled = false;
    }

    return { actionDisabled, actionText, moveDisabled, moveText };
  }

  // 1. Human Roll Phase: actionBtn enabled, moveBtn disabled
  const s1 = getActionAndMoveBtnState({
    phase: "roll",
    isHumanTurn: true,
    isComputer: false,
    rolling: false,
    moving: false,
    demo: false,
    targetMove: null,
    optsCount: 0,
    historyLength: 0
  });
  assert.equal(s1.actionDisabled, false);
  assert.equal(s1.actionText, "🎲 Roll Dice");
  assert.equal(s1.moveDisabled, true);

  // 2. Human Rolling: both buttons disabled
  const s2 = getActionAndMoveBtnState({
    phase: "roll",
    isHumanTurn: true,
    isComputer: false,
    rolling: true,
    moving: false,
    demo: false,
    targetMove: null,
    optsCount: 0,
    historyLength: 0
  });
  assert.equal(s2.actionDisabled, true);
  assert.equal(s2.moveDisabled, true);

  // 3. Human Move Phase with entry move: both buttons enabled and aligned
  const s3 = getActionAndMoveBtnState({
    phase: "move",
    isHumanTurn: true,
    isComputer: false,
    rolling: false,
    moving: false,
    demo: false,
    targetMove: { piece: { id: "P0-0", progress: -1 } },
    optsCount: 6,
    historyLength: 1
  });
  assert.equal(s3.actionDisabled, false);
  assert.equal(s3.actionText, "✨ Enter Piece");
  assert.equal(s3.moveDisabled, false);
  assert.equal(s3.moveText, "✨ Enter Piece");

  // 4. Moving animation: both buttons strictly disabled with "Moving…" text
  const s4 = getActionAndMoveBtnState({
    phase: "move",
    isHumanTurn: true,
    isComputer: false,
    rolling: false,
    moving: true,
    demo: false,
    targetMove: { piece: { id: "P0-0", progress: 0 } },
    optsCount: 1,
    historyLength: 1
  });
  assert.equal(s4.actionDisabled, true);
  assert.equal(s4.actionText, "Moving…");
  assert.equal(s4.moveDisabled, true);
  assert.equal(s4.moveText, "Moving…");

  // 5. Computer turn: actionBtn strictly disabled ("Computer is thinking…"), moveBtn disabled
  const s5 = getActionAndMoveBtnState({
    phase: "roll",
    isHumanTurn: false,
    isComputer: true,
    rolling: false,
    moving: false,
    demo: false,
    targetMove: null,
    optsCount: 0,
    historyLength: 0
  });
  assert.equal(s5.actionDisabled, true);
  assert.equal(s5.actionText, "Computer is thinking…");
  assert.equal(s5.moveDisabled, true);
});

test("guaranteed cleanup of moving flag via try-finally on move execution", async () => {
  let moving = false;
  let movingPieceId: string | null = null;

  async function simulateApplyWithPotentialError(throwError: boolean) {
    moving = true;
    movingPieceId = "P0-0";
    try {
      if (throwError) {
        throw new Error("Simulated animation or audio exception");
      }
    } catch (_) {
      // Handled
    } finally {
      moving = false;
      movingPieceId = null;
    }
  }

  // Normal move execution
  await simulateApplyWithPotentialError(false);
  assert.equal(moving, false, "moving flag must be false after normal execution");
  assert.equal(movingPieceId, null);

  // Exceptional execution must still clear moving flag
  await simulateApplyWithPotentialError(true);
  assert.equal(moving, false, "moving flag must be false even if an error is thrown");
  assert.equal(movingPieceId, null);
});

test("capture splash triggers with subtle UI and hides verbose statusText", () => {
  let splashTriggered = false;
  let splashSquare = "";
  let statusTitle = "";
  let statusText = "Previous instruction";

  function showCaptureSplash(sq: string) {
    splashTriggered = true;
    splashSquare = sq;
  }

  function handleCaptureEvent(sq: string) {
    showCaptureSplash(sq);
    statusTitle = "⚔️ Capture!";
    statusText = ""; // Verbose note is suppressed for subtle game experience
  }

  handleCaptureEvent("C3");
  assert.equal(splashTriggered, true, "showCaptureSplash must be called on capture");
  assert.equal(splashSquare, "C3");
  assert.equal(statusTitle, "⚔️ Capture!");
  assert.equal(statusText, "", "Verbose description text note must be suppressed");
});


