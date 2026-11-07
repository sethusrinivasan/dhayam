import assert from "node:assert/strict";
import dns from "node:dns";
import test from "node:test";

dns.setDefaultResultOrder("ipv4first");

const MCP_URL = process.env.DHAYAM_MCP_URL || "https://dhayam-staging.cancun.workers.dev/mcp";
const HEALTH_URL = process.env.DHAYAM_HEALTH_URL || "https://dhayam-staging.cancun.workers.dev/health";

async function fetchWithRetry(url: string, init?: RequestInit, maxAttempts = 5): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  throw lastErr;
}

test("MCP Server on Cloudflare: GET /health healthcheck", async () => {
  const res = await fetchWithRetry(HEALTH_URL);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, "healthy");
  assert.equal(data.service, "dhayam-mcp");
  assert.equal(data.version, "1.0.0");
});

test("MCP Server on Cloudflare: GET /mcp service discovery", async () => {
  const res = await fetchWithRetry(MCP_URL);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");

  const data = await res.json();
  assert.equal(data.status, "active");
  assert.equal(data.protocol, "Model Context Protocol (MCP)");
  assert.ok(Array.isArray(data.tools));
  assert.ok(data.tools.includes("dhayam_new_game"));
  assert.ok(data.tools.includes("dhayam_roll_dice"));
  assert.ok(data.tools.includes("dhayam_move_piece"));
});

test("MCP Server on Cloudflare: OPTIONS /mcp CORS preflight", async () => {
  const res = await fetchWithRetry(MCP_URL, { method: "OPTIONS" });
  assert.ok(res.status === 200 || res.status === 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.ok(res.headers.get("access-control-allow-methods")?.includes("POST"));
});

test("MCP Server on Cloudflare: POST initialize handshake", async () => {
  const payload = {
    jsonrpc: "2.0",
    id: 101,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "dhayam-test-suite", version: "1.0.0" }
    }
  };

  const res = await fetchWithRetry(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.jsonrpc, "2.0");
  assert.equal(data.id, 101);
  assert.ok(data.result);
  assert.equal(data.result.protocolVersion, "2024-11-05");
  assert.equal(data.result.serverInfo.name, "dhayam-cloudflare-mcp");
  assert.ok(data.result.capabilities.tools);
});

test("MCP Server on Cloudflare: POST notifications/initialized", async () => {
  const payload = {
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {}
  };

  const res = await fetchWithRetry(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 204);
});

test("MCP Server on Cloudflare: POST tools/list returns complete catalog", async () => {
  const payload = {
    jsonrpc: "2.0",
    id: 102,
    method: "tools/list"
  };

  const res = await fetchWithRetry(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.jsonrpc, "2.0");
  assert.equal(data.id, 102);
  assert.ok(Array.isArray(data.result.tools));

  const toolNames = data.result.tools.map((t: any) => t.name);
  const expectedTools = [
    "dhayam_new_game",
    "dhayam_get_state",
    "dhayam_roll_dice",
    "dhayam_get_legal_moves",
    "dhayam_move_piece",
    "dhayam_pass",
    "dhayam_get_audit_log",
    "dhayam_get_game_summary",
    "dhayam_get_turn_details",
    "dhayam_get_share_url",
    "dhayam_evaluate_moves",
    "dhayam_play_ai_turn",
    "dhayam_simulate_ai_match",
    "dhayam_simulate_online_match"
  ];

  for (const expected of expectedTools) {
    assert.ok(toolNames.includes(expected), `Tool catalog must include ${expected}`);
  }

  // Validate tool inputSchema structure
  const moveTool = data.result.tools.find((t: any) => t.name === "dhayam_move_piece");
  assert.ok(moveTool.inputSchema.properties.piece_id);
});

test("MCP Server on Cloudflare: POST resources/list returns documentation resources", async () => {
  const payload = {
    jsonrpc: "2.0",
    id: 103,
    method: "resources/list"
  };

  const res = await fetchWithRetry(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.jsonrpc, "2.0");
  assert.equal(data.id, 103);
  assert.ok(Array.isArray(data.result.resources));
  assert.ok(data.result.resources.some((r: any) => r.uri === "dhayam://rules"));
});

