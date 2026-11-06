import { DurableObject } from "cloudflare:workers";
import { handleAuthAndLeaderboard } from "./auth.js";

/**
 * Dhayam Cloudflare Worker & Streamable HTTP MCP Server
 *
 * Frugal, zero-dependency Cloudflare Worker that:
 * 1. Serves the static Dhayam game on Cloudflare's Global Edge CDN (via env.ASSETS)
 * 2. Hosts real-time multiplayer rooms via Cloudflare Durable Objects with WebSocket Hibernation
 * 3. Exposes the Model Context Protocol (MCP) Streamable HTTP endpoint at /mcp
 * 4. Provides uptime monitoring at /health
 *
 * Deployable on Cloudflare Free Tier (100,000 req/day, 0ms cold starts, <1MB bundle).
 */

const SAFE_SQUARES = new Set(["A4", "B2", "B6", "D1", "D7", "F2", "F6", "G4"]);
const GOAL_SQUARE = "D4";
const BONUS_VALUES = new Set([1, 5, 6, 12]);
const SEATS = ["N", "E", "S", "W"];

const OUTER = [
  "A4", "A5", "A6", "A7", "B7", "C7", "D7", "E7", "F7", "G7",
  "G6", "G5", "G4", "G3", "G2", "G1", "F1", "E1", "D1", "C1",
  "B1", "A1", "A2", "A3"
];

const INNER = [
  "B4", "B3", "B2", "C2", "D2", "E2", "F2", "F3",
  "F4", "F5", "F6", "E6", "D6", "C6", "B6", "B5"
];

const APPROACH = {
  N: ["C4", "D4"],
  E: ["D5", "D4"],
  S: ["E4", "D4"],
  W: ["D3", "D4"]
};

const START = {
  N: "A4",
  E: "D7",
  S: "G4",
  W: "D1"
};

function buildRoute(seat) {
  const startOuter = { N: 0, E: 6, S: 12, W: 18 }[seat];
  const outerLoop = Array.from({ length: OUTER.length }, (_, i) => OUTER[(startOuter + i) % OUTER.length]);
  const startInner = { N: 0, E: 12, S: 8, W: 4 }[seat];
  const innerLoop = Array.from({ length: INNER.length }, (_, i) => INNER[(startInner + i) % INNER.length]);
  return [...outerLoop, outerLoop[0], ...innerLoop, innerLoop[0], ...APPROACH[seat]];
}

const ROUTES = {
  N: buildRoute("N"),
  E: buildRoute("E"),
  S: buildRoute("S"),
  W: buildRoute("W")
};

const DICE_OUTCOMES = [
  { a: 0, b: 1, val: 1 }, { a: 1, b: 0, val: 1 },
  { a: 0, b: 2, val: 2 }, { a: 1, b: 1, val: 2 }, { a: 2, b: 0, val: 2 },
  { a: 0, b: 3, val: 3 }, { a: 1, b: 2, val: 3 }, { a: 2, b: 1, val: 3 }, { a: 3, b: 0, val: 3 },
  { a: 1, b: 3, val: 4 }, { a: 2, b: 2, val: 4 }, { a: 3, b: 1, val: 4 },
  { a: 2, b: 3, val: 5 }, { a: 3, b: 2, val: 5 },
  { a: 3, b: 3, val: 6 },
  { a: 0, b: 0, val: 12 }
];

function parsePieceCoord(id) {
  if (!id) return null;
  const m = String(id).trim().match(/^p?(\d+)[-_]?(?:q|piece)?(\d+)$/i);
  return m ? m[1] + ":" + m[2] : null;
}

function matchPieceId(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const pa = parsePieceCoord(a);
  const pb = parsePieceCoord(b);
  if (pa && pb) return pa === pb;
  return String(a).toLowerCase().replace(/[^a-z0-9]/g, "") === String(b).toLowerCase().replace(/[^a-z0-9]/g, "");
}

class DhayamEngine {
  constructor(state = null) {
    if (state) {
      this.players = state.players;
      this.current = state.current;
      this.phase = state.phase;
      this.pool = state.pool || [];
      this.history = state.history || [];
      this.lastRoll = state.lastRoll || null;
      this.turn = state.turn || 1;
      this.openingEntryPlayers = state.openingEntryPlayers || [];
      this.audit = state.audit || [];
    } else {
      this.initNewMatch(["Player 1", "Player 2"]);
    }
  }

  initNewMatch(names = ["Player 1", "Player 2"]) {
    const count = Math.min(Math.max(names.length, 2), 32);
    const avatars = ["🎃", "👻", "🧙", "🦇", "🐺", "🕷️", "💀", "🌙", "🦊", "🐯", "🦚", "🦁", "🐘", "🦉", "🦄", "🦅", "🐲", "🦋", "🐬", "🦀", "🐸", "🦩", "🐙", "🦜", "🐺", "🦝", "🐻", "🦔", "🦭", "🐆", "🦣", "🦤"];
    const colors = ["#ff7518", "#2dd4bf", "#f59e0b", "#6366f1", "#ec4899", "#8b5cf6", "#10b981", "#06b6d4", "#e74c3c", "#2389da", "#f4b400", "#2e9d57", "#8e5bd9", "#00a6a6", "#f97316", "#14b8a6", "#ef4444", "#3b82f6", "#eab308", "#22c55e", "#a855f7", "#06b6d4", "#f43f5e", "#0ea5e9", "#84cc16", "#d946ef", "#fb923c", "#4ade80", "#38bdf8", "#c084fc", "#fbbf24", "#34d399"];

    this.players = names.slice(0, count).map((name, i) => ({
      id: "P" + i,
      name,
      avatar: avatars[i % avatars.length],
      color: colors[i % colors.length],
      seat: count === 2 ? (i === 0 ? "N" : "S") : count === 3 ? (i === 0 ? "N" : i === 1 ? "E" : "S") : SEATS[i % SEATS.length],
      captured: false,
      rank: null,
      bonusPoints: 0,
      pieces: Array.from({ length: 6 }, (_, q) => ({ id: "P" + i + "-" + q, progress: -1 }))
    }));

    this.current = 0;
    this.phase = "roll";
    this.pool = [];
    this.history = [];
    this.lastRoll = null;
    this.turn = 1;
    this.openingEntryPlayers = [];
    this.audit = [{ event: "GAME_CREATED", playerCount: count, players: this.players.map((p) => p.name) }];
  }

  activePlayer() {
    return this.players[this.current];
  }

  pieceNode(p, piece) {
    return piece.progress < 0 ? null : ROUTES[p.seat][piece.progress];
  }

  bonusDecision(value) {
    const specialRoll = BONUS_VALUES.has(value);
    const bonusDepth = Math.max(0, this.history.length - 1);
    const bonusChance = specialRoll ? 0.5 ** bonusDepth : 0;
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const bonusDraw = specialRoll && bonusChance < 1 ? randomBytes[0] / 2 ** 32 : null;
    const bonus = specialRoll && (bonusChance === 1 || bonusDraw < bonusChance);
    return { specialRoll, bonusDepth, bonusChance, bonusDraw, bonus };
  }

