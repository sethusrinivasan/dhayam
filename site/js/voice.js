/**
 * voice.js - Keyboard Navigation & Optional Voice Control Engine
 *
 * Provides complete keyboard-only play (Roll, Move, New Solo Game, Exit)
 * and optional hands-free voice command recognition via the Web Speech API.
 */
"use strict";

let voiceEnabled = false;
let speechRecognitionInstance = null;
let voiceToastTimer = null;
let keyboardSelectedMoveIndex = 0;

/**
 * Displays a non-intrusive floating visual confirmation of recognized voice/keyboard commands.
 */
function showVoiceToast(message) {
  let toast = $("voiceToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "voiceToast";
    toast.className = "voice-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  if (voiceToastTimer) clearTimeout(voiceToastTimer);
  voiceToastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1900);
}

/**
 * Primary keyboard/voice handler for rolling dice.
 */
function handleKeyboardRoll() {
  if (typeof game === "undefined" || !game) return;
  if (game.phase === "roll") {
    const actionBtn = $("actionBtn");
    if (actionBtn && !actionBtn.disabled) {
      actionBtn.click();
      showVoiceToast("🎲 Rolling dice…");
    } else if (typeof roll === "function" && !rolling) {
      roll();
      showVoiceToast("🎲 Rolling dice…");
    }
  } else if (game.phase === "move") {
    // If during move phase and action button says "Pass turn" or "Enter Piece"
    const actionBtn = $("actionBtn");
    if (actionBtn && !actionBtn.disabled) {
      actionBtn.click();
    } else {
      handleKeyboardMove();
    }
  } else if (game.phase === "done") {
    handleKeyboardNewGame();
  }
}

/**
 * Primary keyboard/voice handler for moving pieces.
 * Optionally accepts a 1-based piece number (1..6).
 */
function handleKeyboardMove(targetPieceNumber = null) {
  if (typeof game === "undefined" || !game || game.phase !== "move" || moving) return;
  const legalOptions = typeof options === "function" ? options() : [];
  if (!legalOptions.length) {
    if (typeof passRemainingRolls === "function") {
      passRemainingRolls();
      showVoiceToast("⏭️ Passing turn (no moves)");
    }
    return;
  }

  // 1. If explicit piece number requested (e.g. piece 1..6)
  if (targetPieceNumber !== null) {
    const match = legalOptions.find((opt) => {
      if (!opt.piece || !opt.piece.id) return false;
      const parts = opt.piece.id.split("-");
      const idx = parts.length > 1 ? parseInt(parts[1], 10) : parseInt(opt.piece.id.replace(/\D/g, ""), 10);
      return idx === targetPieceNumber - 1;
    });
    if (match) {
      showVoiceToast("👉 Moving piece " + targetPieceNumber);
      apply(match, "keyboard");
      return;
    }
  }

  // 2. If action button is active for single move or entry
  const actionBtn = $("actionBtn");
  if (actionBtn && !actionBtn.disabled && actionBtn.textContent.includes("Enter")) {
    showVoiceToast("✨ Entering piece");
    actionBtn.click();
    return;
  }

  // 3. Cycle or choose best automatic move
  if (legalOptions.length === 1) {
    showVoiceToast("👉 Moving piece");
    apply(legalOptions[0], "keyboard");
    return;
  }

  const bestMove = typeof bestAutomaticMove === "function" ? bestAutomaticMove(legalOptions) : legalOptions[0];
  if (bestMove) {
    showVoiceToast("👉 Moving piece");
    apply(bestMove, "keyboard");
  }
}

/**
 * Primary keyboard/voice handler to start a new Solo game vs Computer.
 */
function handleKeyboardNewGame() {
  const modalback = $("modalback");
  if (modalback && modalback.classList.contains("open")) {
    closeModal();
  }
  if (typeof newGame === "function") {
    newGame(2, 1);
    showVoiceToast("🤖 New Solo Game vs Computer");
    if (typeof speakGame === "function") {
      speakGame("Started new solo game vs computer.");
    }
  }
}

