/**
 * multiplayer.js - Real-Time Multi-User Engine for Dhayam
 *
 * Implements high-performance, real-time multiplayer using:
 * 1. Cloudflare Edge Durable Objects + WebSockets with WebSocket Hibernation (Primary, 0ms idle cost, low-latency edge routing)
 * 2. WebRTC DataChannels via PeerJS (Fallback for local file:// testing and offline P2P)
 *
 * Supports host room creation with dynamic QR codes, shareable invite links,
 * auto-join via QR scan/URL, unassigned seat picking, session reconnects,
 * synchronized 3D dice physics rolling, animated piece movement, and live emoji reactions.
 */
"use strict";

const MP_PREFIX = "dhayam-v1-";
const MP_SESSION_KEY = "dhayam_mp_session_v1";

/**
 * Session storage helpers for page reload / tab recovery
 */
function saveSession(data) {
  try {
    sessionStorage.setItem(MP_SESSION_KEY, JSON.stringify(data));
  } catch (e) {}
}

function getSession() {
  try {
    const raw = sessionStorage.getItem(MP_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(MP_SESSION_KEY);
  } catch (e) {}
}

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
 * Generate a standalone crisp SVG QR code using client-side qrcode-generator
 */
function generateQrSvg(text, cellSize = 4, margin = 4) {
  if (typeof qrcode === "undefined") {
    return '<div style="padding:16px;color:#3b2210;font-size:0.85rem;">QR code library loading…</div>';
  }
  try {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag(cellSize, margin);
  } catch (err) {
    console.warn("Failed to generate QR SVG:", err);
    return '<div style="padding:16px;color:#3b2210;font-size:0.85rem;">Could not render QR code</div>';
  }
}

/**
 * Helper to inspect seat availability and claims for the current game
 */
function getRoomSeatsInfo() {
  if (!game || !game.players) return [];
  return game.players.map((p, idx) => {
    const isHost = idx === 0;
    const claim = multiplayer.claimedSeats ? multiplayer.claimedSeats[idx] : null;
    const isClaimed = isHost || Boolean(claim);
    return {
      seat: idx,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      claimed: isClaimed,
      claimedBy: isHost ? game.players[0].name + " (Host)" : claim ? claim.name : "",
      isHost: isHost,
      connected: claim ? claim.connected !== false : true,
    };
  });
}

/**
 * Serialize game state suitable for transmission over network
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

let pendingRemoteState = null;

/**
 * Normalizes piece IDs across client ("P0-0") and worker ("p0_q0") conventions
 */
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
window.matchPieceId = matchPieceId;

/**
 * Applies pending remote state once active rolling or movement animations finish
 */
function checkPendingRemoteState() {
  if (
    pendingRemoteState &&
    !(typeof rolling !== "undefined" && rolling) &&
    !(typeof moving !== "undefined" && moving)
  ) {
    const { remoteGame, remoteAudit } = pendingRemoteState;
    pendingRemoteState = null;
    applyRemoteState(remoteGame, remoteAudit);
    return true;
  }
  return false;
}
window.checkPendingRemoteState = checkPendingRemoteState;

/**
 * Apply state received from authoritative Host or Cloudflare Durable Object
 */
function applyRemoteState(remoteGame, remoteAudit) {
  if (!remoteGame) return;
  if (
    (typeof rolling !== "undefined" && rolling) ||
    (typeof moving !== "undefined" && moving)
  ) {
    pendingRemoteState = { remoteGame, remoteAudit };
    return;
  }
  pendingRemoteState = null;

  game.players = remoteGame.players;
  game.current = remoteGame.current;
  game.phase = remoteGame.phase;
  game.pool = Array.isArray(remoteGame.pool) ? [...remoteGame.pool] : [];
  game.history = Array.isArray(remoteGame.history) ? [...remoteGame.history] : [];
  game.last = remoteGame.last || remoteGame.lastRoll || null;
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
 * Host broadcasts current state to all connected peers (P2P mode)
 */
function broadcastState(extra = {}) {
  if (!multiplayer.active) return;
  if (multiplayer.transport === "cf_ws") return;
  if (!multiplayer.isHost) return;

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
 * Transmit action (roll, move, pass) to Cloudflare DO or P2P Host
 */
function sendPlayerAction(action) {
  if (!multiplayer.active) return false;

  if (multiplayer.transport === "cf_ws") {
    if (action.type === "ROLL") {
      return sendWsMessage({ type: "ROLL" });
    } else if (action.type === "MOVE") {
      return sendWsMessage({
        type: "MOVE",
        pieceId: action.pieceId,
        diceValues: action.values || null,
        targetProgress: action.targetProgress,
      });
    } else if (action.type === "PASS") {
      return sendWsMessage({ type: "PASS" });
    }
    return false;
  }

  // P2P Guest mode
  if (multiplayer.isHost) return false;
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
 * Send WebSocket message to Cloudflare Edge Durable Object
 */
function sendWsMessage(payload) {
  if (multiplayer.ws && multiplayer.ws.readyState === WebSocket.OPEN) {
    try {
      multiplayer.ws.send(JSON.stringify(payload));
      if (typeof FlightRecorder !== "undefined") {
        FlightRecorder.record("MP_WS_SEND", {
          type: payload.type,
          roomCode: multiplayer.roomCode,
          seat: multiplayer.mySeat,
        });
      }
      return true;
    } catch (e) {
      console.warn("Failed to send WebSocket message:", e);
      if (typeof FlightRecorder !== "undefined") {
        FlightRecorder.record("MP_WS_SEND_ERROR", { error: String(e && e.message ? e.message : e) });
      }
      return false;
    }
  }
  return false;
}
window.sendWsMessage = sendWsMessage;

/**
 * Request fresh state sync from Cloudflare Durable Object
 */
function requestStateSync() {
  if (multiplayer.active && multiplayer.transport === "cf_ws") {
    sendWsMessage({ type: "GET_STATE" });
  }
}
window.requestStateSync = requestStateSync;

/**
 * Send floating emote reaction to all peers
 */
function broadcastEmote(emote) {
  if (!multiplayer.active) return;
  const p = game && game.players ? game.players[multiplayer.mySeat] : null;
  const name = p ? p.name : "Player";
  displayFloatingEmote(emote, name);

  if (multiplayer.transport === "cf_ws") {
    sendWsMessage({ type: "EMOTE", emote, name });
    return;
  }

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
  bubble.innerHTML =
    '<span class="emote-icon">' +
    escapeHtml(emote) +
    '</span><span class="emote-name">' +
    escapeHtml(senderName) +
    "</span>";
  boardWrap.appendChild(bubble);
  setTimeout(() => bubble.remove(), 2600);
}

/**
 * Primary Entrypoint: Host an online match
 * Tries Cloudflare Durable Objects WebSocket room first; falls back to WebRTC P2P.
 */
async function hostOnlineGame(playerCount = 2) {
  leaveMultiplayer();
  const code = generateRoomCode();

  // Try Cloudflare Edge WebSocket first if running on HTTP/HTTPS
  if (window.location.protocol.startsWith("http")) {
    try {
      await connectCloudflareRoom(code, true, playerCount);
      return;
    } catch (cfErr) {
      console.info("Cloudflare DO WebSocket unavailable, falling back to WebRTC P2P:", cfErr);
    }
  }

  // Fallback to WebRTC P2P
  hostOnlineGameP2P(code, playerCount);
}

/**
 * Primary Entrypoint: Join an online match
 * Tries Cloudflare Durable Objects WebSocket room first; falls back to WebRTC P2P.
 */
async function joinOnlineGame(roomCode) {
  if (!roomCode) return;
  const cleanCode = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleanCode) return;

  leaveMultiplayer();

  // Try Cloudflare Edge WebSocket first if running on HTTP/HTTPS
  if (window.location.protocol.startsWith("http")) {
    try {
      await connectCloudflareRoom(cleanCode, false);
      return;
    } catch (cfErr) {
      console.info("Cloudflare DO WebSocket unavailable, falling back to WebRTC P2P:", cfErr);
    }
  }

  // Fallback to WebRTC P2P
  joinOnlineGameP2P(cleanCode);
}

/**
 * Connect to Cloudflare Durable Objects WebSocket Room
 */
function connectCloudflareRoom(roomCode, isHost, playerCount = 2, customName = null) {
  return new Promise((resolve, reject) => {
    if (!window.location.protocol.startsWith("http")) {
      return reject(new Error("Local file protocol; fallback to P2P WebRTC"));
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const saved = getSession();
    const token = saved && saved.roomCode === roomCode ? saved.token : crypto.randomUUID();
    const seat = saved && saved.roomCode === roomCode ? saved.seat : isHost ? 0 : "";
    const wsUrl = `${wsProtocol}//${window.location.host}/api/room/${roomCode}/ws?code=${roomCode}&players=${playerCount}&token=${token}&seat=${seat}`;

    showModal(
      isHost ? "Creating Room " + roomCode : "Connecting to Room " + roomCode,
      '<div style="text-align:center;padding:16px 0;"><div class="mp-spinner"></div><p style="margin-top:12px;color:#f2dec5;">Connecting to Cloudflare Edge…</p></div>',
      "Cancel",
      leaveMultiplayer
    );

    let socket;
    try {
      socket = new WebSocket(wsUrl);
    } catch (err) {
      return reject(err);
    }

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled && socket.readyState !== WebSocket.OPEN) {
        settled = true;
        try {
          socket.close();
        } catch (e) {}
        reject(new Error("WebSocket connection timeout"));
      }
    }, 3500);

    socket.onopen = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      multiplayer.active = true;
      multiplayer.transport = "cf_ws";
      multiplayer.ws = socket;
      multiplayer.roomCode = roomCode;
      multiplayer.isHost = isHost;
      multiplayer.roomTargetCount = playerCount;
      multiplayer.status = "connected";

      if (isHost) {
        newGame(playerCount, 0);
        const hostName = game?.players[0]?.name || "Player 1";
        socket.send(
          JSON.stringify({
            type: "CLAIM_SEAT",
            seat: 0,
            name: hostName,
            token: token,
          })
        );
      } else if (saved && saved.roomCode === roomCode && saved.seat !== undefined) {
        socket.send(
          JSON.stringify({
            type: "CLAIM_SEAT",
            seat: saved.seat,
            name: saved.name || customName || "",
            token: saved.token,
          })
        );
      }

      resolve(socket);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWsMessage(msg);
      } catch (e) {
        console.warn("Failed to parse WS message:", e);
      }
    };

    socket.onclose = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error("WebSocket closed prematurely"));
      }
      if (multiplayer.active && multiplayer.status === "connected") {
        updateMultiplayerBadge();
      }
    };

    socket.onerror = (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    };
  });
}

