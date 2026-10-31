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