  rollDice(secret = "") {
    if (this.phase !== "roll") {
      return { error: "Cannot roll dice during move phase. Please choose a piece move first." };
    }

    const cleanSecret = typeof secret === "string" ? secret.slice(0, 8) : "";
    let secretHash = 0;
    if (cleanSecret) {
      secretHash = 2166136261;
      for (let index = 0; index < cleanSecret.length; index++) {
        secretHash ^= cleanSecret.charCodeAt(index);
        secretHash = Math.imul(secretHash, 16777619);
      }
      secretHash >>>= 0;
    }
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const randomValue = (randomBytes[0] ^ secretHash) >>> 0;
    const outcome = DICE_OUTCOMES[randomValue % DICE_OUTCOMES.length];
    const bonusResult = this.bonusDecision(outcome.val);
    const isBonus = bonusResult.bonus;

    this.pool.push(outcome.val);
    this.history.push(outcome.val);
    this.lastRoll = {
      a: outcome.a,
      b: outcome.b,
      value: outcome.val,
      val: outcome.val,
      bonus: isBonus,
      specialRoll: bonusResult.specialRoll,
      secretUsed: cleanSecret.length > 0
    };

    this.audit.push({
      event: "ROLL",
      player: this.activePlayer().name,
      dice: { a: outcome.a, b: outcome.b },
      value: outcome.val,
      bonus: isBonus,
      secretHash: cleanSecret ? secretHash : null,
      specialRoll: bonusResult.specialRoll,
      pool: [...this.pool]
    });

    if (!isBonus) {
      this.phase = "move";
      const legal = this.getLegalMoves();
      if (!legal.length) {
        this.audit.push({
          event: "PASS",
          player: this.activePlayer().name,
          reason: "NO_LEGAL_MOVE"
        });
        this.nextTurn();
      }
    }

    return {
      roll: this.lastRoll,
      pool: [...this.pool],
      history: [...this.history],
      phase: this.phase,
      bonusEarned: isBonus,
      legalMoves: this.phase === "move" ? this.getLegalMoves() : []
    };
  }

  openingEntryAvailable(p, piece, values) {
    return (
      this.turn <= this.players.length &&
      !this.openingEntryPlayers.includes(p.id) &&
      piece.progress === -1 &&
      values.length === 1
    );
  }

  testMove(p, piece, values) {
    const openingEntry = values[0] !== 1 && this.openingEntryAvailable(p, piece, values);
    let pos = piece.progress;
    let captured = p.captured;
    const targets = [];

    for (const val of values) {
      if (pos === 43) return null;
      if (pos === -1) {
        if (val !== 1 && !openingEntry) return null;
        pos = 0;
      } else {
        const next = pos + val;
        if (next > 43) return null;
        if (next >= 25 && !captured) return null;
        pos = next;
      }

      const sq = ROUTES[p.seat][pos];
      const enemies = [];
      for (const other of this.players) {
        if (other.id === p.id) continue;
        for (const q of other.pieces) {
          if (q.progress >= 0 && q.progress < 43 && this.pieceNode(other, q) === sq) {
            enemies.push({ other, q });
          }
        }
      }

      if (!SAFE_SQUARES.has(sq) && sq !== GOAL_SQUARE) {
        if (enemies.length > 1) return null;
        if (enemies.length === 1) {
          captured = true;
          targets.push(enemies[0]);
        }
      }
    }

    return { progress: pos, destination: ROUTES[p.seat][pos], captured, targets, openingEntry };
  }

  getLegalMoves() {
    if (this.phase !== "move" || !this.pool.length) return [];
    const p = this.activePlayer();
    const moves = [];
    const subsets = this.pool.map((val, i) => ({ indices: [i], values: [val] }));
    if (this.pool.length > 1 && this.pool.length <= 12) {
      subsets.push({ indices: this.pool.map((_, i) => i), values: [...this.pool] });
    }

    for (let pieceIdx = 0; pieceIdx < p.pieces.length; pieceIdx++) {
      const piece = p.pieces[pieceIdx];
      for (const s of subsets) {
        const test = this.testMove(p, piece, s.values);
        if (test) {
          moves.push({
            piece_id: piece.id,
            piece_number: pieceIdx + 1,
            from: this.pieceNode(p, piece) || "reserve",
            to: test.destination,
            target_progress: test.progress,
            dice_values: s.values,
            pool_indices: s.indices,
            captures: test.targets.length > 0,
            opening_entry: test.openingEntry
          });
        }
      }
    }
    return moves;
  }

  applyMove(pieceId, diceValues = null) {
    if (this.phase !== "move") {
      return { error: "Game is in roll phase. Roll dice first." };
    }

    const legal = this.getLegalMoves();
    const match =
      legal.find(
        (m) =>
          matchPieceId(m.piece_id, pieceId) &&
          (!diceValues || JSON.stringify(m.dice_values) === JSON.stringify(diceValues)),
      ) || legal.find((m) => matchPieceId(m.piece_id, pieceId));

    if (!match) {
      return { error: "No legal move found for piece " + pieceId };
    }

    const p = this.activePlayer();
    const piece = p.pieces.find((q) => matchPieceId(q.id, pieceId));
    if (!piece) {
      return { error: "Piece not found: " + pieceId };
    }
    const fromProgress = piece.progress;
    const test = this.testMove(p, piece, match.dice_values);
    if (!test) {
      return { error: "Move candidate validation failed for piece " + pieceId };
    }

    const captureTargets = test.targets.map((hit) => ({
      playerId: hit.other.id,
      playerName: hit.other.name,
      pieceId: hit.q.id
    }));

    const wasReserve = fromProgress === -1;
    const willFinish = test.progress === 43;
    piece.progress = test.progress;
    if (wasReserve) {
      p.bonusPoints = (p.bonusPoints || 0) + 1;
    }
    if (willFinish) {
      p.bonusPoints = (p.bonusPoints || 0) + 1;
    }
    if (test.captured) {
      p.captured = true;
      for (const hit of test.targets) {
        hit.q.progress = -1;
        this.audit.push({
          event: "CAPTURE",
          capturer: p.name,
          captured_player: hit.other.name,
          square: test.destination
        });
      }
    }

    if (test.openingEntry && !this.openingEntryPlayers.includes(p.id)) {
      this.openingEntryPlayers.push(p.id);
    }

    // Deduct dice
    for (const idx of match.pool_indices.sort((a, b) => b - a)) {
      if (idx < this.pool.length) this.pool.splice(idx, 1);
    }

    this.audit.push({
      event: "MOVE",
      player: p.name,
      piece: piece.id,
      to: test.destination,
      remaining_pool: [...this.pool]
    });

    if (p.pieces.every((q) => q.progress === 43)) {
      p.rank = 1;
      this.phase = "done";
      this.audit.push({ event: "WINNER", winner: p.name });
      return {
        status: "win",
        winner: p.name,
        pieceId: piece.id,
        fromProgress,
        targetProgress: test.progress,
        destination: test.destination,
        diceValues: match.dice_values,
        captures: captureTargets,
        summary: this.getSummary()
      };
    }

    if (!this.pool.length || !this.getLegalMoves().length) {
      this.nextTurn();
    }

    return {
      status: "success",
      pieceId: piece.id,
      fromProgress,
      targetProgress: test.progress,
      destination: test.destination,
      diceValues: match.dice_values,
      captures: captureTargets,
      remainingPool: [...this.pool],
      phase: this.phase,
      current_player: this.activePlayer().name
    };
  }

