import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const ROOT_DIR = path.resolve(".");
const SITE_DIR = path.join(ROOT_DIR, "site");
const JS_DIR = path.join(SITE_DIR, "js");

function loadBrowserScript(filename: string, context: Record<string, any> = {}) {
  const code = fs.readFileSync(path.join(JS_DIR, filename), "utf-8");
  const sandbox = {
    window: {},
    globalThis: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    innerWidth: 1024,
    innerHeight: 768,
    devicePixelRatio: 1,
    document: {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({
        getContext: () => ({
          clearRect: () => {},
          fillRect: () => {},
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
          save: () => {},
          restore: () => {},
          translate: () => {},
          rotate: () => {},
          scale: () => {}
        }),
        style: {}
      }),
      body: { appendChild: () => {} },
      getElementById: () => null
    },
    navigator: {},
    console,
    Math,
    Date,
    Intl,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (cb: Function) => setTimeout(cb, 16),
    cancelAnimationFrame: (id: any) => clearTimeout(id),
    ...context
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

test("COMPUTER_PERSONAS roster contains 10 balanced female & male personas", () => {
  const ctx = loadBrowserScript("personas.js");
  const personas = ctx.COMPUTER_PERSONAS;
  assert.ok(Array.isArray(personas), "Personas must be an array");
  assert.equal(personas.length, 10, "Expected exactly 10 diverse personas");

  const females = personas.filter((p: any) => p.gender === "female");
  const males = personas.filter((p: any) => p.gender === "male");
  assert.equal(females.length, 5, "Expected 5 female personas");
  assert.equal(males.length, 5, "Expected 5 male personas");

  const expectedNames = [
    "Kavitha", "Ananya", "Rani", "Meera", "Selvi",
    "Murugan", "Kavin", "Arjun", "Mani", "Vikram"
  ];

  for (const name of expectedNames) {
    const found = personas.find((p: any) => p.name === name);
    assert.ok(found, `Persona ${name} must exist in roster`);
    assert.ok(found.avatar, `Persona ${name} must have an avatar`);
    assert.ok(found.color, `Persona ${name} must have a theme color`);
    assert.ok(found.title, `Persona ${name} must have an English title`);
    assert.ok(found.titleTa, `Persona ${name} must have a Tamil title`);
    assert.ok(typeof found.safetyWeight === "number", `Persona ${name} must have safetyWeight`);
    assert.ok(typeof found.aggressionWeight === "number", `Persona ${name} must have aggressionWeight`);
    assert.ok(typeof found.progressWeight === "number", `Persona ${name} must have progressWeight`);
    assert.ok(typeof found.voicePitch === "number", `Persona ${name} must have voicePitch`);
    assert.ok(typeof found.voiceRate === "number", `Persona ${name} must have voiceRate`);
  }
});

test("getRandomComputerPersona selects valid persona and respects exclusion", () => {
  const ctx = loadBrowserScript("personas.js");
  const persona = ctx.getRandomComputerPersona();
  assert.ok(persona);
  assert.ok(persona.name);

  // Exclude all except one
  const allNames = ctx.COMPUTER_PERSONAS.map((p: any) => p.name);
  const excludeNine = allNames.slice(0, 9);
  const picked = ctx.getRandomComputerPersona(excludeNine);
  assert.equal(picked.name, allNames[9], "Should pick the only non-excluded persona");
});

test("getPersonaByName finds personas case-insensitively by name or id", () => {
  const ctx = loadBrowserScript("personas.js");
  const kavitha = ctx.getPersonaByName("kavitha");
  assert.ok(kavitha);
  assert.equal(kavitha.name, "Kavitha");
  assert.equal(kavitha.gender, "female");

  const murugan = ctx.getPersonaByName("MURUGAN");
  assert.ok(murugan);
  assert.equal(murugan.name, "Murugan");
  assert.equal(murugan.gender, "male");

  assert.equal(ctx.getPersonaByName("NonExistent"), null);
});

test("getSuggestedLocalizedNames provides regional names", () => {
  const ctx = loadBrowserScript("personas.js");
  const names = ctx.getSuggestedLocalizedNames();
  assert.ok(Array.isArray(names));
  assert.ok(names.length >= 8);
  assert.ok(names.includes("Aarav") || names.includes("Maya") || names.includes("Siva"));
});

test("escapeHtml prevents XSS injection in player and persona names", () => {
  const ctx = loadBrowserScript("personas.js");
  const escaped = ctx.escapeHtml("<script>alert('xss')</script> & \"Organizer\"");
  assert.ok(!escaped.includes("<script>"));
  assert.ok(escaped.includes("&lt;script&gt;"));
  assert.ok(escaped.includes("&amp;"));
  assert.ok(escaped.includes("&quot;"));
});

test("confetti.js exports launchConfettiCelebration and stopCelebration", () => {
  const ctx = loadBrowserScript("confetti.js");
  assert.equal(typeof ctx.launchConfettiCelebration, "function");
  assert.equal(typeof ctx.stopCelebration, "function");

  // Verify safe invocation without exceptions in sandbox
  ctx.launchConfettiCelebration(100);
  ctx.stopCelebration();
});
