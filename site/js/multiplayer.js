/**
 * multiplayer.js - Peer-to-Peer Real-Time Multiplayer Engine
 *
 * Implements serverless online multiplayer using WebRTC DataChannels (via PeerJS).
 * Supports host room creation, shareable invite links, camera QR-code joining,
 * state synchronization across browsers, action forwarding, and animated reactions.
 */
"use strict";

const MP_PREFIX = "dhayam-v1-";

/**
 * Generate a random 5-character room code (alphanumeric, uppercase, unambiguous)
 */
function generateRoomCode() {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  const randomBytes = new Uint8Array(5);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < 5; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}

/**
 * Build shareable room invite link
 */
function getRoomInviteUrl(code) {
  const base = window.location.origin + window.location.pathname;
  return base + "?join=" + code;
}

/**
 * Serialize game state suitable for transmission over WebRTC DataChannel
 */
function serializeGameState() {
  if (!game) return null;
  return {
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      seat: p.seat,
      captured: p.captured,
      rank: p.rank,
      pieces: p.pieces.map((q) => ({ id: q.id, progress: q.progress })),
    })),
    current: game.current,
    phase: game.phase,
    pool: [...game.pool],
    history: [...game.history],
    last: game.last ? { ...game.last } : null,
    turn: game.turn,
    finished: game.finished,
    openingEntryPlayers: [...game.openingEntryPlayers],
  };
}

/**
 * Apply state received from authoritative Host
 */
function applyRemoteState(remoteGame, remoteAudit) {
  if (!remoteGame) return;
  game.players = remoteGame.players;
  game.current = remoteGame.current;
  game.phase = remoteGame.phase;
  game.pool = remoteGame.pool;
  game.history = remoteGame.history;
  game.last = remoteGame.last;
  game.turn = remoteGame.turn;
  game.finished = remoteGame.finished;
  game.openingEntryPlayers = remoteGame.openingEntryPlayers || [];

  selectedRoll = 0;
  selectedPieceId = null;

  if (remoteAudit && audit && audit.events) {
    audit.events = remoteAudit;
  }
  render();
}

/**
 * Host broadcasts current state to all connected guest peers
 */
function broadcastState(extra = {}) {
  if (!multiplayer.active || !multiplayer.isHost) return;
  const payload = {
    type: "SYNC_STATE",
    game: serializeGameState(),
    audit: audit ? audit.events : [],
    ...extra,
  };
  multiplayer.connections.forEach((conn) => {
    if (conn.open) {
      try {
        conn.send(payload);
      } catch (err) {
        console.warn("Failed to send state to peer:", err);
      }
    }
  });
  updateMultiplayerBadge();
}

/**
 * Guest transmits an action (roll or move) to the host
 */
function sendPlayerAction(action) {
  if (!multiplayer.active || multiplayer.isHost) return false;
  const conn = multiplayer.connections[0];
  if (!conn || !conn.open) {
    showModal("Connection Lost", "<p>Lost connection to the host player. Please rejoin the room.</p>", "OK", () => {});
    return false;
  }
  conn.send({
    type: "ACTION",
    seat: multiplayer.mySeat,
    action,
  });
  return true;
}

/**
 * Send floating emote reaction to all peers
 */
function broadcastEmote(emote) {
  if (!multiplayer.active) return;
  const p = game && game.players ? game.players[multiplayer.mySeat] : null;
  const name = p ? p.name : "Player";
  displayFloatingEmote(emote, name);

  const payload = { type: "EMOTE", emote, name, seat: multiplayer.mySeat };
  if (multiplayer.isHost) {
    multiplayer.connections.forEach((conn) => {
      if (conn.open) conn.send(payload);
    });
  } else if (multiplayer.connections[0]?.open) {
    multiplayer.connections[0].send(payload);
  }
}

/**
 * Render floating animated reaction emoji over board
 */
function displayFloatingEmote(emote, senderName) {
  const boardWrap = document.querySelector(".boardwrap");
  if (!boardWrap) return;
  const bubble = document.createElement("div");
  bubble.className = "floating-emote";
  bubble.innerHTML = '<span class="emote-icon">' + escapeHtml(emote) + '</span><span class="emote-name">' + escapeHtml(senderName) + '</span>';
  boardWrap.appendChild(bubble);
  setTimeout(() => bubble.remove(), 2600);
}

