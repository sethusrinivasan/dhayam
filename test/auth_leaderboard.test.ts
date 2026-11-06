import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import {
  handleAuthAndLeaderboard,
  createSessionToken,
  verifySessionToken,
  sanitizeAlias,
  parseCookies,
  getAuthCorsHeaders,
  extractToken,
  IN_MEMORY_DB
} from "../cloudflare/auth.js";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const AUTH_JS_PATH = path.join(ROOT_DIR, "site", "js", "auth.js");

const TEST_SECRET = "test-hmac-sha256-secret-for-dhayam-tests";

test("auth: alias sanitization restricts length to 8 and strips HTML", () => {
  assert.equal(sanitizeAlias("Murugan"), "Murugan");
  assert.equal(sanitizeAlias("SuperLongPlayerName"), "SuperLon"); // 8 chars
  assert.equal(sanitizeAlias("<script>alert(1)</script>"), "alert(1)");
  assert.equal(sanitizeAlias(""), "Player");
  assert.equal(sanitizeAlias(null), "Player");
});

test("auth: parseCookies parses complex cookie header accurately", () => {
  const header = "dhayam_session=abc.123.xyz; other_cookie=hello%20world; test=1";
  const cookies = parseCookies(header);
  assert.equal(cookies.dhayam_session, "abc.123.xyz");
  assert.equal(cookies.other_cookie, "hello world");
  assert.equal(cookies.test, "1");
});

test("auth: session token creation and verification with HMAC-SHA256", async () => {
  const payload = { userId: "usr_123", alias: "Kavitha", exp: Math.floor(Date.now() / 1000) + 3600 };
  const token = await createSessionToken(payload, TEST_SECRET);
  assert.ok(typeof token === "string");
  assert.equal(token.split(".").length, 3);

  // Valid verification
  const verified = await verifySessionToken(token, TEST_SECRET);
  assert.ok(verified);
  assert.equal(verified.userId, "usr_123");
  assert.equal(verified.alias, "Kavitha");

  // Tampered payload rejected
  const parts = token.split(".");
  parts[1] = btoa(JSON.stringify({ ...payload, alias: "Hacker" }));
  const tampered = parts.join(".");
  const tamperedResult = await verifySessionToken(tampered, TEST_SECRET);
  assert.equal(tamperedResult, null);

  // Wrong secret rejected
  const wrongSecretResult = await verifySessionToken(token, "wrong-secret-key");
  assert.equal(wrongSecretResult, null);

  // Expired token rejected
  const expiredPayload = { userId: "usr_exp", exp: Math.floor(Date.now() / 1000) - 100 };
  const expiredToken = await createSessionToken(expiredPayload, TEST_SECRET);
  const expiredResult = await verifySessionToken(expiredToken, TEST_SECRET);
  assert.equal(expiredResult, null);
});

test("auth: getAuthCorsHeaders echoes allowed origin and enables credentials", () => {
  const req = new Request("https://dhayam.cancun.workers.dev/api/auth/me", {
    headers: { Origin: "https://sethusrinivasan.github.io" }
  });
  const cors = getAuthCorsHeaders(req);
  assert.equal(cors["Access-Control-Allow-Origin"], "https://sethusrinivasan.github.io");
  assert.equal(cors["Access-Control-Allow-Credentials"], "true");
  assert.notEqual(cors["Access-Control-Allow-Origin"], "*");
});

test("api: GET /api/auth/config returns client IDs", async () => {
  const req = new Request("https://dhayam.cancun.workers.dev/api/auth/config");
  const url = new URL(req.url);
  const env = {
    GOOGLE_CLIENT_ID: "test-google-id",
    GITHUB_CLIENT_ID: "test-github-id",
    AUTH_JWT_SECRET: TEST_SECRET
  };

  const res = await handleAuthAndLeaderboard(req, env, url);
  assert.ok(res);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.googleClientId, "test-google-id");
  assert.equal(data.githubClientId, "test-github-id");
  assert.equal(data.githubConfigured, true);
});

test("api: GET /api/auth/me returns null for unauthenticated visitor", async () => {
  const req = new Request("https://dhayam.cancun.workers.dev/api/auth/me");
  const url = new URL(req.url);
  const env = { AUTH_JWT_SECRET: TEST_SECRET };

  const res = await handleAuthAndLeaderboard(req, env, url);
  assert.ok(res);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user, null);
});

