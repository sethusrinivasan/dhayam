/**
 * themes.js - Board theme management and Diwali default configuration
 *
 * Persists theme preference in localStorage, defaults to 'diwali' on launch,
 * and updates DOM attributes and board symbols dynamically.
 */
"use strict";

const THEME_DEFINITIONS = {
  diwali: {
    id: "diwali",
    name: "🪔 Diwali",
    description: "Festival lights, marigold gold & rangoli color",
    goalMotif: "🪔",
    safeMotif: "✿",
    players: [
      { name: "Maya", avatar: "🪔", color: "#f97316" },
      { name: "Ashwin", avatar: "🌺", color: "#0f766e" },
      { name: "Deepa", avatar: "✨", color: "#ca8a04" },
      { name: "Vikram", avatar: "🌟", color: "#be123c" },
    ],
  },
  halloween: {
    id: "halloween",
    name: "🎃 Halloween",
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
  christmas: {
    id: "christmas",
    name: "🎄 Christmas",
    description: "Evergreen, winter lights & festive red",
    goalMotif: "🎁",
    safeMotif: "❄️",
    players: [
      { name: "Maya", avatar: "🎄", color: "#dc2626" },
      { name: "Ashwin", avatar: "🎅", color: "#16a34a" },
      { name: "Deepa", avatar: "❄️", color: "#38bdf8" },
      { name: "Vikram", avatar: "🎁", color: "#facc15" },
    ],
  },
  hanukkah: {
    id: "hanukkah",
    name: "🕎 Hanukkah",
    description: "Blue, silver & menorah candlelight",
    goalMotif: "🕎",
    safeMotif: "✦",
    players: [
      { name: "Maya", avatar: "🕎", color: "#2563eb" },
      { name: "Ashwin", avatar: "🔹", color: "#38bdf8" },
      { name: "Deepa", avatar: "✨", color: "#e5e7eb" },
      { name: "Vikram", avatar: "🔷", color: "#60a5fa" },
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
  newyear: {
    id: "newyear",
    name: "🎆 New Year",
    description: "Midnight fireworks, neon & celebration",
    goalMotif: "🎆",
    safeMotif: "✨",
    players: [
      { name: "Maya", avatar: "🎆", color: "#f0abfc" },
      { name: "Ashwin", avatar: "🎇", color: "#22d3ee" },
      { name: "Deepa", avatar: "✨", color: "#facc15" },
      { name: "Vikram", avatar: "🥂", color: "#fb7185" },
    ],
  },
  pongal: {
    id: "pongal",
    name: "🌾 Pongal",
    description: "Harvest sun, sugarcane & Tamil kolam color",
    goalMotif: "☀️",
    safeMotif: "🌾",
    players: [
      { name: "Maya", avatar: "🌾", color: "#ea580c" },
      { name: "Ashwin", avatar: "🐂", color: "#15803d" },
      { name: "Deepa", avatar: "☀️", color: "#ca8a04" },
      { name: "Vikram", avatar: "🥣", color: "#b91c1c" },
    ],
  },
  dasara: {
    id: "dasara",
    name: "🏵️ Dasara",
    description: "Mysuru gold, marigolds & victory colors",
    goalMotif: "🏵️",
    safeMotif: "✦",
    players: [
      { name: "Maya", avatar: "🏵️", color: "#f59e0b" },
      { name: "Ashwin", avatar: "🐘", color: "#7c3aed" },
      { name: "Deepa", avatar: "🪷", color: "#db2777" },
      { name: "Vikram", avatar: "⚔️", color: "#b45309" },
    ],
  },
  holi: {
    id: "holi",
    name: "🎨 Holi",
    description: "Spring colors, joy & playful powder",
    goalMotif: "🎨",
    safeMotif: "🌈",
    players: [
      { name: "Maya", avatar: "🩷", color: "#ec4899" },
      { name: "Ashwin", avatar: "💙", color: "#2563eb" },
      { name: "Deepa", avatar: "💛", color: "#eab308" },
      { name: "Vikram", avatar: "💚", color: "#16a34a" },
    ],
  },
  eid: {
    id: "eid",
    name: "🌙 Eid",
    description: "Crescent moon, emerald & lantern light",
    goalMotif: "🌙",
    safeMotif: "✦",
    players: [
      { name: "Maya", avatar: "🌙", color: "#059669" },
      { name: "Ashwin", avatar: "🕌", color: "#0f766e" },
      { name: "Deepa", avatar: "🪔", color: "#f59e0b" },
      { name: "Vikram", avatar: "⭐", color: "#eab308" },
    ],
  },
  wallstreet: {
    id: "wallstreet",
    name: "📈 Wall Street",
    description: "Ticker green, market gold & trading floor energy",
    goalMotif: "📈",
    safeMotif: "💵",
    players: [
      { name: "Maya", avatar: "🐂", color: "#16a34a" },
      { name: "Ashwin", avatar: "📊", color: "#2563eb" },
      { name: "Deepa", avatar: "💰", color: "#ca8a04" },
      { name: "Vikram", avatar: "🔔", color: "#dc2626" },
    ],
  },
  elections: {
    id: "elections",
    name: "🗳️ US Elections",
    description: "Civic blue, campaign red & ballot-day gold",
    goalMotif: "🗳️",
    safeMotif: "⭐",
    players: [
      { name: "Maya", avatar: "🔵", color: "#2563eb" },
      { name: "Ashwin", avatar: "🔴", color: "#dc2626" },
      { name: "Deepa", avatar: "⭐", color: "#f59e0b" },
      { name: "Vikram", avatar: "🏛️", color: "#64748b" },
    ],
  },
};

let currentTheme = localStorage.getItem("dhayam_theme") || "diwali";

function applyTheme(themeId) {
  if (!THEME_DEFINITIONS[themeId]) themeId = "diwali";
  currentTheme = themeId;
  localStorage.setItem("dhayam_theme", themeId);
  if (document.documentElement) {
    document.documentElement.setAttribute("data-theme", themeId);
  }
  if (document.body) {
    document.body.setAttribute("data-theme", themeId);
  }

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
