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
  maskAlias,
  parseCookies,
  getAuthCorsHeaders,
  extractToken,
  IN_MEMORY_DB,
  upsertUser,
  recordComputerMatch,
  getLeaderboard,
  getUserAndRank,
  submitFeedback,
  getFeedback,
  FAKE_LEADERBOARD_ENTRIES,
  populateWithFakeEntries,
  resolveRegionHeuristic
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

test("auth: maskAlias keeps first 3 letters and appends ***", () => {
  assert.equal(maskAlias("Murugan"), "Mur***");
  assert.equal(maskAlias("Leo"), "Leo***");
  assert.equal(maskAlias("Kavitha"), "Kav***");
  assert.equal(maskAlias("AI"), "AI***");
  assert.equal(maskAlias(""), "Pla***");
  assert.equal(maskAlias(null), "Pla***");
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
  assert.equal(matchData.rank, 9); // In populated leaderboard with varied fake entries, 120 pts places Murugan at rank 9

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

  // 5. GET /api/leaderboard verifies Murugan is ranked at rank 9 in top 10
  const lbReq = new Request("https://dhayam.cancun.workers.dev/api/leaderboard", {
    headers: { Cookie: `dhayam_session=${sessionToken}` }
  });
  const lbRes = await handleAuthAndLeaderboard(lbReq, env, new URL(lbReq.url));
  assert.ok(lbRes);
  const lbData = await lbRes.json();
  assert.equal(lbData.top10.length, 10);
  const muruganLeader = lbData.top10.find((u) => u.alias === "Murugan");
  assert.ok(muruganLeader, "Murugan must be present in top 10");
  assert.equal(muruganLeader.total_score, 120);
  assert.equal(muruganLeader.rank, 9);
  assert.equal(lbData.currentUser.global_rank, 9);

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
          style: {},
          setAttribute() {},
          removeAttribute() {},
          innerHTML: "",
          textContent: "",
          value: "",
          appendChild() {},
          addEventListener: () => {},
          focus: () => {}
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
      appendChild() {},
      focus: () => {}
    }),
    addEventListener: () => {}
  };

  const storageObj = mockLocalStorage && typeof mockLocalStorage.getItem === "function"
    ? mockLocalStorage
    : {
        getItem: (key: string) => mockLocalStorage?.[key] ?? null,
        setItem: (key: string, val: string) => { if (mockLocalStorage) mockLocalStorage[key] = String(val); },
        removeItem: (key: string) => { if (mockLocalStorage) delete mockLocalStorage[key]; },
        clear: () => { for (const k in mockLocalStorage) delete mockLocalStorage[k]; }
      };

  const sandbox: any = {
    window: {
      location: { origin: "https://sethusrinivasan.github.io", pathname: "/dhayam/", search: "", hash: "" },
      history: { replaceState: () => {} },
      addEventListener: () => {},
      localStorage: storageObj
    },
    document: documentMock,
    localStorage: storageObj,
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
  assert.ok(result.error.includes("Only signed-in players"));
});

test("api: GET /api/leaderboard masks names and strips avatars for unauthenticated visitors", async () => {
  const env = { AUTH_JWT_SECRET: TEST_SECRET };
  const userId = "usr_public_player";

  IN_MEMORY_DB.users.set(userId, {
    id: userId,
    oauth_provider: "google",
    oauth_sub: "556677",
    alias: "Karthikeyan",
    avatar_url: "https://lh3.googleusercontent.com/photo.jpg",
    email: "karthik@example.com",
    last_login: Date.now()
  });
  IN_MEMORY_DB.stats.set(userId, {
    user_id: userId,
    games_played: 5,
    games_won: 4,
    total_captures: 10,
    total_score: 500,
    updated_at: Date.now()
  });

  // Request WITHOUT any auth token or session cookie
  const unauthReq = new Request("https://dhayam.cancun.workers.dev/api/leaderboard");
  const res = await handleAuthAndLeaderboard(unauthReq, env, new URL(unauthReq.url));
  assert.ok(res);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.currentUser, null);
  assert.ok(data.top10.length > 0);
  const found = data.top10.find((p: any) => p.total_score === 500);
  assert.ok(found);
  // Alias must be masked: "Kar***"
  assert.equal(found.alias, "Kar***");
  // Avatar must be stripped: ""
  assert.equal(found.avatar_url, "");
});