test("api: full lifecycle - register, record match score, leaderboard ranking, and logout", async () => {
  const env = { AUTH_JWT_SECRET: TEST_SECRET };
  const userId = "usr_test_player_1";

  // 1. Manually simulate user creation in DB
  IN_MEMORY_DB.users.set(userId, {
    id: userId,
    oauth_provider: "google",
    oauth_sub: "12345",
    alias: "Murugan",
    avatar_url: "https://example.com/avatar.png",
    email: "murugan@example.com",
    last_login: Date.now()
  });
  IN_MEMORY_DB.stats.set(userId, {
    user_id: userId,
    games_played: 0,
    games_won: 0,
    total_captures: 0,
    total_score: 0,
    updated_at: Date.now()
  });

  const sessionToken = await createSessionToken({
    userId,
    alias: "Murugan",
    avatarUrl: "https://example.com/avatar.png",
    provider: "google",
    exp: Math.floor(Date.now() / 1000) + 3600
  }, TEST_SECRET);

  // 2. GET /api/auth/me with session cookie
  const meReq = new Request("https://dhayam.cancun.workers.dev/api/auth/me", {
    headers: { Cookie: `dhayam_session=${sessionToken}` }
  });
  const meRes = await handleAuthAndLeaderboard(meReq, env, new URL(meReq.url));
  assert.ok(meRes);
  const meData = await meRes.json();
  assert.equal(meData.user.alias, "Murugan");
  assert.equal(meData.stats.total_score, 0);

  // 3. POST /api/stats/record a victory (+100 pts win, 2 captures = +20 pts)
  const matchReq = new Request("https://dhayam.cancun.workers.dev/api/stats/record", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `dhayam_session=${sessionToken}`
    },
    body: JSON.stringify({
      matchId: "match_e2e_1",
      isWinner: true,
      captures: 2,
      turns: 28
    })
  });
  const matchRes = await handleAuthAndLeaderboard(matchReq, env, new URL(matchReq.url));
  assert.ok(matchRes);
  assert.equal(matchRes.status, 200);
  const matchData = await matchRes.json();
  assert.equal(matchData.ok, true);
  assert.equal(matchData.stats.games_won, 1);
  assert.equal(matchData.stats.total_captures, 2);
  assert.equal(matchData.stats.total_score, 120); // 100 win + 20 captures
  assert.equal(matchData.rank, 1);

  // 4. Duplicate match submission rejected idempotently
  const dupReq = new Request("https://dhayam.cancun.workers.dev/api/stats/record", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `dhayam_session=${sessionToken}`
    },
    body: JSON.stringify({
      matchId: "match_e2e_1",
      isWinner: true,
      captures: 2,
      turns: 28
    })
  });
  const dupRes = await handleAuthAndLeaderboard(dupReq, env, new URL(dupReq.url));
  const dupData = await dupRes.json();
  assert.equal(dupData.duplicate, true);
  assert.equal(dupData.stats.total_score, 120);

  // 5. GET /api/leaderboard verifies Murugan is Rank #1
  const lbReq = new Request("https://dhayam.cancun.workers.dev/api/leaderboard", {
    headers: { Cookie: `dhayam_session=${sessionToken}` }
  });
  const lbRes = await handleAuthAndLeaderboard(lbReq, env, new URL(lbReq.url));
  assert.ok(lbRes);
  const lbData = await lbRes.json();
  assert.ok(lbData.top10.length >= 1);
  assert.equal(lbData.top10[0].alias, "Murugan");
  assert.equal(lbData.top10[0].total_score, 120);
  assert.equal(lbData.currentUser.global_rank, 1);

  // 6. POST /api/auth/logout clears session
  const logoutReq = new Request("https://dhayam.cancun.workers.dev/api/auth/logout", {
    method: "POST",
    headers: { Cookie: `dhayam_session=${sessionToken}` }
  });
  const logoutRes = await handleAuthAndLeaderboard(logoutReq, env, new URL(logoutReq.url));
  assert.ok(logoutRes);
  const setCookie = logoutRes.headers.get("Set-Cookie");
  assert.ok(setCookie?.includes("Max-Age=0"));
});

