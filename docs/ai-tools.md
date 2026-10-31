# AI-Assisted Development Acknowledgement

This repository was designed and engineered with pair-programming assistance from:
* **OpenAI Codex**
* **Google Gemini / Antigravity**

They assisted with iterative UI and board rule implementations, 3D dice physics, Cloudflare Edge Durable Object WebSockets, Model Context Protocol (MCP) tool integration, automated regression testing, and architectural documentation.

The game itself does not call an external AI API at runtime during player moves; the web game is a self-contained, zero-dependency browser application utilizing standard Web APIs (`crypto.getRandomValues`, SpeechSynthesis, WebSockets).

For automated testing, simulation, and pair-programming, the pure game engine is also exposed via the Model Context Protocol (`/mcp` and `mcp/server.py`), enabling AI agents to analyze board states, evaluate legal moves, and simulate matches.
