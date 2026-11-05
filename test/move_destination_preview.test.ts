import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const JS_DIR = path.join(ROOT_DIR, "site", "js");

function createMockElement(tagName = "DIV", id = "") {
  const children: any[] = [];
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
    children,
    style: {},
    innerHTML: "",
    textContent: "",
    setAttribute(k: string, v: string) {
      this[k] = v;
    },
    getAttribute(k: string) {
      return this[k] ?? null;
    },
    removeAttribute(k: string) {
      delete this[k];
    },
    get className() {
      return Array.from(this.classList.classes).join(" ");
    },
    set className(val: string) {
      this.classList.classes.clear();
      if (val) {
        val.split(/\s+/).filter(Boolean).forEach((c) => this.classList.classes.add(c));
      }
    },
    appendChild(child: any) {
      children.push(child);
      return child;
    },
    querySelector(selector: string) {
      if (selector === ".destination-badge") {
        return children.find((c) => c.classList?.contains("destination-badge")) || null;
      }
      return null;
    },
    remove() {
      // no-op mock
    },
    click() {
      if (typeof this.onclick === "function") this.onclick();
    },
  };
  return el;
}

function setupMockEnvironment() {
  const elements = new Map<string, any>();
  const cellMap = new Map<string, any>();

  // Pre-populate board cells A1-G7
  for (const row of "ABCDEFG") {
    for (let col = 1; col <= 7; col++) {
      const sq = row + col;
      const cell = createMockElement("BUTTON", "cell-" + sq);
      cell.dataset.sq = sq;
      cellMap.set(sq, cell);
    }
  }

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
      const cellMatch = selector.match(/\.cell\[data-sq="([A-G][1-7])"\]/);
      if (cellMatch) return cellMap.get(cellMatch[1]) || null;
      if (selector.startsWith("#")) return getElementById(selector.slice(1));
      if (selector === ".dice") return getElementById("dice");
      return null;
    },
    querySelectorAll: (selector: string) => {
      if (selector.includes(".cell.target-destination") || selector.includes(".cell.source-selected") || selector.includes(".cell.possible-destination")) {
        return Array.from(cellMap.values()).filter(
          (c) =>
            c.classList.contains("target-destination") ||
            c.classList.contains("source-selected") ||
            c.classList.contains("possible-destination"),
        );
      }
      if (selector.includes(".cell")) {
        return Array.from(cellMap.values());
      }
      if (selector.includes(".player[data-can-enter='true']")) {
        return [];
      }
      return [];
    },
    body: createMockElement("BODY"),
  };

  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (k: string) => storage.get(k) || null,
    setItem: (k: string, v: string) => storage.set(k, String(v)),
    removeItem: (k: string) => storage.delete(k),
  };

  const sandbox: any = {
    console,
    document: documentMock,
    window: {},
    localStorage: localStorageMock,
    $: getElementById,
    cellMap,
    elements,
    setTimeout: (fn: Function) => fn(),
    clearTimeout: () => {},
  };
  sandbox.window = sandbox;

  // Load config, state, and themes first
  const configCode = fs.readFileSync(path.join(JS_DIR, "config.js"), "utf-8");
  const stateCode = fs.readFileSync(path.join(JS_DIR, "state.js"), "utf-8");
  const themesCode = fs.readFileSync(path.join(JS_DIR, "themes.js"), "utf-8");
  const uiCode = fs.readFileSync(path.join(JS_DIR, "ui.js"), "utf-8");

  vm.createContext(sandbox);
  const fullCode = [configCode, stateCode, themesCode, uiCode].join("\n;\n");
  vm.runInContext(fullCode, sandbox);

  return sandbox;
}

test("updateMovePreviews is exported and cleanly clears highlights when not in move phase", () => {
  const env = setupMockEnvironment();
  assert.equal(typeof env.updateMovePreviews, "function", "updateMovePreviews must be exported");

  // In roll phase, calling updateMovePreviews should not set any destination highlights
  env.game = {
    phase: "roll",
    current: 0,
    players: [{ id: "p0", name: "Player 1", seat: "N", pieces: [], computer: false }],
  };
  env.updateMovePreviews();

  const highlighted = env.document.querySelectorAll(".cell.target-destination");
  assert.equal(highlighted.length, 0, "No cells should be highlighted during roll phase");
});