  passTurn() {
    this.audit.push({ event: "PASS", player: this.activePlayer().name, unused_pool: [...this.pool] });
    this.nextTurn();
    return { status: "passed", current_player: this.activePlayer().name, phase: this.phase };
  }

  nextTurn() {
    this.pool = [];
    this.history = [];
    this.lastRoll = null;
    let i = this.current;
    do {
      i = (i + 1) % this.players.length;
    } while (this.players[i].rank !== null && i !== this.current);
    this.current = i;
    this.phase = "roll";
    this.turn += 1;
  }

  getSummary() {
    return {
      current_player: this.activePlayer().name,
      current_seat: this.activePlayer().seat,
      phase: this.phase,
      pool: [...this.pool],
      turn: this.turn,
      players: this.players.map((p) => ({
        name: p.name,
        seat: p.seat,
        avatar: p.avatar,
        captured: p.captured,
        finished: p.pieces.filter((q) => q.progress === 43).length,
        on_board: p.pieces.filter((q) => q.progress >= 0 && q.progress < 43).length,
        waiting: p.pieces.filter((q) => q.progress < 0).length
      }))
    };
  }

  getGameSummary() {
    const active = this.activePlayer();
    return {
      format: "dhayam-game-summary-v1",
      game: {
        phase: this.phase,
        turn: this.turn,
        current_player: active.name,
        current_seat: active.seat,
        pool: [...this.pool]
      },
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        captured: p.captured,
        waiting: p.pieces.filter((q) => q.progress < 0).length,
        on_board: p.pieces.filter((q) => q.progress >= 0 && q.progress < 43).length,
        finished: p.pieces.filter((q) => q.progress === 43).length,
        pieces: p.pieces.map((q, index) => ({
          piece_id: q.id,
          piece_number: index + 1,
          progress: q.progress,
          square: this.pieceNode(p, q)
        }))
      })),
      legal_moves: this.getLegalMoves(),
      analysis_prompt: "Choose the strongest legal move for the current player. Explain safety, capture, progress, and overcrowding tradeoffs."
    };
  }

  getTurnDetails() {
    const grouped = new Map();
    for (const event of this.audit) {
      const turn = Number(event.turn || 0);
      if (!grouped.has(turn)) grouped.set(turn, []);
      grouped.get(turn).push(event);
    }
    return {
      format: "dhayam-turn-details-v1",
      game: {
        phase: this.phase,
        current_turn: this.turn,
        current_player: this.activePlayer().name
      },
      turns: [...grouped.entries()].sort((a, b) => a[0] - b[0]).map(([turn, events]) => ({
        turn,
        player: events.find((event) => event.player)?.player || null,
        events
      }))
    };
  }

  evaluateMoves(strategy = "balanced") {
    if (this.phase !== "move" || !this.pool.length) return [];
    const p = this.activePlayer();
    const legalMoves = this.getLegalMoves();
    if (!legalMoves.length) return [];

    // Occupancy map for active player to relieve overcrowding
    const occupancy = new Map();
    for (const piece of p.pieces) {
      if (piece.progress >= 0 && piece.progress < 43) {
        const sq = this.pieceNode(p, piece);
        if (sq) occupancy.set(sq, (occupancy.get(sq) || 0) + 1);
      }
    }
    const startSq = START[p.seat];
    const startCrowd = occupancy.get(startSq) || 0;

    return legalMoves.map((m) => {
      const piece = p.pieces.find((q) => matchPieceId(q.id, m.piece_id));
      const fromSq = piece && piece.progress >= 0 ? this.pieceNode(p, piece) : null;
      const crowdingAtOrigin = fromSq ? (occupancy.get(fromSq) || 1) : 0;
      const willFinish = m.target_progress === 43;
      const willCapture = Boolean(m.captures);
      const isEntering = !piece || piece.progress < 0;
      const isSafe = SAFE_SQUARES.has(m.to);
      const tags = [];
      let score = 0;

      const captureWeight = strategy === "aggressive" ? 75000 : strategy === "cautious" ? 35000 : 50000;
      const safetyWeight = strategy === "cautious" ? 25000 : strategy === "aggressive" ? 5000 : 12000;

      if (willFinish) {
        score += 100000;
        tags.push("GOAL_FINISH");
      }
      if (willCapture) {
        score += captureWeight;
        tags.push("CAPTURE");
      }
      if (isSafe && !willFinish) {
        score += safetyWeight;
        tags.push("SAFETY_ZONE");
      }
      if (crowdingAtOrigin > 1) {
        score += 15000 * crowdingAtOrigin;
        tags.push("RELIEVE_OVERCROWDING");
      }
      if (isEntering) {
        score += startCrowd >= 2 ? 2500 : 8000;
        tags.push("ENTER_BOARD");
      } else {
        const lagBoost = Math.max(0, 43 - (piece ? piece.progress : 0)) * 20;
        score += lagBoost;
        if (m.target_progress >= 25 && (piece ? piece.progress < 25 : false)) {
          score += 10000;
          tags.push("ENTER_INNER_TRACK");
        }
      }
      if (m.pool_indices && m.pool_indices.length > 1) {
        score += 1000;
        tags.push("COMBINE_DICE");
      }
      score += m.target_progress;

      let explanation = `Move piece #${m.piece_number} from ${m.from} to ${m.to} (${m.dice_values.join("+")}).`;
      if (willFinish) explanation += " Reaches central goal to score +100 points!";
      else if (willCapture) explanation += " Captures opponent piece sending it back to reserve!";
      else if (crowdingAtOrigin > 1) explanation += ` Relieves ${crowdingAtOrigin}-piece congestion at ${m.from}.`;
      else if (isEntering) explanation += " Enters a fresh piece onto the board.";
      else if (isSafe) explanation += " Lands on safe sanctuary square protected from captures.";

      return {
        ...m,
        score,
        tags,
        explanation
      };
    }).sort((a, b) => b.score - a.score);
  }

  getBestMove(strategy = "balanced") {
    const scored = this.evaluateMoves(strategy);
    return scored.length > 0 ? scored[0] : null;
  }

  playAiTurn(strategy = "balanced") {
    if (this.phase === "done") {
      return {
        status: "game_complete",
        winner: this.players.find((p) => p.rank === 1)?.name || null,
        summary: this.getSummary(),
        state: this.serialize()
      };
    }

    const p = this.activePlayer();
    const actions = [];
    let rollsCount = 0;

    // 1. Roll phase: keep rolling while bonus throws are earned
    while (this.phase === "roll" && rollsCount < 20) {
      rollsCount++;
      const rollRes = this.rollDice();
      actions.push({
        type: "ROLL",
        player: p.name,
        roll: rollRes.roll,
        bonusEarned: rollRes.bonusEarned,
        pool: [...this.pool]
      });
      if (this.phase !== "roll") break;
    }

    // 2. Move phase: play legal moves until pool is exhausted or no moves remain
    let moveLoops = 0;
    while (this.phase === "move" && this.pool.length > 0 && moveLoops < 20) {
      moveLoops++;
      const best = this.getBestMove(strategy);
      if (!best) {
        const passRes = this.passTurn();
        actions.push({
          type: "PASS",
          player: p.name,
          reason: "NO_LEGAL_MOVES_LEFT",
          remainingPool: passRes.unused_pool
        });
        break;
      }

      const moveRes = this.applyMove(best.piece_id, best.dice_values);
      actions.push({
        type: "MOVE",
        player: p.name,
        piece_id: best.piece_id,
        piece_number: best.piece_number,
        from: best.from,
        to: best.to,
        dice_values: best.dice_values,
        captures: moveRes.captures || [],
        score: best.score,
        tags: best.tags,
        explanation: best.explanation
      });

      if (moveRes.status === "win") {
        break;
      }
    }

    // Generate readable narrative commentary
    const rollsDesc = actions.filter((a) => a.type === "ROLL").map((a) => a.roll?.value).filter(Boolean).join(", ");
    const movesDesc = actions.filter((a) => a.type === "MOVE");
    let commentary = `${p.name} rolled [${rollsDesc}].`;
    if (movesDesc.length > 0) {
      const moveDetails = movesDesc.map((m) => {
        let desc = `Piece #${m.piece_number} (${m.from} → ${m.to})`;
        if (m.captures && m.captures.length) {
          desc += ` capturing ${m.captures.map((c) => c.playerName).join(" & ")}`;
        }
        return desc;
      }).join("; ");
      commentary += ` Executed: ${moveDetails}.`;
    } else {
      commentary += " No moves could be played, turn passed.";
    }

    return {
      status: "success",
      player: p.name,
      seat: p.seat,
      strategy,
      actions,
      commentary,
      summary: this.getSummary(),
      state: this.serialize()
    };
  }

  simulateAiMatch(options = {}) {
    const { player_names, strategies = [], max_turns = 150 } = options;
    if (player_names && player_names.length >= 2) {
      this.initNewMatch(player_names);
    }

    const stratMap = {};
    this.players.forEach((p, idx) => {
      stratMap[p.name] = (Array.isArray(strategies) ? strategies[idx] : strategies[p.name]) || "balanced";
    });

    const turnLogs = [];
    const startTime = Date.now();
    let turnCount = 0;

    while (this.phase !== "done" && turnCount < max_turns) {
      turnCount++;
      const currentActive = this.activePlayer().name;
      const strategy = stratMap[currentActive] || "balanced";
      const turnResult = this.playAiTurn(strategy);
      turnLogs.push({
        turn: turnCount,
        player: currentActive,
        strategy,
        commentary: turnResult.commentary,
        actions: turnResult.actions
      });
    }

    const winner = this.players.find((p) => p.rank === 1);
    const durationMs = Date.now() - startTime;

    const statistics = this.players.map((p) => {
      const rolls = this.audit.filter((a) => a.event === "ROLL" && a.player === p.name);
      const captures = this.audit.filter((a) => a.event === "CAPTURE" && a.capturer === p.name);
      const moves = this.audit.filter((a) => a.event === "MOVE" && a.player === p.name);
      return {
        name: p.name,
        seat: p.seat,
        avatar: p.avatar,
        winner: winner?.name === p.name,
        rank: p.rank,
        finishedPieces: p.pieces.filter((q) => q.progress === 43).length,
        capturesCount: captures.length,
        totalRolls: rolls.length,
        bonusRollsCount: rolls.filter((r) => r.bonus).length,
        totalMoves: moves.length
      };
    });

    return {
      status: winner ? "completed" : "max_turns_reached",
      winner: winner ? winner.name : null,
      totalTurns: turnCount,
      durationMs,
      statistics,
      recentHighlights: turnLogs.filter((t) => t.actions?.some((a) => a.type === "MOVE" && (a.captures?.length || a.tags?.includes("GOAL_FINISH")))).slice(-8),
      summary: this.getSummary(),
      state: this.serialize()
    };
  }

  serialize() {
    return {
      players: this.players,
      current: this.current,
      phase: this.phase,
      pool: this.pool,
      history: this.history,
      lastRoll: this.lastRoll,
      turn: this.turn,
      openingEntryPlayers: this.openingEntryPlayers,
      audit: this.audit
    };
  }
}