test("client auth: openLeaderboard renders masked names and generic avatars for non-signed-in users", async () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => { store.set(key, String(val)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); }
  };

  const elements = new Map<string, any>();
  const sandbox = createClientSandbox(mockLocalStorage, async (url: string) => {
    if (url.includes("/api/leaderboard")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          top10: [
            { alias: "Murugan", avatar_url: "https://example.com/pfp.jpg", total_score: 300, games_won: 3, total_captures: 5 }
          ],
          currentUser: null
        })
      };
    }
    return { ok: true, status: 200, json: async () => ({ user: null }) };
  });

  const authCode = fs.readFileSync(AUTH_JS_PATH, "utf-8");
  vm.createContext(sandbox);
  vm.runInContext(authCode, sandbox);

  const dhayamAuth = sandbox.DhayamAuth;
  // Ensure not signed in
  assert.equal(dhayamAuth.getCurrentUser(), null);

  await dhayamAuth.openLeaderboard();

  const listEl = sandbox.document.getElementById("leaderboardList");
  assert.ok(listEl);
  // Name should be masked with first 3 letters and remaining ***
  assert.ok(listEl.innerHTML.includes("Mur***"));
  // Avatar should be generic
  assert.ok(listEl.innerHTML.includes("leaderboard-avatar-generic"));
  // Real photo URL should NOT be rejected in DOM
  assert.ok(!listEl.innerHTML.includes("https://example.com/pfp.jpg"));
});

test("withdrawal restricted modal: uses user-friendly copy and omits technical terms like OAuth", () => {
  const appJsPath = path.join(ROOT_DIR, "site", "js", "app.js");
  const appJsContent = fs.readFileSync(appJsPath, "utf-8");

  // Verify the modal message exists in app.js
  assert.ok(appJsContent.includes("Withdrawal Restricted"));
  assert.ok(
    appJsContent.includes(
      "Only signed-in players can withdraw with profile score reduction. Please sign in to link your game records and standings."
    )
  );

  // Assert no user-facing "OAuth" in the withdrawal restriction prompt
  const withdrawalSnippetMatch = appJsContent.match(
    /function requestWithdrawal\(\)[\s\S]*?return;\s*\}/
  );
  assert.ok(withdrawalSnippetMatch, "requestWithdrawal function must exist");
  const snippet = withdrawalSnippetMatch[0];
  assert.ok(!snippet.includes("OAuth players"), "Should not refer to OAuth players");
  assert.ok(!snippet.includes("OAuth signed-in"), "Should not refer to OAuth signed-in");
});

test("theme system: defaults launch theme to Diwali across index.html, DOM data-theme and THEMES configuration", () => {
  const indexHtmlPath = path.join(ROOT_DIR, "site", "index.html");
  const htmlContent = fs.readFileSync(indexHtmlPath, "utf-8");

  // Verify site/index.html has data-theme="diwali" on html and body
  assert.ok(htmlContent.includes('<html lang="en" data-theme="diwali">'));
  assert.ok(htmlContent.includes('<body data-theme="diwali">'));

  // Verify themes.js defaults currentTheme to diwali
  const themesJsPath = path.join(ROOT_DIR, "site", "js", "themes.js");
  const themesContent = fs.readFileSync(themesJsPath, "utf-8");
  assert.ok(themesContent.includes('currentTheme = "diwali"'));
  assert.ok(themesContent.includes('THEME_DEFINITIONS[themeId]) themeId = "diwali"'));

  // Verify config.js default THEMES have Diwali avatars
  const configJsPath = path.join(ROOT_DIR, "site", "js", "config.js");
  const configContent = fs.readFileSync(configJsPath, "utf-8");
  assert.ok(configContent.includes('{ name: "Maya", avatar: "🪔", color: "#f97316" }'));
  assert.ok(configContent.includes('{ name: "Ashwin", avatar: "🌺", color: "#0f766e" }'));
  assert.ok(configContent.includes('{ name: "Deepa", avatar: "✨", color: "#ca8a04" }'));
  assert.ok(configContent.includes('{ name: "Vikram", avatar: "🌟", color: "#be123c" }'));
});

test("computer player score tracking: tracks score in database and marks is_computer = 1", async () => {
  const env = { AUTH_JWT_SECRET: TEST_SECRET };
  const botId = "bot_deepa";

  const res = await recordComputerMatch(env, {
    id: botId,
    alias: "Deepa",
    avatar: "✨",
    isWinner: true,
    captures: 2,
    turns: 18,
    score: 120
  });

  assert.equal(res.ok, true);
  const user = IN_MEMORY_DB.users.get(botId);
  assert.ok(user, "Computer player must exist in users table");
  assert.equal(user.is_computer, 1, "Computer player must be marked with is_computer = 1");
  assert.equal(user.alias, "Deepa");

  const stats = IN_MEMORY_DB.stats.get(botId);
  assert.ok(stats);
  assert.equal(stats.games_won, 1);
  assert.equal(stats.total_score, 120);
});