/**
 * Handle incoming message from Cloudflare Durable Object
 */
function handleWsMessage(msg) {
  if (!msg || typeof msg !== "object") return;
  if (typeof FlightRecorder !== "undefined") {
    FlightRecorder.record("MP_WS_RECV", {
      type: msg.type,
      roomCode: multiplayer.roomCode,
      seat: multiplayer.mySeat,
      message: msg.message || undefined,
    });
  }

  switch (msg.type) {
    case "ROOM_STATE": {
      multiplayer.roomTargetCount = msg.targetPlayers || multiplayer.roomTargetCount;
      multiplayer.claimedSeats = {};
      if (msg.seats) {
        msg.seats.forEach((s) => {
          if (s.claimed) {
            multiplayer.claimedSeats[s.seat] = { name: s.claimedBy, connected: s.connected };
          }
        });
      }
      if (multiplayer.isHost) {
        updateMultiplayerBadge();
        showHostLobbyModal(multiplayer.roomCode, multiplayer.roomTargetCount);
      } else {
        const saved = getSession();
        if (!saved || saved.roomCode !== multiplayer.roomCode) {
          closeModal();
          showSeatSelectionModal({
            seats: msg.seats,
            roomCode: multiplayer.roomCode,
            totalPlayers: multiplayer.roomTargetCount,
          });
        }
      }
      break;
    }

    case "ROOM_UPDATE": {
      if (msg.seats) {
        multiplayer.claimedSeats = {};
        msg.seats.forEach((s) => {
          if (s.claimed) {
            multiplayer.claimedSeats[s.seat] = { name: s.claimedBy, connected: s.connected };
          }
        });
        updateHostLobbySeats();
        updateMultiplayerBadge();
        updateLobbyStatus();
      }
      break;
    }

    case "INIT": {
      multiplayer.mySeat = msg.seat;
      multiplayer.token = msg.token;
      multiplayer.roomCode = msg.roomCode || multiplayer.roomCode;
      multiplayer.status = "connected";

      saveSession({
        roomCode: multiplayer.roomCode,
        seat: msg.seat,
        token: msg.token,
        name: game?.players[msg.seat]?.name || "",
      });

      newGame(msg.totalPlayers || multiplayer.roomTargetCount || 2, 0);
      applyRemoteState(msg.game, msg.audit);

      if (typeof FlightRecorder !== "undefined" && typeof FlightRecorder.recordGameStart === "function") {
        FlightRecorder.recordGameStart({
          mode: multiplayer.isHost ? "multiplayer-cf-host" : "multiplayer-cf-guest",
          playerCount: msg.totalPlayers || multiplayer.roomTargetCount || 2,
          computerCount: 0,
          roomCode: multiplayer.roomCode,
          cfHost: window.location.host,
          transport: "cf_ws",
          seat: msg.seat,
          players: game && game.players ? game.players.map((p) => ({ id: p.id, name: p.name, seat: p.seat })) : null,
          rulesVariant: "Dhayam 7x7 online multiplayer",
        });
      }

      closeModal();
      updateMultiplayerBadge();
      updateEmoteBar();

      const myPlayer = game.players[msg.seat];
      if (!multiplayer.isHost) {
        showModal(
          "Joined Game!",
          '<div style="text-align:center;padding:12px 0;">' +
            '<div style="font-size:2.8rem;margin-bottom:8px;">' +
            myPlayer.avatar +
            "</div>" +
            '<p style="font-size:1.1rem;color:#ffe4b5;margin:0 0 6px 0;">You are playing as <strong>' +
            escapeHtml(myPlayer.name) +
            "</strong></p>" +
            '<p style="font-size:0.85rem;color:#a3e635;">Connected to Cloudflare Edge in Room <strong>' +
            multiplayer.roomCode +
            "</strong></p>" +
            '<p style="font-size:0.82rem;color:#d8c4ab;margin-top:8px;">When it is your turn, dice and piece movements will be enabled for you.</p>' +
            "</div>",
          "Let's Play!",
          () => {}
        );
      }
      break;
    }

    case "ROLL_START": {
      if (typeof handleSynchronizedRollStart === "function") {
        handleSynchronizedRollStart(msg);
      }
      break;
    }

    case "MOVE_START": {
      if (typeof handleSynchronizedMoveStart === "function") {
        handleSynchronizedMoveStart(msg);
      }
      break;
    }

    case "SYNC_STATE": {
      applyRemoteState(msg.game, msg.audit);
      if (msg.seats) {
        multiplayer.claimedSeats = {};
        msg.seats.forEach((s) => {
          if (s.claimed) {
            multiplayer.claimedSeats[s.seat] = { name: s.claimedBy, connected: s.connected };
          }
        });
        updateMultiplayerBadge();
      }
      break;
    }

    case "CHOOSE_SEAT": {
      multiplayer.status = "choosing_seat";
      closeModal();
      showSeatSelectionModal(msg);
      break;
    }

    case "PRESENCE": {
      if (multiplayer.claimedSeats[msg.seat]) {
        multiplayer.claimedSeats[msg.seat].connected = msg.connected;
      }
      if (msg.seats) {
        updateHostLobbySeats();
      }
      updateMultiplayerBadge();
      break;
    }

    case "EMOTE": {
      displayFloatingEmote(msg.emote, msg.name || "Opponent");
      break;
    }

    case "ERROR": {
      console.warn("Multiplayer server error:", msg.message);
      if (typeof rolling !== "undefined") rolling = false;
      if (typeof moving !== "undefined") {
        moving = false;
        movingPieceId = null;
      }
      if (typeof showToast === "function" && msg.message) {
        showToast(msg.message);
      }
      render();
      break;
    }
  }
}

