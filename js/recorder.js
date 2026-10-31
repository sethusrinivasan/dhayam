/**
 * recorder.js - Flight Recorder & Diagnostics Black Box
 *
 * Captures a circular buffer of every user interaction, state machine transition,
 * DOM click, roll outcome, move execution, timing, and error event.
 * Provides a one-click copy-to-clipboard diagnostic payload for debugging.
 */
"use strict";

(function () {
  const MAX_EVENTS = 400;
  const startTime = Date.now();
  const eventBuffer = [];

  function formatRelative(ms) {
    const totalSec = ms / 1000;
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(3);
    return "+" + String(mins).padStart(2, "0") + ":" + (secs < 10 ? "0" : "") + secs;
  }

  function getSystemDiagnostics() {
    return {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform || "unknown",
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio || 1,
      },
      screen: {
        width: window.screen ? window.screen.width : null,
        height: window.screen ? window.screen.height : null,
      },
      touch: {
        maxTouchPoints: navigator.maxTouchPoints || 0,
        hasTouch: "ontouchstart" in window,
      },
      theme: document.body ? document.body.getAttribute("data-theme") || "halloween" : "halloween",
      audio: typeof audioEnabled !== "undefined" ? audioEnabled : null,
      gameState: typeof game !== "undefined" && game ? {
        phase: game.phase,
        turn: game.turn,
        current: game.current,
        currentPlayer: game.players && game.players[game.current] ? game.players[game.current].name : null,
        isComputer: game.players && game.players[game.current] ? Boolean(game.players[game.current].computer) : null,
        pool: game.pool ? [...game.pool] : [],
        history: game.history ? [...game.history] : [],
        rolling: typeof rolling !== "undefined" ? rolling : null,
        moving: typeof moving !== "undefined" ? moving : null,
        demo: typeof demo !== "undefined" ? demo : null,
        multiplayer: typeof multiplayer !== "undefined" ? {
          active: Boolean(multiplayer.active),
          isHost: Boolean(multiplayer.isHost),
          roomCode: multiplayer.roomCode || null,
        } : null,
      } : null,
    };
  }

  function record(type, details = {}) {
    const now = Date.now();
    const relMs = now - startTime;
    const entry = {
      i: eventBuffer.length + 1,
      rel: formatRelative(relMs),
      ms: relMs,
      iso: new Date(now).toISOString(),
      type,
      ...details,
    };
    if (eventBuffer.length >= MAX_EVENTS) {
      eventBuffer.shift();
    }
    eventBuffer.push(entry);
    return entry;
  }

  // Intercept all global click and touch events
  document.addEventListener(
    "click",
    function (e) {
      try {
        const target = e.target;
        if (!target) return;
        const tag = target.tagName ? target.tagName.toLowerCase() : "";
        const id = target.id ? "#" + target.id : "";
        const cls = target.className && typeof target.className === "string" ? "." + target.className.trim().split(/\s+/).join(".") : "";
        const text = (target.textContent || "").trim().slice(0, 40);
        const rect = target.getBoundingClientRect ? target.getBoundingClientRect() : null;
        
        record("USER_CLICK", {
          target: tag + id + cls,
          text: text || null,
          coords: { x: Math.round(e.clientX), y: Math.round(e.clientY) },
          box: rect ? { w: Math.round(rect.width), h: Math.round(rect.height) } : null,
          phase: typeof game !== "undefined" && game ? game.phase : null,
          current: typeof game !== "undefined" && game ? game.current : null,
        });
      } catch (err) {}
    },
    true
  );

  // Intercept keyboard shortcuts
  document.addEventListener(
    "keydown",
    function (e) {
      try {
        if (["Enter", " ", "Escape"].includes(e.key)) {
          record("USER_KEY", {
            key: e.key,
            activeElement: document.activeElement ? (document.activeElement.tagName || "").toLowerCase() + (document.activeElement.id ? "#" + document.activeElement.id : "") : null,
          });
        }
      } catch (err) {}
    },
    true
  );

  // Intercept window errors & unhandled rejections
  window.addEventListener("error", function (e) {
    record("ERROR", {
      message: e.message || String(e),
      filename: e.filename || null,
      lineno: e.lineno || null,
      colno: e.colno || null,
    });
  });

  window.addEventListener("unhandledrejection", function (e) {
    record("UNHANDLED_REJECTION", {
      reason: e.reason ? (e.reason.message || String(e.reason)) : "Unknown rejection",
    });
  });

  function getDiagnosticExport() {
    const diag = getSystemDiagnostics();
    const timeline = eventBuffer.map((ev) => {
      const parts = [ev.rel, ev.type];
      if (ev.target) parts.push(ev.target);
      if (ev.text) parts.push('"' + ev.text + '"');
      if (ev.value !== undefined) parts.push("val=" + ev.value);
      if (ev.pieceId) parts.push("piece=" + ev.pieceId);
      if (ev.phase) parts.push("[" + ev.phase + "]");
      if (ev.message) parts.push("msg=" + ev.message);
      return parts.join(" ");
    });

    return {
      dhayamFlightRecorder: {
        version: "1.0",
        recordedAt: diag.timestamp,
        sessionUptimeMs: Date.now() - startTime,
        eventCount: eventBuffer.length,
        system: diag,
        timelineSummary: timeline,
        events: eventBuffer,
      },
    };
  }

  function copyToClipboard(feedbackEl) {
    const data = getDiagnosticExport();
    const jsonStr = JSON.stringify(data, null, 2);
    
    const showSuccess = () => {
      record("FLIGHT_RECORDER_COPIED", { eventCount: eventBuffer.length });
      if (feedbackEl) {
        feedbackEl.textContent = "✓ Flight recorder copied (" + eventBuffer.length + " events)!";
        setTimeout(() => {
          if (feedbackEl) feedbackEl.textContent = "";
        }, 3000);
      }
      showToast("Flight recorder copied (" + eventBuffer.length + " events) to clipboard");
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).then(showSuccess).catch(() => {
        fallbackCopy(jsonStr, showSuccess);
      });
    } else {
      fallbackCopy(jsonStr, showSuccess);
    }
  }

  function fallbackCopy(text, cb) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      cb();
    } catch (e) {
      alert("Please copy flight recorder manually:\n" + text.slice(0, 300) + "...");
    } finally {
      document.body.removeChild(ta);
    }
  }

  function showToast(msg) {
    let toast = document.getElementById("flightToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "flightToast";
      toast.style.cssText =
        "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1f132b;color:#fcd34d;padding:10px 18px;border-radius:10px;border:1px solid #f59e0b;box-shadow:0 10px 30px rgba(0,0,0,0.8);z-index:99999;font-size:0.88rem;font-weight:700;display:flex;align-items:center;gap:8px;pointer-events:none;transition:opacity 0.25s ease;";
      document.body.appendChild(toast);
    }
    toast.innerHTML = "🛫 " + msg;
    toast.style.opacity = "1";
    setTimeout(() => {
      if (toast) toast.style.opacity = "0";
    }, 2800);
  }

  // Public API
  window.FlightRecorder = {
    record,
    getLog: getDiagnosticExport,
    copy: copyToClipboard,
    getEventCount: () => eventBuffer.length,
  };

  record("APP_INIT", { url: window.location.href });
})();