/**
 * Primary keyboard/voice handler to exit or close modals/demo/matches.
 */
function handleKeyboardExit() {
  const modalback = $("modalback");
  if (modalback && modalback.classList.contains("open")) {
    closeModal();
    return;
  }
  if (typeof demo !== "undefined" && demo) {
    if (typeof exitGuidedDemo === "function") exitGuidedDemo();
    showVoiceToast("🚪 Exited demo");
    return;
  }
  if (typeof multiplayer !== "undefined" && multiplayer.active) {
    if (typeof leaveMultiplayer === "function") leaveMultiplayer();
    showVoiceToast("🚪 Left multiplayer room");
    return;
  }
  showModal(
    "Exit Match",
    "<p>Are you sure you want to exit the current match?</p><p class='help'>Starting a new match will reset piece positions and scores.</p>",
    "Exit & Restart",
    () => {
      handleKeyboardNewGame();
    }
  );
}

/**
 * Opens a modal explaining all available keyboard shortcuts and voice commands.
 */
function showKeyboardHelpModal() {
  const helpHtml =
    '<div class="shortcuts-modal-content">' +
      '<section class="settings-section">' +
        '<h3 class="settings-heading">⌨️ Keyboard Controls</h3>' +
        '<table class="shortcuts-table" style="width:100%;border-collapse:collapse;margin-top:8px;">' +
          '<tbody>' +
            '<tr><td style="padding:6px 0;"><strong>Space</strong> or <strong>R</strong></td><td style="color:#ffe0a3;">Roll Dice (or Primary Action)</td></tr>' +
            '<tr><td style="padding:6px 0;"><strong>M</strong> or <strong>Enter</strong></td><td style="color:#ffe0a3;">Move / Enter Piece</td></tr>' +
            '<tr><td style="padding:6px 0;"><strong>1</strong> – <strong>6</strong></td><td style="color:#ffe0a3;">Move Specific Piece Number</td></tr>' +
            '<tr><td style="padding:6px 0;"><strong>N</strong></td><td style="color:#ffe0a3;">New Solo Game vs Computer</td></tr>' +
            '<tr><td style="padding:6px 0;"><strong>Esc</strong> or <strong>X</strong></td><td style="color:#ffe0a3;">Exit Match / Close Dialog</td></tr>' +
            '<tr><td style="padding:6px 0;"><strong>V</strong></td><td style="color:#ffe0a3;">Toggle Voice Commands</td></tr>' +
            '<tr><td style="padding:6px 0;"><strong>?</strong> or <strong>H</strong></td><td style="color:#ffe0a3;">Show Shortcuts Help</td></tr>' +
          '</tbody>' +
        '</table>' +
      '</section>' +
      '<section class="settings-section">' +
        '<h3 class="settings-heading">🎤 Voice Commands (Optional)</h3>' +
        '<p class="settings-help">When voice control is enabled, speak clearly into your microphone:</p>' +
        '<ul style="margin:8px 0 0 18px;line-height:1.6;color:#ffe0a3;">' +
          '<li><em>"Roll"</em> or <em>"Roll dice"</em> — Rolls the Dayakattai dice</li>' +
          '<li><em>"Move"</em> or <em>"Move piece [1-6]"</em> — Moves a piece or enters the board</li>' +
          '<li><em>"New game"</em> or <em>"Solo game"</em> — Starts a solo match vs computer</li>' +
          '<li><em>"Pass"</em> — Passes turn when no moves are available</li>' +
          '<li><em>"Exit"</em> or <em>"Quit"</em> — Exits match or closes dialog</li>' +
        '</ul>' +
      '</section>' +
    '</div>';

  showModal("⌨️ Keyboard & Voice Controls", helpHtml, "Got it");
}

/**
 * Initializes and wires the global keyboard listener.
 */
