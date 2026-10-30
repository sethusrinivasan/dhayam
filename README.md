# Dhayam

[![Node.js](https://img.shields.io/badge/node-%E2%89%A522.18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Tests](https://github.com/sethusrinivasan/dhayam/actions/workflows/test.yml/badge.svg)](https://github.com/sethusrinivasan/dhayam/actions/workflows/test.yml)
[![Play Dhayam](https://img.shields.io/badge/play-Live%20Dhayam-d88a3e?logo=githubpages&logoColor=white)](https://sethusrinivasan.github.io/dhayam/)
[![License: MIT](https://img.shields.io/badge/license-MIT-8a2be2)](LICENSE)

A static, Dayakattai-inspired board game for local play or one human against 1–5 computer opponents. It features numbered pieces, guided play, fair browser dice, animated captures, and exportable game audits.

## Start

Requires Node.js 22.18 or newer.

```sh
npm test
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000/` on the same machine that runs the server.

## For contributors and AI coding harnesses

- Read [AGENTS.md](AGENTS.md) for implementation and verification guidance.
- Use [ONE_SHOT_PROMPT.md](ONE_SHOT_PROMPT.md) as a copy-paste task prompt.
- The browser UI is in `site/index.html`; the tested rules engine is in `src/game.ts`.
- GitHub Actions runs tests and coverage on every push and pull request.

## Documentation

- [Architecture](docs/architecture.md)
- [Design decisions](docs/design-decisions.md)
- [Threat model and privacy](docs/threat-model.md)
- [Test plan](docs/test-plan.md)
- [AI-assisted development acknowledgement](docs/ai-tools.md)

## Deployment

The Pages workflow publishes `site/` on pushes to `main`. Enable **GitHub Actions** as the source in **Settings → Pages**. Private-repository Pages availability depends on the owner’s GitHub plan.

## License

[MIT](LICENSE)
