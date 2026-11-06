/**
 * auth.js - OAuth Authentication, Cloudflare D1 Leaderboard & Player Stats
 *
 * Implements Google & GitHub OAuth client flows, secure session synchronization,
 * Global Top 10 Leaderboard rendering, and game score tracking with retroactive
 * guest win claims.
 */
"use strict";

(function () {
  const CONFIG = (typeof window !== "undefined" && window.AUTH_CONFIG) || {
    googleClientId: "764310467229-rkh1lrv0tclv07d8q10dj426didl1u8f.apps.googleusercontent.com",
    githubClientId: "Ov23liHwuHgasom2EnpI",
    apiBase: ""
  };

  const API_BASE = CONFIG.apiBase || "";

  let currentUser = null;
  let currentStats = null;
  let currentRank = null;

  function safeEscape(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getAvatarMarkup(avatarUrl, alias, size = 32) {
    if (avatarUrl && (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://") || avatarUrl.startsWith("data:"))) {
      return '<img src="' + safeEscape(avatarUrl) + '" alt="' + safeEscape(alias) + '" class="leaderboard-avatar" style="width:' + size + 'px;height:' + size + 'px;" onerror="this.src=\'assets/qr-dhayam.svg\'">';
    }
    const initial = (alias || "P").charAt(0).toUpperCase();
    return '<div class="leaderboard-avatar" style="width:' + size + 'px;height:' + size + 'px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:' + (size * 0.45) + 'px;background:#b45309;color:#fff;">' +
      safeEscape(initial) +
      '</div>';
  }

  function getAuthHeaders(extraHeaders = {}) {
    const headers = { ...extraHeaders };
    try {
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("dhayam_auth_token") : null;
      if (token) {
        headers["Authorization"] = "Bearer " + token;
      }
    } catch {}
    return headers;
  }

  async function fetchAuthStatus() {
    try {
      const res = await fetch(API_BASE + "/api/auth/me", {
        headers: getAuthHeaders(),
        credentials: "include"
      });
      if (!res.ok) {
        if (res.status === 401) {
          try { localStorage.removeItem("dhayam_auth_token"); } catch {}
        }
        currentUser = null;
        updateAuthPill();
        return;
      }
      const data = await res.json();
      if (data && data.user) {
        currentUser = data.user;
        currentStats = data.stats || null;
        currentRank = data.rank || null;
        updateAuthPill();
        checkPendingWin();
      } else {
        currentUser = null;
        updateAuthPill();
      }
    } catch {
      currentUser = null;
      updateAuthPill();
    }
  }

  function updateAuthPill() {
    const pill = document.getElementById("authPill");
    const menuBtn = document.getElementById("menuAuthBtn");
    if (!pill) return;

    if (currentUser) {
      const rankText = currentRank ? "#" + currentRank : "";
      pill.classList.add("auth-pill-signed-in");
      pill.innerHTML = getAvatarMarkup(currentUser.avatar_url, currentUser.alias, 20) +
        '<span>' + safeEscape(currentUser.alias) + '</span>' +
        (rankText ? '<span class="auth-pill-rank-badge">' + rankText + '</span>' : '');
      pill.setAttribute("aria-label", "Signed in as " + currentUser.alias + ". Click for profile.");
      if (menuBtn) {
        menuBtn.textContent = "👤 Profile (" + currentUser.alias + ")";
      }
    } else {
      pill.classList.remove("auth-pill-signed-in");
      pill.innerHTML = '👤 <span>Sign In</span>';
      pill.setAttribute("aria-label", "Sign in with Google or GitHub");
      if (menuBtn) {
        menuBtn.textContent = "👤 Sign in / Profile";
      }
    }
  }

  async function openLeaderboard() {
    const modalBack = document.getElementById("leaderboardModalBack");
    const listEl = document.getElementById("leaderboardList");
    const stickyEl = document.getElementById("leaderboardStickyUser");
    if (!modalBack) return;

    modalBack.classList.add("open");
    modalBack.removeAttribute("hidden");

    if (listEl) {
      listEl.innerHTML = '<div style="text-align:center;padding:24px;color:#d8c4ab;">Loading global rankings...</div>';
    }

    try {
      const res = await fetch(API_BASE + "/api/leaderboard", {
        headers: getAuthHeaders(),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to load rankings");
      const data = await res.json();
      renderLeaderboard(data.top10 || [], data.currentUser || null);
    } catch (err) {
      if (listEl) {
        listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#f87171;">Unable to load leaderboard. Please check your connection.</div>';
      }
    }
  }

  function closeLeaderboard() {
    const modalBack = document.getElementById("leaderboardModalBack");
    if (modalBack) {
      modalBack.classList.remove("open");
      modalBack.setAttribute("hidden", "true");
    }
  }

  function renderLeaderboard(top10, userStanding) {
    const listEl = document.getElementById("leaderboardList");
    const stickyEl = document.getElementById("leaderboardStickyUser");
    if (!listEl) return;

    if (top10.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:24px;color:#d8c4ab;">No rankings recorded yet. Be the first to win and set the record!</div>';
    } else {
      let html = "";
      top10.forEach((leader, idx) => {
        const rank = idx + 1;
        let rankClass = "rank-" + rank;
        let rankBadge = "#" + rank;
        if (rank === 1) rankBadge = "🥇";
        else if (rank === 2) rankBadge = "🥈";
        else if (rank === 3) rankBadge = "🥉";

        html += '<div class="leaderboard-item ' + rankClass + '">' +
          '<div class="leaderboard-rank">' + rankBadge + '</div>' +
          getAvatarMarkup(leader.avatar_url, leader.alias, 34) +
          '<div class="leaderboard-name-col">' +
            '<div class="leaderboard-alias">' + safeEscape(leader.alias) + '</div>' +
            '<div class="leaderboard-substats">' + leader.games_won + ' wins · ' + (leader.total_captures || 0) + ' captures</div>' +
          '</div>' +
          '<div class="leaderboard-score-badge">' +
            '<div class="leaderboard-score-value">' + (leader.total_score || 0) + '</div>' +
            '<div class="leaderboard-score-label">Points</div>' +
          '</div>' +
        '</div>';
      });
      listEl.innerHTML = html;
    }

    if (stickyEl) {
      if (currentUser && userStanding) {
        currentRank = userStanding.global_rank;
        updateAuthPill();
        stickyEl.innerHTML = '<div class="personal-rank-card">' +
          '<div class="personal-rank-card-header">Your Global Standing</div>' +
          '<div class="personal-rank-body">' +
            '<div class="leaderboard-rank" style="color:#ffd166;font-size:16px;">#' + userStanding.global_rank + '</div>' +
            getAvatarMarkup(currentUser.avatar_url, currentUser.alias, 34) +
            '<div class="leaderboard-name-col">' +
              '<div class="leaderboard-alias">' + safeEscape(currentUser.alias) + '</div>' +
              '<div class="leaderboard-substats">' + (userStanding.games_won || 0) + ' wins · ' + (userStanding.total_captures || 0) + ' captures</div>' +
            '</div>' +
            '<div class="leaderboard-score-badge">' +
              '<div class="leaderboard-score-value">' + (userStanding.total_score || 0) + '</div>' +
              '<div class="leaderboard-score-label">Points</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      } else {
        stickyEl.innerHTML = '<div class="personal-rank-card">' +
          '<div class="personal-rank-guest">' +
            '<p>Playing as <strong>Guest</strong>. Sign in to save your game scores and earn your rank!</p>' +
            '<div style="display:flex;gap:8px;justify-content:center;">' +
              '<button type="button" class="btn" style="padding:6px 14px;font-size:12px;" onclick="DhayamAuth.openAuthModal()">Sign in with Google / GitHub</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }
    }
  }

  function openAuthModal() {
    const modalBack = document.getElementById("authModalBack");
    const contentEl = document.getElementById("authModalContent");
    if (!modalBack || !contentEl) return;

    modalBack.classList.add("open");
    modalBack.removeAttribute("hidden");

    if (currentUser) {
      contentEl.innerHTML = '<div class="user-profile-view">' +
        '<div class="user-profile-header">' +
          getAvatarMarkup(currentUser.avatar_url, currentUser.alias, 56) +
          '<div class="user-profile-details">' +
            '<strong style="font-size:1.1rem;color:#ffd166;">' + safeEscape(currentUser.alias) + '</strong>' +
            '<div style="font-size:12px;color:#a8947e;margin-top:2px;">Provider: ' + safeEscape(currentUser.oauth_provider) + '</div>' +
            (currentRank ? '<div style="margin-top:4px;"><span class="auth-pill-rank-badge">Global Rank #' + currentRank + '</span></div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="user-stats-grid">' +
          '<div class="user-stat-box"><div class="user-stat-val">' + (currentStats ? currentStats.total_score : 0) + '</div><div class="user-stat-lbl">Total Score</div></div>' +
          '<div class="user-stat-box"><div class="user-stat-val">' + (currentStats ? currentStats.games_won : 0) + '</div><div class="user-stat-lbl">Wins</div></div>' +
          '<div class="user-stat-box"><div class="user-stat-val">' + (currentStats ? currentStats.total_captures : 0) + '</div><div class="user-stat-lbl">Captures</div></div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;margin-top:10px;justify-content:flex-end;">' +
          '<button type="button" class="btn secondary" onclick="DhayamAuth.closeAuthModal()">Close</button>' +
          '<button type="button" class="btn" style="background:#dc2626;border-color:#b91c1c;" onclick="DhayamAuth.logout()">Sign Out</button>' +
        '</div>' +
      '</div>';
    } else {
      contentEl.innerHTML = '<div>' +
        '<p style="color:#d8c4ab;font-size:13px;line-height:1.5;">' +
          'Sign in to link your game statistics, track wins and captures, and compete on the global leaderboard.' +
        '</p>' +
        '<div class="auth-providers-list">' +
          '<button type="button" class="btn-oauth btn-oauth-google" onclick="DhayamAuth.signInGoogle()">' +
            '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
            '<span>Continue with Google</span>' +
          '</button>' +
          '<button type="button" class="btn-oauth btn-oauth-github" onclick="DhayamAuth.signInGitHub()">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>' +
            '<span>Continue with GitHub</span>' +
          '</button>' +
        '</div>' +
        '<div class="auth-note">' +
          '🔒 Frugal & Private: We only store your alias, avatar, and game scores. We never store passwords or share your data.' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px;">' +
          '<button type="button" class="btn secondary" onclick="DhayamAuth.closeAuthModal()">Close</button>' +
        '</div>' +
      '</div>';
    }
  }

  function closeAuthModal() {
    const modalBack = document.getElementById("authModalBack");
    if (modalBack) {
      modalBack.classList.remove("open");
      modalBack.setAttribute("hidden", "true");
    }
  }

  function signInGoogle() {
    const returnUrl = encodeURIComponent(window.location.origin + window.location.pathname + "?auth_success=1");
    window.location.href = API_BASE + "/api/auth/google/login?return_to=" + returnUrl;
  }

  function signInGitHub() {
    const returnUrl = encodeURIComponent(window.location.origin + window.location.pathname + "?auth_success=1");
    window.location.href = API_BASE + "/api/auth/github/login?return_to=" + returnUrl;
  }

  async function logout() {
    try {
      await fetch(API_BASE + "/api/auth/logout", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include"
      });
    } catch {
      // Fallback ignore
    }
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("dhayam_auth_token");
      }
    } catch {}
    currentUser = null;
    currentStats = null;
    currentRank = null;
    updateAuthPill();
    closeAuthModal();
  }

  async function submitMatchResult(matchPayload) {
    try {
      const res = await fetch(API_BASE + "/api/stats/record", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(matchPayload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.stats) currentStats = data.stats;
        if (data.rank) currentRank = data.rank;
        updateAuthPill();
        const modalBack = document.getElementById("leaderboardModalBack");
        if (modalBack && modalBack.classList.contains("open")) {
          openLeaderboard();
        }
      }
    } catch {
      // Network error handled gracefully
    }
  }

  function checkPendingWin() {
    if (!currentUser) return;
    try {
      const pendingRaw = sessionStorage.getItem("dhayam_pending_win");
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw);
        sessionStorage.removeItem("dhayam_pending_win");
        submitMatchResult(pending);
      }
    } catch {
      // Storage unavailable
    }
  }

  function onGameWin(winner, score, captures) {
    if (!winner) return;
    const matchId = "match_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const turnsCount = (typeof game !== "undefined" && game && typeof game.turn === "number")
      ? game.turn
      : (typeof currentTurn !== "undefined" ? currentTurn : 30);
    const matchPayload = {
      matchId: matchId,
      isWinner: !winner.computer,
      turns: turnsCount,
      captures: captures || (winner.captured ? 1 : 0),
      score: score || 100
    };

    if (currentUser) {
      submitMatchResult(matchPayload);
    } else if (matchPayload.isWinner) {
      try {
        sessionStorage.setItem("dhayam_pending_win", JSON.stringify(matchPayload));
      } catch {
        // Storage fallback
      }
      // Inject claim banner into celebration if element exists
      const victoryModalContent = document.getElementById("modalContent");
      if (victoryModalContent) {
        const claimBanner = document.createElement("div");
        claimBanner.className = "victory-claim-card";
        claimBanner.innerHTML = '<p>🏆 You won as a Guest! Save this victory (+100 pts) to the Global Leaderboard:</p>' +
          '<div class="victory-claim-actions">' +
            '<button type="button" class="btn btn-victory-claim" onclick="DhayamAuth.signInGoogle()">Sign in with Google</button>' +
            '<button type="button" class="btn secondary btn-victory-claim" onclick="DhayamAuth.signInGitHub()">Sign in with GitHub</button>' +
          '</div>';
        victoryModalContent.appendChild(claimBanner);
      }
    }
  }

  // Initialize UI hooks on load
  function init() {
    const leaderboardBtn = document.getElementById("leaderboardBtn");
    const menuLeaderboardBtn = document.getElementById("menuLeaderboardBtn");
    const authPill = document.getElementById("authPill");
    const menuAuthBtn = document.getElementById("menuAuthBtn");

    if (leaderboardBtn) leaderboardBtn.addEventListener("click", openLeaderboard);
    if (menuLeaderboardBtn) menuLeaderboardBtn.addEventListener("click", openLeaderboard);
    if (authPill) authPill.addEventListener("click", openAuthModal);
    if (menuAuthBtn) menuAuthBtn.addEventListener("click", openAuthModal);

    // Escape key to close modals
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeLeaderboard();
        closeAuthModal();
      }
    });

    // Check for auth callback parameter or token in URL
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("auth_token");
    if (tokenFromUrl) {
      try {
        localStorage.setItem("dhayam_auth_token", tokenFromUrl);
      } catch {}
    }
    if (params.has("auth_success") || tokenFromUrl) {
      params.delete("auth_token");
      params.delete("auth_success");
      const cleanSearch = params.toString() ? "?" + params.toString() : "";
      const cleanUrl = window.location.origin + window.location.pathname + cleanSearch + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      setTimeout(openLeaderboard, 400);
    }

    fetchAuthStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  const DhayamAuth = {
    openLeaderboard: openLeaderboard,
    closeLeaderboard: closeLeaderboard,
    openAuthModal: openAuthModal,
    closeAuthModal: closeAuthModal,
    signInGoogle: signInGoogle,
    signInGitHub: signInGitHub,
    logout: logout,
    onGameWin: onGameWin,
    fetchAuthStatus: fetchAuthStatus,
    getCurrentUser: function () { return currentUser; }
  };

  if (typeof window !== "undefined") {
    window.DhayamAuth = DhayamAuth;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.DhayamAuth = DhayamAuth;
  }
})();