function setupKeyboardNavigation() {
  document.addEventListener("keydown", (e) => {
    // Never intercept typing inside inputs, selects, or textareas
    if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
      return;
    }
    // Ignore modifier combinations (Ctrl/Alt/Meta) except pure keystrokes
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    const key = e.key.toLowerCase();

    // 1. Roll dice: Space or R
    if (e.code === "Space" || key === "r") {
      e.preventDefault();
      handleKeyboardRoll();
      return;
    }

    // 2. Move piece: M or Enter
    if (key === "m" || e.code === "Enter") {
      e.preventDefault();
      handleKeyboardMove();
      return;
    }

    // 3. Move specific piece 1..6
    if (["1", "2", "3", "4", "5", "6"].includes(key)) {
      e.preventDefault();
      handleKeyboardMove(parseInt(key, 10));
      return;
    }

    // 4. New game solo vs computer: N
    if (key === "n") {
      e.preventDefault();
      handleKeyboardNewGame();
      return;
    }

    // 5. Exit game / modal: Escape or X
    if (e.code === "Escape" || key === "x") {
      e.preventDefault();
      handleKeyboardExit();
      return;
    }

    // 6. Toggle voice commands: V
    if (key === "v") {
      e.preventDefault();
      toggleVoiceCommands();
      return;
    }

    // 7. Help & shortcuts modal: H or ?
    if (key === "h" || key === "?") {
      e.preventDefault();
      showKeyboardHelpModal();
      return;
    }

    // 8. Withdraw from match: W (only available for OAuth signed-in players)
    if (key === "w") {
      const withdrawBtn = document.getElementById("withdrawBtn");
      if (withdrawBtn && !withdrawBtn.hidden && !withdrawBtn.disabled) {
        e.preventDefault();
        if (typeof requestWithdrawal === "function") {
          requestWithdrawal();
        } else {
          withdrawBtn.click();
        }
        return;
      }
    }
  });
}

/**
 * Parses spoken speech transcripts into game commands.
 */
function processVoiceTranscript(raw) {
  if (!raw) return;
  // Ignore self-speech loopback while computer narrator is actively talking
  if (typeof window !== "undefined" && window.speechSynthesis && window.speechSynthesis.speaking) {
    return;
  }

  const text = raw.toLowerCase().trim();

  // 1. Roll command
  if (
    /^(roll|throw|dice|rolling)/i.test(text) ||
    text.includes("roll dice") ||
    text.includes("throw dice") ||
    text === "roll" ||
    text === "dice"
  ) {
    handleKeyboardRoll();
    return;
  }

  // 2. Move command
  if (
    /^(move|enter|step|go)/i.test(text) ||
    text.includes("move") ||
    text.includes("enter piece")
  ) {
    let pieceNum = null;
    if (text.includes("1") || text.includes("one")) pieceNum = 1;
    else if (text.includes("2") || text.includes("two")) pieceNum = 2;
    else if (text.includes("3") || text.includes("three")) pieceNum = 3;
    else if (text.includes("4") || text.includes("four")) pieceNum = 4;
    else if (text.includes("5") || text.includes("five")) pieceNum = 5;
    else if (text.includes("6") || text.includes("six")) pieceNum = 6;
    handleKeyboardMove(pieceNum);
    return;
  }

  // 3. New game solo vs computer
  if (
    text.includes("new game") ||
    text.includes("solo") ||
    text.includes("play computer") ||
    text.includes("restart")
  ) {
    handleKeyboardNewGame();
    return;
  }

  // 4. Pass turn
  if (text.includes("pass") || text.includes("skip")) {
    if (typeof passRemainingRolls === "function") {
      showVoiceToast("⏭️ Pass turn");
      passRemainingRolls();
    }
    return;
  }

  // 5. Exit game
  if (text.includes("exit") || text.includes("quit") || text.includes("leave")) {
    handleKeyboardExit();
    return;
  }

  // 6. Help
  if (text.includes("help") || text.includes("shortcuts")) {
    showKeyboardHelpModal();
    return;
  }
}

/**
 * Toggles voice commands on or off, asking for microphone permissions when turning ON.
 */
