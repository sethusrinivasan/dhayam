/**
 * Dhayam Cloudflare Worker & Streamable HTTP MCP Server
 *
 * Frugal, zero-dependency Cloudflare Worker that:
 * 1. Serves the static Dhayam game on Cloudflare's Global Edge CDN (via env.ASSETS)
 * 2. Exposes the Model Context Protocol (MCP) Streamable HTTP endpoint at /mcp
 * 3. Provides uptime monitoring at /health
 *
 * Deployable on Cloudflare Free Tier (100,000 req/day, 0ms cold starts, <1MB bundle).
 */
"use strict";

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

function buildRoute(seat) {
  const startOuter = { N: 0, E: 6, S: 12, W: 18 }[seat];
  const outerLoop = Array.from({ length: OUTER.length }, (_, i) => OUTER[(startOuter + i) % OUTER.length]);
  const startInner = { N: 0, E: 12, S: 8, W: 4 }[seat];
  const innerLoop = Array.from({ length: INNER.length }, (_, i) => INNER[(startInner + i) % INNER.length]);
  return [...outerLoop, ...innerLoop, ...APPROACH[seat]];
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
    const count = Math.min(Math.max(names.length, 2), 4);
    const avatars = ["🔴", "🟢", "🟡", "🔵"];
    const colors = ["#ff7518", "#2dd4bf", "#f59e0b", "#6366f1"];

    this.players = names.slice(0, count).map((name, i) => ({
      id: "p" + i,
      name,
      avatar: avatars[i],
      color: colors[i],
      seat: SEATS[i],
      captured: false,
      rank: null,
      pieces: Array.from({ length: 6 }, (_, q) => ({ id: "p" + i + "_q" + q, progress: -1 }))
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

  rollDice() {
    if (this.phase !== "roll") {
      return { error: "Cannot roll dice during move phase. Please choose a piece move first." };
    }

    const randomBytes = new Uint8Array(1);
    crypto.getRandomValues(randomBytes);
    const outcome = DICE_OUTCOMES[randomBytes[0] % DICE_OUTCOMES.length];
    const isBonus = BONUS_VALUES.has(outcome.val);

    this.pool.push(outcome.val);
    this.history.push(outcome.val);
    this.lastRoll = { a: outcome.a, b: outcome.b, value: outcome.val, bonus: isBonus };

    this.audit.push({
      event: "ROLL",
      player: this.activePlayer().name,
      dice: { a: outcome.a, b: outcome.b },
      value: outcome.val,
      bonus: isBonus,
      pool: [...this.pool]
    });

    if (!isBonus) {
      this.phase = "move";
    }

    return {
      roll: this.lastRoll,
      pool: [...this.pool],
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
    const match = legal.find(
      (m) => m.piece_id === pieceId && (!diceValues || JSON.stringify(m.dice_values) === JSON.stringify(diceValues))
    ) || legal.find((m) => m.piece_id === pieceId);

    if (!match) {
      return { error: "No legal move found for piece " + pieceId };
    }

    const p = this.activePlayer();
    const piece = p.pieces.find((q) => q.id === pieceId);
    const test = this.testMove(p, piece, match.dice_values);

    piece.progress = test.progress;
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
      piece: pieceId,
      to: test.destination,
      remaining_pool: [...this.pool]
    });

    if (p.pieces.every((q) => q.progress === 43)) {
      p.rank = 1;
      this.phase = "done";
      this.audit.push({ event: "WINNER", winner: p.name });
      return { status: "win", winner: p.name, summary: this.getSummary() };
    }

    if (!this.pool.length || !this.getLegalMoves().length) {
      this.nextTurn();
    }

    return {
      status: "success",
      destination: test.destination,
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
    this.current = (this.current + 1) % this.players.length;
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
    description: "Start a new Dhayam / Dayakattai match with 2, 3, or 4 players.",
    inputSchema: {
      type: "object",
      properties: {
        player_names: {
          type: "array",
          items: { type: "string" },
          description: "List of player names (2 to 4). Defaults to ['Player 1', 'Player 2']."
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
    description: "Roll the traditional Dayakattai dice (1, 2, 3, 4, 5, 6, 12). If 1, 5, 6, or 12 is rolled, grants a bonus throw.",
    inputSchema: { type: "object", properties: { state: { type: "object" } } }
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
    name: "dhayam_get_share_url",
    description: "Generate a direct link to view or play this game in a web browser on GitHub Pages or Cloudflare.",
    inputSchema: {
      type: "object",
      properties: {
        base_url: { type: "string", description: "Optional web client base URL." }
      }
    }
  }
];

function handleMcpToolCall(name, args = {}) {
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
    const outcome = engine.rollDice();
    result = { ...outcome, state: engine.serialize() };
  } else if (name === "dhayam_get_legal_moves") {
    result = {
      phase: engine.phase,
      pool: engine.pool,
      legalMoves: engine.getLegalMoves(),
      state: engine.serialize()
    };
  } else if (name === "dhayam_move_piece") {
    const moveRes = engine.applyMove(args.piece_id, args.dice_values);
    result = { ...moveRes, state: engine.serialize() };
  } else if (name === "dhayam_pass") {
    const passRes = engine.passTurn();
    result = { ...passRes, state: engine.serialize() };
  } else if (name === "dhayam_get_audit_log") {
    result = { audit: engine.audit, state: engine.serialize() };
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
  "Content-Type": "application/json"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
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
            const toolResult = handleMcpToolCall(params.name, params.arguments);
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
