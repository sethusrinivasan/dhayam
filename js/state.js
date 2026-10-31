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
        demoSpeed = 1,
        superSpeed = false,
        savedDemoSpeed = 1,
        savedAudioEnabled = true,
        audioEnabled = true,
        demoRollQueue = [],
        rolling = false,
        moving = false,
        movingPieceId = null,
        capturedPieceIds = [],
        capturedPlayerIds = [],
        rollTimer = null,
        computerTimer = null,
        commentaryUntil = 0,
        audit = null,
        availableVoices = [];
      const DEMO_DELAY = 5000,
        MOVE_STEP_DELAY = 650,
        SUPER_DEMO_SPEED = 3,
        MIN_SUPER_MOVE_DELAY = 220;

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
      };

      function isMyTurn() {
        if (!game) return false;
        if (!multiplayer.active) return !active().computer;
        return game.current === multiplayer.mySeat;
      }
