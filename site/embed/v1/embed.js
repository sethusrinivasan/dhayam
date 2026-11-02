/*
 * Dhayam Embed v1
 *
 * This loader owns only the host-page boundary. The isolated game frame keeps
 * the existing rules, rendering, and multiplayer code as the source of truth.
 */
(function () {
  "use strict";

  const DEFAULT_HEIGHT = 760;
  const MIN_HEIGHT = 480;
  const MAX_HEIGHT = 1600;
  const ALLOWED_MODES = new Set(["solo", "local", "multiplayer", "spectator"]);
  const ALLOWED_THEMES = new Set(["classic", "dark", "high-contrast"]);

  function getScript() {
    return document.currentScript || document.querySelector("script[data-container]");
  }

  function text(value, fallback = "") {
    return String(value || fallback).trim().slice(0, 80);
  }

  function color(value) {
    const candidate = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : "";
  }

  function height(value) {
    const candidate = Number(value);
    if (!Number.isFinite(candidate)) return DEFAULT_HEIGHT;
    return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(candidate)));
  }

  function readConfig(script) {
    const data = script?.dataset || {};
    return {
      mode: ALLOWED_MODES.has(data.mode) ? data.mode : "solo",
      theme: ALLOWED_THEMES.has(data.theme) ? data.theme : "classic",
      height: height(data.height),
      roomCode: text(data.roomCode).replace(/[^a-z0-9_-]/gi, "").slice(0, 32),
      brand: {
        name: text(data.brandName),
        logoUrl: /^https:\/\//i.test(data.brandLogo || "") ? data.brandLogo : "",
        primaryColor: color(data.primaryColor),
        accentColor: color(data.accentColor),
      },
    };
  }

  function mount(target, options = {}, scriptOverride = null) {
    const container = typeof target === "string" ? document.querySelector(target) : target;
    if (!container) throw new Error("DhayamEmbed.mount: container was not found");

    const script =
      scriptOverride ||
      getScript() ||
      document.querySelector('script[src*="/embed/v1/embed.js"]');
    const baseConfig = readConfig(script);
    const config = {
      ...baseConfig,
      ...options,
      height: height(options.height ?? baseConfig.height),
      brand: { ...baseConfig.brand, ...(options.brand || {}) },
    };
    const serviceUrl = new URL("/embed", script?.src || window.location.href);
    serviceUrl.searchParams.set("embed", "1");
    serviceUrl.searchParams.set("parentOrigin", window.location.origin);
    serviceUrl.searchParams.set("mode", config.mode);
    serviceUrl.searchParams.set("theme", config.theme);
    if (config.brand.name) serviceUrl.searchParams.set("brandName", config.brand.name);
    if (config.brand.logoUrl) serviceUrl.searchParams.set("brandLogo", config.brand.logoUrl);
    if (config.brand.primaryColor) serviceUrl.searchParams.set("primaryColor", config.brand.primaryColor);
    if (config.brand.accentColor) serviceUrl.searchParams.set("accentColor", config.brand.accentColor);
    if (config.roomCode) serviceUrl.searchParams.set("roomCode", config.roomCode);

    const frame = document.createElement("iframe");
    frame.title = config.brand.name ? `${config.brand.name} Dhayam game` : "Dhayam game";
    frame.src = serviceUrl.toString();
    frame.loading = "lazy";
    frame.allow = "clipboard-write";
    frame.style.width = "100%";
    frame.style.height = `${config.height}px`;
    frame.style.border = "0";
    frame.style.display = "block";
    function sendConfig() {
      frame.contentWindow.postMessage(
        { source: "dhayam-embed", version: 1, type: "CONFIGURE", config },
        serviceUrl.origin,
      );
    }
    frame.addEventListener("load", () => window.setTimeout(sendConfig, 0));
    container.replaceChildren(frame);

    function handleMessage(event) {
      if (event.source !== frame.contentWindow || event.origin !== serviceUrl.origin) return;
      const message = event.data;
      if (!message || message.source !== "dhayam-embed" || message.version !== 1) return;

      if (message.type === "READY") sendConfig();
      if (message.type === "RESIZE") frame.style.height = `${height(message.height)}px`;
      const eventName = message.type.toLowerCase().replace(/_(\w)/g, (_, letter) => letter.toUpperCase());
      const callbackName = `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
      const callback =
        options[callbackName] ||
        (script?.dataset?.[callbackName] ? window[script.dataset[callbackName]] : undefined);
      if (typeof callback === "function") callback(message);
    }

    window.addEventListener("message", handleMessage);
    return {
      iframe: frame,
      destroy() {
        window.removeEventListener("message", handleMessage);
        frame.remove();
      },
    };
  }

  window.DhayamEmbed = { mount };

  const script = getScript();
  if (script?.dataset.container) {
    mount(script.dataset.container, {
      onReady: script.dataset.onReady ? window[script.dataset.onReady] : undefined,
      onGameOver: script.dataset.onGameOver ? window[script.dataset.onGameOver] : undefined,
    }, script);
  }
})();
