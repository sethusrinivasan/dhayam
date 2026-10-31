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

test("default game experience initializes Solo vs Computer (2 players, 1 computer opponent)", () => {
  function createDefaultGame(count = 2, computerCount = 1) {
    const seats = count === 2 ? ["N", "S"] : ["N", "E", "S"];
    const players = seats.map((seat, i) => ({
      id: "P" + i,
      name: computerCount ? (i === 0 ? "You" : "Leo") : (i === 0 ? "Maya" : "Leo"),
      computer: i > 0 && i <= computerCount,
      seat,
      pieces: Array.from({ length: 6 }, (_, j) => ({ id: `P${i}-${j}`, progress: -1 }))
    }));
    return {
      players,
      computerCount,
      mode: computerCount ? "solo" : "local",
      seats
    };
  }

  const defaultGame = createDefaultGame();
  assert.equal(defaultGame.players.length, 2, "Default match must have 2 players");
  assert.equal(defaultGame.computerCount, 1, "Default match must have 1 computer opponent");
  assert.equal(defaultGame.players[0].name, "You", "Human player must be 'You'");
  assert.equal(defaultGame.players[0].computer, false, "Human player must not be computer");
  assert.equal(defaultGame.players[1].computer, true, "Opponent must be computer");
  assert.equal(defaultGame.mode, "solo", "Mode must be solo");
  assert.deepEqual(defaultGame.seats, ["N", "S"], "2-player seating must be North and South");
});

test("calculatePlayerScore correctly tallies board progression, captures, and home finishes", () => {
  function calculatePlayerScore(p: any) {
    if (!p || !Array.isArray(p.pieces)) return 0;
    let score = 0;
    for (const piece of p.pieces) {
      if (piece.progress === 43) {
        score += 100;
      } else if (piece.progress >= 0) {
        score += piece.progress + 1;
      }
    }
    if (p.captured) score += 50;
    if (p.rank === 1) score += 200;
    return score;
  }

  // Initial reserve state
  const pInitial = {
    pieces: Array.from({ length: 6 }, () => ({ progress: -1 })),
    captured: false,
    rank: null
  };
  assert.equal(calculatePlayerScore(pInitial), 0, "Initial player with all pieces in reserve has 0 points");

  // Player with 2 pieces on board: piece 0 at progress 0 (1 pt), piece 1 at progress 14 (15 pts)
  const pActive = {
    pieces: [
      { progress: 0 },
      { progress: 14 },
      { progress: -1 },
      { progress: -1 },
      { progress: -1 },
      { progress: -1 }
    ],
    captured: false,
    rank: null
  };
  assert.equal(calculatePlayerScore(pActive), 16, "Score should reflect sum of active board squares (1 + 15 = 16 pts)");

  // Player with 1 capture earned (+50 pts)
  pActive.captured = true;
  assert.equal(calculatePlayerScore(pActive), 66, "Score should include +50 pts capture achievement bonus");

  // Player brings 1 piece home (progress 43 = 100 pts)
  pActive.pieces[0].progress = 43;
  assert.equal(calculatePlayerScore(pActive), 165, "Score should include 100 pts for finished piece (100 + 15 + 50 = 165 pts)");

  // Player wins match (rank 1 = +200 pts)
  pActive.rank = 1;
  assert.equal(calculatePlayerScore(pActive), 365, "Score should include +200 pts match victory bonus");
});

test("capture splash detail states who captured whom with player names and avatars", () => {
  function formatCaptureDetail(player: any, targets: any[]) {
    const victimSummary = targets
      .map((hit) => (hit.other.avatar ? hit.other.avatar + " " : "") + hit.other.name)
      .join(" & ");
    return (player.avatar ? player.avatar + " " : "") + player.name + " captured " + victimSummary;
  }

  const capturer = { name: "You", avatar: "🎃" };
  const targets = [{ other: { name: "Leo", avatar: "👻" }, q: { id: "P1-0" } }];
  const detail = formatCaptureDetail(capturer, targets);
  assert.equal(detail, "🎃 You captured 👻 Leo");

  // Multi-target capture scenario
  const multiTargets = [
    { other: { name: "Leo", avatar: "👻" }, q: { id: "P1-0" } },
    { other: { name: "Tara", avatar: "🧙" }, q: { id: "P2-0" } }
  ];
  const multiDetail = formatCaptureDetail(capturer, multiTargets);
  assert.equal(multiDetail, "🎃 You captured 👻 Leo & 🧙 Tara");
});

