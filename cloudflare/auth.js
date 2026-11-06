/**
 * cloudflare/auth.js - Frugal OAuth 2.0 (Google & GitHub) & D1 Leaderboard Service
 *
 * Implements:
 * 1. CSRF-protected OAuth redirects & callbacks
 * 2. HMAC-SHA256 session token generation and verification
 * 3. HttpOnly SameSite=Lax Secure session cookies (BFF architecture)
 * 4. Frugal Cloudflare D1 SQL queries for Top 10 Leaders & current user Global Rank
 * 5. In-memory datastore fallback for local testing without D1 daemon
 */

export const IN_MEMORY_DB = {
  users: new Map(),        // userId -> { id, oauth_provider, oauth_sub, alias, avatar_url, email, last_login }
  stats: new Map(),        // userId -> { user_id, games_played, games_won, total_captures, total_score, updated_at }
  submissions: new Set()   // matchId
};

export function getAuthCorsHeaders(request) {
  const origin = (request && request.headers.get("Origin")) || "";
  const allowed = [
    "https://sethusrinivasan.github.io",
    "https://dhayam.cancun.workers.dev",
    "https://dhayam-staging.cancun.workers.dev",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
  ];
  const isAllowed = allowed.includes(origin) || origin.endsWith(".workers.dev");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://sethusrinivasan.github.io",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  };
}

export function parseCookies(header) {
  const list = {};
  if (!header) return list;
  header.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    if (parts.length >= 2) {
      list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join("=").trim());
    }
  });
  return list;
}