/**
 * Fallback WebRTC P2P Host
 */
function hostOnlineGameP2P(code, playerCount) {
  if (typeof Peer === "undefined") {
    showModal("Multiplayer Unavailable", "<p>WebRTC library is loading. Please try again in a few seconds.</p>", "OK", () => {});
    return;
  }

  const peerId = MP_PREFIX + code;

  multiplayer.active = true;
  multiplayer.transport = "webrtc";
  multiplayer.isHost = true;
  multiplayer.roomCode = code;
  multiplayer.mySeat = 0;
  multiplayer.connections = [];
  multiplayer.roomTargetCount = playerCount;
  multiplayer.status = "hosting";

  newGame(playerCount, 0);

  multiplayer.claimedSeats = {
    0: { peerId: "HOST", name: game.players[0].name, connected: true },
  };

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
    updateEmoteBar();
    showHostLobbyModal(code, playerCount);
  });

  peer.on("connection", (conn) => {
    handleIncomingGuestP2P(conn);
  });

  peer.on("error", (err) => {
    console.error("Peer error:", err);
    if (err.type === "unavailable-id") {
      hostOnlineGame(playerCount);
    } else {
      showModal("Multiplayer Error", "<p>Connection error: " + escapeHtml(err.message || String(err)) + "</p>", "OK", () => {});
    }
  });
}

