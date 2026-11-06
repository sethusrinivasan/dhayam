import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const JS_DIR = path.join(ROOT_DIR, "site", "js");

function createMockElement(tagName = "DIV", id = "") {
  const classList = {
    classes: new Set<string>(),
    add(...cls: string[]) {
      for (const c of cls) this.classes.add(c);
    },
    remove(...cls: string[]) {
      for (const c of cls) this.classes.delete(c);
    },
    contains(c: string) {
      return this.classes.has(c);
    },
    toggle(c: string, force?: boolean) {
      if (force === true) this.classes.add(c);
      else if (force === false) this.classes.delete(c);
      else if (this.classes.has(c)) this.classes.delete(c);
      else this.classes.add(c);
    },
  };

  const el: any = {
    tagName: tagName.toUpperCase(),
    id,
    dataset: {},
    classList,
    style: {},
    innerHTML: "",
    textContent: "",
    hidden: false,
    disabled: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    setAttribute(k: string, v: string) {
      this[k] = v;
    },
    getAttribute(k: string) {
      return this[k] ?? null;
    },
    removeAttribute(k: string) {
      delete this[k];
    },
    appendChild(child: any) {
      return child;
    },
    querySelector(selector: string) {
      return createMockElement("DIV", selector);
    },
    querySelectorAll() {
      return [];
    },
  };
  return el;
}

function setupTurnTimerEnvironment() {
  const elements = new Map<string, any>();
  const thinkingTimerPill = createMockElement("DIV", "thinkingTimerPill");
  thinkingTimerPill.hidden = true;
  elements.set("thinkingTimerPill", thinkingTimerPill);
  elements.set("actionBtn", createMockElement("BUTTON", "actionBtn"));
  elements.set("statusTitle", createMockElement("STRONG", "statusTitle"));
  elements.set("statusText", createMockElement("SPAN", "statusText"));
  elements.set("rollChips", createMockElement("DIV", "rollChips"));
  elements.set("board", createMockElement("DIV", "board"));
  elements.set("playerLegend", createMockElement("DIV", "playerLegend"));

  function getElementById(id: string) {
    if (!elements.has(id)) {
      elements.set(id, createMockElement("DIV", id));
    }
    return elements.get(id);
  }

  const documentMock = {
    getElementById,
    createElement: (tag: string) => createMockElement(tag),
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: (selector: string) => {
      if (selector.startsWith("#")) return getElementById(selector.slice(1));
      if (selector === ".dice") return getElementById("dice");
      return null;
    },
    querySelectorAll: () => [],
    body: createMockElement("BODY"),
  };

  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (k: string) => storage.get(k) || null,
    setItem: (k: string, v: string) => storage.set(k, String(v)),
    removeItem: (k: string) => storage.delete(k),
  };

  const flightRecords: any[] = [];
  const activeTimers = new Set<any>();
  const sandbox: any = {
    console,
    document: documentMock,
    window: {},
    localStorage: localStorageMock,
    $: getElementById,
    elements,
    setTimeout: (fn: Function, delay?: number) => {
      const id = setTimeout(() => {
        activeTimers.delete(id);
        fn();
      }, delay || 0);
      activeTimers.add(id);
      return id;
    },
    clearTimeout: (id: any) => {
      activeTimers.delete(id);
      clearTimeout(id);
    },
    cleanupTimers: () => {
      for (const id of activeTimers) clearTimeout(id);
      activeTimers.clear();
    },
    setInterval: () => 1,
    clearInterval: () => {},
    FlightRecorder: {
      record: (name: string, payload: any) => flightRecords.push({ name, payload }),
    },
    flightRecords,
    crypto: {
      getRandomValues: (arr: Uint32Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 4294967296);
        return arr;
      },
    },
  };
  sandbox.window = sandbox;

  const scriptFiles = [
    "config.js",
    "i18n.js",
    "personas.js",
    "confetti.js",
    "state.js",
    "themes.js",
    "audio.js",
    "dice.js",
    "audit.js",
    "engine.js",
    "turn.js",
    "ui.js",
  ];

  const fullCode = scriptFiles
    .map((file) => fs.readFileSync(path.join(JS_DIR, file), "utf-8"))
    .join("\n;\n");

  vm.createContext(sandbox);
  vm.runInContext(fullCode, sandbox);

  return sandbox;
}

test("thinking timer: remains hidden when elapsed thinking time <= 10s", () => {
  const env = setupTurnTimerEnvironment();
  const pill = env.$("thinkingTimerPill");

  env.game = {
    turn: 1,
    current: 0,
    phase: "roll",
    pool: [],
    history: [],
    players: [
      { id: "p0", name: "Player 1", seat: "N", pieces: [], computer: false, rank: null },
      { id: "p1", name: "Computer", seat: "S", pieces: [], computer: true, rank: null },
    ],
  };

  // 5 seconds elapsed
  env.turnThinkingStartTime = Date.now() - 5000;
  env.updateTurnThinkingTimer();

  assert.equal(pill.hidden, true, "Pill must remain hidden under 10 seconds");
  assert.equal(pill.classList.contains("urgent"), false);
});

