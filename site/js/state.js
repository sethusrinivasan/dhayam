/**
 * state.js - Game State Variables & Core Accessors
 *
 * Maintains global mutable match state, animation locks, active player helpers,
 * and text sanitizers for organizer-edited player names.
 */
"use strict";

      const $ = (id) => document.getElementById(id);
      let game = null,
        selectedRoll = 0,
        selectedPieceId = null,
        demo = false,
        modalAction = null,
        demoTimer = null,
        demoSpeechTimer = null,
        demoSpeechId = 0,
        demoWaitingForSpeech = false,
        demoNextDelay = 5000,
        demoPaused = false,
        demoStep = 0,
        demoMode = "classic",
        demoPlayerCount = 2,
        demoWebSockets = [],
        demoWatchdogTimer = null,
        demoKeepAliveTimer = null,
        demoSpeed = 1,
        superSpeed = false,
        quantumMode = false,
        savedDemoSpeed = 1,
        savedAudioEnabled = false,
        audioEnabled = false,
        demoRollQueue = [],
        rolling = false,
        moving = false,
        movingPieceId = null,
        movingStepRemaining = 0,
        capturedPieceIds = [],
        capturedPlayerIds = [],
        rollTimer = null,
        computerTimer = null,
        commentaryUntil = 0,
        audit = null,
        availableVoices = [],
        // Turn Thinking Timer: tracks thinking duration for human player turns
        turnThinkingStartTime = Date.now(),
        turnThinkingInterval = null,
        // Game Liveliness Timer: tracks session/match uptime updated every 30s
        gameStartTime = Date.now(),
        gameTimerInterval = null,
        // Real Demo Liveliness: tracks last progress timestamp and recurring stall detector
        lastRealDemoActionTime = Date.now(),
        realDemoStallDetector = null;
      const DEMO_DELAY = 5000,
        MOVE_STEP_DELAY = 650,
        SUPER_DEMO_SPEED = 3,
        QUANTUM_DEMO_SPEED = 32,
        MAX_DEMO_SPEED = 128,
        MIN_SUPER_MOVE_DELAY = 10,
        // Thinking timer thresholds: warn after 10s, auto-pass after 60s
        THINKING_WARNING_THRESHOLD_SEC = 10,
        THINKING_MAX_TIMEOUT_SEC = 60,
        // Page liveliness heartbeat cadence: updates every 30 seconds
        GAME_TIMER_INTERVAL_MS = 30000;

      function active() {
        return game.players[game.current];
      }
      function escapeHtml(value) {
        return String(value).replace(
          /[&<>'"]/g,
          (character) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              "'": "&#39;",
              '"': "&quot;",
            })[character],
        );
      }
      function cleanPlayerName(value, fallback) {
        return value.replace(/\s+/g, " ").trim().slice(0, 18) || fallback;
      }
      function node(player, piece) {
        return piece.progress < 0 ? null : ROUTES[player.seat][piece.progress];
      }
      function finished(p) {
        return p.pieces.every((q) => q.progress === 43);
      }

      const multiplayer = {
        active: false,
        isHost: false,
        roomCode: null,
        mySeat: 0,
        peer: null,
        connections: [],
        status: "offline",
        roomTargetCount: 2,
        claimedSeats: Object.create(null),
        transport: "cf_ws",
        ws: null,
        token: null,
        presence: {},
      };

      function isMyTurn() {
        if (!game) return false;
        if (!multiplayer.active) return !active().computer;
        return game.current === multiplayer.mySeat;
      }

      if (typeof window !== "undefined") {
        Object.defineProperty(window, "game", {
          get: () => game,
          set: (v) => { game = v; },
          configurable: true,
        });
        Object.defineProperty(window, "audit", {
          get: () => audit,
          set: (v) => { audit = v; },
          configurable: true,
        });
        Object.defineProperty(window, "turnThinkingStartTime", {
          get: () => turnThinkingStartTime,
          set: (v) => { turnThinkingStartTime = v; },
          configurable: true,
        });
        window.active = active;
        window.node = node;
        window.isMyTurn = isMyTurn;
        window.THINKING_WARNING_THRESHOLD_SEC = THINKING_WARNING_THRESHOLD_SEC;
        window.THINKING_MAX_TIMEOUT_SEC = THINKING_MAX_TIMEOUT_SEC;
      }