/**
 * Handle incoming guest connection in P2P mode
 */
function handleIncomingGuestP2P(conn) {
  conn.on("open", () => {
    const total = multiplayer.roomTargetCount;
    const claimedCount = Object.keys(multiplayer.claimedSeats || {}).length;
    if (claimedCount >= total) {
      conn.send({ type: "REJECT", reason: "Room " + multiplayer.roomCode + " is already full (" + total + "/" + total + " players)." });
      setTimeout(() => conn.close(), 500);
      return;
    }

    if (!multiplayer.connections.includes(conn)) {
      multiplayer.connections.push(conn);
    }

    conn.send({
      type: "CHOOSE_SEAT",
      roomCode: multiplayer.roomCode,
      totalPlayers: total,
      seats: getRoomSeatsInfo(),
      game: serializeGameState(),
      audit: audit ? audit.events : [],
    });

    updateLobbyStatus();
    updateMultiplayerBadge();
  });

  conn.on("data", (data) => {
    handleHostReceivedDataP2P(conn, data);
  });

  conn.on("close", () => {
    handleGuestDisconnectP2P(conn);
  });
}

/**
 * Handle guest disconnection in P2P mode
 */
function handleGuestDisconnectP2P(conn) {
  let releasedSeat = null;
  if (multiplayer.claimedSeats) {
    for (const [seatStr, claim] of Object.entries(multiplayer.claimedSeats)) {
      if (claim.peerId === conn.peer || claim.conn === conn) {
        releasedSeat = Number(seatStr);
        delete multiplayer.claimedSeats[releasedSeat];
        recordAudit("PLAYER_DISCONNECTED", { seat: releasedSeat });
        break;
      }
    }
  }
  multiplayer.connections = multiplayer.connections.filter((c) => c !== conn);
  updateLobbyStatus();
  updateMultiplayerBadge();
  broadcastState({ seats: getRoomSeatsInfo() });
  updateHostLobbySeats();
}