test("leaderboard: brings in computer player scores when total real human users < 10", async () => {
  // Clear in-memory DB
  IN_MEMORY_DB.users.clear();
  IN_MEMORY_DB.stats.clear();
  IN_MEMORY_DB.submissions.clear();

  const env = { AUTH_JWT_SECRET: TEST_SECRET };

  // Add 3 real human users (< 10)
  for (let i = 1; i <= 3; i++) {
    const uid = `human_user_${i}`;
    await upsertUser(env, {
      id: uid,
      provider: "google",
      sub: `sub_${i}`,
      alias: `Human${i}`,
      avatarUrl: "👤",
      isComputer: 0
    });
    IN_MEMORY_DB.stats.set(uid, {
      user_id: uid,
      games_played: 2,
      games_won: 2,
      total_captures: 3,
      total_score: 250 - i * 10,
      updated_at: Date.now()
    });
  }

  // Add 2 computer users
  await recordComputerMatch(env, {
    id: "bot_maya",
    alias: "Maya",
    avatar: "🪔",
    isWinner: true,
    captures: 1,
    score: 300
  });
  await recordComputerMatch(env, {
    id: "bot_ashwin",
    alias: "Ashwin",
    avatar: "🌺",
    isWinner: true,
    captures: 1,
    score: 150
  });

  // Query leaderboard
  const { top10 } = await getLeaderboard(env, null);

  // Since total real human users = 3 (< 10), computer scores are included and filled to 10 entries with fake entries
  assert.equal(top10.length, 10);
  const botAliases = top10.map((u) => u.alias);
  assert.ok(botAliases.includes("Maya"), "Maya bot should be in leaderboard when real users < 10");
  assert.ok(botAliases.includes("Ashwin"), "Ashwin bot should be in leaderboard when real users < 10");
});

test("leaderboard: strictly excludes computer player scores when total real human users >= 10", async () => {
  // Clear in-memory DB
  IN_MEMORY_DB.users.clear();
  IN_MEMORY_DB.stats.clear();
  IN_MEMORY_DB.submissions.clear();

  const env = { AUTH_JWT_SECRET: TEST_SECRET };

  // Add 12 real human users (>= 10)
  for (let i = 1; i <= 12; i++) {
    const uid = `human_user_${i}`;
    await upsertUser(env, {
      id: uid,
      provider: "google",
      sub: `sub_${i}`,
      alias: `Player${i}`,
      avatarUrl: "👤",
      isComputer: 0
    });
    IN_MEMORY_DB.stats.set(uid, {
      user_id: uid,
      games_played: 3,
      games_won: i,
      total_captures: 2,
      total_score: i * 50,
      updated_at: Date.now()
    });
  }

  // Add computer user with highest score (5000)
  await recordComputerMatch(env, {
    id: "bot_godmode",
    alias: "GodBot",
    avatar: "🤖",
    isWinner: true,
    captures: 10,
    score: 5000
  });

  // Query leaderboard
  const { top10 } = await getLeaderboard(env, null);

  // Since total real human users >= 10, computer scores must be strictly excluded
  assert.equal(top10.length, 10);
  const botFound = top10.find((u) => u.alias === "GodBot" || u.is_computer === 1);
  assert.equal(botFound, undefined, "Computer bot must NOT appear in leaderboard when real human users >= 10");
  assert.ok(top10.every((u) => !u.is_computer), "All leaderboard entries must be human users");
});

test("demo mode: supports setting pieces count to 1 or 6 (default 6)", () => {
  const demoJsPath = path.join(ROOT_DIR, "site", "js", "demo.js");
  const demoContent = fs.readFileSync(demoJsPath, "utf-8");

  // Verify demo.js has piece count getter and setter
  assert.ok(demoContent.includes("let demoPiecesCount = 6;"));
  assert.ok(demoContent.includes("function setDemoPiecesCount(count)"));
  assert.ok(demoContent.includes("function getDemoPiecesCount()"));

  // Verify app.js newGame supports piecesCount
  const appJsPath = path.join(ROOT_DIR, "site", "js", "app.js");
  const appContent = fs.readFileSync(appJsPath, "utf-8");
  assert.ok(appContent.includes("function newGame(count = 2, computerCount = 1, piecesCount = 6)"));
  assert.ok(appContent.includes("const pieceTotal = Math.max(1, Math.min(6, parseInt(piecesCount || 6, 10)));"));

  // Verify demoBar has demoPiecesSelect
  const indexHtmlPath = path.join(ROOT_DIR, "site", "index.html");
  const htmlContent = fs.readFileSync(indexHtmlPath, "utf-8");
  assert.ok(htmlContent.includes('id="demoPiecesSelect"'));
  assert.ok(htmlContent.includes('value="1">1 Piece</option>'));
  assert.ok(htmlContent.includes('value="6" selected>6 Pieces</option>'));
});