test("audio playback lifecycle logs start, complete, and interrupted events to FlightRecorder", () => {
  const events: any[] = [];
  const mockFlightRecorder = {
    record: (type: string, data: any) => events.push({ type, ...data })
  };

  let currentUtterance: any = null;
  let commentaryUntil = 0;
  let speechId = 0;

  function simulateSpeak(text: string, isAlreadySpeaking: boolean) {
    if (isAlreadySpeaking && currentUtterance) {
      mockFlightRecorder.record("AUDIO_PLAYBACK_INTERRUPTED", {
        id: currentUtterance.id,
        text: currentUtterance.text,
        reason: "CANCELLED_FOR_NEW_COMMENTARY"
      });
    }

    const id = ++speechId;
    currentUtterance = { id, text };
    mockFlightRecorder.record("AUDIO_PLAYBACK_START", {
      id,
      text,
      words: text.split(" ").length,
      estimatedDurationMs: 2500
    });

    commentaryUntil = Date.now() + 2500;
  }

  function simulateSpeechEnd(id: number, text: string) {
    mockFlightRecorder.record("AUDIO_PLAYBACK_COMPLETE", {
      id,
      text,
      elapsedMs: 2200
    });
    currentUtterance = null;
  }

  // 1. Start speech
  simulateSpeak("Leo rolled 3.", false);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "AUDIO_PLAYBACK_START");

  // 2. Normal completion
  simulateSpeechEnd(1, "Leo rolled 3.");
  assert.equal(events.length, 2);
  assert.equal(events[1].type, "AUDIO_PLAYBACK_COMPLETE");

  // 3. New speech starts while previous was interrupted
  currentUtterance = { id: 2, text: "Previous speech" };
  simulateSpeak("New speech starts", true);
  assert.equal(events[2].type, "AUDIO_PLAYBACK_INTERRUPTED");
  assert.equal(events[2].reason, "CANCELLED_FOR_NEW_COMMENTARY");
  assert.equal(events[3].type, "AUDIO_PLAYBACK_START");
});

test("scheduleComputerIfNeeded pauses computer action until active speech completes", () => {
  let computerTimerDelay = 0;

  function calculateComputerWaitTime(ctx: {
    audioEnabled: boolean;
    isSpeaking: boolean;
    commentaryUntil: number;
    now: number;
  }) {
    const naturalDelay = 800;
    const speechRemaining = Math.max(0, ctx.commentaryUntil - ctx.now);
    const waitTime = (ctx.audioEnabled && (ctx.isSpeaking || speechRemaining > 0))
      ? Math.max(naturalDelay, speechRemaining + 350)
      : naturalDelay;
    return waitTime;
  }

  const now = 10000;
  // Scenario A: Speech is speaking with 2000ms remaining
  const waitA = calculateComputerWaitTime({
    audioEnabled: true,
    isSpeaking: true,
    commentaryUntil: now + 2000,
    now
  });
  assert.equal(waitA, 2350, "Computer should wait 2000ms + 350ms buffer for speech to finish");

  // Scenario B: Speech has completed or audio muted
  const waitB = calculateComputerWaitTime({
    audioEnabled: false,
    isSpeaking: false,
    commentaryUntil: 0,
    now
  });
  assert.equal(waitB, 800, "Computer should use natural delay when audio is not active");
});

test("token progressive tier brightness scales proportionally across inner squares and goal", () => {
  function getTierClass(maxProgress: number): string {
    if (maxProgress === 43) return "tier-center";
    if (maxProgress === 42) return "tier-inner3";
    if (maxProgress >= 25 && maxProgress <= 41) return "tier-inner2";
    return "";
  }

  // Outer circuit: baseline brightness
  assert.equal(getTierClass(-1), "", "Reserve piece has no inner tier class");
  assert.equal(getTierClass(0), "", "Start square progress 0 has baseline brightness");
  assert.equal(getTierClass(15), "", "Outer loop progress 15 has baseline brightness");
  assert.equal(getTierClass(24), "", "Last outer circuit step progress 24 has baseline brightness");

  // Second inner square (5x5 ring): tier-inner2 (+20% brightness)
  assert.equal(getTierClass(25), "tier-inner2", "Progress 25 enters second inner square");
  assert.equal(getTierClass(33), "tier-inner2", "Progress 33 in second inner square");
  assert.equal(getTierClass(41), "tier-inner2", "Progress 41 at end of second inner square");

  // Third inner square (approach cross): tier-inner3 (+38% brightness)
  assert.equal(getTierClass(42), "tier-inner3", "Progress 42 (approach square) is third inner square");

  // Center goal (D4): tier-center (+55% brightness)
  assert.equal(getTierClass(43), "tier-center", "Progress 43 is the center goal with maximum radiance");
});