/**
 * Host processes action or seat claim in P2P mode
 */
function handleHostReceivedDataP2P(conn, data) {
  if (!data || typeof data !== "object") return;

  if (data.type === "CLAIM_SEAT") {
    const seat = Number(data.seat);
    const total = multiplayer.roomTargetCount;
    if (isNaN(seat) || seat <= 0 || seat >= total) {
      conn.send({ type: "ERROR", message: "Invalid player slot selected." });
      return;
    }

    if (multiplayer.claimedSeats && multiplayer.claimedSeats[seat]) {
      conn.send({
        type: "CHOOSE_SEAT",
        roomCode: multiplayer.roomCode,
        totalPlayers: total,
        seats: getRoomSeatsInfo(),
        error: "Seat " + (seat + 1) + " was just chosen by another player. Please pick an unassigned player.",
      });
      return;
    }

    const originalName = game.players[seat].name;
    const guestName = data.customName ? cleanPlayerName(data.customName, originalName) : originalName;
    game.players[seat].name = guestName;

    if (!multiplayer.claimedSeats) multiplayer.claimedSeats = {};
    multiplayer.claimedSeats[seat] = {
      peerId: conn.peer,
      name: guestName,
      conn: conn,
      connected: true,
    };

    recordAudit("PLAYER_JOINED", {
      seat,
      name: guestName,
      avatar: game.players[seat].avatar,
    });

    conn.send({
      type: "INIT",
      seat: seat,
      roomCode: multiplayer.roomCode,
      totalPlayers: total,
      game: serializeGameState(),
      audit: audit ? audit.events : [],
      seats: getRoomSeatsInfo(),
    });

    broadcastState({ seats: getRoomSeatsInfo() });
    updateLobbyStatus();
    updateMultiplayerBadge();
    updateHostLobbySeats();
    render();
  } else if (data.type === "ACTION") {
    let senderSeat = null;
    if (multiplayer.claimedSeats) {
      for (const [s, claim] of Object.entries(multiplayer.claimedSeats)) {
        if (claim.peerId === conn.peer || claim.conn === conn) {
          senderSeat = Number(s);
          break;
        }
      }
    }

    if (senderSeat === null || game.current !== senderSeat) {
      console.warn("Received action from seat out of turn:", senderSeat, "current:", game.current);
      return;
    }

    if (data.action.type === "ROLL") {
      roll();
    } else if (data.action.type === "MOVE") {
      const legalMoves = options();
      const move =
        legalMoves.find(
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
    multiplayer.connections.forEach((c) => {
      if (c !== conn && c.open) c.send(data);
    });
  }
}

/**
 * Fallback WebRTC P2P Guest
 */
function joinOnlineGameP2P(cleanCode) {
  if (typeof Peer === "undefined") {
    showModal("Multiplayer Unavailable", "<p>WebRTC library is loading. Please try again in a few seconds.</p>", "OK", () => {});
    return;
  }

  multiplayer.active = true;
  multiplayer.transport = "webrtc";
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
      updateEmoteBar();
    });

    conn.on("data", (data) => {
      handleGuestReceivedDataP2P(data);
    });

    conn.on("close", () => {
      showModal("Disconnected", "<p>The host has closed the match or disconnected.</p>", "OK", leaveMultiplayer);
      leaveMultiplayer();
    });

    conn.on("error", (err) => {
      console.error("Connection error:", err);
      showModal(
        "Connection Failed",
        "<p>Could not connect to room " + escapeHtml(cleanCode) + ". Ensure the code is correct and the host is active.</p>",
        "OK",
        leaveMultiplayer
      );
    });
  });

  peer.on("error", (err) => {
    console.error("Peer error:", err);
    showModal("Connection Error", "<p>" + escapeHtml(err.message || String(err)) + "</p>", "OK", leaveMultiplayer);
  });
}