test("MCP Server on Cloudflare: tools/call full gameplay loop (new game, roll, state, moves, pass)", async () => {
  // Helper to call tools
  async function callTool(name: string, args: Record<string, any> = {}) {
    const res = await fetchWithRetry(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name, arguments: args }
      })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.jsonrpc, "2.0");
    assert.ok(json.result?.content?.[0]?.text);
    return JSON.parse(json.result.content[0].text);
  }

  // 1. dhayam_new_game
  const newGameRes = await callTool("dhayam_new_game", { player_names: ["Aarav", "Diya"] });
  assert.ok(newGameRes.message.includes("New Dhayam match started"));
  assert.equal(newGameRes.summary.current_player, "Aarav");
  assert.equal(newGameRes.summary.turn, 1);
  assert.equal(newGameRes.summary.players.length, 2);
  let state = newGameRes.state;
  assert.ok(state);

  // 2. dhayam_get_state
  const getStateRes = await callTool("dhayam_get_state", { state });
  assert.equal(getStateRes.summary.current_player, "Aarav");
  assert.equal(getStateRes.summary.phase, "roll");

  // 3. dhayam_roll_dice
  const rollRes = await callTool("dhayam_roll_dice", { state });
  assert.ok(rollRes.roll);
  assert.ok(typeof rollRes.roll.value === "number");
  assert.ok([1, 2, 3, 4, 5, 6, 12].includes(rollRes.roll.value));
  assert.ok(Array.isArray(rollRes.pool));
  assert.ok(rollRes.pool.length >= 1);
  state = rollRes.state;

  // 4. dhayam_get_legal_moves
  const legalRes = await callTool("dhayam_get_legal_moves", { state });
  assert.ok(Array.isArray(legalRes.legalMoves));
  assert.ok(["roll", "move"].includes(legalRes.phase));

  // 5. dhayam_get_audit_log
  const auditRes = await callTool("dhayam_get_audit_log", { state });
  assert.ok(Array.isArray(auditRes.audit));
  assert.ok(auditRes.audit.length >= 2, "Audit log must contain at least GAME_CREATED and ROLL");

  const summaryRes = await callTool("dhayam_get_game_summary", { state });
  assert.equal(summaryRes.format, "dhayam-game-summary-v1");
  assert.ok(Array.isArray(summaryRes.legal_moves));
  assert.ok(Array.isArray(summaryRes.players));

  const turnDetailsRes = await callTool("dhayam_get_turn_details", { state });
  assert.equal(turnDetailsRes.format, "dhayam-turn-details-v1");
  assert.ok(Array.isArray(turnDetailsRes.turns));

  // 6. dhayam_get_share_url
  const shareRes = await callTool("dhayam_get_share_url", {});
  assert.ok(shareRes.webUrl.startsWith("http"));
});

test("MCP Server on Cloudflare: tools/call AI-to-AI simulation and automated turn", async () => {
  async function callTool(name: string, args: Record<string, any> = {}) {
    const res = await fetchWithRetry(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name, arguments: args }
      })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.jsonrpc, "2.0");
    assert.ok(json.result?.content?.[0]?.text);
    return JSON.parse(json.result.content[0].text);
  }

  // 1. Play automated AI turn
  const turnRes = await callTool("dhayam_play_ai_turn", { strategy: "aggressive" });
  assert.equal(turnRes.status, "success");
  assert.ok(Array.isArray(turnRes.actions));
  assert.ok(turnRes.actions.length >= 1);
  assert.ok(typeof turnRes.commentary === "string");
  assert.ok(turnRes.state);

  // 2. Evaluate candidate moves with tactical scores and tags
  const evalRes = await callTool("dhayam_evaluate_moves", { strategy: "balanced", state: turnRes.state });
  assert.ok(Array.isArray(evalRes.scored_moves));

  // 3. Full AI-to-AI match simulation
  const simRes = await callTool("dhayam_simulate_ai_match", {
    player_names: ["AlphaBot", "BetaBot"],
    strategies: ["aggressive", "cautious"],
    max_turns: 15
  });
  assert.ok(["completed", "max_turns_reached"].includes(simRes.status));
  assert.ok(simRes.totalTurns >= 1);
  assert.ok(Array.isArray(simRes.statistics));
  assert.equal(simRes.statistics.length, 2);
  assert.ok(simRes.share_url);
});

