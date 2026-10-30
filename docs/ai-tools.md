# AI-assisted development acknowledgement

OpenAI Codex / ChatGPT was used as an implementation assistant during the development of this repository. It assisted with iterative UI and rules changes, code comments, documentation, automated-test additions, and browser-based verification.

The game does not call an AI model or an AI API at runtime. It is a static browser application. Its runtime behavior relies on browser APIs such as `crypto.getRandomValues`, Speech Synthesis, and the Clipboard API.

Development verification also used Node's built-in test runner and coverage support, GitHub Actions, and headless Chromium through Playwright. These are development and deployment tools, not runtime dependencies for players.
