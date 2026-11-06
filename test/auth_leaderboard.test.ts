import assert from "node:assert/strict";
import test from "node:test";
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
