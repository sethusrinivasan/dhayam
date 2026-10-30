import assert from "node:assert/strict";
import test from "node:test";
import {
  FINISH_PROGRESS,
  ROUTES,
  applyMove,
  createGame,
  diceValue,
  evaluateMove,
  legalMoves,
  routeFor,
  squareFor,
} from "../src/game.ts";

test("creates the supported seating arrangements", () => {
  assert.deepEqual(
    createGame(2).players.map((player) => player.seat),
    ["N", "S"],
  );
  assert.deepEqual(
    createGame(3).players.map((player) => player.seat),
    ["N", "E", "S"],
  );
  assert.deepEqual(
    createGame(4).players.map((player) => player.seat),
    ["N", "E", "S", "W"],
  );
  assert.deepEqual(
    createGame(6).players.map((player) => player.seat),
    ["N", "E", "S", "W", "N", "E"],
  );
  assert.throws(() => createGame(1), RangeError);
});

test("builds a 44-position rotationally symmetric route for each seat", () => {
  for (const seat of ["N", "E", "S", "W"] as const) {
    const route = routeFor(seat);
    assert.equal(route.length, 44);
    assert.equal(route[43], "D4");
    assert.deepEqual(route, ROUTES[seat]);
  }
  assert.equal(ROUTES.N[0], "A4");
  assert.equal(ROUTES.E[0], "D7");
  assert.equal(ROUTES.S[0], "G4");
  assert.equal(ROUTES.W[0], "D1");
});

test("maps the double-zero dice result to 12", () => {
  assert.equal(diceValue(0, 0), 12);
  assert.equal(diceValue(2, 3), 5);
  assert.throws(() => diceValue(4, 0), RangeError);
});

test("requires a one to enter a reserved piece", () => {
  const game = createGame(2);
  game.phase = "move";
  game.pool = [1, 2];
  assert.equal(evaluateMove(game, "P0-0", [2]), null);
  assert.equal(evaluateMove(game, "P0-0", [1])?.progress, 0);
  assert.equal(
    legalMoves(game).filter((move) => move.values.length === 1).length,
    6,
  );
});

test("requires a capture before entering the inner track", () => {
  const game = createGame(2);
  game.phase = "move";
  game.pool = [1];
  game.players[0].pieces[0].progress = 24;
  assert.equal(evaluateMove(game, "P0-0", [1]), null);
  game.players[0].captured = true;
  assert.equal(evaluateMove(game, "P0-0", [1])?.progress, 25);
});

test("captures one opponent on an unsafe square", () => {
  const game = createGame(2);
  game.phase = "move";
  game.pool = [1];
  game.players[0].pieces[0].progress = 0;
  game.players[1].pieces[0].progress = 13;
  assert.equal(squareFor(game.players[0], game.players[0].pieces[0]), "A4");
  assert.equal(squareFor(game.players[1], game.players[1].pieces[0]), "A5");

  const move = evaluateMove(game, "P0-0", [1], [0]);
  assert.deepEqual(move?.captures, [{ playerId: "P1", pieceId: "P1-0" }]);
  const next = applyMove(game, move!);
  assert.equal(next.players[0].captured, true);
  assert.equal(next.players[1].pieces[0].progress, -1);
  assert.equal(
    game.players[1].pieces[0].progress,
    13,
    "the input state remains unchanged",
  );
});

test("does not capture opponents on safe squares", () => {
  const game = createGame(2);
  game.phase = "move";
  game.players[0].pieces[0].progress = 23;
  game.players[1].pieces[0].progress = 12;
  const move = evaluateMove(game, "P0-0", [1]);
  assert.equal(ROUTES.N[24], "A4");
  assert.deepEqual(move?.captures, []);
});

test("rejects a landing occupied by multiple opponents on an unsafe square", () => {
  const game = createGame(2);
  game.phase = "move";
  game.players[0].pieces[0].progress = 0;
  game.players[1].pieces[0].progress = 13;
  game.players[1].pieces[1].progress = 13;
  assert.equal(evaluateMove(game, "P0-0", [1]), null);
});

test("requires an exact roll to finish", () => {
  const game = createGame(2);
  game.phase = "move";
  game.players[0].captured = true;
  game.players[0].pieces[0].progress = 42;
  assert.equal(evaluateMove(game, "P0-0", [2]), null);
  assert.equal(evaluateMove(game, "P0-0", [1])?.progress, FINISH_PROGRESS);
});

test("offers single rolls and all remaining rolls in order", () => {
  const game = createGame(2);
  game.phase = "move";
  game.pool = [1, 2];
  const pieceMoves = legalMoves(game).filter((move) => move.pieceId === "P0-0");
  assert.deepEqual(
    pieceMoves.map((move) => move.values),
    [[1], [1, 2]],
  );
  assert.equal(pieceMoves[1].progress, 2);
});

test("uses an earlier capture in a combined move to unlock the inner track", () => {
  const game = createGame(2);
  game.phase = "move";
  game.pool = [1, 3];
  game.players[0].pieces[0].progress = 21;

  const captureSquare = ROUTES.N[22];
  game.players[1].pieces[0].progress = ROUTES.S.indexOf(captureSquare);

  const move = evaluateMove(game, "P0-0", [1, 3], [0, 1]);
  assert.equal(move?.progress, 25);
  assert.equal(move?.captured, true);
  assert.deepEqual(move?.captures, [{ playerId: "P1", pieceId: "P1-0" }]);
});

test("applyMove consumes only the selected rolls and rejects forged moves", () => {
  const game = createGame(2);
  game.phase = "move";
  game.pool = [1, 2];

  const combined = evaluateMove(game, "P0-0", [1, 2], [0, 1]);
  const next = applyMove(game, combined!);
  assert.equal(next.players[0].pieces[0].progress, 2);
  assert.deepEqual(next.pool, []);
  assert.equal(game.players[0].pieces[0].progress, -1);
  assert.deepEqual(game.pool, [1, 2]);

  assert.throws(
    () =>
      applyMove(game, {
        ...combined!,
        pieceId: "P1-0",
      }),
    /Cannot apply an illegal move/,
  );
});

test("does not offer moves outside the move phase or for the other player", () => {
  const game = createGame(2);
  assert.deepEqual(legalMoves(game), []);
  game.phase = "move";
  game.pool = [1];
  assert.equal(evaluateMove(game, "P1-0", [1]), null);
});
