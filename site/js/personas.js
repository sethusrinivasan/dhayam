/**
 * site/js/personas.js
 *
 * Rich roster of authentic AI opponents, dynamic persona heuristics,
 * localized player name generation, and gender-aligned voice parameters.
 */

(function (window) {
  "use strict";

  // HTML Entity Escaper for organizer & player names (mandated by AGENTS.md)
  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Diverse Roster of 10 Distinct Computer Personas (5 Female, 5 Male)
  const COMPUTER_PERSONAS = [
    // --- Female Personas ---
    {
      id: "kavitha",
      name: "Kavitha",
      regionalNames: {
        northAmerica: "Emma",
        southAsia: "Kavitha",
        southeastAsia: "Geetha",
        global: "Chloe"
      },
      gender: "female",
      avatar: "🪷",
      color: "#0d9488", // Lotus Teal
      title: "Cautious Strategist",
      titleTa: "\u0ba8\u0bbf\u0ba4\u0bbe\u0ba9 \u0bb5\u0bbf\u0baf\u0bc2\u0b95\u0bb0\u0bcd",
      bio: "Prioritizes safe sanctuary squares and avoids risky moves.",
      safetyWeight: 1.8,
      aggressionWeight: 0.8,
      progressWeight: 1.0,
      entryWeight: 1.1,
      voicePitch: 1.15,
      voiceRate: 1.0,
      commentaryIntro: "Kavitha bows gracefully and prepares a defensive line."
    },
    {
      id: "ananya",
      name: "Ananya",
      regionalNames: {
        northAmerica: "Olivia",
        southAsia: "Ananya",
        southeastAsia: "Malar",
        global: "Elena"
      },
      gender: "female",
      avatar: "🌺",
      color: "#f59e0b", // Coral Gold
      title: "Tactical Master",
      titleTa: "\u0ba4\u0ba8\u0bcd\u0ba4\u0bbf\u0bb0 \u0ba8\u0bbf\u0baa\u0bc1\u0ba3\u0bb0\u0bcd",
      bio: "Balances coin progression with timely tactical captures.",
      safetyWeight: 1.2,
      aggressionWeight: 1.2,
      progressWeight: 1.3,
      entryWeight: 1.2,
      voicePitch: 1.12,
      voiceRate: 1.02,
      commentaryIntro: "Ananya smiles confidently, studying the four brass dice."
    },
    {
      id: "rani",
      name: "Rani",
      regionalNames: {
        northAmerica: "Harper",
        southAsia: "Rani",
        southeastAsia: "Malaya",
        global: "Zara"
      },
      gender: "female",
      avatar: "🐆",
      color: "#e11d48", // Royal Ruby
      title: "Fierce Hunter",
      titleTa: "\u0bb5\u0bc7\u0b9f\u0bcd\u0b9f\u0bc8 \u0b85\u0bb0\u0b9a\u0bbf",
      bio: "Relentlessly pursues opponent coins and executes cutoffs.",
      safetyWeight: 0.6,
      aggressionWeight: 2.2,
      progressWeight: 1.1,
      entryWeight: 1.0,
      voicePitch: 1.08,
      voiceRate: 1.05,
      commentaryIntro: "Rani rolls with fierce intensity, eyeing vulnerable targets."
    },
    {
      id: "meera",
      name: "Meera",
      regionalNames: {
        northAmerica: "Maya",
        southAsia: "Meera",
        southeastAsia: "Mei",
        global: "Aria"
      },
      gender: "female",
      avatar: "🦚",
      color: "#0284c7", // Peacock Blue
      title: "Playful Gambler",
      titleTa: "\u0ba4\u0bc1\u0b9f\u0bc1\u0b95\u0bcd\u0b95\u0bc1 \u0b86\u0b9f\u0bcd\u0b9f\u0b95\u0bcd\u0b95\u0bbe\u0bb0\u0bb0\u0bcd",
      bio: "Takes adventurous chances on high rolls and aggressive doubles.",
      safetyWeight: 0.9,
      aggressionWeight: 1.4,
      progressWeight: 1.4,
      entryWeight: 1.3,
      voicePitch: 1.2,
      voiceRate: 1.08,
      commentaryIntro: "Meera laughs joyfully, tossing the Dayakattai high into the air."
    },
    {
      id: "selvi",
      name: "Selvi",
      regionalNames: {
        northAmerica: "Sophia",
        southAsia: "Selvi",
        southeastAsia: "Nur",
        global: "Amara"
      },
      gender: "female",
      avatar: "🌾",
      color: "#16a34a", // Emerald Green
      title: "Patient Guardian",
      titleTa: "\u0baa\u0bca\u0bb1\u0bc1\u0bae\u0bc8 \u0b95\u0bbe\u0bb5\u0bb2\u0bb0\u0bcd",
      bio: "Conserves reserves carefully until powerful roll sequences unfold.",
      safetyWeight: 1.5,
      aggressionWeight: 1.0,
      progressWeight: 0.9,
      entryWeight: 1.5,
      voicePitch: 1.1,
      voiceRate: 0.98,
      commentaryIntro: "Selvi nods patiently, waiting for the golden Dhayam to strike."
    },

    // --- Male Personas ---
    {
      id: "murugan",
      name: "Murugan",
      regionalNames: {
        northAmerica: "Liam",
        southAsia: "Murugan",
        southeastAsia: "Siva",
        global: "Kai"
      },
      gender: "male",
      avatar: "🪔",
      color: "#d97706", // Golden Diya Amber
      title: "Venerable Elder",
      titleTa: "\u0bae\u0bc1\u0ba4\u0bbf\u0baf \u0b9e\u0bbe\u0ba9\u0bbf",
      bio: "Classic traditional playstyle; values reserve preservation and steady pacing.",
      safetyWeight: 1.6,
      aggressionWeight: 0.9,
      progressWeight: 1.1,
      entryWeight: 1.2,
      voicePitch: 0.85,
      voiceRate: 0.95,
      commentaryIntro: "Elder Murugan raises his hand in blessing before rolling."
    },
    {
      id: "kavin",
      name: "Kavin",
      regionalNames: {
        northAmerica: "Ethan",
        southAsia: "Kavin",
        southeastAsia: "Kavi",
        global: "Lucas"
      },
      gender: "male",
      avatar: "⚡",
      color: "#f97316", // Solar Orange
      title: "Lightning Sprinter",
      titleTa: "\u0bae\u0bbf\u0ba9\u0bcd\u0ba9\u0bb2\u0bcd \u0bb5\u0bbf\u0bb0\u0bc8\u0bb5\u0bbe\u0bb3\u0bb0\u0bcd",
      bio: "Pushes leading coins directly toward the inner sanctum and center goal.",
      safetyWeight: 0.8,
      aggressionWeight: 1.1,
      progressWeight: 2.0,
      entryWeight: 1.0,
      voicePitch: 0.95,
      voiceRate: 1.08,
      commentaryIntro: "Kavin swiftly casts the dice, focused on speed."
    },
    {
      id: "arjun",
      name: "Arjun",
      regionalNames: {
        northAmerica: "Mason",
        southAsia: "Arjun",
        southeastAsia: "Dinesh",
        global: "Leo"
      },
      gender: "male",
      avatar: "🏹",
      color: "#dc2626", // Crimson Flame
      title: "Bold Challenger",
      titleTa: "\u0bb5\u0bc0\u0bb0 \u0b9a\u0bb5\u0bbe\u0bb2\u0bbe\u0bb3\u0bb0\u0bcd",
      bio: "Establishes aggressive center-track blockades and bold maneuvers.",
      safetyWeight: 1.0,
      aggressionWeight: 1.7,
      progressWeight: 1.3,
      entryWeight: 1.1,
      voicePitch: 0.9,
      voiceRate: 1.02,
      commentaryIntro: "Arjun steps up with focused resolve, ready for battle."
    },
    {
      id: "mani",
      name: "Mani",
      regionalNames: {
        northAmerica: "Logan",
        southAsia: "Mani",
        southeastAsia: "Kumaran",
        global: "Felix"
      },
      gender: "male",
      avatar: "🐅",
      color: "#c2410c", // Copper Bronze
      title: "Tenacious Fighter",
      titleTa: "\u0bb5\u0bbf\u0b9f\u0bbe\u0bae\u0bc1\u0baf\u0bb1\u0bcd\u0b9a\u0bbf\u0baf\u0bbe\u0bb3\u0bb0\u0bcd",
      bio: "Patient in the outer circuit; lethal when counter-hopping enemy coins.",
      safetyWeight: 1.3,
      aggressionWeight: 1.6,
      progressWeight: 1.0,
      entryWeight: 1.2,
      voicePitch: 0.88,
      voiceRate: 1.0,
      commentaryIntro: "Mani grips the brass dice, coiled to counter-strike."
    },
    {
      id: "vikram",
      name: "Vikram",
      regionalNames: {
        northAmerica: "Noah",
        southAsia: "Vikram",
        southeastAsia: "Wei",
        global: "Gabriel"
      },
      gender: "male",
      avatar: "🦅",
      color: "#2563eb", // Sapphire Blue
      title: "Grand Strategist",
      titleTa: "\u0baa\u0bc6\u0bb0\u0bc1\u0ba8\u0bcd\u0ba4\u0bb2\u0bc8\u0bb5\u0bb0\u0bcd",
      bio: "High-heuristic minimax calculator; balances all 6 coins as a disciplined unit.",
      safetyWeight: 1.2,
      aggressionWeight: 1.3,
      progressWeight: 1.5,
      entryWeight: 1.3,
      voicePitch: 0.92,
      voiceRate: 1.04,
      commentaryIntro: "Vikram studies the board geometry before releasing the roll."
    }
  ];

  // Localized Name Banks for GeoIP / Timezone Seed
  const LOCALIZED_NAMES = {
    northAmerica: [
      "Liam", "Emma", "Noah", "Olivia", "Ethan",
      "Sophia", "Mason", "Maya", "Logan", "Harper",
      "Lucas", "Chloe", "James", "Evelyn", "Oliver"
    ],
    southAsia: [
      "Aarav", "Diya", "Kavin", "Ananya", "Murugan",
      "Priya", "Thilak", "Selvi", "Ashwin", "Nithya",
      "Kavitha", "Arjun", "Meera", "Mani", "Rani"
    ],
    southeastAsia: [
      "Siva", "Malar", "Kumaran", "Geetha", "Dinesh",
      "Kavitha", "Ravi", "Suresh", "Letchumi", "Arumugam"
    ],
    global: [
      "Maya", "Kai", "Elena", "Liam", "Zara",
      "Aria", "Noah", "Sofia", "Lucas", "Amara"
    ]
  };

  /**
   * Determine client regional context from timezone and locale
   */
  function getClientRegion() {
    let region = "northAmerica";
    try {
      if (typeof window !== "undefined" && window.dhayamActiveLanguage === "ta") {
        return "southAsia";
      }
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const lang = (typeof navigator !== "undefined" && (navigator.language || (navigator.languages && navigator.languages[0]))) || "";
      if (tz.includes("Kolkata") || tz.includes("Colombo") || tz.includes("India") || lang.startsWith("ta") || lang.startsWith("hi")) {
        return "southAsia";
      }
      if (tz.includes("Singapore") || tz.includes("Kuala_Lumpur") || tz.includes("Bangkok") || tz.includes("Jakarta")) {
        return "southeastAsia";
      }
      if (tz.startsWith("America/") || tz.startsWith("US/") || tz.startsWith("Canada/") || lang.startsWith("en-US") || lang.startsWith("en-CA")) {
        return "northAmerica";
      }
      if (tz.startsWith("Europe/") || tz.startsWith("Australia/") || tz.startsWith("Pacific/")) {
        return "global";
      }
    } catch (e) {}
    return region;
  }

  /**
   * Determine suggested names based on client's regional context
   */
  function getSuggestedLocalizedNames(requestedRegion) {
    const region = requestedRegion || getClientRegion();
    return LOCALIZED_NAMES[region] || LOCALIZED_NAMES.northAmerica || LOCALIZED_NAMES.global;
  }

  /**
   * Select a random computer persona excluding specified names, adapted for region
   */
  function getRandomComputerPersona(excludeNames = [], requestedRegion) {
    const region = requestedRegion || getClientRegion();
    const pool = COMPUTER_PERSONAS.filter((p) => {
      const locName = (p.regionalNames && p.regionalNames[region]) || p.name;
      return !excludeNames.includes(p.name) &&
             !excludeNames.includes(p.id) &&
             !excludeNames.includes(locName);
    });
    const candidates = pool.length ? pool : COMPUTER_PERSONAS;
    const base = candidates[Math.floor(Math.random() * candidates.length)];
    const localizedName = (base.regionalNames && base.regionalNames[region]) || base.name;
    const intro = base.commentaryIntro ? base.commentaryIntro.replace(base.name, localizedName) : "";

    return {
      ...base,
      displayName: localizedName,
      commentaryIntro: intro
    };
  }

  /**
   * Retrieve a persona by name or ID (supports canonical, id, and regional names)
   */
  function getPersonaByName(nameOrId) {
    if (!nameOrId) return null;
    const clean = String(nameOrId).trim().toLowerCase();
    return COMPUTER_PERSONAS.find((p) => {
      if (p.name.toLowerCase() === clean || p.id.toLowerCase() === clean) return true;
      if (p.regionalNames) {
        return Object.values(p.regionalNames).some((rn) => rn.toLowerCase() === clean);
      }
      return false;
    }) || null;
  }

  // Exports to window
  window.COMPUTER_PERSONAS = COMPUTER_PERSONAS;
  window.getClientRegion = getClientRegion;
  window.getRandomComputerPersona = getRandomComputerPersona;
  window.getPersonaByName = getPersonaByName;
  window.getSuggestedLocalizedNames = getSuggestedLocalizedNames;
  window.escapeHtml = escapeHtml;

})(typeof window !== "undefined" ? window : globalThis);