test("MCP Server on Cloudflare: JSON-RPC error handling", async () => {
  // 1. Unknown method (-32601)
  const unknownRes = await fetchWithRetry(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 999, method: "non_existent_method" })
  });
  assert.equal(unknownRes.status, 200);
  const unknownJson = await unknownRes.json();
  assert.equal(unknownJson.error.code, -32601);
  assert.equal(unknownJson.error.message, "Method not found");

  // 2. Malformed JSON (-32700)
  const malformedRes = await fetchWithRetry(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ this is not valid json }"
  });
  assert.equal(malformedRes.status, 400);
  const malformedJson = await malformedRes.json();
  assert.equal(malformedJson.error.code, -32700);
});

test("MCP Python stdio server: lists and executes dhayam_get_leaderboard, dhayam_submit_feedback, dhayam_get_feedback", async () => {
  const { spawn } = await import("node:child_process");

  async function callPythonMcp(method: string, params: Record<string, any> = {}) {
    return new Promise<any>((resolve, reject) => {
      const proc = spawn("python3", ["mcp/server.py"], { stdio: ["pipe", "pipe", "inherit"] });
      let output = "";
      proc.stdout.on("data", (chunk) => {
        output += chunk.toString();
      });
      proc.on("close", (code) => {
        if (code !== 0) {
          return reject(new Error(`Python process exited with code ${code}`));
        }
        try {
          const parsed = JSON.parse(output.trim());
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
      const req = { jsonrpc: "2.0", id: Date.now(), method, params };
      proc.stdin.write(JSON.stringify(req) + "\n");
      proc.stdin.end();
    });
  }

  // 1. tools/list must include new tools
  const listResp = await callPythonMcp("tools/list");
  assert.ok(listResp.result?.tools);
  const toolNames = listResp.result.tools.map((t: any) => t.name);
  assert.ok(toolNames.includes("dhayam_get_leaderboard"));
  assert.ok(toolNames.includes("dhayam_submit_feedback"));
  assert.ok(toolNames.includes("dhayam_get_feedback"));

  // 2. dhayam_get_leaderboard returns 10 populated entries
  const lbResp = await callPythonMcp("tools/call", {
    name: "dhayam_get_leaderboard",
    arguments: {}
  });
  assert.ok(lbResp.result?.content?.[0]?.text);
  const lbData = JSON.parse(lbResp.result.content[0].text);
  assert.ok(Array.isArray(lbData.leaderboard));
  assert.equal(lbData.leaderboard.length, 10, "Leaderboard must be fully populated with 10 entries");
  assert.equal(lbData.leaderboard[0].rank, 1);
  assert.equal(lbData.leaderboard[9].rank, 10);

  // 3. dhayam_submit_feedback saves feedback with timestamp, user details, IP address
  const fbResp = await callPythonMcp("tools/call", {
    name: "dhayam_submit_feedback",
    arguments: {
      feedback: "Spectacular Dayakattai AI and UI!",
      category: "praise",
      rating: 5,
      user_alias: "Agent007"
    }
  });
  const fbData = JSON.parse(fbResp.result.content[0].text);
  assert.equal(fbData.ok, true);
  assert.ok(fbData.id.startsWith("fb_"));
  assert.ok(fbData.timestamp > 0);
  assert.equal(fbData.feedback.user_alias, "Agent007");
  assert.equal(fbData.feedback.ip_address, "127.0.0.1 (MCP stdio)");
  assert.equal(fbData.feedback.feedback_text, "Spectacular Dayakattai AI and UI!");

  // 4. dhayam_get_feedback retrieves saved entries
  const getFbResp = await callPythonMcp("tools/call", {
    name: "dhayam_get_feedback",
    arguments: { limit: 5 }
  });
  const getFbData = JSON.parse(getFbResp.result.content[0].text);
  assert.equal(getFbData.ok, true);
  assert.ok(Array.isArray(getFbData.feedback));
  assert.ok(getFbData.feedback.length >= 1);
  assert.equal(getFbData.feedback[0].id, fbData.id);
});