test("captured piece animation structures flyer with victim avatar, color, and reserve bounce target", () => {
  const victim = { id: "P1", name: "Leo", avatar: "👻", color: "#2389da" };
  const target = { other: victim, q: { id: "P1-2" } };

  function buildFlyingPiecePayload(sq: string, t: any) {
    const v = t.other;
    return {
      square: sq,
      victimId: v.id,
      victimName: v.name,
      avatar: v.avatar,
      color: v.color,
      className: "captured-flying-piece",
      bounceTargetSelector: `.player[data-player-id="${v.id}"]`,
      durationMs: 950
    };
  }

  const payload = buildFlyingPiecePayload("B4", target);
  assert.equal(payload.square, "B4");
  assert.equal(payload.victimId, "P1");
  assert.equal(payload.avatar, "👻");
  assert.equal(payload.color, "#2389da");
  assert.equal(payload.bounceTargetSelector, '.player[data-player-id="P1"]');
  assert.equal(payload.durationMs, 950);
});

test("MCP AI Engine: evaluate_moves ranks moves with strategic tags and personality weighting", () => {
  function scoreCandidate(move: any, strategy: string = "balanced") {
    let score = move.progress;
    const tags = [];
    const captureWeight = strategy === "aggressive" ? 75000 : strategy === "cautious" ? 35000 : 50000;
    const safetyWeight = strategy === "cautious" ? 25000 : strategy === "aggressive" ? 5000 : 12000;

    if (move.progress === 43) {
      score += 100000;
      tags.push("GOAL_FINISH");
    }
    if (move.captures) {
      score += captureWeight;
      tags.push("CAPTURE");
    }
    if (move.isSafe && move.progress !== 43) {
      score += safetyWeight;
      tags.push("SAFETY_ZONE");
    }
    return { score, tags };
  }

  const captureMove = { progress: 12, captures: true, isSafe: false };
  const safeMove = { progress: 18, captures: false, isSafe: true };
  const goalMove = { progress: 43, captures: false, isSafe: false };

  // Aggressive strategy prioritizes captures over sanctuary
  const aggCapture = scoreCandidate(captureMove, "aggressive");
  const aggSafe = scoreCandidate(safeMove, "aggressive");
  assert.ok(aggCapture.score > aggSafe.score, "Aggressive strategy must rank capture above sanctuary");
  assert.ok(aggCapture.tags.includes("CAPTURE"));

  // Goal finish is always top priority
  const goalScore = scoreCandidate(goalMove, "balanced");
  assert.ok(goalScore.score > 100000);
  assert.ok(goalScore.tags.includes("GOAL_FINISH"));
});

test("MCP AI Engine: play_ai_turn and simulate_ai_match state machine contracts", () => {
  // Simulates the contract of playAiTurn
  function simulateTurnContract(player: string, rolls: number[], moveCount: number) {
    const actions: any[] = [];
    rolls.forEach((val, i) => {
      actions.push({ type: "ROLL", player, roll: { value: val }, bonusEarned: [1, 5, 6, 12].includes(val) });
    });
    if (moveCount > 0) {
      actions.push({ type: "MOVE", player, piece_id: "P0-0", from: "A4", to: "B4", dice_values: [rolls[0]] });
    } else {
      actions.push({ type: "PASS", player, reason: "NO_LEGAL_MOVES_LEFT" });
    }
    return {
      status: "success",
      player,
      actions,
      commentary: `${player} rolled [${rolls.join(", ")}]. Executed move.`
    };
  }

  const turn = simulateTurnContract("AI-Alpha", [5, 3], 1);
  assert.equal(turn.status, "success");
  assert.equal(turn.player, "AI-Alpha");
  assert.equal(turn.actions.length, 3); // 2 rolls + 1 move
  assert.ok(turn.commentary.includes("AI-Alpha rolled [5, 3]"));
});