test("auth: extractToken retrieves token from Bearer Authorization header or cookie fallback", () => {
  const reqWithBearer = new Request("https://dhayam.cancun.workers.dev/api/auth/me", {
    headers: { Authorization: "Bearer token_from_bearer_123" }
  });
  assert.equal(extractToken(reqWithBearer, {}), "token_from_bearer_123");

  const reqWithCookie = new Request("https://dhayam.cancun.workers.dev/api/auth/me");
  assert.equal(extractToken(reqWithCookie, { dhayam_session: "token_from_cookie_456" }), "token_from_cookie_456");

  // Bearer header takes precedence over cookie
  const reqWithBoth = new Request("https://dhayam.cancun.workers.dev/api/auth/me", {
    headers: { Authorization: "Bearer token_bearer_wins" }
  });
  assert.equal(extractToken(reqWithBoth, { dhayam_session: "token_cookie_secondary" }), "token_bearer_wins");

  const reqWithNone = new Request("https://dhayam.cancun.workers.dev/api/auth/me");
  assert.equal(extractToken(reqWithNone, {}), null);
});

test("api: GET /api/auth/me authenticates via Authorization Bearer token without cookies", async () => {
  const env = { AUTH_JWT_SECRET: TEST_SECRET };
  const userId = "usr_bearer_user_1";

  IN_MEMORY_DB.users.set(userId, {
    id: userId,
    oauth_provider: "google",
    oauth_sub: "998877",
    alias: "Anand",
    avatar_url: "",
    email: "anand@example.com",
    last_login: Date.now()
  });

  const sessionToken = await createSessionToken({
    userId,
    alias: "Anand",
    avatarUrl: "",
    provider: "google",
    exp: Math.floor(Date.now() / 1000) + 3600
  }, TEST_SECRET);

  const req = new Request("https://dhayam.cancun.workers.dev/api/auth/me", {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  const res = await handleAuthAndLeaderboard(req, env, new URL(req.url));
  assert.ok(res);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.user);
  assert.equal(data.user.alias, "Anand");
});

function createClientSandbox(mockLocalStorage: any, fetchHandler?: Function) {
  const elements = new Map<string, any>();
  const documentMock = {
    readyState: "complete",
    getElementById: (id: string) => {
      if (!elements.has(id)) {
        elements.set(id, {
          id,
          classList: {
            classes: new Set<string>(),
            add(c: string) { this.classes.add(c); },
            remove(c: string) { this.classes.delete(c); },
            contains(c: string) { return this.classes.has(c); }
          },
          setAttribute() {},
          innerHTML: "",
          textContent: "",
          appendChild() {},
          addEventListener: () => {}
        });
      }
      return elements.get(id);
    },
    createElement: (tag: string) => ({
      tagName: tag.toUpperCase(),
      className: "",
      innerHTML: "",
      style: {},
      setAttribute() {},
      appendChild() {}
    }),
    addEventListener: () => {}
  };

  const sandbox: any = {
    window: {
      location: { origin: "https://sethusrinivasan.github.io", pathname: "/dhayam/", search: "", hash: "" },
      history: { replaceState: () => {} },
      addEventListener: () => {},
      localStorage: mockLocalStorage
    },
    document: documentMock,
    localStorage: mockLocalStorage,
    URLSearchParams: globalThis.URLSearchParams,
    fetch: fetchHandler || (async () => ({ ok: true, status: 200, json: async () => ({ user: null }) })),
    setTimeout: (fn: Function) => fn(),
    console
  };
  sandbox.window.window = sandbox.window;
  sandbox.globalThis = sandbox;
  return sandbox;
}

test("client auth: loadCachedState restores cached user, stats, and rank synchronously upon boot", () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => { store.set(key, String(val)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); }
  };

  mockLocalStorage.setItem("dhayam_cached_user", JSON.stringify({
    id: "usr_cached_1",
    alias: "Karthik",
    avatar_url: "https://example.com/karthik.png",
    oauth_provider: "google"
  }));
  mockLocalStorage.setItem("dhayam_cached_stats", JSON.stringify({
    games_played: 3,
    games_won: 2,
    total_captures: 4,
    total_score: 240
  }));
  mockLocalStorage.setItem("dhayam_cached_rank", "5");

  const sandbox = createClientSandbox(mockLocalStorage);
  const authCode = fs.readFileSync(AUTH_JS_PATH, "utf-8");
  vm.createContext(sandbox);
  vm.runInContext(authCode, sandbox);

  const dhayamAuth = sandbox.DhayamAuth;
  assert.ok(dhayamAuth);
  assert.equal(dhayamAuth.getCurrentUser()?.alias, "Karthik");
  assert.equal(dhayamAuth.getCurrentStats()?.total_score, 240);
  assert.equal(dhayamAuth.getCurrentRank(), "5");
});