/**
 * Handle incoming message for P2P Guest
 */
function handleGuestReceivedDataP2P(data) {
  if (!data || typeof data !== "object") return;

  if (data.type === "CHOOSE_SEAT") {
    multiplayer.status = "choosing_seat";
    closeModal();
    showSeatSelectionModal(data);
  } else if (data.type === "INIT") {
    multiplayer.mySeat = data.seat;
    multiplayer.roomCode = data.roomCode || multiplayer.roomCode;
    multiplayer.status = "connected";

    newGame(data.totalPlayers || 2, 0);
    applyRemoteState(data.game, data.audit);

    closeModal();
    updateMultiplayerBadge();
    updateEmoteBar();

    const myPlayer = game.players[data.seat];
    showModal(
      "Joined Game!",
      '<div style="text-align:center;padding:12px 0;">' +
        '<div style="font-size:2.8rem;margin-bottom:8px;">' +
        myPlayer.avatar +
        "</div>" +
        '<p style="font-size:1.1rem;color:#ffe4b5;margin:0 0 6px 0;">You are playing as <strong>' +
        escapeHtml(myPlayer.name) +
        "</strong></p>" +
        '<p style="font-size:0.85rem;color:#a3e635;">Connected to Host in Room <strong>' +
        multiplayer.roomCode +
        "</strong></p>" +
        '<p style="font-size:0.82rem;color:#d8c4ab;margin-top:8px;">When it is your turn, dice and piece movements will be enabled for you.</p>' +
        "</div>",
      "Let's Play!",
      () => {}
    );
  } else if (data.type === "ROLL_START") {
    if (typeof handleSynchronizedRollStart === "function") {
      handleSynchronizedRollStart(data);
    }
  } else if (data.type === "MOVE_START") {
    if (typeof handleSynchronizedMoveStart === "function") {
      handleSynchronizedMoveStart(data);
    }
  } else if (data.type === "SYNC_STATE") {
    applyRemoteState(data.game, data.audit);
  } else if (data.type === "REJECT") {
    showModal("Cannot Join Room", "<p>" + escapeHtml(data.reason || "Room is unavailable") + "</p>", "OK", leaveMultiplayer);
  } else if (data.type === "EMOTE") {
    displayFloatingEmote(data.emote, data.name || "Opponent");
  }
}

/**
 * Display Guest Seat Selection Modal: pick an unassigned player
 */
function showSeatSelectionModal(data) {
  const seats = data.seats || [];
  const roomCode = data.roomCode || multiplayer.roomCode;
  let errorBanner = "";
  if (data.error) {
    errorBanner = '<div class="mp-error-banner">' + escapeHtml(data.error) + "</div>";
  }

  const seatsHtml = seats
    .map((s) => {
      if (s.claimed) {
        return (
          '<div class="mp-seat-card claimed">' +
          '<div class="mp-seat-avatar">' +
          s.avatar +
          "</div>" +
          '<div class="mp-seat-info">' +
          "<strong>" +
          escapeHtml(s.name) +
          "</strong>" +
          '<span class="mp-seat-badge claimed-badge">' +
          (s.isHost ? "👑 Host" : "Taken") +
          " (" +
          escapeHtml(s.claimedBy) +
          ")</span>" +
          "</div>" +
          '<button type="button" class="btn pill" disabled style="opacity:0.4;cursor:not-allowed;">Occupied</button>' +
          "</div>"
        );
      } else {
        return (
          '<div class="mp-seat-card available" data-seat="' +
          s.seat +
          '">' +
          '<div class="mp-seat-avatar">' +
          s.avatar +
          "</div>" +
          '<div class="mp-seat-info">' +
          "<strong>" +
          escapeHtml(s.name) +
          "</strong>" +
          '<span class="mp-seat-badge available-badge">✨ Available</span>' +
          "</div>" +
          '<button type="button" class="btn pill mp-pick-btn" data-seat="' +
          s.seat +
          '" style="font-weight:700;">Pick ' +
          escapeHtml(s.name) +
          "</button>" +
          "</div>"
        );
      }
    })
    .join("");

  const modalHtml =
    '<div class="mp-seat-modal">' +
    errorBanner +
    '<p style="margin:0 0 10px 0;color:#f3dfc6;font-size:0.9rem;">' +
    "Choose an <strong>unassigned player</strong> below to join match <strong>" +
    roomCode +
    "</strong>:" +
    "</p>" +
    '<div class="mp-name-input-row" style="margin-bottom:12px;">' +
    '<label for="mpGuestCustomName" style="margin-bottom:4px;display:block;font-size:0.85rem;color:#e8d1b8;">Your Display Name (optional):</label>' +
    '<input id="mpGuestCustomName" maxlength="15" placeholder="e.g. Anand" style="padding:7px 10px;font-size:0.9rem;border-radius:8px;" />' +
    "</div>" +
    '<div class="mp-seats-list">' +
    seatsHtml +
    "</div>" +
    "</div>";

  showModal("Pick Your Player", modalHtml, "Cancel", () => {
    leaveMultiplayer();
  });

  setTimeout(() => {
    const pickButtons = document.querySelectorAll(".mp-pick-btn");
    pickButtons.forEach((btn) => {
      btn.onclick = () => {
        const seat = Number(btn.getAttribute("data-seat"));
        const customName = ($("mpGuestCustomName")?.value || "").trim();
        btn.textContent = "Joining…";
        btn.disabled = true;

        if (multiplayer.transport === "cf_ws") {
          sendWsMessage({
            type: "CLAIM_SEAT",
            seat,
            name: customName || null,
            token: crypto.randomUUID(),
          });
        } else {
          const conn = multiplayer.connections[0];
          if (conn && conn.open) {
            conn.send({
              type: "CLAIM_SEAT",
              seat,
              customName: customName || null,
            });
          }
        }
      };
    });
  }, 40);
}