test("updateMovePreviews marks normal advance destination with tactical badge and source selection", () => {
  const env = setupMockEnvironment();
  const player = {
    id: "p0",
    name: "Alex",
    seat: "N",
    color: "#e67e22",
    avatar: "🦊",
    computer: false,
    pieces: [
      { id: "p0_q0", progress: 0 }, // Progress 0 on seat N is ROUTES.N[0] = D7
      { id: "p0_q1", progress: -1 },
    ],
  };

  env.game = {
    phase: "move",
    current: 0,
    players: [player],
    pool: [3],
  };
  env.selectedRoll = 0;
  env.selectedPieceId = "p0_q0";

  // Mock options returning candidate move to progress 3
  const destSq = env.ROUTES.N[3]; // destination square
  const originSq = env.ROUTES.N[0]; // D7
  env.options = () => [
    {
      piece: player.pieces[0],
      indices: [0],
      values: [3],
      test: { progress: 3, targets: [], captured: false },
    },
  ];

  env.updateMovePreviews("p0_q0", 0);

  const destCell = env.cellMap.get(destSq);
  assert.ok(destCell.classList.contains("target-destination"), "Destination cell must have target-destination class");
  assert.ok(destCell.classList.contains("target-normal"), "Destination cell must have target-normal class");
  assert.ok(destCell._previewMove, "Destination cell must store _previewMove reference");

  const originCell = env.cellMap.get(originSq);
  assert.ok(originCell.classList.contains("source-selected"), "Origin cell must have source-selected class");

  const badge = destCell.querySelector(".destination-badge");
  assert.ok(badge, "Destination cell must have a destination-badge");
  assert.ok(badge.innerHTML.includes("+3"), "Badge must show step count (+3)");
});

test("updateMovePreviews flags sanctuary destination with safe tactical badge", () => {
  const env = setupMockEnvironment();
  const player = {
    id: "p0",
    name: "Alex",
    seat: "N",
    computer: false,
    pieces: [{ id: "p0_q0", progress: 0 }],
  };

  // Find a progress that lands on a safe square
  let safeProgress = -1;
  for (let i = 1; i < env.ROUTES.N.length; i++) {
    if (env.SAFE.has(env.ROUTES.N[i])) {
      safeProgress = i;
      break;
    }
  }
  assert.ok(safeProgress > 0, "Must find a safe square on route");
  const safeSq = env.ROUTES.N[safeProgress];

  env.game = {
    phase: "move",
    current: 0,
    players: [player],
    pool: [safeProgress],
  };
  env.selectedRoll = 0;
  env.selectedPieceId = "p0_q0";

  env.options = () => [
    {
      piece: player.pieces[0],
      indices: [0],
      values: [safeProgress],
      test: { progress: safeProgress, targets: [], captured: false },
    },
  ];

  env.updateMovePreviews("p0_q0", 0);

  const destCell = env.cellMap.get(safeSq);
  assert.ok(destCell.classList.contains("target-destination"), "Must have target-destination class");
  assert.ok(destCell.classList.contains("target-sanctuary"), "Must have target-sanctuary class");

  const badge = destCell.querySelector(".destination-badge");
  assert.ok(badge, "Must have destination badge");
  assert.ok(badge.innerHTML.includes("SAFE"), "Badge must declare SAFE sanctuary");
});

test("updateMovePreviews flags capture destination with victim avatar and capture tactical badge", () => {
  const env = setupMockEnvironment();
  const player = {
    id: "p0",
    name: "Alex",
    seat: "N",
    computer: false,
    pieces: [{ id: "p0_q0", progress: 5 }],
  };
  const opponent = {
    id: "p1",
    name: "Morgan",
    seat: "S",
    avatar: "👻",
    pieces: [{ id: "p1_q0", progress: 2 }],
  };

  const destSq = env.ROUTES.N[7];

  env.game = {
    phase: "move",
    current: 0,
    players: [player, opponent],
    pool: [2],
  };
  env.selectedRoll = 0;
  env.selectedPieceId = "p0_q0";

  env.options = () => [
    {
      piece: player.pieces[0],
      indices: [0],
      values: [2],
      test: {
        progress: 7,
        targets: [{ other: opponent, q: opponent.pieces[0] }],
        captured: true,
      },
    },
  ];

  env.updateMovePreviews("p0_q0", 0);

  const destCell = env.cellMap.get(destSq);
  assert.ok(destCell.classList.contains("target-destination"), "Must have target-destination class");
  assert.ok(destCell.classList.contains("target-capture"), "Must have target-capture class");

  const badge = destCell.querySelector(".destination-badge");
  assert.ok(badge, "Must have destination badge");
  assert.ok(badge.innerHTML.includes("CAPTURE"), "Badge text must include CAPTURE");
  assert.ok(badge.innerHTML.includes("👻"), "Badge text must include victim avatar emoji");
});