test("client auth: onGameWin increments points locally and enqueues pending match immediately", () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => { store.set(key, String(val)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); }
  };

  const sandbox = createClientSandbox(mockLocalStorage);
  const authCode = fs.readFileSync(AUTH_JS_PATH, "utf-8");
  vm.createContext(sandbox);
  vm.runInContext(authCode, sandbox);

  const dhayamAuth = sandbox.DhayamAuth;
  // Simulate human player winning
  dhayamAuth.onGameWin({ name: "Player 1", computer: false, captured: true }, 130, 2);

  // 1. Current stats immediately updated in memory and cache
  const stats = dhayamAuth.getCurrentStats();
  assert.ok(stats);
  assert.equal(stats.games_won, 1);
  assert.equal(stats.total_score, 130);
  assert.equal(stats.total_captures, 2);

  // 2. Pending matches queue persisted in localStorage
  const pending = dhayamAuth.getPendingMatches();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].isWinner, true);
  assert.equal(pending[0].score, 130);

  // 3. Stats persisted in localStorage string
  const cachedStatsRaw = mockLocalStorage.getItem("dhayam_cached_stats");
  assert.ok(cachedStatsRaw);
  const parsedStats = JSON.parse(cachedStatsRaw);
  assert.equal(parsedStats.total_score, 130);
});

test("client auth: syncPendingMatches flushes queued wins to /api/stats/record", async () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => { store.set(key, String(val)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); }
  };

  let recordedCalls: any[] = [];
  const sandbox = createClientSandbox(mockLocalStorage, async (url: string, opts: any) => {
    if (url.includes("/api/stats/record")) {
      const body = JSON.parse(opts.body);
      recordedCalls.push(body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          stats: { games_played: 1, games_won: 1, total_captures: 1, total_score: 110 },
          rank: 1
        })
      };
    }
    return { ok: true, status: 200, json: async () => ({ user: null }) };
  });

  // Set auth token and pending match in localStorage
  mockLocalStorage.setItem("dhayam_auth_token", "jwt_token_abc");
  mockLocalStorage.setItem("dhayam_cached_user", JSON.stringify({ id: "usr_1", alias: "Player1" }));
  mockLocalStorage.setItem("dhayam_pending_matches", JSON.stringify([{
    matchId: "match_offline_1",
    isWinner: true,
    score: 110,
    captures: 1,
    turns: 25
  }]));

  const authCode = fs.readFileSync(AUTH_JS_PATH, "utf-8");
  vm.createContext(sandbox);
  vm.runInContext(authCode, sandbox);

  const dhayamAuth = sandbox.DhayamAuth;
  await dhayamAuth.syncPendingMatches();

  assert.equal(recordedCalls.length, 1);
  assert.equal(recordedCalls[0].matchId, "match_offline_1");
  assert.equal(dhayamAuth.getPendingMatches().length, 0);
  assert.equal(dhayamAuth.getCurrentRank(), 1);
});

test("client auth: logout clears cached profile, stats, rank, and auth token", async () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => { store.set(key, String(val)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); }
  };

  mockLocalStorage.setItem("dhayam_auth_token", "test_token");
  mockLocalStorage.setItem("dhayam_cached_user", JSON.stringify({ id: "usr_1", alias: "Murugan" }));
  mockLocalStorage.setItem("dhayam_cached_stats", JSON.stringify({ games_won: 2, total_score: 220 }));
  mockLocalStorage.setItem("dhayam_cached_rank", "1");

  const sandbox = createClientSandbox(mockLocalStorage);
  const authCode = fs.readFileSync(AUTH_JS_PATH, "utf-8");
  vm.createContext(sandbox);
  vm.runInContext(authCode, sandbox);

  const dhayamAuth = sandbox.DhayamAuth;
  assert.ok(dhayamAuth.getCurrentUser());

  await dhayamAuth.logout();

  assert.equal(dhayamAuth.getCurrentUser(), null);
  assert.equal(dhayamAuth.getCurrentStats(), null);
  assert.equal(dhayamAuth.getCurrentRank(), null);
  assert.equal(mockLocalStorage.getItem("dhayam_auth_token"), null);
  assert.equal(mockLocalStorage.getItem("dhayam_cached_user"), null);
  assert.equal(mockLocalStorage.getItem("dhayam_cached_stats"), null);
  assert.equal(mockLocalStorage.getItem("dhayam_cached_rank"), null);
});