/**
 * Display Host Lobby Modal with Room Code, Direct Link & Live Dynamic SVG QR Code
 */
function showHostLobbyModal(code, playerCount) {
  const inviteUrl = getRoomInviteUrl(code);
  const qrSvg = generateQrSvg(inviteUrl, 4, 4);

  const content =
    '<div class="mp-lobby">' +
    '<p style="margin:0 0 8px 0;color:#f3dfc6;font-size:0.88rem;">' +
    "Share this unique <strong>Game Code</strong> or <strong>QR Code</strong> with friends on phone, tablet, or laptop to auto-join:" +
    "</p>" +
    '<div class="mp-code-box">' +
    '<div class="mp-code-label">GAME CODE</div>' +
    '<div class="mp-code-value">' +
    code +
    "</div>" +
    "</div>" +
    '<div class="mp-qr-box">' +
    qrSvg +
    '<div class="mp-qr-caption">📷 Scan with phone camera to auto-join</div>' +
    "</div>" +
    '<div style="display:flex;gap:6px;width:100%;max-width:400px;margin:8px auto 4px auto;">' +
    '<input type="text" readonly value="' +
    inviteUrl +
    '" id="mpInviteInput" class="mp-input" />' +
    '<button id="mpCopyBtn" class="pill" type="button" style="white-space:nowrap;padding:6px 12px;font-weight:700;">Copy link</button>' +
    "</div>" +
    '<p id="mpCopyFeedback" style="margin:2px 0 6px 0;font-size:0.8rem;color:#a3e635;min-height:1.2em;"></p>' +
    '<div class="mp-lobby-seats" id="mpLobbySeatsContainer">' +
    renderHostLobbySeatsHtml() +
    "</div>" +
    '<div id="mpLobbyStatus" class="mp-lobby-status">' +
    renderLobbyStatusText() +
    "</div>" +
    "</div>";

  showModal("Room Lobby: " + code, content, "Play Match", () => {
    broadcastState();
  });

  setTimeout(() => {
    bindHostLobbyEvents(inviteUrl);
  }, 40);
}

/**
 * Render HTML pills for host lobby seats
 */
function renderHostLobbySeatsHtml() {
  const seats = getRoomSeatsInfo();
  return (
    '<div class="mp-seats-grid">' +
    seats
      .map((s) => {
        const isClaimed = s.claimed;
        return (
          '<div class="mp-seat-pill ' +
          (isClaimed ? "claimed" : "waiting") +
          '">' +
          '<span class="mp-seat-avatar">' +
          s.avatar +
          "</span>" +
          '<span class="mp-seat-name">' +
          escapeHtml(s.name) +
          "</span>" +
          '<span class="mp-seat-status">' +
          (s.isHost ? "👑 Host" : isClaimed ? "✓ Joined" : "Waiting…") +
          "</span>" +
          "</div>"
        );
      })
      .join("") +
    "</div>"
  );
}

/**
 * Render human-readable status text in lobby
 */