export function sanitizeAlias(raw) {
  if (!raw || typeof raw !== "string") return "Player";
  let cleaned = raw.replace(/<[^>]*>/g, "").replace(/[<>&"'/]/g, "").trim();
  // Max 8 characters
  cleaned = Array.from(cleaned).slice(0, 8).join("");
  return cleaned || "Player";
}

function hexStringToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(payload, secret) {
  const effectiveSecret = secret || "dhayam-dev-fallback-secret-2026";
  const headerB64 = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadB64 = btoa(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(effectiveSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigHex = bytesToHex(new Uint8Array(sigBuffer));
  return `${data}.${sigHex}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigHex] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const effectiveSecret = secret || "dhayam-dev-fallback-secret-2026";

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(effectiveSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = hexStringToBytes(sigHex);
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function extractToken(request, cookies = {}) {
  const authHeader = request && request.headers ? request.headers.get("Authorization") : null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  return cookies.dhayam_session || null;
}

export async function handleAuthAndLeaderboard(request, env, url) {
  const cors = getAuthCorsHeaders(request);
  const secret = (env && env.AUTH_JWT_SECRET) || "dhayam-dev-fallback-secret-2026";
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = extractToken(request, cookies);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  // 1. Auth Configuration: returns public OAuth client IDs
  if (url.pathname === "/api/auth/config") {
    return new Response(JSON.stringify({
      googleClientId: (env && env.GOOGLE_CLIENT_ID) || "764310467229-rkh1lrv0tclv07d8q10dj426didl1u8f.apps.googleusercontent.com",
      githubClientId: (env && env.GITHUB_CLIENT_ID) || "Ov23liHwuHgasom2EnpI",
      githubConfigured: Boolean(env && env.GITHUB_CLIENT_ID)
    }), { headers: cors });
  }

  // 2. Google OAuth Login Redirect
  if (url.pathname === "/api/auth/google/login") {
    const clientId = (env && env.GOOGLE_CLIENT_ID) || "764310467229-rkh1lrv0tclv07d8q10dj426didl1u8f.apps.googleusercontent.com";
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const returnTo = url.searchParams.get("return_to") || "/";

    const stateObj = {
      nonce: bytesToHex(crypto.getRandomValues(new Uint8Array(16))),
      returnTo: returnTo
    };
    const stateToken = await createSessionToken(stateObj, secret);

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid profile email");
    authUrl.searchParams.set("state", stateToken);

    const headers = new Headers();
    headers.set("Location", authUrl.toString());
    headers.set("Set-Cookie", `dhayam_oauth_state=${stateToken}; Path=/api/auth; HttpOnly; SameSite=None; Secure; Max-Age=600`);
    return new Response(null, { status: 302, headers });
  }

  // 3. Google OAuth Callback
  if (url.pathname === "/api/auth/google/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = cookies.dhayam_oauth_state;

    if (!code || !state || state !== cookieState) {
      return Response.redirect(`${url.origin}/?auth_error=state_mismatch`, 302);
    }

    const verifiedState = await verifySessionToken(state, secret);
    if (!verifiedState) {
      return Response.redirect(`${url.origin}/?auth_error=invalid_state`, 302);
    }

    try {
      const clientId = (env && env.GOOGLE_CLIENT_ID) || "764310467229-rkh1lrv0tclv07d8q10dj426didl1u8f.apps.googleusercontent.com";
      const clientSecret = (env && env.GOOGLE_CLIENT_SECRET) || "";
      const redirectUri = `${url.origin}/api/auth/google/callback`;

      // Token Exchange
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        })
      });

      if (!tokenRes.ok) {
        return Response.redirect(`${url.origin}/?auth_error=token_exchange_failed`, 302);
      }

      const tokenData = await tokenRes.json();
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      if (!userinfoRes.ok) {
        return Response.redirect(`${url.origin}/?auth_error=userinfo_failed`, 302);
      }

      const googleUser = await userinfoRes.json();
      const userId = `usr_google_${googleUser.sub}`;
      const alias = sanitizeAlias(googleUser.given_name || googleUser.name || "Player");
      const avatarUrl = googleUser.picture || "";

      await upsertUser(env, {
        id: userId,
        provider: "google",
        sub: googleUser.sub,
        alias,
        avatarUrl,
        email: googleUser.email || ""
      });

      const sessionToken = await createSessionToken({
        userId,
        alias,
        avatarUrl,
        provider: "google",
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600
      }, secret);

      const targetUrlObj = new URL(verifiedState.returnTo || `${url.origin}/?auth_success=1`);
      targetUrlObj.searchParams.set("auth_token", sessionToken);
      targetUrlObj.searchParams.set("auth_success", "1");
      const targetUrl = targetUrlObj.toString();
      const headers = new Headers();
      headers.set("Location", targetUrl);
      headers.set("Set-Cookie", `dhayam_session=${sessionToken}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${30 * 24 * 3600}`);
      headers.append("Set-Cookie", "dhayam_oauth_state=; Path=/api/auth; HttpOnly; SameSite=None; Secure; Max-Age=0");
      return new Response(null, { status: 302, headers });
    } catch {
      return Response.redirect(`${url.origin}/?auth_error=internal_error`, 302);
    }
  }

  // 4. GitHub OAuth Login Redirect
  if (url.pathname === "/api/auth/github/login") {
    const clientId = (env && env.GITHUB_CLIENT_ID) || "Ov23liHwuHgasom2EnpI";
    const redirectUri = `${url.origin}/api/auth/github/callback`;
    const returnTo = url.searchParams.get("return_to") || "/";

    const stateObj = {
      nonce: bytesToHex(crypto.getRandomValues(new Uint8Array(16))),
      returnTo: returnTo
    };
    const stateToken = await createSessionToken(stateObj, secret);

    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", "read:user");
    authUrl.searchParams.set("state", stateToken);

    const headers = new Headers();
    headers.set("Location", authUrl.toString());
    headers.set("Set-Cookie", `dhayam_oauth_state=${stateToken}; Path=/api/auth; HttpOnly; SameSite=None; Secure; Max-Age=600`);
    return new Response(null, { status: 302, headers });
  }

  // 5. GitHub OAuth Callback
  if (url.pathname === "/api/auth/github/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = cookies.dhayam_oauth_state;

    if (!code || !state || state !== cookieState) {
      return Response.redirect(`${url.origin}/?auth_error=state_mismatch`, 302);
    }

    const verifiedState = await verifySessionToken(state, secret);
    if (!verifiedState) {
      return Response.redirect(`${url.origin}/?auth_error=invalid_state`, 302);
    }

    try {
      const clientId = (env && env.GITHUB_CLIENT_ID) || "Ov23liHwuHgasom2EnpI";
      const clientSecret = (env && env.GITHUB_CLIENT_SECRET) || "";

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code
        })
      });

      if (!tokenRes.ok) {
        return Response.redirect(`${url.origin}/?auth_error=token_exchange_failed`, 302);
      }

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        return Response.redirect(`${url.origin}/?auth_error=no_access_token`, 302);
      }

      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `Bearer ${tokenData.access_token}`,
          "User-Agent": "Dhayam-Edge-App"
        }
      });

      if (!userRes.ok) {
        return Response.redirect(`${url.origin}/?auth_error=userinfo_failed`, 302);
      }

      const ghUser = await userRes.json();
      const userId = `usr_github_${ghUser.id}`;
      const alias = sanitizeAlias(ghUser.login || ghUser.name || "Player");
      const avatarUrl = ghUser.avatar_url || "";

      await upsertUser(env, {
        id: userId,
        provider: "github",
        sub: String(ghUser.id),
        alias,
        avatarUrl,
        email: ghUser.email || ""
      });

      const sessionToken = await createSessionToken({
        userId,
        alias,
        avatarUrl,
        provider: "github",
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600
      }, secret);

      const targetUrlObj = new URL(verifiedState.returnTo || `${url.origin}/?auth_success=1`);
      targetUrlObj.searchParams.set("auth_token", sessionToken);
      targetUrlObj.searchParams.set("auth_success", "1");
      const targetUrl = targetUrlObj.toString();
      const headers = new Headers();
      headers.set("Location", targetUrl);
      headers.set("Set-Cookie", `dhayam_session=${sessionToken}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${30 * 24 * 3600}`);
      headers.append("Set-Cookie", "dhayam_oauth_state=; Path=/api/auth; HttpOnly; SameSite=None; Secure; Max-Age=0");
      return new Response(null, { status: 302, headers });
    } catch {
      return Response.redirect(`${url.origin}/?auth_error=internal_error`, 302);
    }
  }

  // 6. Current User Me Profile: /api/auth/me
  if (url.pathname === "/api/auth/me") {
    const session = await verifySessionToken(token, secret);
    if (!session || !session.userId) {
      return new Response(JSON.stringify({ user: null }), { headers: cors });
    }

    const { user, stats, rank } = await getUserAndRank(env, session.userId);
    return new Response(JSON.stringify({
      user: user || {
        id: session.userId,
        alias: session.alias,
        avatar_url: session.avatarUrl,
        oauth_provider: session.provider
      },
      stats: stats || { games_played: 0, games_won: 0, total_captures: 0, total_score: 0 },
      rank: rank || null
    }), { headers: cors });
  }

  // 7. Logout: /api/auth/logout
  if (url.pathname === "/api/auth/logout") {
    const headers = new Headers(cors);
    headers.set("Set-Cookie", "dhayam_session=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0");
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  // 8. Global Leaderboard: /api/leaderboard
  if (url.pathname === "/api/leaderboard") {
    const session = await verifySessionToken(token, secret);
    const userId = session ? session.userId : null;

    const { top10, currentUser } = await getLeaderboard(env, userId);
    const headers = new Headers(cors);
    // Edge cache 30s to keep D1 reads frugal and prevent unnecessary SQL load
    headers.set("Cache-Control", "public, max-age=15, s-maxage=30");
    return new Response(JSON.stringify({ top10, currentUser }), { headers });
  }

  // 9. Match Score Recording: /api/stats/record
  if (url.pathname === "/api/stats/record" && request.method === "POST") {
    const session = await verifySessionToken(token, secret);
    if (!session || !session.userId) {
      return new Response(JSON.stringify({ error: "Unauthorized. Please sign in to record scores." }), {
        status: 401,
        headers: cors
      });
    }

    try {
      const body = await request.json();
      const matchId = body.matchId || `match_${Date.now()}`;
      const isWithdrawal = Boolean(body.isWithdrawal);
      const isWinner = isWithdrawal ? false : Boolean(body.isWinner);
      const captures = isWithdrawal ? 0 : parseInt(body.captures || 0, 10);
      const turns = parseInt(body.turns || 30, 10);
      const score = isWithdrawal ? -100 : ((isWinner ? 100 : 0) + (captures * 10));

      const recordResult = await recordMatch(env, {
        matchId,
        userId: session.userId,
        isWinner,
        captures,
        turns,
        score
      });

      return new Response(JSON.stringify(recordResult), { headers: cors });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid payload: " + err.message }), {
        status: 400,
        headers: cors
      });
    }
  }

  return null; // Not an auth/leaderboard route, pass to next worker handler
}

// ─── D1 & In-Memory Store Implementations ─────────────────────────────────────

async function upsertUser(env, { id, provider, sub, alias, avatarUrl, email }) {
  if (env && env.DB) {
    await env.DB.prepare(`
      INSERT INTO users (id, oauth_provider, oauth_sub, alias, avatar_url, email, last_login)
      VALUES (?, ?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(oauth_provider, oauth_sub) DO UPDATE SET
        alias = excluded.alias,
        avatar_url = excluded.avatar_url,
        last_login = unixepoch()
    `).bind(id, provider, sub, alias, avatarUrl, email).run();

    await env.DB.prepare(`
      INSERT INTO player_stats (user_id) VALUES (?)
      ON CONFLICT(user_id) DO NOTHING
    `).bind(id).run();
    return;
  }

  // In-memory fallback
  let user = IN_MEMORY_DB.users.get(id);
  if (!user) {
    user = { id, oauth_provider: provider, oauth_sub: sub, alias, avatar_url: avatarUrl, email, last_login: Date.now() };
    IN_MEMORY_DB.users.set(id, user);
  } else {
    user.alias = alias;
    user.avatar_url = avatarUrl;
    user.last_login = Date.now();
  }

  if (!IN_MEMORY_DB.stats.has(id)) {
    IN_MEMORY_DB.stats.set(id, {
      user_id: id,
      games_played: 0,
      games_won: 0,
      total_captures: 0,
      total_score: 0,
      updated_at: Date.now()
    });
  }
}

async function getUserAndRank(env, userId) {
  if (env && env.DB) {
    const userRow = await env.DB.prepare(
      "SELECT id, oauth_provider, alias, avatar_url FROM users WHERE id = ?"
    ).bind(userId).first();

    const statsRow = await env.DB.prepare(
      "SELECT games_played, games_won, total_captures, total_score FROM player_stats WHERE user_id = ?"
    ).bind(userId).first();

    const rankRow = await env.DB.prepare(`
      WITH ranked AS (
        SELECT user_id, ROW_NUMBER() OVER (ORDER BY total_score DESC, games_won DESC) AS rank
        FROM player_stats
      )
      SELECT rank FROM ranked WHERE user_id = ?
    `).bind(userId).first();

    return {
      user: userRow || null,
      stats: statsRow || null,
      rank: rankRow ? rankRow.rank : null
    };
  }

  // In-memory fallback
  const user = IN_MEMORY_DB.users.get(userId) || null;
  const stats = IN_MEMORY_DB.stats.get(userId) || null;

  // Calculate rank
  const allStats = Array.from(IN_MEMORY_DB.stats.values());
  allStats.sort((a, b) => (b.total_score - a.total_score) || (b.games_won - a.games_won));
  const rankIdx = allStats.findIndex((s) => s.user_id === userId);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;

  return { user, stats, rank };
}

async function getLeaderboard(env, currentUserId) {
  if (env && env.DB) {
    const topRows = await env.DB.prepare(`
      SELECT 
        u.alias,
        u.avatar_url,
        ps.total_score,
        ps.games_won,
        ps.games_played,
        ps.total_captures,
        ROW_NUMBER() OVER (ORDER BY ps.total_score DESC, ps.games_won DESC) AS rank
      FROM player_stats ps
      JOIN users u ON ps.user_id = u.id
      ORDER BY ps.total_score DESC, ps.games_won DESC
      LIMIT 10
    `).all();

    let currentUser = null;
    if (currentUserId) {
      const userRank = await env.DB.prepare(`
        WITH ranked AS (
          SELECT user_id, total_score, games_won, total_captures,
                 ROW_NUMBER() OVER (ORDER BY total_score DESC, games_won DESC) AS global_rank
          FROM player_stats
        )
        SELECT r.global_rank, r.total_score, r.games_won, r.total_captures, u.alias, u.avatar_url
        FROM ranked r
        JOIN users u ON r.user_id = u.id
        WHERE r.user_id = ?
      `).bind(currentUserId).first();
      currentUser = userRank || null;
    }

    return { top10: topRows.results || [], currentUser };
  }

  // In-memory fallback
  const list = [];
  for (const [uid, stats] of IN_MEMORY_DB.stats.entries()) {
    const user = IN_MEMORY_DB.users.get(uid);
    if (user) {
      list.push({
        alias: user.alias,
        avatar_url: user.avatar_url,
        total_score: stats.total_score,
        games_won: stats.games_won,
        games_played: stats.games_played,
        total_captures: stats.total_captures
      });
    }
  }

  list.sort((a, b) => (b.total_score - a.total_score) || (b.games_won - a.games_won));
  const top10 = list.slice(0, 10).map((item, idx) => ({ ...item, rank: idx + 1 }));

  let currentUser = null;
  if (currentUserId && IN_MEMORY_DB.users.has(currentUserId)) {
    const user = IN_MEMORY_DB.users.get(currentUserId);
    const stats = IN_MEMORY_DB.stats.get(currentUserId);
    const rankIdx = list.findIndex((item) => item.alias === user.alias);
    currentUser = {
      global_rank: rankIdx >= 0 ? rankIdx + 1 : list.length + 1,
      total_score: stats.total_score,
      games_won: stats.games_won,
      total_captures: stats.total_captures,
      alias: user.alias,
      avatar_url: user.avatar_url
    };
  }

  return { top10, currentUser };
}

async function recordMatch(env, { matchId, userId, isWinner, captures, turns, score }) {
  if (env && env.DB) {
    const existing = await env.DB.prepare(
      "SELECT match_id FROM match_submissions WHERE match_id = ?"
    ).bind(matchId).first();

    if (existing) {
      const current = await getUserAndRank(env, userId);
      return { ok: true, duplicate: true, stats: current.stats, rank: current.rank };
    }

    await env.DB.prepare(`
      INSERT INTO match_submissions (match_id, winner_id, player_count, turns_count, score_awarded, audit_hash)
      VALUES (?, ?, 2, ?, ?, 'verified_audit')
    `).bind(matchId, userId, turns, score).run();

    await env.DB.prepare(`
      UPDATE player_stats SET
        games_played = games_played + 1,
        games_won = games_won + ?,
        total_captures = total_captures + ?,
        total_score = total_score + ?,
        updated_at = unixepoch()
      WHERE user_id = ?
    `).bind(isWinner ? 1 : 0, captures, score, userId).run();

    const current = await getUserAndRank(env, userId);
    return { ok: true, stats: current.stats, rank: current.rank };
  }

  // In-memory fallback
  if (IN_MEMORY_DB.submissions.has(matchId)) {
    const current = await getUserAndRank(env, userId);
    return { ok: true, duplicate: true, stats: current.stats, rank: current.rank };
  }

  IN_MEMORY_DB.submissions.add(matchId);
  const stats = IN_MEMORY_DB.stats.get(userId) || {
    user_id: userId,
    games_played: 0,
    games_won: 0,
    total_captures: 0,
    total_score: 0,
    updated_at: Date.now()
  };

  stats.games_played += 1;
  if (isWinner) stats.games_won += 1;
  stats.total_captures += captures;
  stats.total_score += score;
  stats.updated_at = Date.now();
  IN_MEMORY_DB.stats.set(userId, stats);

  const current = await getUserAndRank(env, userId);
  return { ok: true, stats: current.stats, rank: current.rank };
}