test("curious non-tech copy: rolling status states 'rolling via global arbitrator' and avoids tech jargon", () => {
  const demoJsPath = path.join(ROOT_DIR, "site", "js", "demo.js");
  const demoContent = fs.readFileSync(demoJsPath, "utf-8");

  // Verify curious phrase "rolling via global arbitrator"
  assert.ok(
    demoContent.includes('is rolling via global arbitrator…'),
    "Status text must state 'rolling via global arbitrator'"
  );
  assert.ok(
    !demoContent.includes('is rolling via Cloudflare Durable Object…'),
    "Should not show techy 'rolling via Cloudflare Durable Object'"
  );

  // Verify modal clearly distinguishes Online Game vs Local Game
  const appJsPath = path.join(ROOT_DIR, "site", "js", "app.js");
  const appContent = fs.readFileSync(appJsPath, "utf-8");
  assert.ok(appContent.includes("Live Online Match"));
  assert.ok(appContent.includes("Online Game"));
  assert.ok(appContent.includes("Local Game Simulation"));
  assert.ok(appContent.includes("Local Game"));
  assert.ok(!appContent.includes("Real Cloudflare Online Match"));
});

test("leaderboard: fills in with fake entries when < 10 and reduces fake entries as real users join", async () => {
  const env = { AUTH_JWT_SECRET: TEST_SECRET };

  // Case 0: 0 real users in DB
  IN_MEMORY_DB.users.clear();
  IN_MEMORY_DB.stats.clear();
  IN_MEMORY_DB.submissions.clear();

  const emptyRes = await getLeaderboard(env, null);
  assert.equal(emptyRes.top10.length, 10, "Leaderboard must be fully populated with 10 entries when empty");
  assert.ok(emptyRes.top10.every((u) => u.is_computer === 1 || u.is_fake === 1), "All 10 must be fake entries");
  assert.equal(emptyRes.top10[0].rank, 1);
  assert.equal(emptyRes.top10[9].rank, 10);

  // Progressive addition of real users: 1 to 10
  for (let realCount = 1; realCount <= 10; realCount++) {
    const uid = `human_player_${realCount}`;
    await upsertUser(env, {
      id: uid,
      provider: "google",
      sub: `sub_real_${realCount}`,
      alias: `User${realCount}`,
      avatarUrl: "👤",
      isComputer: 0
    });
    IN_MEMORY_DB.stats.set(uid, {
      user_id: uid,
      games_played: 1,
      games_won: 1,
      total_captures: 2,
      total_score: 500 + realCount * 10,
      updated_at: Date.now()
    });

    const currentRes = await getLeaderboard(env, null);
    assert.equal(currentRes.top10.length, 10, `Leaderboard must always have 10 entries at realCount=${realCount}`);

    const realInLeaderboard = currentRes.top10.filter((u) => !u.is_computer && !u.is_fake);
    const fakeInLeaderboard = currentRes.top10.filter((u) => u.is_computer === 1 || u.is_fake === 1);

    assert.equal(realInLeaderboard.length, realCount, `Expected exactly ${realCount} real user entries`);
    assert.equal(fakeInLeaderboard.length, 10 - realCount, `Expected fake entries reduced to ${10 - realCount}`);
  }

  // Once 10 real users are in, fake entries are 0
  const fullRes = await getLeaderboard(env, null);
  assert.equal(fullRes.top10.length, 10);
  assert.equal(fullRes.top10.filter((u) => u.is_fake || u.is_computer).length, 0, "Fake entries must be completely reduced to 0");
});

