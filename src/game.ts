export type Seat = "N" | "E" | "S" | "W";

export type Piece = {
  id: string;
  progress: number;
};

export type Player = {
  id: string;
  name: string;
  seat: Seat;
  captured: boolean;
  rank: number | null;
  pieces: Piece[];
};

export type Game = {
  players: Player[];
  current: number;
  phase: "roll" | "move" | "done";
  pool: number[];
  turn: number;
  finished: number;
};

export type Capture = {
  playerId: string;
  pieceId: string;
};

export type Move = {
  pieceId: string;
  indices: number[];
  values: number[];
  progress: number;
  captured: boolean;
  captures: Capture[];
};

export const SEATS: readonly Seat[] = ["N", "E", "S", "W"];
export const SAFE_SQUARES = new Set([
  "A4",
  "B2",
  "B6",
  "D1",
  "D7",
  "F2",
  "F6",
  "G4",
]);
export const GOAL = "D4";
export const FINISH_PROGRESS = 43;
export const BONUS_VALUES = new Set([1, 5, 6, 12]);

const OUTER = [
  "A4",
  "A5",
  "A6",
  "A7",
  "B7",
  "C7",
  "D7",
  "E7",
  "F7",
  "G7",
  "G6",
  "G5",
  "G4",
  "G3",
  "G2",
  "G1",
  "F1",
  "E1",
  "D1",
  "C1",
  "B1",
  "A1",
  "A2",
  "A3",
];
const INNER = [
  "B4",
  "B3",
  "B2",
  "C2",
  "D2",
  "E2",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "E6",
  "D6",
  "C6",
  "B6",
  "B5",
];
const APPROACH: Record<Seat, string> = { N: "C4", E: "D5", S: "E4", W: "D3" };
const NAMES = ["Maya", "Leo", "Amina", "Kai", "Sofia", "Noah"];

// The board stores one north-facing route. Rotating it gives every seat the
// same movement length and rules without duplicating four coordinate lists.
export function rotate(coordinate: string, turns: number): string {
  let row = coordinate.charCodeAt(0) - 65;
  let column = Number(coordinate[1]) - 1;
  for (let index = 0; index < turns; index += 1) {
    [row, column] = [column, 6 - row];
  }
  return `${String.fromCharCode(65 + row)}${column + 1}`;
}

export function routeFor(seat: Seat): string[] {
  const turns = SEATS.indexOf(seat);
  const outer = OUTER.map((coordinate) => rotate(coordinate, turns));
  const inner = INNER.map((coordinate) => rotate(coordinate, turns));
  return [...outer, outer[0], ...inner, inner[0], APPROACH[seat], GOAL];
}

export const ROUTES: Record<Seat, string[]> = Object.fromEntries(
  SEATS.map((seat) => [seat, routeFor(seat)]),
) as Record<Seat, string[]>;

export function createGame(playerCount = 4): Game {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 6) {
    throw new RangeError("Dhayam requires 2 to 6 players");
  }
  const seats: Seat[] =
    playerCount === 2
      ? ["N", "S"]
      : playerCount === 3
        ? ["N", "E", "S"]
        : Array.from(
            { length: playerCount },
            (_, index) => SEATS[index % SEATS.length],
          );
  return {
    players: seats.map((seat, playerIndex) => ({
      id: `P${playerIndex}`,
      name: NAMES[playerIndex] ?? `Player ${playerIndex + 1}`,
      seat,
      captured: false,
      rank: null,
      pieces: Array.from({ length: 6 }, (_, pieceIndex) => ({
        id: `P${playerIndex}-${pieceIndex}`,
        progress: -1,
      })),
    })),
    current: 0,
    phase: "roll",
    pool: [],
    turn: 1,
    finished: 0,
  };
}

export function squareFor(player: Player, piece: Piece): string | null {
  return piece.progress < 0 ? null : ROUTES[player.seat][piece.progress];
}