/**
 * Start hosting an online match
 */
function hostOnlineGame(playerCount = 2) {
  if (typeof Peer === "undefined") {
    showModal("Multiplayer Unavailable", "<p>WebRTC library is loading. Please try again in a few seconds.</p>", "OK", () => {});
    return;
  }

  // Cleanup any existing peer
  leaveMultiplayer();

  const code = generateRoomCode();
  const peerId = MP_PREFIX + code;

  multiplayer.active = true;
  multiplayer.isHost = true;
  multiplayer.roomCode = code;
  multiplayer.mySeat = 0;
  multiplayer.connections = [];
  multiplayer.roomTargetCount = playerCount;
  multiplayer.status = "hosting";

  // Initialize Host's game engine
  newGame(playerCount, 0);

  const peer = new Peer(peerId, {
    debug: 1,
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" },
      ],
    },
  });

  multiplayer.peer = peer;

  peer.on("open", () => {
    updateMultiplayerBadge();
    showHostLobbyModal(code, playerCount);
  });

  peer.on("connection", (conn) => {
    handleIncomingGuest(conn);
  });

  peer.on("error", (err) => {
    console.error("Peer error:", err);
    if (err.type === "unavailable-id") {
      // Retry with new code if collision occurs
      hostOnlineGame(playerCount);
    } else {
      showModal("Multiplayer Error", "<p>Connection error: " + escapeHtml(err.message || String(err)) + "</p>", "OK", () => {});
    }
  });
}

/**
 * Host accepts and registers guest player
 */
function handleIncomingGuest(conn) {
  const currentCount = multiplayer.connections.length + 1; // +1 for host
  if (currentCount >= multiplayer.roomTargetCount) {
    conn.on("open", () => {
      conn.send({ type: "REJECT", reason: "Room is already full" });
      setTimeout(() => conn.close(), 500);
    });
    return;
  }

  const assignedSeat = multiplayer.connections.length + 1;
  multiplayer.connections.push(conn);

  conn.on("open", () => {
    conn.send({
      type: "INIT",
      seat: assignedSeat,
      totalPlayers: multiplayer.roomTargetCount,
      game: serializeGameState(),
      audit: audit ? audit.events : [],
    });

    updateLobbyStatus();
    updateMultiplayerBadge();

    // Auto-close lobby modal when target count is reached
    if (multiplayer.connections.length + 1 >= multiplayer.roomTargetCount) {
      setTimeout(() => {
        closeModal();
        broadcastState();
      }, 1000);
    }
  });

  conn.on("data", (data) => {
    handleHostReceivedData(conn, data);
  });

  conn.on("close", () => {
    multiplayer.connections = multiplayer.connections.filter((c) => c !== conn);
    updateLobbyStatus();
    updateMultiplayerBadge();
    recordAudit("PLAYER_DISCONNECTED", { seat: assignedSeat });
  });
}

/**
 * Host processes action sent by a guest
 */
function handleHostReceivedData(conn, data) {
  if (!data || typeof data !== "object") return;

  if (data.type === "ACTION") {
    if (game.current !== data.seat) {
      console.warn("Received action from seat out of turn:", data.seat);
      return;
    }

    if (data.action.type === "ROLL") {
      roll();
    } else if (data.action.type === "MOVE") {
      const legalMoves = options();
      const move = legalMoves.find(
        (m) => m.piece.id === data.action.pieceId && m.test.progress === data.action.targetProgress
      ) || legalMoves[0];

      if (move) {
        apply(move, "remote-player");
      }
    } else if (data.action.type === "PASS") {
      passRemainingRolls();
    }
  } else if (data.type === "EMOTE") {
    displayFloatingEmote(data.emote, data.name || "Player");
    // Forward emote to all other connected peers
    multiplayer.connections.forEach((c) => {
      if (c !== conn && c.open) c.send(data);
    });
  }
}

/**
 * Join an online match as a guest
 */
