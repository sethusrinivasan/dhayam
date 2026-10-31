/**
 * audio.js - Speech Synthesis & Voice Commentary
 *
 * Maps players to browser speech synthesis voices with distinct masculine
 * and feminine pitch hints, narrating key game events and demo steps.
 */
"use strict";

      const FEMININE_VOICE_HINTS = [
          "samantha",
          "victoria",
          "karen",
          "moira",
          "tessa",
          "zira",
          "female",
        ],
        MASCULINE_VOICE_HINTS = [
          "daniel",
          "alex",
          "fred",
          "david",
          "mark",
          "male",
        ];
      function refreshVoices() {
        if ("speechSynthesis" in window)
          availableVoices = speechSynthesis.getVoices();
      }
      function voiceForPlayer(player) {
        if (!player || !availableVoices.length) return null;
        const playerIndex = game.players.indexOf(player),
          hints =
            playerIndex % 2 === 0
              ? FEMININE_VOICE_HINTS
              : MASCULINE_VOICE_HINTS,
          preferred = availableVoices.find((voice) =>
            hints.some((hint) => voice.name.toLowerCase().includes(hint)),
          );
        return (
          preferred || availableVoices[playerIndex % availableVoices.length]
        );
      }

      function speakGame(message) {
        if (!audioEnabled || demo || !("speechSynthesis" in window)) {
          commentaryUntil = 0;
          return 0;
        }
        speechSynthesis.cancel();
        const words = message.trim().split(/\s+/).length,
          duration = Math.max(2400, Math.round((words / 2.3) * 1000) + 700),
          speech = new SpeechSynthesisUtterance(message);
        speech.voice = voiceForPlayer(active());
        speech.rate = 0.86;
        speech.pitch = 1;
        speech.volume = 1;
        commentaryUntil = Date.now() + duration;
        speechSynthesis.speak(speech);
        return duration;
      }

      function finishDemoSpeech(id) {
        if (id !== demoSpeechId) return;
        if (demoSpeechTimer) clearTimeout(demoSpeechTimer);
        demoSpeechTimer = null;
        demoWaitingForSpeech = false;
        if (demo && !demoPaused && game.phase !== "done") scheduleDemo(1500);
      }
      function speakDemo(message) {
        // The next demo action waits for narration to finish. A calculated
        // reading delay provides the same human pace when audio is unavailable.
        const words = message.trim().split(/\s+/).length;
        demoNextDelay = Math.max(5000, Math.round((words / 2) * 1000) + 1800);
        if (!audioEnabled || !("speechSynthesis" in window)) {
          demoWaitingForSpeech = false;
          return;
        }
        if (demoSpeechTimer) clearTimeout(demoSpeechTimer);
        const id = ++demoSpeechId;
        speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(message);
        demoWaitingForSpeech = true;
        speech.voice = voiceForPlayer(active());
        speech.rate = Math.min(2, 0.78 * demoSpeed);
        speech.pitch = 1;
        speech.volume = 1;
        speech.onend = () => finishDemoSpeech(id);
        speech.onerror = () => finishDemoSpeech(id);
        demoSpeechTimer = setTimeout(
          () => finishDemoSpeech(id),
          scaledDemoDelay(demoNextDelay + 2500),
        );
        speechSynthesis.speak(speech);
      }
      async function demoScene(message, update) {
        await update();
        render();
        recordAudit("DEMO_SCENE", { message });
        $("statusTitle").textContent = "Guided demo";
        $("statusText").textContent = message;
        speakDemo(message);
        if (message.toLowerCase().includes("roll")) triggerDiceAnimation();
      }

      function updateAudioToggle() {
        const available = "speechSynthesis" in window;
        if (!$("audioToggle")) return;
        $("audioToggle").textContent = available
          ? audioEnabled
            ? "🔊"
            : "🔇"
          : "🔇";
        $("audioToggle").setAttribute(
          "aria-label",
          available
            ? audioEnabled
              ? "Voice commentary: ON. Click to mute."
              : "Voice commentary: MUTED. Click to turn on."
            : "Commentary unavailable",
        );
        $("audioToggle").title = available
          ? audioEnabled
            ? "Voice commentary: ON (Click to mute)"
            : "Voice commentary: MUTED (Click to unmute)"
          : "Commentary unavailable";
        $("audioToggle").setAttribute("aria-pressed", String(audioEnabled));
        $("audioToggle").disabled = !available || (demo && superSpeed);
      }
      function toggleAudio() {
        if (demo && superSpeed) return;
        audioEnabled = !audioEnabled;
        commentaryUntil = 0;
        if (demoSpeechTimer) clearTimeout(demoSpeechTimer);
        demoSpeechTimer = null;
        demoSpeechId++;
        demoWaitingForSpeech = false;
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        if (audioEnabled && demo) speakDemo($("statusText").textContent);
        else if (audioEnabled && !demo) speakGame("Audio commentary is on.");
        else if (demo && !demoPaused) scheduleDemo(demoNextDelay);
        updateAudioToggle();
        updateDemoControls();
      }