export function diceValue(firstFace: number, secondFace: number): number {
  if (
    ![firstFace, secondFace].every(
      (face) => Number.isInteger(face) && face >= 0 && face <= 3,
    )
  ) {
    throw new RangeError("Dayakattai faces must be integers from 0 through 3");
  }
  return firstFace === 0 && secondFace === 0 ? 12 : firstFace + secondFace;
}

function findPiece(
  game: Game,
  pieceId: string,
): { player: Player; piece: Piece } | null {
  for (const player of game.players) {
    const piece = player.pieces.find((candidate) => candidate.id === pieceId);
    if (piece) return { player, piece };
  }
  return null;
}

export function evaluateMove(
  game: Game,
  pieceId: string,
  values: number[],
  indices: number[] = [],
): Move | null {
  // Apply roll values sequentially to a temporary position. A capture made by
  // an earlier value can unlock the inner track for a later value in one move.
  if (
    game.phase !== "move" ||
    values.length === 0 ||
    values.some((value) => !Number.isInteger(value) || value < 1)
  )
    return null;
  const found = findPiece(game, pieceId);
  const activePlayer = game.players[game.current];
  if (!found || found.player !== activePlayer) return null;

  let progress = found.piece.progress;
  let captured = activePlayer.captured;
  const captures: Capture[] = [];

  for (const value of values) {
    if (progress === FINISH_PROGRESS) return null;
    if (progress === -1) {
      if (value !== 1) return null;
      progress = 0;
    } else {
      const next = progress + value;
      if (next > FINISH_PROGRESS || (next >= 25 && !captured)) return null;
      progress = next;
    }

    const square = ROUTES[activePlayer.seat][progress];
    const enemies = game.players
      .flatMap((player) =>
        player === activePlayer
          ? []
          : player.pieces
              .filter(
                (piece) =>
                  piece.progress >= 0 &&
                  piece.progress < FINISH_PROGRESS &&
                  squareFor(player, piece) === square,
              )
              .map((piece) => ({ playerId: player.id, pieceId: piece.id })),
      )
      .filter(
        (enemy) =>
          !captures.some((capture) => capture.pieceId === enemy.pieceId),
      );

    if (!SAFE_SQUARES.has(square) && square !== GOAL) {
      if (enemies.length > 1) return null;
      if (enemies.length === 1) {
        captured = true;
        captures.push(enemies[0]);
      }
    }
  }

  return { pieceId, indices, values, progress, captured, captures };
}

export function legalMoves(game: Game): Move[] {
  // A turn may spend one stored roll or combine the whole pool in roll order.
  if (game.phase !== "move") return [];
  const allocations = game.pool.map((value, index) => ({
    indices: [index],
    values: [value],
  }));
  if (game.pool.length > 1 && game.pool.length <= 12) {
    allocations.push({
      indices: game.pool.map((_, index) => index),
      values: [...game.pool],
    });
  }
  return game.players[game.current].pieces.flatMap((piece) =>
    allocations.flatMap((allocation) => {
      const move = evaluateMove(
        game,
        piece.id,
        allocation.values,
        allocation.indices,
      );
      return move ? [move] : [];
    }),
  );
}

export function applyMove(game: Game, move: Move): Game {
  const legal = legalMoves(game).find(
    (candidate) =>
      candidate.pieceId === move.pieceId &&
      candidate.indices.length === move.indices.length &&
      candidate.indices.every(
        (index, position) => index === move.indices[position],
      ),
  );
  if (!legal) throw new Error("Cannot apply an illegal move");

  const next = structuredClone(game);
  const activePlayer = next.players[next.current];
  const piece = activePlayer.pieces.find(
    (candidate) => candidate.id === legal.pieceId,
  )!;
  piece.progress = legal.progress;
  activePlayer.captured = legal.captured;
  for (const capture of legal.captures) {
    const target = findPiece(next, capture.pieceId);
    if (target) target.piece.progress = -1;
  }
  next.pool = next.pool.filter((_, index) => !legal.indices.includes(index));
  return next;
}