test("thinking timer: appears after 10s with countdown and warning state", () => {
  const env = setupTurnTimerEnvironment();
  const pill = env.$("thinkingTimerPill");

  env.game = {
    turn: 1,
    current: 0,
    phase: "roll",
    pool: [],
    history: [],
    players: [
      { id: "p0", name: "Player 1", seat: "N", pieces: [], computer: false, rank: null },
      { id: "p1", name: "Computer", seat: "S", pieces: [], computer: true, rank: null },
    ],
  };

  // 15 seconds elapsed -> 45 seconds remaining
  env.turnThinkingStartTime = Date.now() - 15000;
  env.updateTurnThinkingTimer();

  assert.equal(pill.hidden, false, "Pill must be visible when thinking exceeds 10s");
  assert.equal(pill.classList.contains("urgent"), false, "Pill must not be urgent when remaining > 15s");
  assert.match(pill.textContent, /Thinking:\s*15s/i, "Must show elapsed seconds");
  assert.match(pill.textContent, /45s\s*left/i, "Must show remaining seconds until turn passes");
});

test("thinking timer: escalates to urgent status in final 15s (>= 45s elapsed)", () => {
  const env = setupTurnTimerEnvironment();
  const pill = env.$("thinkingTimerPill");

  env.game = {
    turn: 1,
    current: 0,
    phase: "roll",
    pool: [],
    history: [],
    players: [
      { id: "p0", name: "Player 1", seat: "N", pieces: [], computer: false, rank: null },
      { id: "p1", name: "Computer", seat: "S", pieces: [], computer: true, rank: null },
    ],
  };

  // 50 seconds elapsed -> 10 seconds remaining
  env.turnThinkingStartTime = Date.now() - 50000;
  env.updateTurnThinkingTimer();

  assert.equal(pill.hidden, false, "Pill must be visible");
  assert.equal(pill.classList.contains("urgent"), true, "Pill must have urgent class in final 15s");
  assert.match(pill.textContent, /Act now!/i, "Must display urgent warning copy");
  assert.match(pill.textContent, /10s/i, "Must show remaining seconds");
});

test("thinking timer: automatically passes turn at 60s timeout and records audit", () => {
  const env = setupTurnTimerEnvironment();
  const pill = env.$("thinkingTimerPill");

  env.audit = env.createAudit("solo");
  env.game = {
    turn: 1,
    current: 0,
    phase: "roll",
    pool: [],
    history: [],
    players: [
      { id: "p0", name: "Player 1", seat: "N", pieces: [], computer: false, rank: null },
      { id: "p1", name: "Computer", seat: "S", pieces: [], computer: true, rank: null },
    ],
  };

  // 61 seconds elapsed -> triggers turn forfeit
  env.turnThinkingStartTime = Date.now() - 61000;
  env.updateTurnThinkingTimer();
  env.cleanupTimers();

  // Next player should now be active
  assert.equal(env.game.current, 1, "Turn must advance to player 1 after 60s timeout");
  assert.equal(pill.hidden, true, "Pill should reset and hide after passing turn");

  // Verify PASS audit event
  const passEvents = env.audit.events.filter((e: any) => e.type === "PASS");
  assert.equal(passEvents.length, 1, "Must record PASS event on timeout");
  assert.equal(passEvents[0].details.reason, "THINKING_TIMEOUT");

  // Verify FlightRecorder record
  const flightTimeout = env.flightRecords.find((r: any) => r.name === "TURN_THINKING_TIMEOUT");
  assert.ok(flightTimeout, "FlightRecorder must receive TURN_THINKING_TIMEOUT");
  assert.equal(flightTimeout.payload.player, "Player 1");
});

test("thinking timer: resets timer when roll() is initiated", () => {
  const env = setupTurnTimerEnvironment();

  env.game = {
    turn: 1,
    current: 0,
    phase: "roll",
    pool: [],
    history: [],
    players: [
      { id: "p0", name: "Player 1", seat: "N", pieces: [], computer: false, rank: null },
      { id: "p1", name: "Computer", seat: "S", pieces: [], computer: true, rank: null },
    ],
  };

  env.turnThinkingStartTime = Date.now() - 35000; // 35 seconds ago
  env.roll();
  env.cleanupTimers();

  const diff = Date.now() - env.turnThinkingStartTime;
  assert.ok(diff < 500, `turnThinkingStartTime must be reset to now on roll(), elapsed diff=${diff}ms`);
});

test("thinking timer: is suppressed for computer players", () => {
  const env = setupTurnTimerEnvironment();
  const pill = env.$("thinkingTimerPill");

  env.game = {
    turn: 2,
    current: 1, // Computer's turn
    phase: "roll",
    pool: [],
    history: [],
    players: [
      { id: "p0", name: "Player 1", seat: "N", pieces: [], computer: false, rank: null },
      { id: "p1", name: "Computer", seat: "S", pieces: [], computer: true, rank: null },
    ],
  };

  // Even if 30 seconds have elapsed, computer turns must never show thinking pill
  env.turnThinkingStartTime = Date.now() - 30000;
  env.updateTurnThinkingTimer();

  assert.equal(pill.hidden, true, "Pill must remain hidden on computer player turn");
});

test("thinking timer: correctly renders Tamil translations when active language is Tamil", () => {
  const env = setupTurnTimerEnvironment();
  const pill = env.$("thinkingTimerPill");

  env.toggleLanguage(); // Switch to Tamil ("ta")
  assert.equal(env.getLanguage(), "ta");

  env.game = {
    turn: 1,
    current: 0,
    phase: "roll",
    pool: [],
    history: [],
    players: [
      { id: "p0", name: "Player 1", seat: "N", pieces: [], computer: false, rank: null },
      { id: "p1", name: "Computer", seat: "S", pieces: [], computer: true, rank: null },
    ],
  };

  // 20s elapsed -> 40s remaining
  env.turnThinkingStartTime = Date.now() - 20000;
  env.updateTurnThinkingTimer();

  assert.equal(pill.hidden, false);
  assert.match(pill.textContent, /20.*40/, "Tamil warning text must interpolate 20s elapsed and 40s remaining");
});
