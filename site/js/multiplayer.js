/**
 * multiplayer.js - Peer-to-Peer Real-Time Multiplayer Engine
 *
 * Implements serverless online multiplayer using WebRTC DataChannels (via PeerJS).
 * Supports host room creation with dynamic QR codes, shareable invite links,
 * auto-join via QR scan/URL, unassigned seat picking, state synchronization,
 * action forwarding, and animated reactions.
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
      claimedBy: isHost ? (game.players[0].name + " (Host)") : (claim ? claim.name : ""),
      isHost: isHost,
    };
  });
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

  // Host permanently owns seat 0
  multiplayer.claimedSeats = {
    0: { peerId: "HOST", name: game.players[0].name },
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
 * Host accepts incoming guest connection and prompts for seat selection
 */
function handleIncomingGuest(conn) {
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

    // Send available seats info so guest can pick an unassigned player
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
    handleHostReceivedData(conn, data);
  });

  conn.on("close", () => {
    handleGuestDisconnect(conn);
  });
}

/**
 * Handle guest disconnection and release claimed seat
 */
function handleGuestDisconnect(conn) {
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
 * Host processes action or seat claim sent by a guest
 */
function handleHostReceivedData(conn, data) {
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

    // Register guest in claimedSeats
    const originalName = game.players[seat].name;
    const guestName = data.customName ? cleanPlayerName(data.customName, originalName) : originalName;
    game.players[seat].name = guestName;

    if (!multiplayer.claimedSeats) multiplayer.claimedSeats = {};
    multiplayer.claimedSeats[seat] = {
      peerId: conn.peer,
      name: guestName,
      conn: conn,
    };

    recordAudit("PLAYER_JOINED", {
      seat,
      name: guestName,
      avatar: game.players[seat].avatar,
    });

    // Send confirmation INIT to guest
    conn.send({
      type: "INIT",
      seat: seat,
      roomCode: multiplayer.roomCode,
      totalPlayers: total,
      game: serializeGameState(),
      audit: audit ? audit.events : [],
      seats: getRoomSeatsInfo(),
    });

    // Broadcast updated state & seat list to all peers
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

  if (data.type === "CHOOSE_SEAT") {
    multiplayer.status = "choosing_seat";
    closeModal();
    showSeatSelectionModal(data);
  } else if (data.type === "INIT") {
    multiplayer.mySeat = data.seat;
    multiplayer.roomCode = data.roomCode || multiplayer.roomCode;
    multiplayer.status = "connected";

    // Initialize local game instance
    newGame(data.totalPlayers || 2, 0);
    applyRemoteState(data.game, data.audit);

    closeModal();
    updateMultiplayerBadge();

    const myPlayer = game.players[data.seat];
    showModal(
      "Joined Game!",
      '<div style="text-align:center;padding:12px 0;">' +
        '<div style="font-size:2.8rem;margin-bottom:8px;">' + myPlayer.avatar + '</div>' +
        '<p style="font-size:1.1rem;color:#ffe4b5;margin:0 0 6px 0;">You are playing as <strong>' + escapeHtml(myPlayer.name) + '</strong></p>' +
        '<p style="font-size:0.85rem;color:#a3e635;">Connected to Host in Room <strong>' + multiplayer.roomCode + '</strong></p>' +
        '<p style="font-size:0.82rem;color:#d8c4ab;margin-top:8px;">When it is your turn, dice and piece movements will be enabled for you.</p>' +
      '</div>',
      "Let's Play!",
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
 * Display Guest Seat Selection Modal: pick an unassigned player
 */
function showSeatSelectionModal(data) {
  const seats = data.seats || [];
  const roomCode = data.roomCode || multiplayer.roomCode;
  let errorBanner = "";
  if (data.error) {
    errorBanner = '<div class="mp-error-banner">' + escapeHtml(data.error) + '</div>';
  }

  const seatsHtml = seats
    .map((s) => {
      if (s.claimed) {
        return (
          '<div class="mp-seat-card claimed">' +
            '<div class="mp-seat-avatar">' + s.avatar + '</div>' +
            '<div class="mp-seat-info">' +
              '<strong>' + escapeHtml(s.name) + '</strong>' +
              '<span class="mp-seat-badge claimed-badge">' + (s.isHost ? '👑 Host' : 'Taken') + ' (' + escapeHtml(s.claimedBy) + ')</span>' +
            '</div>' +
            '<button type="button" class="btn pill" disabled style="opacity:0.4;cursor:not-allowed;">Occupied</button>' +
          '</div>'
        );
      } else {
        return (
          '<div class="mp-seat-card available" data-seat="' + s.seat + '">' +
            '<div class="mp-seat-avatar">' + s.avatar + '</div>' +
            '<div class="mp-seat-info">' +
              '<strong>' + escapeHtml(s.name) + '</strong>' +
              '<span class="mp-seat-badge available-badge">✨ Available</span>' +
            '</div>' +
            '<button type="button" class="btn pill mp-pick-btn" data-seat="' + s.seat + '" style="font-weight:700;">Pick ' + escapeHtml(s.name) + '</button>' +
          '</div>'
        );
      }
    })
    .join("");

  const modalHtml =
    '<div class="mp-seat-modal">' +
      errorBanner +
      '<p style="margin:0 0 10px 0;color:#f3dfc6;font-size:0.9rem;">' +
        'Choose an <strong>unassigned player</strong> below to join match <strong>' + roomCode + '</strong>:' +
      '</p>' +
      '<div class="mp-name-input-row" style="margin-bottom:12px;">' +
        '<label for="mpGuestCustomName" style="margin-bottom:4px;display:block;font-size:0.85rem;color:#e8d1b8;">Your Display Name (optional):</label>' +
        '<input id="mpGuestCustomName" maxlength="15" placeholder="e.g. Anand" style="padding:7px 10px;font-size:0.9rem;border-radius:8px;" />' +
      '</div>' +
      '<div class="mp-seats-list">' + seatsHtml + '</div>' +
    '</div>';

  showModal("Pick Your Player", modalHtml, "Cancel", () => {
    leaveMultiplayer();
  });

  setTimeout(() => {
    const pickButtons = document.querySelectorAll(".mp-pick-btn");
    pickButtons.forEach((btn) => {
      btn.onclick = () => {
        const seat = Number(btn.getAttribute("data-seat"));
        const customName = ($("mpGuestCustomName")?.value || "").trim();
        const conn = multiplayer.connections[0];
        if (conn && conn.open) {
          btn.textContent = "Joining…";
          btn.disabled = true;
          conn.send({
            type: "CLAIM_SEAT",
            seat,
            customName: customName || null,
          });
        }
      };
    });
  }, 40);
}

/**
 * Display Host Lobby Modal with Room Code, Direct Link & Live Dynamic QR Code
 */
function showHostLobbyModal(code, playerCount) {
  const inviteUrl = getRoomInviteUrl(code);
  const qrSvg = generateQrSvg(inviteUrl, 4, 4);

  const content =
    '<div class="mp-lobby">' +
      '<p style="margin:0 0 8px 0;color:#f3dfc6;font-size:0.88rem;">' +
        'Share this unique <strong>Game Code</strong> or <strong>QR Code</strong> with friends on phone, tablet, or laptop to auto-join:' +
      '</p>' +
      '<div class="mp-code-box">' +
        '<div class="mp-code-label">GAME CODE</div>' +
        '<div class="mp-code-value">' + code + '</div>' +
      '</div>' +
      '<div class="mp-qr-box">' +
        qrSvg +
        '<div class="mp-qr-caption">📷 Scan with phone camera to auto-join</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;width:100%;max-width:400px;margin:8px auto 4px auto;">' +
        '<input type="text" readonly value="' + inviteUrl + '" id="mpInviteInput" class="mp-input" />' +
        '<button id="mpCopyBtn" class="pill" type="button" style="white-space:nowrap;padding:6px 12px;font-weight:700;">Copy link</button>' +
      '</div>' +
      '<p id="mpCopyFeedback" style="margin:2px 0 6px 0;font-size:0.8rem;color:#a3e635;min-height:1.2em;"></p>' +
      '<div class="mp-lobby-seats" id="mpLobbySeatsContainer">' +
        renderHostLobbySeatsHtml() +
      '</div>' +
      '<div id="mpLobbyStatus" class="mp-lobby-status">' +
        renderLobbyStatusText() +
      '</div>' +
    '</div>';

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
          '<div class="mp-seat-pill ' + (isClaimed ? 'claimed' : 'waiting') + '">' +
            '<span class="mp-seat-avatar">' + s.avatar + '</span>' +
            '<span class="mp-seat-name">' + escapeHtml(s.name) + '</span>' +
            '<span class="mp-seat-status">' + (s.isHost ? '👑 Host' : isClaimed ? '✓ Joined' : 'Waiting…') + '</span>' +
          '</div>'
        );
      })
      .join("") +
    '</div>'
  );
}

