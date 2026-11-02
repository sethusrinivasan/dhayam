/*
 * Embed host bridge.
 *
 * The normal game never uses this bridge. When /embed is loaded, it applies
 * the partner's small configuration object and reports lifecycle events to
 * the parent page. Rules and game actions remain inside the existing client.
 */
"use strict";

const embedQuery = new URLSearchParams(window.location.search);
const embedParentOrigin = embedQuery.get("parentOrigin");
const embedMode = embedQuery.get("embed") === "1";

function isTrustedEmbedMessage(event) {
  return (
    embedMode &&
    event.source === window.parent &&
    Boolean(embedParentOrigin) &&
    event.origin === embedParentOrigin
  );
}

function sendEmbedEvent(type, details = {}) {
  if (!embedMode || !embedParentOrigin || window.parent === window) return;
  window.parent.postMessage(
    { source: "dhayam-embed", version: 1, type, ...details },
    embedParentOrigin,
  );
}

function applyEmbedConfig(config = {}) {
  const brand = config.brand || {};
  document.body.classList.add("embed-mode");
  if (["classic", "dark", "high-contrast"].includes(config.theme)) {
    document.body.dataset.theme = config.theme;
  }
  if (/^#[0-9a-f]{6}$/i.test(brand.primaryColor || "")) {
    document.documentElement.style.setProperty("--embed-primary", brand.primaryColor);
  }
  if (/^#[0-9a-f]{6}$/i.test(brand.accentColor || "")) {
    document.documentElement.style.setProperty("--embed-accent", brand.accentColor);
  }

  const brandName = document.getElementById("brandName");
  const brandLogo = document.getElementById("brandLogo");
  if (brandName && typeof brand.name === "string") brandName.textContent = brand.name.slice(0, 80);
  if (brandLogo && /^https:\/\//i.test(brand.logoUrl || "")) {
    brandLogo.src = brand.logoUrl;
    brandLogo.alt = brand.name ? `${brand.name} logo` : "Partner logo";
    brandLogo.hidden = false;
  }
}

if (embedMode) {
  applyEmbedConfig({
    theme: embedQuery.get("theme"),
    brand: {
      name: embedQuery.get("brandName") || "",
      logoUrl: embedQuery.get("brandLogo") || "",
      primaryColor: embedQuery.get("primaryColor") || "",
      accentColor: embedQuery.get("accentColor") || "",
    },
  });
}

window.DhayamEmbedHost = {
  gameStarted(details) {
    sendEmbedEvent("GAME_STARTED", details);
  },
  gameOver(details) {
    sendEmbedEvent("GAME_OVER", details);
  },
};

window.addEventListener("message", (event) => {
  if (!isTrustedEmbedMessage(event)) return;
  const message = event.data;
  if (!message || message.source !== "dhayam-embed" || message.version !== 1) return;
  if (message.type === "CONFIGURE") applyEmbedConfig(message.config);
});

if (embedMode) {
  let readySent = false;
  const announceReady = () => {
    if (readySent) return;
    readySent = true;
    sendEmbedEvent("READY");
    window.setTimeout(() => {
      sendEmbedEvent("RESIZE", { height: document.documentElement.scrollHeight });
    }, 0);
  };
  window.addEventListener("DOMContentLoaded", announceReady, { once: true });
  window.addEventListener("load", announceReady, { once: true });
}