test("leaderboard: fictitious scores have variation and last-place player is ranked #10 not #1", async () => {
  const env = { AUTH_JWT_SECRET: TEST_SECRET };
  IN_MEMORY_DB.users.clear();
  IN_MEMORY_DB.stats.clear();
  IN_MEMORY_DB.submissions.clear();

  // Simulate Sethu with negative score from withdrawals (-200)
  const userId = "usr_google_sethu";
  await upsertUser(env, {
    id: userId,
    provider: "google",
    sub: "google_sub_sethu",
    alias: "Sethu",
    avatarUrl: "👤",
    isComputer: 0
  });
  IN_MEMORY_DB.stats.set(userId, {
    user_id: userId,
    games_played: 2,
    games_won: 0,
    total_captures: 0,
    total_score: -200,
    updated_at: Date.now()
  });

  // 1. Leaderboard query for Sethu
  const lb = await getLeaderboard(env, userId);
  assert.equal(lb.top10.length, 10, "Leaderboard must have exactly 10 entries");

  // Verify all fake entries have variation (scores are distinct)
  const fakeEntries = lb.top10.filter((u) => u.is_fake === 1 || u.is_computer === 1);
  assert.equal(fakeEntries.length, 9, "Must have 9 fake entries when 1 real user exists");
  const uniqueScores = new Set(fakeEntries.map((u) => u.total_score));
  assert.equal(uniqueScores.size, fakeEntries.length, "All fake entries must have distinct, varied scores");

  // Verify Sethu is ranked #10 (last) and NOT #1
  assert.equal(lb.top10[9].alias, "Sethu");
  assert.equal(lb.top10[9].rank, 10);
  assert.equal(lb.top10[9].total_score, -200);

  // Crucial: currentUser.global_rank must be 10, NOT 1
  assert.ok(lb.currentUser, "currentUser standing must exist");
  assert.equal(lb.currentUser.global_rank, 10, "Sethu's standing must be rank 10 when score is last in pool");
  assert.notEqual(lb.currentUser.global_rank, 1, "Sethu must NOT be stated as #1 when score is last in pool");

  // 2. getUserAndRank (/api/auth/me) must also report rank 10, NOT 1
  const userAndRank = await getUserAndRank(env, userId);
  assert.equal(userAndRank.rank, 10, "getUserAndRank must return rank 10 matching the leaderboard position");
  assert.notEqual(userAndRank.rank, 1, "getUserAndRank must never report #1 for last-place player");
});

test("leaderboard: regional name alignment serves regionally common names for US visitors", async () => {
  const env = { AUTH_JWT_SECRET: TEST_SECRET };
  IN_MEMORY_DB.users.clear();
  IN_MEMORY_DB.stats.clear();
  IN_MEMORY_DB.submissions.clear();

  // 1. Visitor from USA (via CF-IPCountry header or America/Los_Angeles timezone)
  const usReq = new Request("https://dhayam.cancun.workers.dev/api/leaderboard?tz=America/Los_Angeles", {
    headers: {
      "CF-IPCountry": "US"
    }
  });
  const usRes = await handleAuthAndLeaderboard(usReq, env, new URL(usReq.url));
  assert.ok(usRes);
  const usData = await usRes.json();
  assert.equal(usData.top10.length, 10);

  // In unauthenticated view, aliases are masked ("Lia***", "Emm***", etc.)
  const usAliases = usData.top10.map((u: any) => u.alias);
  assert.ok(usAliases.includes("Lia***") || usAliases.includes("Emm***") || usAliases.includes("Noa***"),
    "US visitor must see North American common filler names (Liam, Emma, Noah, etc.)");

  // 2. Visitor from India (via CF-IPCountry: IN)
  const inReq = new Request("https://dhayam.cancun.workers.dev/api/leaderboard", {
    headers: {
      "CF-IPCountry": "IN"
    }
  });
  const inRes = await handleAuthAndLeaderboard(inReq, env, new URL(inReq.url));
  assert.ok(inRes);
  const inData = await inRes.json();
  const inAliases = inData.top10.map((u: any) => u.alias);
  assert.ok(inAliases.includes("Kav***") || inAliases.includes("Mur***"),
    "Indian visitor must see South Asian common names (Kavitha, Murugan, etc.)");
});