function joinOnlineGame(roomCode) {
  if (!roomCode) return;
  const cleanCode = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleanCode) return;

  if (typeof Peer === "undefined") {
    showModal("Multiplayer Unavailable", "<p>WebRTC library is loading. Please try again in a few seconds.</p>", "OK", () => {});
    return;
  }

  leaveMultiplayer();

  multiplayer.active = true;
  multiplayer.isHost = false;
  multiplayer.roomCode = cleanCode;
  multiplayer.status = "connecting";

  showModal(
    "Connecting to Room " + cleanCode,
    '<div style="text-align:center;padding:16px 0;"><div class="mp-spinner"></div><p style="margin-top:12px;color:#f2dec5;">Connecting to host over WebRTC…</p></div>',
    "Cancel",
    leaveMultiplayer
  );

  const peer = new Peer(null, {
    debug: 1,
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" },
      ],
    },
  });

  multiplayer.peer = peer;

  peer.on("open", () => {
    const hostPeerId = MP_PREFIX + cleanCode;
    const conn = peer.connect(hostPeerId, { reliable: true });

    conn.on("open", () => {
      multiplayer.connections = [conn];
      multiplayer.status = "connected";
      updateMultiplayerBadge();
    });

    conn.on("data", (data) => {
      handleGuestReceivedData(data);
    });

    conn.on("close", () => {
      showModal("Disconnected", "<p>The host has closed the match or disconnected.</p>", "OK", leaveMultiplayer);
      leaveMultiplayer();
    });

    conn.on("error", (err) => {
      console.error("Connection error:", err);
      showModal("Connection Failed", "<p>Could not connect to room " + escapeHtml(cleanCode) + ". Ensure the code is correct and the host is active.</p>", "OK", leaveMultiplayer);
    });
  });

  peer.on("error", (err) => {
    console.error("Peer error:", err);
    showModal("Connection Error", "<p>" + escapeHtml(err.message || String(err)) + "</p>", "OK", leaveMultiplayer);
  });
}

/**
 * Guest processes incoming messages from host
 */
function handleGuestReceivedData(data) {
  if (!data || typeof data !== "object") return;

  if (data.type === "INIT") {
    multiplayer.mySeat = data.seat;
    multiplayer.status = "connected";

    // Initialize local game instance
    newGame(data.totalPlayers || 2, 0);
    applyRemoteState(data.game, data.audit);

    closeModal();
    updateMultiplayerBadge();

    const myPlayer = game.players[data.seat];
    showModal(
      "Joined Room " + multiplayer.roomCode,
      '<div style="text-align:center;padding:8px 0;"><p>You are playing as <strong>' +
        myPlayer.avatar + " " + escapeHtml(myPlayer.name) +
        '</strong>.</p><p style="color:#a3e635;">Connected successfully!</p></div>',
      "Let's play!",
      () => {}
    );
  } else if (data.type === "SYNC_STATE") {
    applyRemoteState(data.game, data.audit);
  } else if (data.type === "REJECT") {
    showModal("Cannot Join Room", "<p>" + escapeHtml(data.reason || "Room is unavailable") + "</p>", "OK", leaveMultiplayer);
  } else if (data.type === "EMOTE") {
    displayFloatingEmote(data.emote, data.name || "Opponent");
  }
}

/**
 * Display Host Lobby Modal with Room Code, Direct Link & QR Code
 */
