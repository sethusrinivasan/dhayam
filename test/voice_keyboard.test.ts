import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const VOICE_JS_PATH = path.join(ROOT_DIR, "site", "js", "voice.js");

function createMockEnvironment() {
  const elements = new Map<string, any>();
  const eventListeners = new Map<string, Function[]>();

  function getElementById(id: string) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        tagName: "DIV",
        textContent: "",
        title: "",
        classList: {
          classes: new Set<string>(),
          add(c: string) { this.classes.add(c); },
          remove(c: string) { this.classes.delete(c); },
          contains(c: string) { return this.classes.has(c); },
        },
        setAttribute(k: string, v: string) { this[k] = v; },
        getAttribute(k: string) { return this[k]; },
        disabled: false,
        click() {
          if (this.onclick) this.onclick();
        },
      });
    }
    return elements.get(id);
  }

  const documentMock = {
    getElementById,
    createElement: (tag: string) => ({
      tagName: tag.toUpperCase(),
      classList: {
        classes: new Set<string>(),
        add(c: string) { this.classes.add(c); },
        remove(c: string) { this.classes.delete(c); },
        contains(c: string) { return this.classes.has(c); },
      },
      setAttribute(k: string, v: string) { this[k] = v; },
      getAttribute(k: string) { return this[k]; },
      style: {},
      textContent: "",
    }),
    body: {
      appendChild: (el: any) => el,
    },
    addEventListener: (type: string, handler: Function) => {
      if (!eventListeners.has(type)) eventListeners.set(type, []);
      eventListeners.get(type)!.push(handler);
    },
  };

  const sandbox: any = {
    console,
    setTimeout: (fn: Function) => fn(),
    clearTimeout: () => {},
    document: documentMock,
    window: {},
    $: getElementById,
    elements,
    eventListeners,
  };
  sandbox.window = sandbox;

  const code = fs.readFileSync(VOICE_JS_PATH, "utf-8");
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  return sandbox;
}

test("voice.js loads cleanly and exports keyboard and voice handlers", () => {
  const env = createMockEnvironment();
  assert.equal(typeof env.handleKeyboardRoll, "function");
  assert.equal(typeof env.handleKeyboardMove, "function");
  assert.equal(typeof env.handleKeyboardNewGame, "function");
  assert.equal(typeof env.handleKeyboardExit, "function");
  assert.equal(typeof env.showKeyboardHelpModal, "function");
  assert.equal(typeof env.toggleVoiceCommands, "function");
  assert.equal(typeof env.setupKeyboardNavigation, "function");
});

test("handleKeyboardRoll triggers primary action button during roll phase", () => {
  const env = createMockEnvironment();
  let actionClicked = false;
  const actionBtn = env.$("actionBtn");
  actionBtn.disabled = false;
  actionBtn.onclick = () => { actionClicked = true; };

  env.game = { phase: "roll" };
  env.handleKeyboardRoll();
  assert.equal(actionClicked, true, "Roll should click the primary action button");
});

test("handleKeyboardRoll triggers roll() directly if actionBtn is not configured", () => {
  const env = createMockEnvironment();
  let rollCalled = false;
  env.roll = () => { rollCalled = true; };
  env.rolling = false;

  env.game = { phase: "roll" };
  const actionBtn = env.$("actionBtn");
  actionBtn.disabled = true; // disabled so it falls back to roll()

  env.handleKeyboardRoll();
  assert.equal(rollCalled, true, "handleKeyboardRoll should fall back to roll() when button is disabled");
});

test("handleKeyboardMove applies first legal move when options exist", () => {
  const env = createMockEnvironment();
  let appliedMove: any = null;
  let appliedSource: any = null;

  env.game = { phase: "move" };
  env.moving = false;
  env.options = () => [
    { piece: { id: "P0-0", progress: 0 }, steps: 1 },
    { piece: { id: "P0-1", progress: 4 }, steps: 1 },
  ];
  env.apply = (move: any, src: string) => {
    appliedMove = move;
    appliedSource = src;
  };

  env.handleKeyboardMove();
  assert.ok(appliedMove, "Move should be applied");
  assert.equal(appliedSource, "keyboard");
  assert.equal(appliedMove.piece.id, "P0-0");
});

