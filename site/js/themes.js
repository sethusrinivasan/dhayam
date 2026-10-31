/**
 * themes.js - Board Theme Management & Halloween Default Configuration
 *
 * Persists theme preference in localStorage, defaults to 'halloween' on launch,
 * and updates DOM attributes and board symbols dynamically.
 */
"use strict";

const THEME_DEFINITIONS = {
  halloween: {
    id: "halloween",
    name: "🎃 Halloween (Default)",
    description: "Spooky pumpkin night, glowing lanterns & haunted board",
    goalMotif: "🎃",
    safeMotif: "🕸️",
    players: [
      { name: "Maya", avatar: "🎃", color: "#ff7518" },
      { name: "Ashwin", avatar: "👻", color: "#2dd4bf" },
      { name: "Deepa", avatar: "🧙", color: "#c084fc" },
      { name: "Vikram", avatar: "🧛", color: "#f43f5e" },
    ],
  },
  wood: {
    id: "wood",
    name: "🪵 Heritage Wood",
    description: "Traditional warm teak wood, brass inlays & temple gold",
    goalMotif: "✺",
    safeMotif: "✿",
    players: [
      { name: "Maya", avatar: "🌿", color: "#e76f51" },
      { name: "Ashwin", avatar: "🌊", color: "#2a9d8f" },
      { name: "Deepa", avatar: "☀️", color: "#e9c46a" },
      { name: "Vikram", avatar: "🌾", color: "#f4a261" },
    ],
  },
  bronze: {
    id: "bronze",
    name: "🏛️ Royal Bronze",
    description: "Ancient stone courtyard, royal ivory & polished copper",
    goalMotif: "✦",
    safeMotif: "✿",
    players: [
      { name: "Maya", avatar: "🦅", color: "#d97706" },
      { name: "Ashwin", avatar: "🛡️", color: "#0d9488" },
      { name: "Deepa", avatar: "👑", color: "#b45309" },
      { name: "Vikram", avatar: "⚔️", color: "#78350f" },
    ],
  },
  nebula: {
    id: "nebula",
    name: "🌌 Midnight Nebula",
    description: "Deep cosmic indigo, glowing violet & starlight",
    goalMotif: "🌟",
    safeMotif: "✦",
    players: [
      { name: "Maya", avatar: "⚡", color: "#6366f1" },
      { name: "Ashwin", avatar: "💫", color: "#06b6d4" },
      { name: "Deepa", avatar: "✨", color: "#a855f7" },
      { name: "Vikram", avatar: "☄️", color: "#ec4899" },
    ],
  },
};

let currentTheme = localStorage.getItem("dhayam_theme") || "halloween";

function applyTheme(themeId) {
  if (!THEME_DEFINITIONS[themeId]) themeId = "halloween";
  currentTheme = themeId;
  localStorage.setItem("dhayam_theme", themeId);
  document.body.setAttribute("data-theme", themeId);

  // Update theme configuration for active game
  const def = THEME_DEFINITIONS[themeId];
  if (typeof THEMES !== "undefined") {
    def.players.forEach((p, idx) => {
      if (THEMES[idx]) {
        THEMES[idx].avatar = p.avatar;
        THEMES[idx].color = p.color;
      }
    });
  }

  // Update in-flight game player avatars/colors if match is active
  if (typeof game !== "undefined" && game && game.players) {
    game.players.forEach((p, idx) => {
      if (def.players[idx]) {
        p.avatar = def.players[idx].avatar;
        p.color = def.players[idx].color;
      }
    });
  }

  if (typeof FlightRecorder !== "undefined") {
    FlightRecorder.record("THEME_CHANGED", { theme: themeId });
  }

  if (typeof render === "function") {
    render();
  }
}

// Initial theme application
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(currentTheme);
});

// Also apply immediately if body is already loaded
if (document.body) {
  applyTheme(currentTheme);
}