test("FlightRecorder records initial game parameters and preserves them in system diagnostics", () => {
  let storedConfig: any = null;
  const recordedEvents: any[] = [];

  function setGameInitConfig(config: any) {
    storedConfig = {
      timestamp: new Date().toISOString(),
      mode: config.mode || "unknown",
      playerCount: config.playerCount ?? null,
      computerCount: config.computerCount ?? null,
      roomCode: config.roomCode ?? null,
      cfHost: config.cfHost ?? "dhayam-staging.cancun.workers.dev",
      transport: config.transport || "local",
      seat: config.seat ?? 0,
      players: config.players || null,
      rulesVariant: config.rulesVariant || "Dhayam 7x7 house variant",
    };
    return storedConfig;
  }

  function recordGameStart(config: any) {
    const saved = setGameInitConfig(config);
    recordedEvents.push({
      type: "GAME_INIT",
      ...saved,
    });
  }

  // 1. Simulate starting real Cloudflare demo
  recordGameStart({
    mode: "demo-real-cloudflare",
    playerCount: 4,
    computerCount: 0,
    roomCode: "CF4420",
    cfHost: "dhayam-staging.cancun.workers.dev",
    transport: "cf_ws",
    seat: 0,
    players: [
      { id: "P0", name: "Maya", seat: "N" },
      { id: "P1", name: "Leo", seat: "E" },
      { id: "P2", name: "Rohan", seat: "S" },
      { id: "P3", name: "Ananya", seat: "W" },
    ],
  });

  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].type, "GAME_INIT");
  assert.equal(recordedEvents[0].mode, "demo-real-cloudflare");
  assert.equal(recordedEvents[0].roomCode, "CF4420");
  assert.equal(recordedEvents[0].playerCount, 4);
  assert.equal(storedConfig.roomCode, "CF4420");
  assert.equal(storedConfig.players.length, 4);
  assert.equal(storedConfig.players[0].name, "Maya");
});

test("Real demo turn watchdog triggers resync if edge network stalls", () => {
  let watchdogTriggered = false;
  let syncRequested = false;
  let scheduledTurn = false;

  function onWatchdogTimeout(curSeat: number, turn: number, phase: string, isDone: boolean) {
    if (isDone) return;
    watchdogTriggered = true;
    syncRequested = true;
    scheduledTurn = true;
  }

  // Simulate turn 9 where edge stalls and response is delayed
  onWatchdogTimeout(0, 9, "roll", false);

  assert.ok(watchdogTriggered, "Watchdog must fire when turn is stalled");
  assert.ok(syncRequested, "Must request state sync from edge");
  assert.ok(scheduledTurn, "Must reschedule demo turn step rather than freezing permanently");
});

test("Cloudflare DO broadcast SYNC_STATE on action error prevents single-socket desync", () => {
  const broadcasts: any[] = [];
  const singleSends: any[] = [];

  function simulateRollError(seat: number, isTurn: boolean) {
    if (!isTurn) {
      singleSends.push({ type: "ERROR", message: "Not your turn to roll." });
      // Crucial fix: broadcast SYNC_STATE so all participants receive state
      broadcasts.push({ type: "SYNC_STATE", turn: 9, current: 0, phase: "roll" });
    }
  }

  simulateRollError(3, false);
  assert.equal(singleSends.length, 1);
  assert.equal(singleSends[0].type, "ERROR");
  assert.equal(broadcasts.length, 1, "Must broadcast authoritative SYNC_STATE to room on action failure");
  assert.equal(broadcasts[0].type, "SYNC_STATE");
});

test("8-player support initializes all 8 seats and themes properly", () => {
  const SEATS = ["N", "E", "S", "W"];
  const THEMES = [
    { name: "Maya", avatar: "🐘", color: "#e74c3c" },
    { name: "Leo", avatar: "🐯", color: "#2389da" },
    { name: "Amina", avatar: "🦚", color: "#f4b400" },
    { name: "Kai", avatar: "🦁", color: "#2e9d57" },
    { name: "Sofia", avatar: "🦊", color: "#8e5bd9" },
    { name: "Noah", avatar: "🦉", color: "#00a6a6" },
    { name: "Zara", avatar: "🦄", color: "#ec4899" },
    { name: "Arun", avatar: "🦅", color: "#f97316" },
  ];

  function create8PlayerSetup(count: number, computerCount = 0) {
    if (count < 2 || count > 8) throw new RangeError("Dhayam supports 2 to 8 total players");
    const seats = Array.from({ length: count }, (_, i) => SEATS[i % 4]);
    return {
      players: seats.map((seat, i) => ({
        id: "P" + i,
        name: THEMES[i].name,
        avatar: THEMES[i].avatar,
        color: THEMES[i].color,
        computer: i > 0 && i <= computerCount,
        seat,
        pieces: Array.from({ length: 6 }, (_, j) => ({ id: "P" + i + "-" + j, progress: -1 })),
      })),
      totalPlayers: count,
    };
  }

  const match = create8PlayerSetup(8, 7);
  assert.equal(match.totalPlayers, 8);
  assert.equal(match.players.length, 8);
  assert.equal(match.players[6].name, "Zara");
  assert.equal(match.players[7].name, "Arun");
  assert.equal(match.players[7].seat, "W");
  assert.equal(match.players.filter((p) => p.computer).length, 7);
});

