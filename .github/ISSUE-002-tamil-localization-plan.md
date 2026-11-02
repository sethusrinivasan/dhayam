# Full Tamil Localization & Internationalization Plan

## Overview
The goal is to make **Dhayam** a first‑class experience for Tamil‑speaking users. This includes full UI translation, Tamil‑written content, audio narration in Tamil, and a seamless way for users to switch languages (including automatic detection for Indian IPs).

## Objectives
1. **Complete UI translation** – all static text, tooltips, button labels, and help messages.
2. **Tamil audio** – narration for turn announcements, dice rolls, win/loss messages, and UI feedback.
3. **Language selector** – a persistent control in the settings panel that lets the user toggle between English and Tamil.
4. **Geo‑IP prompt** – when a visitor’s IP resolves to India, show a polite modal asking if they want to switch to Tamil.
5. **Accessibility** – ensure Tamil text is correctly rendered (Unicode, proper font fallback) and that audio is optional/controllable.
6. **Content pipeline** – manage translations, audio files, and future language additions via a simple JSON‑based resource bundle.
7. **Testing & QA** – visual, functional, and linguistic testing with native Tamil speakers.

---

## Detailed Work Breakdown

| Phase | Tasks | Owner | Duration | Deliverables |
|------|-------|-------|----------|--------------|
| **1. Foundations** | • Add `i18n` module (`src/i18n.ts`).<br>• Define JSON resource files: `en.json`, `ta.json` (Tamil).<br>• Refactor UI code to fetch strings via `t(key)` helper.<br>• Add `lang` attribute on `<html>` dynamically. | Dev Lead | 1 week | Working i18n scaffolding, no UI changes yet. |
| **2. UI Text Translation** | • Extract every user‑visible string (buttons, alerts, help, modals).<br>• Translate to Tamil (use professional translator).<br>• Populate `ta.json`. | Translator + Dev | 2 weeks | Complete Tamil string bundle. |
| **3. Audio Assets** | • Script Tamil narration (turn start, dice roll, capture, win, loss, errors).<br>• Record high‑quality audio clips (fallback MP3 & OGG).<br>• Store in `site/assets/audio/ta/`.
• Implement `audioPlayer.play(key, locale)` wrapper. | Audio Engineer | 2 weeks | 30‑odd audio files, playback API. |
| **4. Settings UI** | • Add Settings panel (if not present) with **Language** dropdown (English / தமிழ்).
• Persist choice in `localStorage` (`dhayamLang`).<br>• Apply on page load (`document.documentElement.lang`). | Front‑end Dev | 1 week | Settings UI, persistent language switch. |
| **5. Geo‑IP Prompt** | • Integrate a lightweight IP‑lookup service (e.g., `ipinfo.io/json`).
• On first visit, if `country == "IN"` and no language preference stored, show modal:
   * "We noticed you are in India. Would you like to view Dhayam in தமிழ்?" – **Yes / No**.
• Respect user choice (store in `localStorage`). | Front‑end Dev | 1 week | Geo‑IP detection & prompt modal. |
| **6. Accessibility & Font** | • Verify Tamil Unicode rendering across browsers – add fallback font family (`"Latha", "Noto Serif Tamil", serif`).
• Provide **mute** toggle for audio.
• Ensure screen‑reader labels are localized. | Accessibility Lead | 1 week | Accessible Tamil UI. |
| **7. Testing** | • Unit tests for `i18n` helper.
• End‑to‑end tests with Cypress: language toggle, audio playback, geo‑IP flow.
• Manual QA with native Tamil speakers for phrasing & pronunciation. | QA Team | 1 week | Test suite, QA sign‑off. |
| **8. Documentation** | • Update `README.md` with language‑switch instructions.
• Add a `docs/i18n.md` describing the localization pipeline.
• Document how to add new languages. | Docs Writer | 3 days | Documentation in repo. |
| **9. Release & Monitoring** | • Tag release `vX.Y‑ta`.
• Add a feature flag to enable/disable Tamil for A/B testing.
• Monitor usage metrics (language selection, audio enable). | Release Engineer | 2 days | Deployed version, metrics dashboard. |

---

## UX Flow
1. **First visit** – site loads in English.
2. **IP detection** runs in background; if Indian IP, modal appears.
3. **User selects** “Yes, switch to தமிழ்”.
4. `localStorage.lang` set to `ta`; page reloads.
5. All UI strings now rendered from `ta.json`.
6. Audio player auto‑plays Tamil narration (respecting mute toggle).
7. Settings icon (gear) lets user change language at any time.

---

## Technical Design
- **i18n Helper (`src/i18n.ts`)**:
  ```ts
  const bundles = { en: import('../i18n/en.json'), ta: import('../i18n/ta.json') };
  let current = 'en';
  export function setLocale(loc: 'en'|'ta') { current = loc; document.documentElement.lang = loc; }
  export function t(key: string): string { return bundles[current][key] ?? key; }
  ```
- **Audio Wrapper (`site/js/audio.js`)**:
  ```js
  export function play(key) {
    const locale = document.documentElement.lang || 'en';
    const src = `/assets/audio/${locale}/${key}.mp3`;
    const audio = new Audio(src);
    audio.play();
  }
  ```
- **Geo‑IP Service** – fetch `https://ipinfo.io/json?token=<TOKEN>` (free tier sufficient). Cache result for the session.
- **Settings Persistence** – `localStorage.setItem('dhayamLang', loc)`; read on startup.

---

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Poor translation quality | User confusion, brand damage | Use a professional Tamil translator and perform a review pass with native speakers. |
| Audio latency on mobile | Gameplay interruption | Pre‑load audio assets, allow mute, fallback to text‑only. |
| IP‑lookup service downtime | Prompt not shown | Cache previous result; fallback to manual language switch. |
| Font rendering issues | Unreadable text | Include `Noto Serif Tamil` via Google Fonts as a fallback. |

---

## Milestones & Timeline (6 weeks total)
1. **Week 1** – i18n scaffolding & string extraction.
2. **Week 2‑3** – Translation & audio production.
3. **Week 4** – Settings UI, Geo‑IP modal, audio wrapper.
4. **Week 5** – Accessibility tweaks, testing (unit + Cypress).
5. **Week 6** – Documentation, release, monitoring.

---

## Labels & Tracking
- **Labels**: `i18n`, `enhancement`, `accessibility`.
- **GitHub Project**: Add to the “Localization” column of the project board.
- **Related Issues**: This issue will be split into smaller tickets (e.g., `#12 – Add i18n helper`, `#13 – Translate UI`, `#14 – Record Tamil audio`).

---

**Created via Antigravity** on 2026‑10‑31.