function renderLobbyStatusText() {
  const connected = Object.keys(multiplayer.claimedSeats || {}).length;
  const total = multiplayer.roomTargetCount;
  return connected >= total
    ? '<span style="color:#a3e635;font-weight:bold;">✓ All ' + total + " players have joined!</span>"
    : "Waiting for players to scan QR code… (" + connected + "/" + total + " joined)";
}

/**
 * Re-render host lobby seats when someone joins or disconnects
 */
function updateHostLobbySeats() {
  const container = $("mpLobbySeatsContainer");
  if (container) {
    container.innerHTML = renderHostLobbySeatsHtml();
  }
  updateLobbyStatus();
}

/**
 * Update the player count status in the lobby modal
 */
function updateLobbyStatus() {
  const statusEl = $("mpLobbyStatus");
  if (statusEl) {
    statusEl.innerHTML = renderLobbyStatusText();
  }
}

/**
 * Bind copy button events in host lobby
 */
function bindHostLobbyEvents(inviteUrl) {
  const copyBtn = $("mpCopyBtn");
  const input = $("mpInviteInput");
  const feedback = $("mpCopyFeedback");
  if (copyBtn && input) {
    copyBtn.onclick = () => {
      input.select();
      const done = () => {
        if (feedback) feedback.textContent = "✓ Invite link copied to clipboard!";
        setTimeout(() => {
          if (feedback) feedback.textContent = "";
        }, 2500);
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
  const transportLabel = multiplayer.transport === "cf_ws" ? "⚡ Cloudflare Edge" : "P2P";
  badge.innerHTML = '<span class="mp-dot"></span> Room ' + multiplayer.roomCode + " · " + seatName;
  badge.title = "Online match active (" + role + " via " + transportLabel + "). Click to show QR code and room details.";
  badge.onclick = () => {
    if (multiplayer.isHost) {
      showHostLobbyModal(multiplayer.roomCode, multiplayer.roomTargetCount);
    } else {
      showModal(
        "Room " + multiplayer.roomCode,
        '<div style="text-align:center;padding:12px 0;">' +
          "<p>You are playing as <strong>" +
          seatName +
          "</strong> (Guest).</p>" +
          '<p style="color:#d8c4ab;font-size:0.88rem;">Connected to Room ' +
          multiplayer.roomCode +
          " via " +
          transportLabel +
          "</p>" +
          '<button class="pill" id="mpLeaveBtn" style="background:#8b2626;color:#fff;margin-top:14px;padding:8px 18px;font-weight:bold;">Leave Match</button>' +
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
            newGame(2, 1);
          };
        }
      }, 40);
    }
  };
}

/**
 * Update floating in-game emoji reaction bar
 */
function updateEmoteBar() {
  let bar = $("mpEmoteBar");
  if (!multiplayer.active) {
    if (bar) bar.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "mpEmoteBar";
    bar.className = "mp-emote-bar";
    bar.setAttribute("aria-label", "Send reaction emote");
    const emojis = ["🎉", "👏", "🔥", "😂", "🎲", "😱"];
    bar.innerHTML = emojis
      .map(
        (emoji) =>
          `<button type="button" class="mp-emote-btn" data-emoji="${emoji}" title="React with ${emoji}">${emoji}</button>`
      )
      .join("");
    const boardWrap = document.querySelector(".boardwrap");
    if (boardWrap) boardWrap.appendChild(bar);

    bar.addEventListener("click", (e) => {
      const btn = e.target.closest(".mp-emote-btn");
      if (btn) {
        const emoji = btn.getAttribute("data-emoji");
        broadcastEmote(emoji);
      }
    });
  }
}

/**
 * Leave current multiplayer match and disconnect peer/socket
 */
function leaveMultiplayer() {
  if (multiplayer.ws) {
    try {
      multiplayer.ws.close();
    } catch (e) {}
    multiplayer.ws = null;
  }
  if (multiplayer.peer) {
    try {
      multiplayer.peer.destroy();
    } catch (e) {
      console.warn("Peer destroy error:", e);
    }
    multiplayer.peer = null;
  }
  clearSession();
  multiplayer.active = false;
  multiplayer.isHost = false;
  multiplayer.roomCode = null;
  multiplayer.connections = [];
  multiplayer.status = "offline";
  multiplayer.claimedSeats = {};
  multiplayer.token = null;
  updateMultiplayerBadge();
  updateEmoteBar();
}

/**
 * Check URL query params for auto-join link on page load (?join=CODE or ?room=CODE)
 */
function initMultiplayerFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get("join") || params.get("room") || params.get("code");
  if (joinCode) {
    setTimeout(() => {
      joinOnlineGame(joinCode);
    }, 400);
  }
}