function showHostLobbyModal(code, playerCount) {
  const inviteUrl = getRoomInviteUrl(code);
  const content =
    '<div class="mp-lobby">' +
    '<p style="margin:0 0 10px 0;color:#f3dfc6;font-size:0.92rem;">Share this code or link with opponents to join your match on their phone, tablet, or laptop:</p>' +
    '<div class="mp-code-box">' +
    '<div class="mp-code-label">ROOM CODE</div>' +
    '<div class="mp-code-value">' + code + '</div>' +
    '</div>' +
    '<div style="background:#fff;padding:10px;border-radius:12px;display:inline-block;margin:10px 0;box-shadow:0 4px 14px rgba(0,0,0,0.4);">' +
    '<img src="assets/qr-dhayam.svg" alt="Room QR Code" style="width:140px;height:140px;display:block;" />' +
    '</div>' +
    '<div style="display:flex;gap:6px;width:100%;max-width:380px;margin:auto;">' +
    '<input type="text" readonly value="' + inviteUrl + '" id="mpInviteInput" class="mp-input" />' +
    '<button id="mpCopyBtn" class="pill" type="button" style="white-space:nowrap;padding:6px 12px;font-weight:700;">Copy link</button>' +
    '</div>' +
    '<p id="mpCopyFeedback" style="margin:4px 0 0 0;font-size:0.8rem;color:#a3e635;min-height:1.2em;"></p>' +
    '<div id="mpLobbyStatus" class="mp-lobby-status">' +
    'Waiting for opponents to connect… (1/' + playerCount + ' joined)' +
    '</div>' +
    '</div>';

  showModal("Online Room Lobby", content, "Start Match", () => {
    broadcastState();
  });

  setTimeout(() => {
    const copyBtn = $("mpCopyBtn");
    const input = $("mpInviteInput");
    const feedback = $("mpCopyFeedback");
    if (copyBtn && input) {
      copyBtn.onclick = () => {
        input.select();
        const done = () => {
          if (feedback) feedback.textContent = "✓ Invite link copied!";
          setTimeout(() => { if (feedback) feedback.textContent = ""; }, 2500);
        };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(inviteUrl).then(done).catch(() => {
            document.execCommand("copy");
            done();
          });
        } else {
          document.execCommand("copy");
          done();
        }
      };
    }
  }, 40);
}

/**
 * Update the player count status in the lobby modal
 */
function updateLobbyStatus() {
  const statusEl = $("mpLobbyStatus");
  if (!statusEl) return;
  const connected = multiplayer.connections.length + 1;
  const total = multiplayer.roomTargetCount;
  statusEl.innerHTML =
    connected >= total
      ? '<span style="color:#a3e635;font-weight:bold;">✓ All ' + total + ' players connected! Starting game…</span>'
      : "Waiting for opponents to connect… (" + connected + "/" + total + " joined)";
}

/**
 * Update the online badge in top header nav
 */
function updateMultiplayerBadge() {
  let badge = $("mpBadge");
  if (!badge) {
    badge = document.createElement("button");
    badge.id = "mpBadge";
    badge.className = "pill mp-badge";
    const nav = document.querySelector(".topnav");
    if (nav) nav.prepend(badge);
  }

  if (!multiplayer.active) {
    badge.hidden = true;
    return;
  }

  badge.hidden = false;
  const role = multiplayer.isHost ? "Host" : "Guest";
  const seatName = game?.players[multiplayer.mySeat]?.name || "Player";
  badge.innerHTML = '<span class="mp-dot"></span> Room ' + multiplayer.roomCode + " · " + seatName;
  badge.title = "Online match active (" + role + "). Click for room details.";
  badge.onclick = () => {
    showModal(
      "Online Match: " + multiplayer.roomCode,
      '<div style="text-align:center;padding:10px 0;">' +
        "<p>You are playing as <strong>" + seatName + "</strong> (" + role + ").</p>" +
        "<p>Connected peers: " + (multiplayer.connections.length + (multiplayer.isHost ? 1 : 0)) + "</p>" +
        '<button class="pill" id="mpLeaveBtn" style="background:#8b2626;color:#fff;margin-top:10px;">Leave Match</button>' +
        "</div>",
      "Close",
      () => {}
    );
    setTimeout(() => {
      const leaveBtn = $("mpLeaveBtn");
      if (leaveBtn) {
        leaveBtn.onclick = () => {
          leaveMultiplayer();
          closeModal();
          newGame(4);
        };
      }
    }, 40);
  };
}

/**
 * Leave current multiplayer match and disconnect peer
 */
function leaveMultiplayer() {
  if (multiplayer.peer) {
    try {
      multiplayer.peer.destroy();
    } catch (e) {
      console.warn("Peer destroy error:", e);
    }
  }
  multiplayer.active = false;
  multiplayer.isHost = false;
  multiplayer.roomCode = null;
  multiplayer.connections = [];
  multiplayer.status = "offline";
  updateMultiplayerBadge();
}

/**
 * Check URL query params for auto-join link on page load (?join=CODE)
 */
function initMultiplayerFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get("join") || params.get("room");
  if (joinCode) {
    setTimeout(() => {
      joinOnlineGame(joinCode);
    }, 400);
  }
}