/**
 * Render human-readable status text in lobby
 */
function renderLobbyStatusText() {
  const connected = Object.keys(multiplayer.claimedSeats || {}).length;
  const total = multiplayer.roomTargetCount;
  return connected >= total
    ? '<span style="color:#a3e635;font-weight:bold;">✓ All ' + total + ' players have joined!</span>'
    : 'Waiting for players to scan QR code… (' + connected + '/' + total + ' joined)';
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
  badge.title = "Online match active (" + role + "). Click to show QR code and room details.";
  badge.onclick = () => {
    if (multiplayer.isHost) {
      showHostLobbyModal(multiplayer.roomCode, multiplayer.roomTargetCount);
    } else {
      showModal(
        "Room " + multiplayer.roomCode,
        '<div style="text-align:center;padding:12px 0;">' +
          '<p>You are playing as <strong>' + seatName + '</strong> (Guest).</p>' +
          '<p style="color:#d8c4ab;font-size:0.88rem;">Connected to Host room ' + multiplayer.roomCode + '</p>' +
          '<button class="pill" id="mpLeaveBtn" style="background:#8b2626;color:#fff;margin-top:14px;padding:8px 18px;font-weight:bold;">Leave Match</button>' +
        '</div>',
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
    }
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
  multiplayer.claimedSeats = {};
  updateMultiplayerBadge();
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
