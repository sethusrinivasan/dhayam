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
      try {
        const savedAudio = typeof localStorage !== "undefined" ? localStorage.getItem("dhayam_audio") : null;
        if (savedAudio !== null) {
          audioEnabled = savedAudio === "true";
        }
      } catch (_) {}

      function refreshVoices() {
        if ("speechSynthesis" in window)
          availableVoices = speechSynthesis.getVoices() || [];
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        speechSynthesis.addEventListener("voiceschanged", refreshVoices);
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
        if (!player) return null;
        if ((!availableVoices || !availableVoices.length) && typeof speechSynthesis !== "undefined") {
          availableVoices = speechSynthesis.getVoices() || [];
        }
        if (!availableVoices || !availableVoices.length) return null;

        if (typeof getLanguage === "function" && getLanguage() === "ta") {
          const tamilVoice = availableVoices.find((voice) => {
            const langCode = (voice.lang || "").toLowerCase();
            const voiceName = (voice.name || "").toLowerCase();
            return langCode.startsWith("ta") || voiceName.includes("tamil");
          });
          if (tamilVoice) return tamilVoice;
          // Never assign a non-Tamil voice to speak Tamil Unicode script.
          // Returning null allows browser's speech.lang = "ta-IN" default or cloud voice to engage.
          return null;
        }

        // For English (or any default non-Tamil locale):
        const englishVoices = availableVoices.filter((voice) => {
          const langCode = (voice.lang || "").toLowerCase();
          return langCode.startsWith("en");
        });
        const pool = englishVoices.length ? englishVoices : availableVoices;
        const playerIndex = Math.max(
          0,
          typeof game !== "undefined" && game && game.players
            ? game.players.indexOf(player)
            : 0
        );
        const personaGender = (player && player.persona && player.persona.gender) || null;
        const isFeminine = personaGender === "female" || (!personaGender && playerIndex % 2 === 0);
        const hints = isFeminine ? FEMININE_VOICE_HINTS : MASCULINE_VOICE_HINTS;
        const preferred = pool.find((voice) =>
          hints.some((hint) => (voice.name || "").toLowerCase().includes(hint))
        );
        if (preferred) return preferred;
        if (englishVoices.length) {
          return englishVoices[playerIndex % englishVoices.length];
        }
        return pool[playerIndex % pool.length] || null;
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

        if (speechSynthesis.speaking || speechSynthesis.pending) {
          speechSynthesis.cancel();
        }
        const words = spokenText.trim().split(/\s+/).length,
          duration = Math.max(2200, Math.round((words / 2.1) * 1000) + 750),
          speech = new SpeechSynthesisUtterance(spokenText);
        const id = ++speechIdCounter;
        speech._id = id;
        currentUtterance = speech;
        speechStartTime = Date.now();

        const speaker = (options && options.player) || (typeof active === "function" ? active() : null);
        const activeVoice = voiceForPlayer(speaker);
        if (activeVoice) {
          speech.voice = activeVoice;
        }

        if (isTamil) {
          speech.lang = hasTamilVoice() ? "ta-IN" : (activeVoice ? activeVoice.lang : "ta-IN");
        } else {
          speech.lang = activeVoice && activeVoice.lang ? activeVoice.lang : "en-US";
        }
        speech.rate = speaker && speaker.persona && typeof speaker.persona.voiceRate === "number" ? speaker.persona.voiceRate : 0.88;
        speech.pitch = speaker && speaker.persona && typeof speaker.persona.voicePitch === "number" ? speaker.persona.voicePitch : 1;
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
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("dhayam_audio", String(audioEnabled));
          }
        } catch (_) {}
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

      /**
       * Synthesize a traditional Indian Conch Shell (Shankha) resonance
       * followed by triumphant brass fanfare chords for game victory celebration.
       */
      function playVictoryFanfare() {
        if (!audioEnabled) return;
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return;
          if (!audioCtx) audioCtx = new AudioContextClass();
          if (audioCtx.state === "suspended") audioCtx.resume();

          const now = audioCtx.currentTime;

          // 1. Traditional Conch Shell (Shankha) upward sweep
          const conchOsc = audioCtx.createOscillator();
          const conchGain = audioCtx.createGain();
          const conchFilter = audioCtx.createBiquadFilter();

          conchOsc.type = "sawtooth";
          conchFilter.type = "bandpass";
          conchFilter.frequency.setValueAtTime(320, now);
          conchFilter.Q.setValueAtTime(4.0, now);

          // Upward pitch bend characteristic of conch blowing
          conchOsc.frequency.setValueAtTime(240, now);
          conchOsc.frequency.linearRampToValueAtTime(380, now + 0.4);
          conchOsc.frequency.linearRampToValueAtTime(440, now + 1.1);

          conchGain.gain.setValueAtTime(0.001, now);
          conchGain.gain.linearRampToValueAtTime(0.12, now + 0.3);
          conchGain.gain.linearRampToValueAtTime(0.15, now + 0.8);
          conchGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

          conchOsc.connect(conchFilter);
          conchFilter.connect(conchGain);
          conchGain.connect(audioCtx.destination);

          conchOsc.start(now);
          conchOsc.stop(now + 1.5);

          // 2. Triumphant fanfare arpeggio (C4, E4, G4, C5)
          const notes = [
            { f: 261.63, t: 1.2, d: 0.22 }, // C4
            { f: 329.63, t: 1.4, d: 0.22 }, // E4
            { f: 392.00, t: 1.6, d: 0.25 }, // G4
            { f: 523.25, t: 1.85, d: 0.75 } // C5 (Sustained celebration)
          ];

          notes.forEach(({ f, t, d }) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(f, now + t);
            gain.gain.setValueAtTime(0.14, now + t);
            gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now + t);
            osc.stop(now + t + d);
          });
        } catch (_) {}
      }

      window.playTone = playTone;
      window.playVictoryFanfare = playVictoryFanfare;