test("handleKeyboardMove targets specific piece by number (1-6)", () => {
  const env = createMockEnvironment();
  let appliedMove: any = null;

  env.game = { phase: "move" };
  env.moving = false;
  env.options = () => [
    { piece: { id: "P0-0", progress: 0 }, steps: 1 },
    { piece: { id: "P0-2", progress: 4 }, steps: 1 },
    { piece: { id: "P0-4", progress: 8 }, steps: 1 },
  ];
  env.apply = (move: any) => { appliedMove = move; };

  // Piece 3 is 0-indexed index 2: id "P0-2"
  env.handleKeyboardMove(3);
  assert.ok(appliedMove);
  assert.equal(appliedMove.piece.id, "P0-2");
});

test("handleKeyboardMove auto-passes if no legal options exist", () => {
  const env = createMockEnvironment();
  let passCalled = false;

  env.game = { phase: "move" };
  env.moving = false;
  env.options = () => [];
  env.passRemainingRolls = () => { passCalled = true; };

  env.handleKeyboardMove();
  assert.equal(passCalled, true, "handleKeyboardMove should pass turn when 0 legal options exist");
});

test("handleKeyboardNewGame invokes newGame(2, 1) to start solo vs computer", () => {
  const env = createMockEnvironment();
  let newGameArgs: any[] = [];
  env.newGame = (players: number, ai: number) => {
    newGameArgs = [players, ai];
  };

  env.handleKeyboardNewGame();
  assert.deepEqual(newGameArgs, [2, 1], "New game should start 2 players with 1 computer");
});

test("handleKeyboardExit closes open modal if modal is currently open", () => {
  const env = createMockEnvironment();
  let modalClosed = false;
  env.closeModal = () => { modalClosed = true; };
  const modalback = env.$("modalback");
  modalback.classList.add("open");

  env.handleKeyboardExit();
  assert.equal(modalClosed, true, "Should close open modal dialog on exit");
});

test("handleKeyboardExit leaves demo if active", () => {
  const env = createMockEnvironment();
  let demoExited = false;
  env.demo = true;
  env.exitGuidedDemo = () => { demoExited = true; };

  env.handleKeyboardExit();
  assert.equal(demoExited, true, "Should exit active demo on exit command");
});

test("setupKeyboardNavigation intercepts Space, R, M, 1-6, N, Esc without intercepting inputs", () => {
  const env = createMockEnvironment();
  env.setupKeyboardNavigation();

  const listeners = env.eventListeners.get("keydown") || [];
  assert.equal(listeners.length, 1, "Should attach single global keydown listener");
  const listener = listeners[0];

  let rollTriggered = false;
  env.handleKeyboardRoll = () => { rollTriggered = true; };

  // Should ignore typing inside text input
  let defaultPrevented = false;
  listener({
    target: { tagName: "INPUT" },
    code: "Space",
    key: " ",
    preventDefault: () => { defaultPrevented = true; },
  });
  assert.equal(rollTriggered, false, "Must not trigger game roll while typing inside input");
  assert.equal(defaultPrevented, false);

  // Should trigger on Space when not inside an input
  listener({
    target: { tagName: "BODY" },
    code: "Space",
    key: " ",
    preventDefault: () => { defaultPrevented = true; },
  });
  assert.equal(rollTriggered, true, "Space must trigger roll");
  assert.equal(defaultPrevented, true);

  // Should trigger on 'r'
  rollTriggered = false;
  listener({
    target: { tagName: "BODY" },
    code: "KeyR",
    key: "r",
    preventDefault: () => {},
  });
  assert.equal(rollTriggered, true, "'r' must trigger roll");

  // Should trigger move on 'm'
  let moveTriggered = false;
  env.handleKeyboardMove = () => { moveTriggered = true; };
  listener({
    target: { tagName: "BODY" },
    code: "KeyM",
    key: "m",
    preventDefault: () => {},
  });
  assert.equal(moveTriggered, true, "'m' must trigger move");

  // Should trigger specific piece move on '4'
  let targetedPiece = 0;
  env.handleKeyboardMove = (num: number) => { targetedPiece = num; };
  listener({
    target: { tagName: "BODY" },
    code: "Digit4",
    key: "4",
    preventDefault: () => {},
  });
  assert.equal(targetedPiece, 4, "'4' must trigger move for piece 4");

  // Should trigger new solo match on 'n'
  let newGameTriggered = false;
  env.handleKeyboardNewGame = () => { newGameTriggered = true; };
  listener({
    target: { tagName: "BODY" },
    code: "KeyN",
    key: "n",
    preventDefault: () => {},
  });
  assert.equal(newGameTriggered, true, "'n' must trigger new game");
});