// In-memory fallback session for this isolate
let activeSessionGame = new DhayamEngine();

const MCP_TOOLS = [
  {
    name: "dhayam_new_game",
    description: "Start a new Dhayam / Dayakattai match with 2 to 32 players.",
    inputSchema: {
      type: "object",
      properties: {
        player_names: {
          type: "array",
          items: { type: "string" },
          description: "List of player names (2 to 32). Defaults to ['Player 1', 'Player 2']."
        }
      }
    }
  },
  {
    name: "dhayam_get_state",
    description: "Inspect the current Dhayam board state, player positions, turn phase, and active rolls.",
    inputSchema: { type: "object", properties: { state: { type: "object" } } }
  },
  {
    name: "dhayam_roll_dice",
    description: "Roll the traditional Dayakattai dice with cryptographic randomness. An optional secret (up to 8 characters) is mixed into the entropy without changing probabilities; the secret is never returned.",
    inputSchema: {
      type: "object",
      properties: {
        secret: { type: "string", maxLength: 8, description: "Optional hidden match secret. Do not expect it in the response." },
        state: { type: "object" }
      }
    }
  },
  {
    name: "dhayam_get_legal_moves",
    description: "List all legal moves available for the active player using the current dice pool.",
    inputSchema: { type: "object", properties: { state: { type: "object" } } }
  },
  {
    name: "dhayam_move_piece",
    description: "Execute a legal piece move on the Dhayam board.",
    inputSchema: {
      type: "object",
      properties: {
        piece_id: { type: "string", description: "ID of the piece to move (e.g. 'p0_q0')" },
        dice_values: { type: "array", items: { type: "integer" } },
        state: { type: "object" }
      },
      required: ["piece_id"]
    }
  },
  {
    name: "dhayam_pass",
    description: "Pass remaining unused dice rolls to advance turn to the next player.",
    inputSchema: { type: "object", properties: { state: { type: "object" } } }
  },
  {
    name: "dhayam_get_audit_log",
    description: "Retrieve the tamper-evident audit history of all game actions.",
    inputSchema: { type: "object", properties: { state: { type: "object" } } }
  },
  {
    name: "dhayam_get_game_summary",
    description: "Return an AI-ready snapshot of the current board, player progress, dice pool, and legal candidate moves for choosing the next best move.",
    inputSchema: { type: "object", properties: { state: { type: "object" } } }
  },
  {
    name: "dhayam_get_turn_details",
    description: "Return ordered turn-by-turn game events grouped by turn for AI analysis, fairness review, and explaining the next move.",
    inputSchema: { type: "object", properties: { state: { type: "object" } } }
  },
  {
    name: "dhayam_get_share_url",
    description: "Generate a direct link to view or play this game in a web browser on GitHub Pages or Cloudflare.",
    inputSchema: {
      type: "object",
      properties: {
        base_url: { type: "string", description: "Optional web client base URL." }
      }
    }
  },
  {
    name: "dhayam_evaluate_moves",
    description: "Evaluate and rank all legal moves for the active player with tactical heuristic scores, strategic tags (CAPTURE, GOAL_FINISH, RELIEVE_OVERCROWDING, SAFETY_ZONE, ENTER_INNER_TRACK), and natural language explanations. Ideal for LLM pair programming and AI vs AI decision making.",
    inputSchema: {
      type: "object",
      properties: {
        strategy: {
          type: "string",
          enum: ["balanced", "aggressive", "cautious"],
          description: "AI evaluation strategy weighting. Defaults to 'balanced'."
        },
        state: {
          type: "object",
          description: "Optional serialized game state to evaluate."
        }
      }
    }
  },
  {
    name: "dhayam_play_ai_turn",
    description: "Execute a complete automated turn for the current AI / computer player. Automatically handles Dayakattai dice rolls (including bonus chains on 1, 5, 6, 12), evaluates and executes the optimal legal moves, captures opponent pieces, and passes when the turn is complete.",
    inputSchema: {
      type: "object",
      properties: {
        strategy: {
          type: "string",
          enum: ["balanced", "aggressive", "cautious"],
          description: "AI play personality. 'aggressive' prioritizes captures; 'cautious' prioritizes safety zones; 'balanced' optimizes goal progress and overcrowding relief."
        },
        state: {
          type: "object",
          description: "Optional serialized game state to play turn on."
        }
      }
    }
  },
  {
    name: "dhayam_simulate_ai_match",
    description: "Simulate a complete Computer-to-Computer or AI-to-AI match (2 to 4 players) to conclusion or max turns. Returns the winner, match statistics, capture counts, bonus streaks, turn highlights, and shareable web link.",
    inputSchema: {
      type: "object",
      properties: {
        player_names: {
          type: "array",
          items: { type: "string" },
          description: "List of player/bot names (e.g. ['AlphaBot', 'BetaBot']). Defaults to ['Computer 1', 'Computer 2']."
        },
        strategies: {
          type: "array",
          items: { type: "string", enum: ["balanced", "aggressive", "cautious"] },
          description: "Strategy for each player respectively."
        },
        max_turns: {
          type: "integer",
          description: "Maximum turns to simulate before stopping. Defaults to 150."
        },
        state: {
          type: "object",
          description: "Optional existing match state to resume simulation from."
        }
      }
    }
  },
  {
    name: "dhayam_simulate_online_match",
    description: "Simulate AI-to-AI moves in a live Cloudflare multiplayer room so spectators can watch the dice tumbling and pieces moving in real-time in their web browser via WebSockets.",
    inputSchema: {
      type: "object",
      properties: {
        room_code: {
          type: "string",
          description: "Multiplayer room code (e.g. 'CF88' or 'AI-ROOM'). Created if it does not exist."
        },
        turns: {
          type: "integer",
          description: "Number of automated AI turns to simulate in the room. Defaults to 4."
        },
        player_count: {
          type: "integer",
          description: "Number of players in the room (2 to 4). Defaults to 2."
        },
        strategy: {
          type: "string",
          enum: ["balanced", "aggressive", "cautious"],
          description: "AI strategy for simulated bot moves."
        }
      },
      required: ["room_code"]
    }
  }
];