test("feedback durable table: stores user feedback with timestamp, user details, and IP address", async () => {
  const env = { AUTH_JWT_SECRET: TEST_SECRET };
  IN_MEMORY_DB.feedback.clear();

  // 1. Authenticated user feedback submission
  const userId = "usr_feedback_tester";
  const sessionToken = await createSessionToken({
    userId,
    alias: "Priya",
    avatarUrl: "https://example.com/priya.png",
    provider: "google",
    email: "priya@example.com",
    exp: Math.floor(Date.now() / 1000) + 3600
  }, TEST_SECRET);

  const req = new Request("https://dhayam.cancun.workers.dev/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${sessionToken}`,
      "CF-Connecting-IP": "198.51.100.42",
      "User-Agent": "Mozilla/5.0 (DhayamTestBrowser)"
    },
    body: JSON.stringify({
      feedback: "The 3D tumbling dice physics feel authentic and smooth! Love the Diwali theme.",
      category: "general",
      rating: 5
    })
  });

  const res = await handleAuthAndLeaderboard(req, env, new URL(req.url));
  assert.ok(res);
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(data.id.startsWith("fb_"));
  assert.ok(data.timestamp > 0);

  // Verify durable storage record
  const saved = IN_MEMORY_DB.feedback.get(data.id);
  assert.ok(saved, "Feedback must be saved in durable table");
  assert.equal(saved.user_id, userId);
  assert.equal(saved.user_alias, "Priya");
  assert.equal(saved.user_email, "priya@example.com");
  assert.equal(saved.ip_address, "198.51.100.42");
  assert.equal(saved.user_agent, "Mozilla/5.0 (DhayamTestBrowser)");
  assert.equal(saved.category, "general");
  assert.equal(saved.rating, 5);
  assert.equal(saved.feedback_text, "The 3D tumbling dice physics feel authentic and smooth! Love the Diwali theme.");
  assert.equal(saved.created_at, data.timestamp);

  // 2. Anonymous feedback submission
  const anonReq = new Request("https://dhayam.cancun.workers.dev/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.19",
      "User-Agent": "MobileSafari/604.1"
    },
    body: JSON.stringify({
      feedback: "Please add an option to play with 8 players on tablet view.",
      category: "rules",
      userAlias: "Gamer99"
    })
  });

  const anonRes = await handleAuthAndLeaderboard(anonReq, env, new URL(anonReq.url));
  assert.ok(anonRes);
  assert.equal(anonRes.status, 201);
  const anonData = await anonRes.json();
  assert.equal(anonData.ok, true);

  const anonSaved = IN_MEMORY_DB.feedback.get(anonData.id);
  assert.ok(anonSaved);
  assert.equal(anonSaved.user_id, null);
  assert.equal(anonSaved.user_alias, "Gamer99");
  assert.equal(anonSaved.ip_address, "203.0.113.19");
  assert.equal(anonSaved.category, "rules");

  // 3. Rejects empty feedback
  const emptyReq = new Request("https://dhayam.cancun.workers.dev/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback: "   " })
  });
  const emptyRes = await handleAuthAndLeaderboard(emptyReq, env, new URL(emptyReq.url));
  assert.equal(emptyRes.status, 400);

  // 4. GET /api/feedback retrieves stored feedback list
  const getReq = new Request("https://dhayam.cancun.workers.dev/api/feedback?limit=10");
  const getRes = await handleAuthAndLeaderboard(getReq, env, new URL(getReq.url));
  assert.equal(getRes.status, 200);
  const getJson = await getRes.json();
  assert.equal(getJson.ok, true);
  assert.ok(Array.isArray(getJson.feedback));
  assert.equal(getJson.feedback.length, 2);
});

