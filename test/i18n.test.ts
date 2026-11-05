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
  };
  return el;
}

function setupI18nEnvironment(initialStorageLang: string | null = null) {
  const storage = new Map<string, string>();
  if (initialStorageLang) {
    storage.set("dhayam_lang", initialStorageLang);
  }

  const localStorageMock = {
    getItem: (k: string) => storage.get(k) || null,
    setItem: (k: string, v: string) => storage.set(k, String(v)),
    removeItem: (k: string) => storage.delete(k),
  };

  const elements = new Map<string, any>();
  function getElementById(id: string) {
    if (!elements.has(id)) {
      elements.set(id, createMockElement("DIV", id));
    }
    return elements.get(id);
  }

  const documentMock: any = {
    documentElement: { lang: "en" },
    getElementById: getElementById,
    querySelector: (sel: string) => {
      if (sel === ".brand .sub") return createMockElement("DIV", "brandSub");
      if (sel === ".menu-trigger span") return createMockElement("SPAN", "menuSpan");
      if (sel === ".side .panel h2") return createMockElement("H2", "familyH2");
      return null;
    },
    querySelectorAll: (sel: string) => [],
    addEventListener: () => {},
  };

  const recordedEvents: any[] = [];
  const FlightRecorderMock = {
    record: (type: string, data: any) => recordedEvents.push({ type, data }),
  };

  const sandbox: any = {
    console,
    document: documentMock,
    window: {},
    localStorage: localStorageMock,
    $: getElementById,
    FlightRecorder: FlightRecorderMock,
    recordedEvents,
    ROUTES: {},
  };
  sandbox.window = sandbox;

  // Load config and i18n
  const configCode = fs.readFileSync(path.join(JS_DIR, "config.js"), "utf-8");
  const i18nCode = fs.readFileSync(path.join(JS_DIR, "i18n.js"), "utf-8");

  vm.createContext(sandbox);
  vm.runInContext([configCode, i18nCode].join("\n;\n"), sandbox);

  return sandbox;
}

test("i18n defaults to English when no saved preference exists", () => {
  const env = setupI18nEnvironment(null);
  assert.equal(env.getLanguage(), "en", "Default language must be English");
  assert.equal(env.document.documentElement.lang, "en", "Document lang attribute should be 'en'");
  assert.equal(env.t("brand_name"), "Dhayam");
  assert.equal(env.t("badge_goal"), "GOAL");
  assert.equal(env.t("badge_capture"), "CAPTURE");
  assert.equal(env.t("badge_sanctuary"), "SAFE");
  assert.equal(env.t("badge_enter"), "ENTER");
});

test("i18n language toggle switches between English and Tamil", () => {
  const env = setupI18nEnvironment(null);
  assert.equal(env.getLanguage(), "en");

  // Toggle to Tamil
  env.toggleLanguage();
  assert.equal(env.getLanguage(), "ta", "Language should now be Tamil");
  assert.equal(env.document.documentElement.lang, "ta", "Document lang should update to 'ta'");
  assert.equal(env.localStorage.getItem("dhayam_lang"), "ta", "Tamil selection must persist to localStorage");

  // Check Tamil tactical badges
  assert.equal(env.t("badge_goal"), "\u0baa\u0bb0\u0bae\u0baa\u0ba4\u0bae\u0bcd", "Goal badge in Tamil: Paramapadam");
  assert.equal(env.t("badge_capture"), "\u0bb5\u0bc6\u0b9f\u0bcd\u0b9f\u0bc1", "Capture badge in Tamil: Vettu");
  assert.equal(env.t("badge_sanctuary"), "\u0bae\u0bb2\u0bc8", "Sanctuary badge in Tamil: Malai");
  assert.equal(env.t("badge_enter"), "\u0b95\u0bb3\u0bae\u0bcd \u0baa\u0bc1\u0b95\u0bc1", "Enter badge in Tamil: Kalam Pugu");

  // Toggle back to English
  env.toggleLanguage();
  assert.equal(env.getLanguage(), "en", "Language should revert to English");
  assert.equal(env.localStorage.getItem("dhayam_lang"), "en", "English selection must persist to localStorage");
  assert.equal(env.t("badge_goal"), "GOAL");
});

test("i18n loads saved Tamil preference from localStorage on fresh session", () => {
  const env = setupI18nEnvironment("ta");
  assert.equal(env.getLanguage(), "ta", "Must initialize to saved Tamil preference");
  assert.equal(env.t("last_roll"), "\u0b95\u0b9f\u0bc8\u0b9a\u0bbf \u0b89\u0bb0\u0bc1\u0b9f\u0bcd\u0b9f\u0bb2\u0bcd");
});

test("i18n interpolates named parameters accurately in English and Tamil", () => {
  const env = setupI18nEnvironment(null);

  // English interpolation
  const enRoll = env.t("speech_roll_normal", { name: "Alex", val: 5 });
  assert.equal(enRoll, "Alex rolled 5. Now choose a legal move.");

  const enTurn = env.t("turn_title", { name: "Maya" });
  assert.equal(enTurn, "Maya’s turn");

  // Tamil interpolation
  env.setLanguage("ta");
  const taRoll = env.t("speech_roll_normal", { name: "Alex", val: 5 });
  assert.ok(taRoll.includes("Alex"), "Tamil commentary must interpolate player name");
  assert.ok(taRoll.includes("5"), "Tamil commentary must interpolate roll value");

  const taTurn = env.t("turn_title", { name: "Maya" });
  assert.equal(taTurn, "Maya-\u0ba9\u0bcd \u0bae\u0bc1\u0bb1\u0bc8");
});

test("i18n language toggle logs event to FlightRecorder", () => {
  const env = setupI18nEnvironment(null);
  env.toggleLanguage();

  const changeEvent = env.recordedEvents.find((e: any) => e.type === "LANGUAGE_CHANGED");
  assert.ok(changeEvent, "Must record LANGUAGE_CHANGED event in FlightRecorder");
  assert.equal(changeEvent.data.lang, "ta");
});