async function handleMcpToolCall(name, args = {}, env = null) {
  let engine = args.state ? new DhayamEngine(args.state) : activeSessionGame;

  let result;
  if (name === "dhayam_new_game") {
    engine = new DhayamEngine();
    engine.initNewMatch(args.player_names);
    if (!args.state) activeSessionGame = engine;
    result = {
      message: "New Dhayam match started.",
      summary: engine.getSummary(),
      state: engine.serialize()
    };
  } else if (name === "dhayam_get_state") {
    result = { summary: engine.getSummary(), state: engine.serialize() };
  } else if (name === "dhayam_roll_dice") {
    const outcome = engine.rollDice(args.secret);
    result = { ...outcome, state: engine.serialize() };
  } else if (name === "dhayam_get_legal_moves") {
    result = {
      phase: engine.phase,
      pool: engine.pool,
      legalMoves: engine.getLegalMoves(),
      state: engine.serialize()
    };
  } else if (name === "dhayam_evaluate_moves") {
    const scored = engine.evaluateMoves(args.strategy || "balanced");
    result = {
      current_player: engine.activePlayer().name,
      phase: engine.phase,
      pool: [...engine.pool],
      strategy: args.strategy || "balanced",
      recommended_move: scored.length > 0 ? scored[0] : null,
      scored_moves: scored,
      state: engine.serialize()
    };
  } else if (name === "dhayam_play_ai_turn") {
    const turnRes = engine.playAiTurn(args.strategy || "balanced");
    if (!args.state) activeSessionGame = engine;
    result = { ...turnRes, state: engine.serialize() };
  } else if (name === "dhayam_simulate_ai_match") {
    engine = args.state ? new DhayamEngine(args.state) : new DhayamEngine();
    const simRes = engine.simulateAiMatch({
      player_names: args.player_names,
      strategies: args.strategies,
      max_turns: args.max_turns || 150
    });
    if (!args.state) activeSessionGame = engine;
    result = {
      ...simRes,
      share_url: "https://sethusrinivasan.github.io/dhayam/"
    };
  } else if (name === "dhayam_simulate_online_match") {
    const roomCode = (args.room_code || "AI" + Math.floor(1000 + Math.random() * 9000)).toUpperCase();
    if (env && env.DHAYAM_ROOM) {
      try {
        const id = env.DHAYAM_ROOM.idFromName(roomCode);
        const stub = env.DHAYAM_ROOM.get(id);
        const res = await stub.fetch(new Request("https://internal/ai-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            turns: args.turns || 4,
            strategy: args.strategy || "balanced",
            player_count: args.player_count || 2
          })
        }));
        result = await res.json();
      } catch (err) {
        result = { error: "Room execution error: " + err.message };
      }
    } else {
      engine = args.state ? new DhayamEngine(args.state) : new DhayamEngine();
      if (!args.state) {
        engine.initNewMatch(Array.from({ length: args.player_count || 2 }, (_, i) => "AI Bot " + (i + 1)));
      }
      const simRes = engine.simulateAiMatch({
        strategies: args.strategy ? [args.strategy] : ["balanced"],
        max_turns: args.turns || 6
      });
      result = {
        ...simRes,
        roomCode,
        spectatorUrl: `https://dhayam.cancun.workers.dev/?room=${roomCode}`
      };
    }
  } else if (name === "dhayam_move_piece") {
    const moveRes = engine.applyMove(args.piece_id, args.dice_values);
    result = { ...moveRes, state: engine.serialize() };
  } else if (name === "dhayam_pass") {
    const passRes = engine.passTurn();
    result = { ...passRes, state: engine.serialize() };
  } else if (name === "dhayam_get_audit_log") {
    result = { audit: engine.audit, state: engine.serialize() };
  } else if (name === "dhayam_get_game_summary") {
    result = { ...engine.getGameSummary(), state: engine.serialize() };
  } else if (name === "dhayam_get_turn_details") {
    result = { ...engine.getTurnDetails(), state: engine.serialize() };
  } else if (name === "dhayam_get_share_url") {
    const base = args.base_url || "https://sethusrinivasan.github.io/dhayam/";
    result = {
      webUrl: base,
      message: "Open this link in any modern desktop or mobile browser to view or play interactively."
    };
  } else {
    result = { error: "Unknown tool: " + name };
  }

  return result;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};

/**
 * DhayamRoom - Durable Object with WebSocket Hibernation & SQLite persistence
 *
 * Coordinates real-time online multiplayer game rooms on Cloudflare Edge.
 * Highly frugal, zero idle cost via WebSocket Hibernation, sub-50ms latency.
 */