test("client auth: feedback modal interactions and form submission", async () => {
  const mockStorage: Record<string, string> = {};
  let postedPayload: any = null;

  const mockFetch = async (url: string, options: any = {}) => {
    if (url.includes("/api/feedback") && options.method === "POST") {
      postedPayload = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        json: async () => ({
          ok: true,
          id: "fb_mock_123",
          message: "Thank you for your feedback!",
          timestamp: Math.floor(Date.now() / 1000)
        })
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  const sandbox = createClientSandbox(mockStorage, mockFetch);
  const authCode = fs.readFileSync(AUTH_JS_PATH, "utf-8");
  vm.createContext(sandbox);
  vm.runInContext(authCode, sandbox);

  const DhayamAuth = sandbox.DhayamAuth;
  assert.ok(DhayamAuth);
  assert.equal(typeof DhayamAuth.openFeedbackModal, "function");
  assert.equal(typeof DhayamAuth.closeFeedbackModal, "function");
  assert.equal(typeof DhayamAuth.submitFeedbackForm, "function");

  // Open modal
  DhayamAuth.openFeedbackModal();
  const modalBack = sandbox.document.getElementById("feedbackModalBack");
  assert.ok(modalBack.classList.contains("open"));

  // Submit feedback
  const textEl = sandbox.document.getElementById("feedbackText");
  const catEl = sandbox.document.getElementById("feedbackCategory");
  textEl.value = "Great multiplayer experience!";
  catEl.value = "multiplayer";

  await DhayamAuth.submitFeedbackForm();
  assert.ok(postedPayload);
  assert.equal(postedPayload.feedback, "Great multiplayer experience!");
  assert.equal(postedPayload.category, "multiplayer");

  // Close modal
  DhayamAuth.closeFeedbackModal();
  assert.equal(modalBack.classList.contains("open"), false);
});

test("social sharing: succinct, exciting text without meaningless player-specific phrases", () => {
  const appJsPath = path.join(ROOT_DIR, "site", "js", "app.js");
  const appContent = fs.readFileSync(appJsPath, "utf-8");

  // Must NOT include player placeholder phrases
  assert.ok(!appContent.includes("can you take the lead?"));
  assert.ok(!appContent.includes("Ashiwin"));
  assert.ok(!appContent.includes("${activePlayer.name}'s turn"));

  // Must include meaningful, exciting text
  assert.ok(appContent.includes("Roll the brass dice"));
  assert.ok(appContent.includes("Strike rivals and race to victory"));

  // Verify index.html Open Graph and Twitter Card tags
  const indexHtmlPath = path.join(ROOT_DIR, "site", "index.html");
  const htmlContent = fs.readFileSync(indexHtmlPath, "utf-8");

  assert.ok(htmlContent.includes('property="og:image" content="https://sethusrinivasan.github.io/dhayam/assets/preview.png"'));
  assert.ok(htmlContent.includes('name="twitter:image" content="https://sethusrinivasan.github.io/dhayam/assets/preview.png"'));
  assert.ok(htmlContent.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(htmlContent.includes('property="og:image:width" content="1200"'));
  assert.ok(htmlContent.includes('property="og:image:height" content="630"'));
  assert.ok(htmlContent.includes('rel="icon" type="image/svg+xml" href="favicon.svg"'));
  assert.ok(htmlContent.includes('rel="shortcut icon" href="favicon.ico"'));
  assert.ok(!htmlContent.includes("Dhayam (Dhayam (Dhayam))"));
});

test("regional_personas D1 table: queries frugal table for regional fake personas without external APIs", async () => {
  // Mock D1 environment with regional_personas table
  const mockRows = [
    { alias: "D1Liam", avatar_url: "🪔", total_score: 550, games_won: 6, games_played: 8, total_captures: 10 }
  ];

  const env = {
    AUTH_JWT_SECRET: TEST_SECRET,
    DB: {
      prepare(sql: string) {
        return {
          bind(...args: any[]) {
            return {
              async first() {
                if (sql.includes("COUNT(*)")) return { count: 0 };
                return null;
              },
              async all() {
                if (sql.includes("regional_personas")) {
                  return { results: mockRows };
                }
                return { results: [] };
              }
            };
          },
          async first() {
            if (sql.includes("COUNT(*)")) return { count: 0 };
            return null;
          },
          async all() {
            if (sql.includes("regional_personas")) {
              return { results: mockRows };
            }
            return { results: [] };
          }
        };
      }
    }
  };

  const req = new Request("https://dhayam.cancun.workers.dev/api/leaderboard?region=northAmerica");
  const res = await handleAuthAndLeaderboard(req, env, new URL(req.url));
  assert.ok(res);
  const data = await res.json();
  assert.equal(data.top10.length, 10);
  // First item must be masked D1Liam from the D1 table
  assert.equal(data.top10[0].alias, "D1L***", "Leaderboard must populate from regional_personas D1 table");
  assert.equal(data.top10[0].total_score, 550);
});

test("regional heuristics: accurately handles Indian VPN connections from US laptops", () => {
  // Case 1: Player in US connects via VPN in India
  // - Edge IP Country is IN
  // - Laptop OS timezone is still America/Los_Angeles
  // - Laptop OS language is en-US
  const vpnRegion = resolveRegionHeuristic({
    country: "IN",
    clientTz: "America/Los_Angeles",
    lang: "en-US",
    offset: 480
  });
  assert.equal(vpnRegion, "southAsia", "VPN with country IN must decisively resolve to southAsia");

  // Case 2: Virtual VPN routing to India via Singapore datacenter
  // - Exit node is SG
  // - Device clock offset is IST (-330 minutes = UTC+5:30)
  const virtualVpnRegion = resolveRegionHeuristic({
    country: "SG",
    offset: -330,
    lang: "en-IN"
  });
  assert.equal(virtualVpnRegion, "southAsia", "Virtual VPN with IST offset -330 must resolve to southAsia");

  // Case 3: Native US visitor
  const usRegion = resolveRegionHeuristic({
    country: "US",
    clientTz: "America/New_York",
    lang: "en-US",
    offset: 300
  });
  assert.equal(usRegion, "northAmerica", "Native US visitor must resolve to northAmerica");

  // Case 4: Explicit user preference overrides network location
  const overrideRegion = resolveRegionHeuristic({
    country: "US",
    requestedRegion: "southAsia"
  });
  assert.equal(overrideRegion, "southAsia", "Explicit user override must take highest priority");

  // Case 5: French VPN connection
  // - Edge IP Country is FR
  // - Client timezone is Europe/Paris or offset is CET (-60)
  // - Client language is fr-FR
  const frRegion = resolveRegionHeuristic({
    country: "FR",
    clientTz: "Europe/Paris",
    lang: "fr-FR",
    offset: -60
  });
  assert.equal(frRegion, "europe", "French VPN with country FR must decisively resolve to europe");

  // Case 6: French language preference on generic European/Global network
  const frLangRegion = resolveRegionHeuristic({
    country: "BE",
    lang: "fr",
    offset: -60
  });
  assert.equal(frLangRegion, "europe", "French language preference must resolve to europe");
});

test("leaderboard: serves authentic French / European personas for visitors connecting from France", async () => {
  const env = { AUTH_JWT_SECRET: TEST_SECRET };
  IN_MEMORY_DB.users.clear();
  IN_MEMORY_DB.stats.clear();
  IN_MEMORY_DB.submissions.clear();

  const frReq = new Request("https://dhayam.cancun.workers.dev/api/leaderboard?country=FR&tz=Europe/Paris&lang=fr-FR");
  const frRes = await handleAuthAndLeaderboard(frReq, env, new URL(frReq.url));
  assert.ok(frRes);
  const frData = await frRes.json();
  assert.equal(frData.top10.length, 10);
  assert.equal(frData.detected.region, "europe");

  // In unauthenticated view, aliases are masked ("Ant***", "Cam***", "Lou***", "Man***")
  const frAliases = frData.top10.map((u: any) => u.alias);
  assert.ok(frAliases.includes("Ant***") || frAliases.includes("Cam***") || frAliases.includes("Lou***") || frAliases.includes("Man***"),
    "French visitor must see authentic French personas (Antoine, Camille, Louis, Manon, etc.)");
});

test("client personas & auth: setRegionPreference and edge handshake sync properly", () => {
  const personasJsPath = path.join(ROOT_DIR, "site", "js", "personas.js");
  const personasContent = fs.readFileSync(personasJsPath, "utf-8");
  const authJsContent = fs.readFileSync(AUTH_JS_PATH, "utf-8");

  const storageMock: Record<string, string> = {};
  const sandbox: any = {
    URLSearchParams,
    URL,
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      location: { search: "", pathname: "/", origin: "https://sethusrinivasan.github.io", hash: "" },
      history: { replaceState: () => {} }
    },
    navigator: { language: "en-US", languages: ["en-US"] },
    Intl: {
      DateTimeFormat: () => ({
        resolvedOptions: () => ({ timeZone: "America/Los_Angeles" })
      })
    },
    localStorage: {
      getItem: (k: string) => storageMock[k] || null,
      setItem: (k: string, v: string) => { storageMock[k] = String(v); },
      removeItem: (k: string) => { delete storageMock[k]; }
    },
    sessionStorage: {
      getItem: (k: string) => storageMock["session_" + k] || null,
      setItem: (k: string, v: string) => { storageMock["session_" + k] = String(v); },
      removeItem: (k: string) => { delete storageMock["session_" + k]; }
    },
    document: {
      getElementById: (id: string) => ({
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        removeAttribute: () => {},
        setAttribute: () => {},
        addEventListener: () => {},
        value: "",
        textContent: "",
        innerHTML: ""
      }),
      addEventListener: () => {},
      readyState: "complete"
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({
        top10: [],
        currentUser: null,
        detected: { country: "IN", region: "southAsia" }
      })
    })
  };
  sandbox.location = { search: "", pathname: "/", origin: "https://sethusrinivasan.github.io", hash: "" };
  sandbox.history = { replaceState: () => {} };
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(personasContent, sandbox);
  vm.runInContext(authJsContent, sandbox);

  assert.equal(typeof sandbox.window.setClientRegion, "function");
  assert.equal(typeof sandbox.window.getClientRegion, "function");
  assert.equal(typeof sandbox.DhayamAuth.setRegionPreference, "function");

  // Server edge handshake sets southAsia
  sandbox.window.setClientRegion("southAsia", { country: "IN" });
  assert.equal(sandbox.window.getClientRegion(), "southAsia", "Edge handshake must set client region to southAsia");

  // User explicitly selects northAmerica
  sandbox.DhayamAuth.setRegionPreference("northAmerica");
  assert.equal(sandbox.window.getClientRegion(), "northAmerica", "Explicit user preference must override edge detection");
  assert.equal(sandbox.localStorage.getItem("dhayam_user_region"), "northAmerica");
});