test("api: POST /api/stats/record with isWithdrawal=true records a -100 point penalty for authenticated player", async () => {
  const env = { AUTH_JWT_SECRET: TEST_SECRET };
  const userId = "usr_withdrawing_player_1";

  IN_MEMORY_DB.users.set(userId, {
    id: userId,
    oauth_provider: "google",
    oauth_sub: "11223344",
    alias: "Senthil",
    avatar_url: "",
    email: "senthil@example.com",
    last_login: Date.now()
  });
  IN_MEMORY_DB.stats.set(userId, {
    user_id: userId,
    games_played: 2,
    games_won: 2,
    total_captures: 4,
    total_score: 240, // Has 240 pts
    updated_at: Date.now()
  });

  const sessionToken = await createSessionToken({
    userId,
    alias: "Senthil",
    avatarUrl: "",
    provider: "google",
    exp: Math.floor(Date.now() / 1000) + 3600
  }, TEST_SECRET);

  const withdrawReq = new Request("https://dhayam.cancun.workers.dev/api/stats/record", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      matchId: "match_withdraw_test_1",
      isWithdrawal: true,
      turns: 12
    })
  });

  const res = await handleAuthAndLeaderboard(withdrawReq, env, new URL(withdrawReq.url));
  assert.ok(res);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  // Score reduced by 100 points: 240 - 100 = 140
  assert.equal(data.stats.total_score, 140);
  assert.equal(data.stats.games_played, 3);
  assert.equal(data.stats.games_won, 2); // Did not win
});

test("api: POST /api/stats/record with isWithdrawal=true is rejected with 401 for unauthenticated visitor", async () => {
  const env = { AUTH_JWT_SECRET: TEST_SECRET };
  const withdrawReq = new Request("https://dhayam.cancun.workers.dev/api/stats/record", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      matchId: "match_withdraw_unauth",
      isWithdrawal: true
    })
  });

  const res = await handleAuthAndLeaderboard(withdrawReq, env, new URL(withdrawReq.url));
  assert.ok(res);
  assert.equal(res.status, 401);
});

test("client auth: onGameWithdrawal deducts 100 points locally and flushes to /api/stats/record", async () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => { store.set(key, String(val)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); }
  };

  let flushedWithdrawal: any = null;
  const sandbox = createClientSandbox(mockLocalStorage, async (url: string, opts: any) => {
    if (url.includes("/api/stats/record")) {
      flushedWithdrawal = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          stats: { games_played: 2, games_won: 1, total_captures: 2, total_score: 50 },
          rank: 3
        })
      };
    }
    return { ok: true, status: 200, json: async () => ({ user: null }) };
  });

  // Seed user with 150 points
  mockLocalStorage.setItem("dhayam_auth_token", "jwt_token_withdraw");
  mockLocalStorage.setItem("dhayam_cached_user", JSON.stringify({ id: "usr_w1", alias: "PlayerW" }));
  mockLocalStorage.setItem("dhayam_cached_stats", JSON.stringify({
    games_played: 1,
    games_won: 1,
    total_captures: 2,
    total_score: 150
  }));

  const authCode = fs.readFileSync(AUTH_JS_PATH, "utf-8");
  vm.createContext(sandbox);
  vm.runInContext(authCode, sandbox);

  const dhayamAuth = sandbox.DhayamAuth;
  assert.equal(dhayamAuth.getCurrentStats()?.total_score, 150);

  const result = await dhayamAuth.onGameWithdrawal();
  assert.equal(result.ok, true);

  // Local stats immediately reduced: 150 - 100 = 50
  assert.equal(dhayamAuth.getCurrentStats()?.total_score, 50);
  assert.equal(dhayamAuth.getCurrentStats()?.games_played, 2);

  // Payload verified
  assert.ok(flushedWithdrawal);
  assert.equal(flushedWithdrawal.isWithdrawal, true);
  assert.equal(flushedWithdrawal.score, -100);
});

test("client auth: onGameWithdrawal is rejected if user is not signed in", async () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => { store.set(key, String(val)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); }
  };

  const sandbox = createClientSandbox(mockLocalStorage);
  const authCode = fs.readFileSync(AUTH_JS_PATH, "utf-8");
  vm.createContext(sandbox);
  vm.runInContext(authCode, sandbox);

  const dhayamAuth = sandbox.DhayamAuth;
  assert.equal(dhayamAuth.getCurrentUser(), null);

  const result = await dhayamAuth.onGameWithdrawal();
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("Only OAuth signed-in players"));
});
