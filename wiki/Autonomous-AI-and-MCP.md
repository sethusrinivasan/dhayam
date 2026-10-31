# 🤖 Autonomous AI & MCP Endpoints

Dhayam features first-class Model Context Protocol (MCP) integration, allowing AI coding assistants and autonomous agents to inspect board states, evaluate legal moves, and execute computer-to-computer matches.

---

## Live MCP Endpoints

* **Streamable HTTP Endpoint:** `https://dhayam.cancun.workers.dev/mcp`
* **Local Stdio Script:** `python3 mcp/server.py`

---

## Supported Tools Catalog

| Tool | Purpose | Key Parameters |
|---|---|---|
| `dhayam_new_game` | Start a new match | `player_names?: string[]` |
| `dhayam_get_state` | Inspect current board and turn | `state?: object` |
| `dhayam_roll_dice` | Roll dice with cryptographic randomness | `state?: object` |
| `dhayam_get_legal_moves` | List available legal moves | `state?: object` |
| `dhayam_evaluate_moves` | Tactical candidate scoring with tags | `strategy?: "balanced" \| "aggressive" \| "cautious"` |
| `dhayam_play_ai_turn` | Complete automated turn for active AI | `strategy?: "balanced" \| "aggressive" \| "cautious"` |
| `dhayam_simulate_ai_match` | Simulate full AI vs AI match | `player_names?: string[]`, `max_turns?: int` |
| `dhayam_simulate_online_match` | Simulate bot turns in live Cloudflare room | `room_code: string`, `turns?: int` |

---

## Example: Running an AI vs AI Match in Python

```python
import importlib.util

spec = importlib.util.spec_from_file_location("server", "mcp/server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

game = server.DhayamGame(["AlphaBot", "BetaBot"])
result = game.simulate_ai_match(strategies=["aggressive", "cautious"], max_turns=120)

print("Winner:", result["winner"])
print("Total Turns:", result["total_turns"])
for stat in result["statistics"]:
    print(f"- {stat['name']}: {stat['finished_pieces']}/6 home, {stat['captures_count']} captures")
```