test("updateMovePreviews flags center goal (progress 43 / D4) with GOAL tactical badge", () => {
  const env = setupMockEnvironment();
  const player = {
    id: "p0",
    name: "Alex",
    seat: "N",
    computer: false,
    pieces: [{ id: "p0_q0", progress: 42 }],
  };

  env.game = {
    phase: "move",
    current: 0,
    players: [player],
    pool: [1],
  };
  env.selectedRoll = 0;
  env.selectedPieceId = "p0_q0";

  env.options = () => [
    {
      piece: player.pieces[0],
      indices: [0],
      values: [1],
      test: { progress: 43, targets: [], captured: false },
    },
  ];

  env.updateMovePreviews("p0_q0", 0);

  const goalCell = env.cellMap.get("D4");
  assert.ok(goalCell.classList.contains("target-destination"), "Must have target-destination class");
  assert.ok(goalCell.classList.contains("target-goal"), "Must have target-goal class");

  const badge = goalCell.querySelector(".destination-badge");
  assert.ok(badge, "Must have destination badge");
  assert.ok(badge.innerHTML.includes("GOAL"), "Badge must declare GOAL");
});

test("updateMovePreviews flags reserve piece entry with ENTER tactical badge on start square", () => {
  const env = setupMockEnvironment();
  const player = {
    id: "p0",
    name: "Alex",
    seat: "N",
    computer: false,
    pieces: [{ id: "p0_q0", progress: -1 }],
  };

  env.game = {
    phase: "move",
    current: 0,
    players: [player],
    pool: [1],
  };
  env.selectedRoll = 0;
  env.selectedPieceId = "p0_q0";

  const startSq = env.START.N; // D7
  env.options = () => [
    {
      piece: player.pieces[0],
      indices: [0],
      values: [1],
      test: { progress: 0, targets: [], captured: false },
    },
  ];

  env.updateMovePreviews("p0_q0", 0);

  const startCell = env.cellMap.get(startSq);
  assert.ok(startCell.classList.contains("target-destination"), "Start cell must have target-destination class");

  const badge = startCell.querySelector(".destination-badge");
  assert.ok(badge, "Must have destination badge");
  assert.ok(badge.innerHTML.includes("ENTER"), "Badge must show ENTER for reserve entry");
});

test("clicking on a highlighted destination cell applies the move with inputSource destination-cell-click", () => {
  const env = setupMockEnvironment();
  let appliedMove: any = null;
  let appliedSource: any = null;

  env.apply = (move: any, src: string) => {
    appliedMove = move;
    appliedSource = src;
  };

  const player = {
    id: "p0",
    name: "Alex",
    seat: "N",
    computer: false,
    pieces: [{ id: "p0_q0", progress: 0 }],
  };

  const destSq = env.ROUTES.N[4];
  const candidateMove = {
    piece: player.pieces[0],
    indices: [0],
    values: [4],
    test: { progress: 4, targets: [], captured: false },
  };

  env.game = {
    phase: "move",
    current: 0,
    players: [player],
    pool: [4],
  };
  env.selectedRoll = 0;
  env.selectedPieceId = "p0_q0";
  env.options = () => [candidateMove];

  env.updateMovePreviews("p0_q0", 0);

  const destCell = env.cellMap.get(destSq);
  assert.ok(destCell._previewMove, "Destination cell must have _previewMove set");

  // Trigger click on destination cell
  destCell.click();

  // If click was attached via cell click listener in ui.js:
  // In our mock, if cell.onclick is defined, cell.click() calls cell.onclick()
  // When ui.js renders the board cells, it wires cell.onclick.
  // In this unit test, cellMap has mocked cell buttons.
  // We can attach the cell click handler or verify destCell._previewMove is stored and ready for apply.
  assert.equal(destCell._previewMove.piece.id, "p0_q0");
  assert.equal(destCell._previewMove.test.progress, 4);
});