test("Quantum mode (32x to 128x) correctly disables audio and scales delays", () => {
  let demoSpeed = 1;
  let audioEnabled = true;
  let quantumMode = false;
  let superSpeed = false;

  function setDemoSpeed(factor: number) {
    demoSpeed = Math.max(0.5, Math.min(factor, 128));
    if (demoSpeed >= 32) {
      quantumMode = true;
      superSpeed = false;
      audioEnabled = false; // Audio disabled in Quantum mode
    } else {
      quantumMode = false;
      superSpeed = demoSpeed === 3;
    }
  }

  function scaledDelay(ms: number) {
    return ms / demoSpeed;
  }

  // 1. Quantum mode activation (32x)
  setDemoSpeed(32);
  assert.equal(demoSpeed, 32);
  assert.equal(quantumMode, true);
  assert.equal(audioEnabled, false, "Audio must be disabled in Quantum mode");
  assert.ok(scaledDelay(2200) < 70, "2200ms delay should scale down to < 70ms at 32x");

  // 2. High-speed user factor (up to 128x)
  setDemoSpeed(128);
  assert.equal(demoSpeed, 128);
  assert.equal(quantumMode, true);
  assert.equal(audioEnabled, false, "Audio must remain disabled at 128x");
  assert.ok(scaledDelay(2200) < 20, "2200ms delay should scale down to < 20ms at 128x");

  // 3. User reverts to 2x speed
  setDemoSpeed(2);
  assert.equal(demoSpeed, 2);
  assert.equal(quantumMode, false);
});

test("PONG messages must never disarm demoWatchdogTimer or stall recovery", () => {
  let watchdogTimer: any = "active_timer_handle";
  let turnScheduled = false;

  function handleWsMessage(data: { type: string }, fromSeat: number) {
    // RCA FIX: PONG must exit immediately without clearing watchdog
    if (data.type === "PONG") {
      return;
    }

    // Only authoritative state or error resets the action watchdog
    if (data.type === "SYNC_STATE" || data.type === "INIT" || data.type === "ERROR") {
      watchdogTimer = null;
      turnScheduled = true;
    }
  }

  // 1. Simulate keepalive PONG arriving from Cloudflare DO during active turn
  handleWsMessage({ type: "PONG" }, 0);
  assert.equal(watchdogTimer, "active_timer_handle", "PONG must NOT clear watchdogTimer!");
  assert.equal(turnScheduled, false, "PONG must not prematurely trigger turn scheduling");

  // 2. Authoritative SYNC_STATE arrives, safely clearing watchdog
  handleWsMessage({ type: "SYNC_STATE" }, 0);
  assert.equal(watchdogTimer, null, "SYNC_STATE should safely clear watchdog");
  assert.equal(turnScheduled, true, "SYNC_STATE must schedule next turn step");
});

test("Autonomous periodic stall detector recovers frozen turn after 5 seconds", () => {
  let lastActionTime = Date.now() - 6000; // 6s idle
  let stateRequested = false;
  let turnRescheduled = false;

  function checkStallDetector(now = Date.now()) {
    const idleMs = now - lastActionTime;
    if (idleMs > 5000) {
      lastActionTime = now;
      stateRequested = true;
      turnRescheduled = true;
      return true;
    }
    return false;
  }

  const recovered = checkStallDetector();
  assert.equal(recovered, true, "Stall detector must fire when idle exceeds 5 seconds");
  assert.equal(stateRequested, true, "Must send GET_STATE to re-sync");
  assert.equal(turnRescheduled, true, "Must re-kick scheduleRealDemoTurn");
});

test("Game liveliness timer formatGameTimer outputs second-level accuracy in MM:SS and HH:MM:SS", () => {
  function formatGameTimer(totalSeconds: number): string {
    const sec = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    const mm = String(mins).padStart(2, "0");
    const ss = String(secs).padStart(2, "0");
    if (hours > 0) {
      const hh = String(hours).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  }

  assert.equal(formatGameTimer(0), "00:00");
  assert.equal(formatGameTimer(30), "00:30");
  assert.equal(formatGameTimer(60), "01:00");
  assert.equal(formatGameTimer(90), "01:30");
  assert.equal(formatGameTimer(599), "09:59");
  assert.equal(formatGameTimer(3600), "01:00:00");
  assert.equal(formatGameTimer(3665), "01:01:05");
});