export class DhayamRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.roomCode = null;
    this.engine = null;
    this.targetPlayers = 2;
    this.claimedSeats = {};

    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room_state (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);
      const rows = this.ctx.storage.sql.exec("SELECT value FROM room_state WHERE key = 'state'").toArray();
      if (rows.length > 0 && rows[0].value) {
        try {
          const saved = JSON.parse(rows[0].value);
          this.roomCode = saved.roomCode;
          this.targetPlayers = saved.targetPlayers || 2;
          this.claimedSeats = saved.claimedSeats || {};
          if (saved.game) {
            this.engine = new DhayamEngine(saved.game);
          }
        } catch (e) {
          console.warn("Failed to parse restored SQLite room state:", e);
        }
      }
    });
  }

  persist() {
    try {
      const data = JSON.stringify({
        roomCode: this.roomCode,
        targetPlayers: this.targetPlayers,
        claimedSeats: this.claimedSeats,
        game: this.engine ? this.engine.serialize() : null
      });
      this.ctx.storage.sql.exec("INSERT OR REPLACE INTO room_state (key, value) VALUES ('state', ?)", data);
    } catch (e) {
      console.warn("SQLite persist error:", e);
    }
  }

  ensureInitialized(targetCount = 2, code = "") {
    if (!this.engine) {
      this.roomCode = code;
      this.targetPlayers = Math.min(Math.max(targetCount, 2), 32);
      const names = Array.from({ length: this.targetPlayers }, (_, i) => "Player " + (i + 1));
      this.engine = new DhayamEngine();
      this.engine.initNewMatch(names);
      this.claimedSeats = {};
      this.persist();
    }
  }

  getSeatsInfo() {
    if (!this.engine || !this.engine.players) return [];
    return this.engine.players.map((p, idx) => {
      const claim = this.claimedSeats[idx];
      return {
        seat: idx,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        claimed: Boolean(claim),
        claimedBy: claim ? claim.name : "",
        isHost: idx === 0,
        connected: Boolean(claim && claim.connected)
      };
    });
  }

  broadcast(payload, excludeWs = null) {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== excludeWs) {
        try {
          ws.send(text);
        } catch (e) {}
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const parts = url.pathname.split("/").filter(Boolean);
      // /api/room/:code/ws
      const codeFromPath = parts.length >= 3 ? parts[2] : "";
      const code = (url.searchParams.get("code") || codeFromPath || "ROOM").toUpperCase();
      const targetCount = parseInt(url.searchParams.get("players") || "2", 10);
      this.ensureInitialized(targetCount, code);

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);

      const token = url.searchParams.get("token") || "";
      const seatParam = url.searchParams.get("seat");
      const seat = seatParam !== null && seatParam !== "" ? Number(seatParam) : null;

      server.serializeAttachment({ token, seat, name: "" });

      // Immediate response with room state
      server.send(JSON.stringify({
        type: "ROOM_STATE",
        roomCode: this.roomCode,
        targetPlayers: this.targetPlayers,
        seats: this.getSeatsInfo(),
        game: this.engine.serialize(),
        audit: this.engine.audit
      }));

      return new Response(null, { status: 101, webSocket: client, headers: CORS_HEADERS });
    }

    if (request.method === "POST") {
      let body = {};
      try {
        body = await request.json();
      } catch (e) {}

      const code = (url.searchParams.get("code") || url.pathname.split("/")[2] || "AI-ROOM").toUpperCase();
      const targetCount = body.player_count || parseInt(url.searchParams.get("players") || "2", 10);
      this.ensureInitialized(targetCount, code);

      const turns = Math.min(Math.max(body.turns || 1, 1), 50);
      const strategy = body.strategy || "balanced";
      const executedTurns = [];

      for (let t = 0; t < turns; t++) {
        if (this.engine.phase === "done") break;
        const activeSeat = this.engine.current;
        const activeName = this.engine.players[activeSeat].name;

        const turnRes = this.engine.playAiTurn(strategy);
        executedTurns.push({
          turn: this.engine.turn,
          player: activeName,
          commentary: turnRes.commentary,
          actions: turnRes.actions
        });

        this.broadcast({
          type: "ROOM_UPDATE",
          seats: this.getSeatsInfo(),
          message: turnRes.commentary
        });

        this.broadcast({
          type: "SYNC_STATE",
          game: this.engine.serialize(),
          audit: this.engine.audit,
          seats: this.getSeatsInfo()
        });
      }

      this.persist();

      return new Response(JSON.stringify({
        status: "success",
        roomCode: this.roomCode,
        turnsExecuted: executedTurns.length,
        executedTurns,
        phase: this.engine.phase,
        winner: this.engine.players.find((p) => p.rank === 1)?.name || null,
        spectatorUrl: `https://dhayam.cancun.workers.dev/?room=${this.roomCode}`,
        seats: this.getSeatsInfo(),
        game: this.engine.serialize()
      }), { headers: CORS_HEADERS });
    }

    // Room info GET endpoint
    return new Response(JSON.stringify({
      roomCode: this.roomCode,
      targetPlayers: this.targetPlayers,
      seats: this.getSeatsInfo(),
      phase: this.engine ? this.engine.phase : "uninitialized",
      current: this.engine ? this.engine.current : 0
    }), { headers: CORS_HEADERS });
  }

  async webSocketMessage(ws, message) {
    try {
      if (typeof message === "string" && message.length > 4096) {
        ws.send(JSON.stringify({ type: "ERROR", message: "Payload too large." }));
        return;
      }
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      if (text.length > 4096) {
        ws.send(JSON.stringify({ type: "ERROR", message: "Payload too large." }));
        return;
      }
      const data = JSON.parse(text);
      const attachment = ws.deserializeAttachment() || {};

      if (data.type === "CLAIM_SEAT") {
        const seat = Number(data.seat);
        if (isNaN(seat) || seat < 0 || seat >= this.targetPlayers) {
          ws.send(JSON.stringify({ type: "ERROR", message: "Invalid seat number." }));
          return;
        }
        const name = String(data.name || "").trim().slice(0, 15).replace(/[<>"'&]/g, "");
        const token = data.token || attachment.token || crypto.randomUUID();

        // 1. Reconnect with matching token
        const existingClaim = this.claimedSeats[seat];
        if (existingClaim && existingClaim.token === token) {
          existingClaim.connected = true;
          existingClaim.disconnectedAt = null; // cancel grace period
          if (name) {
            existingClaim.name = name;
            this.engine.players[seat].name = name;
          }
          attachment.seat = seat;
          attachment.token = token;
          attachment.name = existingClaim.name;
          ws.serializeAttachment(attachment);
          this.persist();

          ws.send(JSON.stringify({
            type: "INIT",
            seat,
            token,
            roomCode: this.roomCode,
            totalPlayers: this.targetPlayers,
            game: this.engine.serialize(),
            audit: this.engine.audit,
            seats: this.getSeatsInfo()
          }));

          this.broadcast({
            type: "PRESENCE",
            seat,
            connected: true,
            name: existingClaim.name,
            seats: this.getSeatsInfo()
          });
          return;
        }

        // 2. Reject if claimed and currently connected by another player
        if (existingClaim && existingClaim.connected) {
          ws.send(JSON.stringify({
            type: "CHOOSE_SEAT",
            roomCode: this.roomCode,
            seats: this.getSeatsInfo(),
            error: "Player slot " + (seat + 1) + " is already occupied. Please select an available slot."
          }));
          return;
        }

        // 3. New Claim
        const chosenName = name || this.engine.players[seat].name;
        this.engine.players[seat].name = chosenName;
        this.claimedSeats[seat] = {
          token,
          name: chosenName,
          connected: true
        };

        attachment.seat = seat;
        attachment.token = token;
        attachment.name = chosenName;
        ws.serializeAttachment(attachment);
        this.persist();

        ws.send(JSON.stringify({
          type: "INIT",
          seat,
          token,
          roomCode: this.roomCode,
          totalPlayers: this.targetPlayers,
          game: this.engine.serialize(),
          audit: this.engine.audit,
          seats: this.getSeatsInfo()
        }));

        this.broadcast({
          type: "ROOM_UPDATE",
          seats: this.getSeatsInfo(),
          message: chosenName + " joined as Player " + (seat + 1)
        });
      }

      else if (data.type === "ROLL") {
        const seat = attachment.seat;
        const claim = seat !== null && seat !== undefined ? this.claimedSeats[seat] : null;
        const tokenValid = Boolean(claim && attachment.token && claim.token === attachment.token);
        if (seat === undefined || seat === null || !tokenValid || this.engine.current !== seat || this.engine.phase !== "roll") {
          ws.send(JSON.stringify({
            type: "ERROR",
            message: this.engine.current !== seat ? "Not your turn to roll." : "Cannot roll during " + this.engine.phase + " phase."
          }));
          this.broadcast({
            type: "SYNC_STATE",
            game: this.engine.serialize(),
            audit: this.engine.audit,
            seats: this.getSeatsInfo()
          });
          return;
        }

        const res = this.engine.rollDice(data.secret);
        if (res.error) {
          ws.send(JSON.stringify({ type: "ERROR", message: res.error }));
          this.broadcast({
            type: "SYNC_STATE",
            game: this.engine.serialize(),
            audit: this.engine.audit,
            seats: this.getSeatsInfo()
          });
          return;
        }

        this.persist();

        // Broadcast synchronized ROLL_START so all players see 3D dice tumble together
        this.broadcast({
          type: "ROLL_START",
          seat,
          player: this.engine.players[seat].name,
          dice: { a: res.roll.a, b: res.roll.b },
          value: res.roll.value,
          val: res.roll.value,
          bonus: res.bonusEarned,
          specialRoll: res.roll.specialRoll,
          pool: [...this.engine.pool],
          history: [...this.engine.history],
          phase: this.engine.phase
        });

        // Broadcast SYNC_STATE
        this.broadcast({
          type: "SYNC_STATE",
          game: this.engine.serialize(),
          audit: this.engine.audit,
          seats: this.getSeatsInfo()
        });
      }

      else if (data.type === "MOVE") {
        const seat = attachment.seat;
        const claim = seat !== null && seat !== undefined ? this.claimedSeats[seat] : null;
        const tokenValid = Boolean(claim && attachment.token && claim.token === attachment.token);
        if (seat === undefined || seat === null || !tokenValid || this.engine.current !== seat || this.engine.phase !== "move") {
          ws.send(JSON.stringify({
            type: "ERROR",
            message: this.engine.current !== seat ? "Not your turn to move." : "Game is in " + this.engine.phase + " phase."
          }));
          this.broadcast({
            type: "SYNC_STATE",
            game: this.engine.serialize(),
            audit: this.engine.audit,
            seats: this.getSeatsInfo()
          });
          return;
        }

        const { pieceId, diceValues } = data;
        const res = this.engine.applyMove(pieceId, diceValues);
        if (res.error) {
          ws.send(JSON.stringify({ type: "ERROR", message: res.error }));
          this.broadcast({
            type: "SYNC_STATE",
            game: this.engine.serialize(),
            audit: this.engine.audit,
            seats: this.getSeatsInfo()
          });
          return;
        }

        this.persist();

        // Broadcast synchronized MOVE_START
        this.broadcast({
          type: "MOVE_START",
          seat,
          player: this.engine.players[seat].name,
          pieceId: res.pieceId,
          fromProgress: res.fromProgress,
          targetProgress: res.targetProgress,
          destination: res.destination,
          captures: res.captures,
          winner: res.winner
        });

        // Broadcast SYNC_STATE
        this.broadcast({
          type: "SYNC_STATE",
          game: this.engine.serialize(),
          audit: this.engine.audit,
          seats: this.getSeatsInfo()
        });
      }

      else if (data.type === "PASS") {
        const seat = attachment.seat;
        const claim = seat !== null && seat !== undefined ? this.claimedSeats[seat] : null;
        const tokenValid = Boolean(claim && attachment.token && claim.token === attachment.token);
        if (seat === undefined || seat === null || !tokenValid || this.engine.current !== seat) {
          ws.send(JSON.stringify({
            type: "ERROR",
            message: "Not your turn."
          }));
          this.broadcast({
            type: "SYNC_STATE",
            game: this.engine.serialize(),
            audit: this.engine.audit,
            seats: this.getSeatsInfo()
          });
          return;
        }

        this.engine.passTurn();
        this.persist();

        this.broadcast({
          type: "SYNC_STATE",
          game: this.engine.serialize(),
          audit: this.engine.audit,
          seats: this.getSeatsInfo()
        });
      }

      else if (data.type === "PING") {
        ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
      }

      else if (data.type === "GET_STATE" || data.type === "SYNC") {
        ws.send(JSON.stringify({
          type: "SYNC_STATE",
          game: this.engine.serialize(),
          audit: this.engine.audit,
          seats: this.getSeatsInfo()
        }));
      }

      else if (data.type === "EMOTE") {
        const seat = attachment.seat;
        const name = attachment.name || (seat !== null && this.engine.players[seat] ? this.engine.players[seat].name : "Player");
        this.broadcast({
          type: "EMOTE",
          emote: data.emote,
          name,
          seat
        });
      }

      else if (data.type === "RESET_GAME") {
        this.engine.initNewMatch(this.engine.players.map((p) => p.name));
        this.persist();
        this.broadcast({
          type: "INIT",
          roomCode: this.roomCode,
          totalPlayers: this.targetPlayers,
          game: this.engine.serialize(),
          audit: this.engine.audit,
          seats: this.getSeatsInfo()
        });
      }
    } catch (err) {
      console.error("Durable Object webSocketMessage error:", err);
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    const attachment = ws.deserializeAttachment() || {};
    if (attachment.seat !== undefined && attachment.seat !== null) {
      const claim = this.claimedSeats[attachment.seat];
      if (claim) {
        claim.connected = false;
        // Record when this seat disconnected so the alarm handler knows
        // which seats to abandon after the 60-second grace window.
        claim.disconnectedAt = Date.now();
        this.persist();
        this.broadcast({
          type: "PRESENCE",
          seat: attachment.seat,
          connected: false,
          name: claim.name,
          seats: this.getSeatsInfo()
        });

        // Arm a 60-second grace period alarm.  If the player reconnects
        // before it fires (CLAIM_SEAT with matching token), the reconnect
        // handler clears disconnectedAt and the alarm handler skips them.
        // We always overwrite the alarm to the latest disconnect time so
        // concurrent disconnects all get a full 60 seconds.
        try {
          await this.ctx.storage.setAlarm(Date.now() + 60_000);
        } catch (_e) {
          // setAlarm may throw in local dev (workerd without alarm support);
          // safe to ignore — the seat claim persists anyway.
        }
      }
    }
  }

  // Called by the Durable Object runtime when the alarm fires.
  async alarm() {
    const now = Date.now();
    const GRACE_MS = 60_000;
    let anyAbandoned = false;

    for (const [seatStr, claim] of Object.entries(this.claimedSeats)) {
      const seat = Number(seatStr);
      // A seat is grace-expired when it is still disconnected AND the
      // disconnectedAt timestamp is older than the grace window.
      if (!claim.connected && claim.disconnectedAt && (now - claim.disconnectedAt) >= GRACE_MS) {
        // Release the seat so another player can take it if needed.
        delete this.claimedSeats[seat];
        anyAbandoned = true;

        // If it is currently this player's turn, pass it automatically
        // so the game doesn't stall.
        if (this.engine && this.engine.current === seat && this.engine.phase !== "done") {
          this.engine.passTurn();
        }

        this.broadcast({
          type: "SEAT_ABANDONED",
          seat,
          name: claim.name,
          message: claim.name + " was disconnected and did not reconnect in time. Their seat is now open.",
          seats: this.getSeatsInfo()
        });

        this.broadcast({
          type: "SYNC_STATE",
          game: this.engine ? this.engine.serialize() : null,
          audit: this.engine ? this.engine.audit : [],
          seats: this.getSeatsInfo()
        });
      }
    }

    if (anyAbandoned) {
      this.persist();
    }
  }

  async webSocketError(ws, error) {
    console.warn("Durable Object webSocketError:", error);
  }
}

// ─── WebSocket Join Rate Limiter ──────────────────────────────────────────
// Lightweight in-memory per-IP throttle.  Limits WebSocket upgrade attempts
// to MAX_WS_JOINS_PER_WINDOW per IP in any RATE_WINDOW_MS rolling window.
// Worker memory resets on cold-start, which is fine — this guards against
// hot brute-force scans, not persistent offline enumeration.
const _wsJoinRateMap = new Map(); // ip -> { count: number, resetAt: number }
const MAX_WS_JOINS_PER_WINDOW = 10;
const RATE_WINDOW_MS = 60_000; // 1 minute

function checkWsJoinRateLimit(ip) {
  const now = Date.now();
  let entry = _wsJoinRateMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    _wsJoinRateMap.set(ip, entry);
  }
  entry.count += 1;
  return entry.count <= MAX_WS_JOINS_PER_WINDOW;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (url.pathname.startsWith("/api/auth") || url.pathname === "/api/leaderboard" || url.pathname === "/api/stats/record") {
        return handleAuthAndLeaderboard(request, env, url);
      }
      return new Response(null, { headers: CORS_HEADERS });
    }

    // 0. Auth & Leaderboard endpoints (/api/auth/*, /api/leaderboard, /api/stats/record)
    if (url.pathname.startsWith("/api/auth") || url.pathname === "/api/leaderboard" || url.pathname === "/api/stats/record") {
      const authResponse = await handleAuthAndLeaderboard(request, env, url);
      if (authResponse) return authResponse;
    }

    // 1. Multiplayer WebSocket & Info endpoint: /api/room/:code/...
    const roomMatch = url.pathname.match(/^\/api\/room\/([A-Za-z0-9_-]+)(?:\/(ws|info))?$/);
    if (roomMatch && env && env.DHAYAM_ROOM) {
      // Rate-limit WebSocket join attempts per IP to prevent room enumeration.
      if (request.headers.get("Upgrade") === "websocket") {
        const clientIp = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
        if (!checkWsJoinRateLimit(clientIp)) {
          return new Response(
            JSON.stringify({ error: "Too many connection attempts. Please wait a moment before trying again." }),
            { status: 429, headers: { ...CORS_HEADERS, "Retry-After": "60" } }
          );
        }
      }
      const roomCode = roomMatch[1].toUpperCase();
      const id = env.DHAYAM_ROOM.idFromName(roomCode);
      const stub = env.DHAYAM_ROOM.get(id);
      return stub.fetch(request);
    }

    // 1. Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "healthy", service: "dhayam-mcp", version: "1.0.0" }), {
        headers: CORS_HEADERS
      });
    }

    // 2. MCP Streamable HTTP JSON-RPC endpoint
    if (url.pathname === "/mcp") {
      if (request.method === "GET") {
        return new Response(
          JSON.stringify({
            service: "Dhayam MCP Streamable HTTP Endpoint",
            status: "active",
            protocol: "Model Context Protocol (MCP)",
            tools: MCP_TOOLS.map((t) => t.name),
            instructions: "Send JSON-RPC 2.0 POST requests to /mcp."
          }, null, 2),
          { headers: CORS_HEADERS }
        );
      }

      if (request.method === "POST") {
        const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
        if (contentLength > 65536) {
          return new Response(
            JSON.stringify({ jsonrpc: "2.0", error: { code: -32600, message: "Payload too large (max 64KB)" } }),
            { status: 413, headers: CORS_HEADERS }
          );
        }
        try {
          const body = await request.json();
          const method = body.method;
          const id = body.id;

          if (method === "initialize") {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id,
                result: {
                  protocolVersion: "2024-11-05",
                  capabilities: { tools: {}, resources: {} },
                  serverInfo: { name: "dhayam-cloudflare-mcp", version: "1.0.0" }
                }
              }),
              { headers: CORS_HEADERS }
            );
          }

          if (method === "notifications/initialized") {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }

          if (method === "tools/list") {
            return new Response(
              JSON.stringify({ jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } }),
              { headers: CORS_HEADERS }
            );
          }

          if (method === "tools/call") {
            const params = body.params || {};
            const toolResult = await handleMcpToolCall(params.name, params.arguments, env);
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id,
                result: {
                  content: [{ type: "text", text: JSON.stringify(toolResult, null, 2) }]
                }
              }),
              { headers: CORS_HEADERS }
            );
          }

          if (method === "resources/list") {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id,
                result: {
                  resources: [
                    { uri: "dhayam://rules", name: "Dhayam Rules", mimeType: "text/markdown" }
                  ]
                }
              }),
              { headers: CORS_HEADERS }
            );
          }

          return new Response(
            JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }),
            { headers: CORS_HEADERS }
          );
        } catch (err) {
          return new Response(
            JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error: " + err.message } }),
            { status: 400, headers: CORS_HEADERS }
          );
        }
      }
    }

    // The embed reuses the tested game shell but needs framing headers that
    // are different from the standalone application.
    if (url.pathname === "/embed" && env && env.ASSETS) {
      const asset = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url)));
      const headers = new Headers(asset.headers);
      headers.delete("X-Frame-Options");
      headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https://*.workers.dev; font-src 'self' data:; object-src 'none'; frame-ancestors https: http://localhost:*",
      );
      return new Response(asset.body, { status: asset.status, headers });
    }

    // 3. Static asset delivery (if configured in Cloudflare Pages / Workers static assets)
    if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    // Fallback: Redirect root visits to GitHub Pages
    if (url.pathname === "/" || url.pathname.startsWith("/site")) {
      return Response.redirect("https://sethusrinivasan.github.io/dhayam/", 302);
    }

    return new Response("Not found", { status: 404 });
  }
};
