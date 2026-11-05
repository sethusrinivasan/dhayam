/**
 * config.js - Board Geometry, Constants & Route Definitions
 *
 * Defines the 7x7 grid coordinates, 8 floral safe squares, rotational
 * symmetry helpers, and animation timing constants for Dhayam.
 */
"use strict";

      const OUTER = [
        "A4",
        "A5",
        "A6",
        "A7",
        "B7",
        "C7",
        "D7",
        "E7",
        "F7",
        "G7",
        "G6",
        "G5",
        "G4",
        "G3",
        "G2",
        "G1",
        "F1",
        "E1",
        "D1",
        "C1",
        "B1",
        "A1",
        "A2",
        "A3",
      ];
      const INNER = [
        "B4",
        "B3",
        "B2",
        "C2",
        "D2",
        "E2",
        "F2",
        "F3",
        "F4",
        "F5",
        "F6",
        "E6",
        "D6",
        "C6",
        "B6",
        "B5",
      ];
      const SAFE = new Set(["A4", "B2", "B6", "D1", "D7", "F2", "F6", "G4"]),
        BONUS_VALUES = new Set([1, 5, 6, 12]);
      const SEATS = ["N", "E", "S", "W"],
        START = { N: "A4", E: "D7", S: "G4", W: "D1" },
        ENTRY = { N: "B4", E: "D6", S: "F4", W: "D2" },
        APPROACH = { N: "C4", E: "D5", S: "E4", W: "D3" };
      const THEMES = [
        { name: "Maya", avatar: "🐘", color: "#e74c3c" },
        { name: "Leo", avatar: "🐯", color: "#2389da" },
        { name: "Amina", avatar: "🦚", color: "#f4b400" },
        { name: "Kai", avatar: "🦁", color: "#2e9d57" },
        { name: "Sofia", avatar: "🦊", color: "#8e5bd9" },
        { name: "Noah", avatar: "🦉", color: "#00a6a6" },
        { name: "Zara", avatar: "🦄", color: "#ec4899" },
        { name: "Arun", avatar: "🦅", color: "#f97316" },
        { name: "Priya", avatar: "🐲", color: "#84cc16" },
        { name: "Ethan", avatar: "🦋", color: "#0ea5e9" },
        { name: "Layla", avatar: "🐬", color: "#f43f5e" },
        { name: "Omar", avatar: "🦀", color: "#14b8a6" },
        { name: "Cleo", avatar: "🐸", color: "#a855f7" },
        { name: "Ravi", avatar: "🦩", color: "#fb923c" },
        { name: "Mia", avatar: "🐙", color: "#38bdf8" },
        { name: "Luca", avatar: "🦜", color: "#4ade80" },
        { name: "Diya", avatar: "🦝", color: "#c084fc" },
        { name: "Finn", avatar: "🐻", color: "#fbbf24" },
        { name: "Hana", avatar: "🦔", color: "#34d399" },
        { name: "Bruno", avatar: "🦭", color: "#e879f9" },
        { name: "Yara", avatar: "🐆", color: "#f9a8d4" },
        { name: "Theo", avatar: "🦣", color: "#6ee7b7" },
        { name: "Noor", avatar: "🦤", color: "#bef264" },
        { name: "Hugo", avatar: "🦊", color: "#fde68a" },
        { name: "Isla", avatar: "🐺", color: "#93c5fd" },
        { name: "Felix", avatar: "🦨", color: "#fca5a5" },
        { name: "Sana", avatar: "🦡", color: "#d8b4fe" },
        { name: "Rex", avatar: "🦦", color: "#86efac" },
        { name: "Aria", avatar: "🦢", color: "#67e8f9" },
        { name: "Jude", avatar: "🐦", color: "#fdba74" },
        { name: "Leila", avatar: "🦆", color: "#f9a8d4" },
        { name: "Milo", avatar: "🐿️", color: "#a5f3fc" },
      ];
      // Every seat follows the same 44-position route. Rotating the north route
      // keeps movement rules consistent while giving each player a unique start.
      function rotate(coord, n) {
        let r = coord.charCodeAt(0) - 65,
          c = Number(coord[1]) - 1;
        for (let i = 0; i < n; i++) {
          [r, c] = [c, 6 - r];
        }
        return String.fromCharCode(65 + r) + (c + 1);
      }
      function route(seat) {
        const turns = SEATS.indexOf(seat);
        const outer = OUTER.map((p) => rotate(p, turns));
        const inner = INNER.map((p) => rotate(p, turns));
        return [...outer, outer[0], ...inner, inner[0], APPROACH[seat], "D4"];
      }
      const ROUTES = Object.fromEntries(SEATS.map((s) => [s, route(s)]));
      function arrowBetween(from, to) {
        const r1 = from.charCodeAt(0),
          c1 = Number(from[1]),
          r2 = to.charCodeAt(0),
          c2 = Number(to[1]);
        return r2 > r1 ? "↓" : r2 < r1 ? "↑" : c2 > c1 ? "→" : "←";
      }
      function directionFor(sq) {
        for (const path of [OUTER, INNER]) {
          const i = path.indexOf(sq);
          if (i >= 0) return arrowBetween(sq, path[(i + 1) % path.length]);
        }
        for (const seat of SEATS)
          if (APPROACH[seat] === sq) return arrowBetween(sq, "D4");
        return "";
      }

      function scaledDemoDelay(milliseconds) {
        return demo ? milliseconds / demoSpeed : milliseconds;
      }

      // Authoritative Application Build Metadata: Bumped on every release
      const BUILD_INFO = {
        version: "0.4.0",
        build: 3,
        timestamp: "2026-11-04 22:25 UTC",
        releaseName: "Authentic Bilingual Tamil & English Localization (i18n)",
      };
       // Global player-count limits — update here, never hardcode elsewhere
       const MIN_PLAYERS = 2;
       const MAX_PLAYERS = 32;

      if (typeof window !== "undefined") {
        window.SEATS = SEATS;
        window.START = START;
        window.SAFE = SAFE;
        window.ROUTES = ROUTES;
        window.BUILD_INFO = BUILD_INFO;
      }
      if (typeof globalThis !== "undefined") {
        globalThis.SEATS = SEATS;
        globalThis.START = START;
        globalThis.SAFE = SAFE;
        globalThis.ROUTES = ROUTES;
        globalThis.BUILD_INFO = BUILD_INFO;
      }
      if (typeof window !== "undefined") {
        // Dynamically populate the build badge and timestamp so they always
        // reflect the authoritative BUILD_INFO rather than a hardcoded string.
        const _badgeEl = document.getElementById("buildNumberBadge");
        const _tsEl = document.getElementById("buildUpdatedTimestamp");
        if (_badgeEl) _badgeEl.textContent = "Build #" + BUILD_INFO.build + " (v" + BUILD_INFO.version + ")";
        if (_tsEl) _tsEl.textContent = "Updated: " + BUILD_INFO.timestamp;
      }