function toggleVoiceCommands() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (voiceEnabled) {
    voiceEnabled = false;
    if (speechRecognitionInstance) {
      try {
        speechRecognitionInstance.stop();
      } catch (_) {}
      speechRecognitionInstance = null;
    }
    updateVoiceButtonUI(false);
    showVoiceToast("🔇 Voice control: Off");
    if (typeof speakGame === "function") speakGame("Voice commands disabled.");
    return;
  }

  // Turning ON: Verify Web Speech API support
  if (!SpeechRecognition) {
    showModal(
      "Voice Control Not Supported",
      "<p>Your browser does not support the Web Speech API (SpeechRecognition).</p><p class='help'>To use voice commands, please use Google Chrome, Microsoft Edge, or a supported Chromium browser.</p>",
      "Understood"
    );
    return;
  }

  // Request microphone permission explicitly via getUserMedia or direct recognition
  function startListening() {
    try {
      speechRecognitionInstance = new SpeechRecognition();
      speechRecognitionInstance.continuous = true;
      speechRecognitionInstance.interimResults = false;
      speechRecognitionInstance.lang = "en-US";

      speechRecognitionInstance.onresult = (event) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript;
        processVoiceTranscript(transcript);
      };

      speechRecognitionInstance.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          voiceEnabled = false;
          updateVoiceButtonUI(false);
          showModal(
            "Microphone Permission Denied",
            "<p>Microphone access was blocked by your browser settings.</p><p class='help'>Please enable microphone permissions in your browser URL bar to use voice commands.</p>",
            "OK"
          );
        }
      };

      speechRecognitionInstance.onend = () => {
        // Automatically keep listening if voice commands remain enabled
        if (voiceEnabled && speechRecognitionInstance) {
          try {
            speechRecognitionInstance.start();
          } catch (_) {}
        }
      };

      speechRecognitionInstance.start();
      voiceEnabled = true;
      updateVoiceButtonUI(true);
      showVoiceToast("🎤 Voice control: Listening");
      if (typeof speakGame === "function") {
        speakGame("Voice control enabled. You can say: Roll dice, Move, New game, or Exit.");
      }
    } catch (err) {
      console.warn("Failed to start SpeechRecognition:", err);
      voiceEnabled = false;
      updateVoiceButtonUI(false);
    }
  }

  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Permission granted - stop the raw stream tracks so mic light isn't held by getUserMedia
        stream.getTracks().forEach((track) => track.stop());
        startListening();
      })
      .catch((err) => {
        console.warn("Microphone permission error:", err);
        showModal(
          "Microphone Permission Required",
          "<p>Dhayam requires microphone access to listen for voice commands like <strong>'Roll'</strong>, <strong>'Move'</strong>, and <strong>'New game'</strong>.</p><p class='help'>Please click Allow when prompted by your browser.</p>",
          "OK"
        );
      });
  } else {
    startListening();
  }
}

/**
 * Updates the #voiceToggle button appearance and accessibility attributes.
 */
function updateVoiceButtonUI(active) {
  const btn = $("voiceToggle");
  if (!btn) return;
  if (active) {
    btn.textContent = "🟢 🎤 Voice: Listening";
    btn.classList.add("listening");
    btn.setAttribute("aria-pressed", "true");
    btn.title = "Voice control active. Click to disable.";
  } else {
    btn.textContent = "🎤 Voice: Off";
    btn.classList.remove("listening");
    btn.setAttribute("aria-pressed", "false");
    btn.title = "Optional: Control the game with voice commands (Roll, Move, New game, Exit)";
  }
}

// Attach to window
window.handleKeyboardRoll = handleKeyboardRoll;
window.handleKeyboardMove = handleKeyboardMove;
window.handleKeyboardNewGame = handleKeyboardNewGame;
window.handleKeyboardExit = handleKeyboardExit;
window.showKeyboardHelpModal = showKeyboardHelpModal;
window.toggleVoiceCommands = toggleVoiceCommands;
window.setupKeyboardNavigation = setupKeyboardNavigation;
