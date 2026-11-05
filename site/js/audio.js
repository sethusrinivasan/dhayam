/**
 * audio.js - Speech Synthesis & Voice Commentary
 *
 * Maps players to browser speech synthesis voices with distinct masculine
 * and feminine pitch hints, narrating key game events and demo steps.
 */
"use strict";

      const AVATAR_SPEECH_NAMES = {
        // Halloween theme
        "🎃": "pumpkin",
        "👻": "ghost",
        "🧙": "witch",
        "🧛": "vampire",
        // Heritage Wood theme
        "🌿": "leaf",
        "🌊": "wave",
        "☀️": "sun",
        "🌾": "wheat",
        // Royal Bronze theme
        "🦅": "eagle",
        "🛡️": "shield",
        "👑": "crown",
        "⚔️": "swords",
        // Midnight Nebula theme
        "⚡": "lightning",
        "💫": "star",
        "✨": "sparkle",
        "☄️": "comet",
        // Classic animals
        "🐘": "elephant",
        "🐯": "tiger",
        "🦚": "peacock",
        "🦁": "lion",
        "🦊": "fox",
        "🦉": "owl",
        // Colored tokens
        "🔴": "red piece",
        "🟢": "green piece",
        "🟡": "yellow piece",
        "🔵": "blue piece",
        "🟣": "purple piece",
        "🟠": "orange piece",
        // Other fun emojis
        "🌸": "lotus",
        "🐲": "dragon",
        "🦄": "unicorn",
        "🐱": "cat",
        "🐶": "dog",
      };

      function getPlayerAvatarSpeechName(player) {
        if (!player) return "piece";
        if (player.avatar && AVATAR_SPEECH_NAMES[player.avatar]) {
          return AVATAR_SPEECH_NAMES[player.avatar];
        }
        return "piece";
      }
      window.getPlayerAvatarSpeechName = getPlayerAvatarSpeechName;

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

      function hasTamilVoice() {
        if (typeof speechSynthesis === "undefined") return false;
        const voices = speechSynthesis.getVoices() || [];
        return Boolean(
          voices.find((voice) => {
            const langCode = (voice.lang || "").toLowerCase();
            const voiceName = (voice.name || "").toLowerCase();
            return langCode.startsWith("ta") || voiceName.includes("tamil");
          })
        );
      }
      window.hasTamilVoice = hasTamilVoice;

      function voiceForPlayer(player) {
        if (!player || !availableVoices.length) return null;
        if (typeof getLanguage === "function" && getLanguage() === "ta") {
          const tamilVoice = availableVoices.find((voice) => {
            const langCode = (voice.lang || "").toLowerCase();
            const voiceName = (voice.name || "").toLowerCase();
            return langCode.startsWith("ta") || voiceName.includes("tamil");
          });
          if (tamilVoice) return tamilVoice;
          // Never assign an English voice to speak Tamil Unicode script.
          // Returning null allows browser's speech.lang = "ta-IN" default or cloud voice to engage.
          return null;
        }
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

      let currentUtterance = null;
      let speechStartTime = 0;
      let speechIdCounter = 0;

      function isAudioSpeaking() {
        return Boolean(
          typeof speechSynthesis !== "undefined" &&
          (speechSynthesis.speaking || (currentUtterance && Date.now() < commentaryUntil))
        );
      }
      window.isAudioSpeaking = isAudioSpeaking;

      function sanitizeSpeechText(text) {
        if (!text) return "";
        return text
          // Strip emojis so TTS does not read "Party popper" or "Trophy"
          .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
          // Strip parenthetical notes like (+1 bonus point)
          .replace(/\s*\(\+?\d+[^)]*\)/g, "")
          // Clean multiple spaces and whitespace
          .replace(/\s+/g, " ")
          .trim();
      }
      window.sanitizeSpeechText = sanitizeSpeechText;

      function speakGame(message, options) {
        if (!audioEnabled || demo || !("speechSynthesis" in window)) {
          commentaryUntil = 0;
          return 0;
        }

        const isTamil = typeof getLanguage === "function" && getLanguage() === "ta";
        let spokenText = message;
        // If system has no native Tamil voice installed and Tanglish phonetic is provided,
        // use smooth phonetic Tanglish so English TTS engines pronounce it cleanly instead of choking.
        if (isTamil && options && options.tanglish && !hasTamilVoice()) {
          spokenText = options.tanglish;
        }

        spokenText = sanitizeSpeechText(spokenText);
        if (!spokenText) return 0;

        // If an existing speech is still speaking, record interruption before cancelling
        if (speechSynthesis.speaking && currentUtterance) {
          const elapsed = Date.now() - speechStartTime;
          if (typeof FlightRecorder !== "undefined") {
            FlightRecorder.record("AUDIO_PLAYBACK_INTERRUPTED", {
              id: currentUtterance._id,
              text: currentUtterance.text,
              elapsedMs: elapsed,
              reason: "CANCELLED_FOR_NEW_COMMENTARY"
            });
          }
        }

        speechSynthesis.cancel();
        const words = spokenText.trim().split(/\s+/).length,
          duration = Math.max(2200, Math.round((words / 2.1) * 1000) + 750),
          speech = new SpeechSynthesisUtterance(spokenText);
        const id = ++speechIdCounter;
        speech._id = id;
        currentUtterance = speech;
        speechStartTime = Date.now();

        const activeVoice = voiceForPlayer(active());
        if (activeVoice) {
          speech.voice = activeVoice;
        }

        if (isTamil) {
          speech.lang = hasTamilVoice() ? "ta-IN" : (activeVoice ? activeVoice.lang : "ta-IN");
        } else {
          speech.lang = "en-US";
        }
        speech.rate = 0.88;
        speech.pitch = 1;
        speech.volume = 1;

        speech.onstart = () => {
          if (typeof FlightRecorder !== "undefined") {
            FlightRecorder.record("AUDIO_PLAYBACK_START", {
              id,
              text: message,
              words,
              estimatedDurationMs: duration,
              player: active()?.name,
              avatar: active()?.avatar,
              voice: speech.voice ? speech.voice.name : "default"
            });
          }
        };

        speech.onend = () => {
          const elapsed = Date.now() - speechStartTime;
          if (currentUtterance === speech) currentUtterance = null;
          commentaryUntil = Math.min(commentaryUntil, Date.now());
          if (typeof FlightRecorder !== "undefined") {
            FlightRecorder.record("AUDIO_PLAYBACK_COMPLETE", {
              id,
              text: message,
              elapsedMs: elapsed
            });
          }
        };

        speech.onerror = (e) => {
          const elapsed = Date.now() - speechStartTime;
          if (currentUtterance === speech) currentUtterance = null;
          commentaryUntil = Math.min(commentaryUntil, Date.now());
          const errorType = e.error || "unknown";
          if (typeof FlightRecorder !== "undefined") {
            if (errorType === "interrupted" || errorType === "canceled") {
              FlightRecorder.record("AUDIO_PLAYBACK_INTERRUPTED", {
                id,
                text: message,
                reason: errorType,
                elapsedMs: elapsed
              });
            } else {
              FlightRecorder.record("AUDIO_PLAYBACK_ABORTED", {
                id,
                text: message,
                error: errorType,
                elapsedMs: elapsed
              });
            }
          }
        };

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

        if (speechSynthesis.speaking) {
          if (typeof FlightRecorder !== "undefined") {
            FlightRecorder.record("AUDIO_PLAYBACK_INTERRUPTED", {
              id,
              text: message,
              reason: "CANCELLED_FOR_DEMO_SCENE"
            });
          }
        }

        speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(message);
        demoWaitingForSpeech = true;
        speech.voice = voiceForPlayer(active());
        speech.rate = Math.min(2, 0.78 * demoSpeed);
        speech.pitch = 1;
        speech.volume = 1;

        speech.onstart = () => {
          if (typeof FlightRecorder !== "undefined") {
            FlightRecorder.record("AUDIO_PLAYBACK_START", {
              id,
              context: "demo",
              text: message,
              words
            });
          }
        };

        speech.onend = () => {
          if (typeof FlightRecorder !== "undefined") {
            FlightRecorder.record("AUDIO_PLAYBACK_COMPLETE", {
              id,
              context: "demo",
              text: message
            });
          }
          finishDemoSpeech(id);
        };

        speech.onerror = (e) => {
          const err = e.error || "unknown";
          if (typeof FlightRecorder !== "undefined") {
            FlightRecorder.record(err === "interrupted" || err === "canceled" ? "AUDIO_PLAYBACK_INTERRUPTED" : "AUDIO_PLAYBACK_ABORTED", {
              id,
              context: "demo",
              text: message,
              error: err
            });
          }
          finishDemoSpeech(id);
        };

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
        $("statusTitle").textContent = "Demo";
        $("statusText").textContent = message;
        speakDemo(message);
        if (message.toLowerCase().includes("roll")) triggerDiceAnimation();
      }

      function updateAudioToggle() {
        const available = "speechSynthesis" in window;
        if (!$("audioToggle")) return;
        const textOn = typeof t === "function" ? t("voice_commentary_on") : "🔊 Voice commentary: On";
        const textOff = typeof t === "function" ? t("voice_commentary_off") : "🔇 Voice commentary: Off";
        $("audioToggle").textContent = available
          ? audioEnabled
            ? textOn
            : textOff
          : "🔇 Voice commentary unavailable";
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
        const isSpeedMuted = Boolean(demo && (superSpeed || quantumMode || demoSpeed >= 32));
        $("audioToggle").disabled = !available || isSpeedMuted;
      }
      function toggleAudio() {
        if (demo && (superSpeed || quantumMode || demoSpeed >= 32)) return;
        audioEnabled = !audioEnabled;
        commentaryUntil = 0;
        if (demoSpeechTimer) clearTimeout(demoSpeechTimer);
        demoSpeechTimer = null;
        demoSpeechId++;
        demoWaitingForSpeech = false;
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        if (audioEnabled && demo) speakDemo($("statusText").textContent);
        else if (audioEnabled && !demo) speakGame(typeof t === "function" ? t("speech_audio_on") : "Audio commentary is on.");
        else if (demo && !demoPaused) scheduleDemo(demoNextDelay);
        updateAudioToggle();
        updateDemoControls();
      }

      let audioCtx = null;
      function playTone(freq = 440, duration = 0.12, type = "sine") {
        if (!audioEnabled) return;
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return;
          if (!audioCtx) audioCtx = new AudioContextClass();
          if (audioCtx.state === "suspended") audioCtx.resume();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + duration);
        } catch (_) {}
      }
      window.playTone = playTone;
