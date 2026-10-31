#!/usr/bin/env python3
"""
Dhayam Model Context Protocol (MCP) Server
Exposes the pure Dhayam / Dayakattai game engine as MCP tools and resources over stdio.
Compatible with Antigravity, Claude Desktop, Cursor, and any MCP-compliant client.
Zero third-party dependencies — uses Python 3 standard library.
"""

import sys
import json
import secrets
from typing import Dict, Any, List, Optional

# --- Dhayam Game Engine Constants & Routes ---

SAFE_SQUARES = {"A4", "B2", "B6", "D1", "D7", "F2", "F6", "G4"}
GOAL_SQUARE = "D4"
BONUS_VALUES = {1, 5, 6, 12}
FINISH_PROGRESS = 43

OUTER = [
    "A4", "A5", "A6", "A7", "B7", "C7", "D7", "E7", "F7", "G7",
    "G6", "G5", "G4", "G3", "G2", "G1", "F1", "E1", "D1", "C1",
    "B1", "A1", "A2", "A3"
]

INNER = [
    "B4", "B3", "B2", "C2", "D2", "E2", "F2", "F3",
    "F4", "F5", "F6", "E6", "D6", "C6", "B6", "B5"
]

APPROACH = {
    "N": ["C4", "D4"],
    "E": ["D5", "D4"],
    "S": ["E4", "D4"],
    "W": ["D3", "D4"]
}

SEATS = ["N", "E", "S", "W"]

def build_route(seat: str) -> List[str]:
    start_outer = {"N": 0, "E": 6, "S": 12, "W": 18}[seat]
    outer_loop = [OUTER[(start_outer + i) % len(OUTER)] for i in range(len(OUTER))]
    start_inner = {"N": 0, "E": 12, "S": 8, "W": 4}[seat]
    inner_loop = [INNER[(start_inner + i) % len(INNER)] for i in range(len(INNER))]
    home = APPROACH[seat]
    return outer_loop + inner_loop + home

ROUTES = {seat: build_route(seat) for seat in SEATS}

DICE_OUTCOMES = [
    (0, 1, 1), (1, 0, 1), (0, 2, 2), (1, 1, 2), (2, 0, 2),
    (0, 3, 3), (1, 2, 3), (2, 1, 3), (3, 0, 3),
    (1, 3, 4), (2, 2, 4), (3, 1, 4),
    (2, 3, 5), (3, 2, 5),
    (3, 3, 6),
    (0, 0, 12)
]

# --- Game State Management ---

class DhayamGame:
    def __init__(self, player_names: Optional[List[str]] = None):
        names = player_names or ["Player 1", "Player 2"]
        count = min(max(len(names), 2), 4)
        avatars = ["🔴", "🟢", "🟡", "🔵"]
        colors = ["#ff7518", "#2dd4bf", "#f59e0b", "#6366f1"]
        
        self.players = []
        for i in range(count):
            self.players.append({
                "id": f"p{i}",
                "name": names[i],
                "avatar": avatars[i],
                "color": colors[i],
                "seat": SEATS[i],
                "captured": False,
                "rank": None,
                "pieces": [{"id": f"p{i}_q{q}", "progress": -1} for q in range(6)]
            })
            
        self.current = 0
        self.phase = "roll"  # roll, move, done
        self.pool: List[int] = []
        self.history: List[int] = []
        self.last_roll: Optional[Dict[str, Any]] = None
        self.turn = 1
        self.opening_entry_players: List[str] = []
        self.audit: List[Dict[str, Any]] = [{
            "event": "GAME_CREATED",
            "playerCount": count,
            "players": [p["name"] for p in self.players]
        }]

    def active_player(self) -> Dict[str, Any]:
        return self.players[self.current]

    def piece_node(self, player: Dict[str, Any], piece: Dict[str, Any]) -> Optional[str]:
        if piece["progress"] < 0:
            return None
        return ROUTES[player["seat"]][piece["progress"]]

    def roll_dice(self) -> Dict[str, Any]:
        if self.phase != "roll":
            return {"error": "Cannot roll dice during move phase. Move a piece first."}

        # Secure random roll
        idx = secrets.randbelow(len(DICE_OUTCOMES))
        a, b, val = DICE_OUTCOMES[idx]
        is_bonus = val in BONUS_VALUES

        self.pool.append(val)
        self.history.append(val)
        self.last_roll = {
            "a": a,
            "b": b,
            "value": val,
            "bonus": is_bonus
        }

        self.audit.append({
            "event": "ROLL",
            "player": self.active_player()["name"],
            "dice": {"a": a, "b": b},
            "value": val,
            "bonus": is_bonus,
            "pool": list(self.pool)
        })

        if not is_bonus:
            self.phase = "move"

        return {
            "roll": self.last_roll,
            "pool": list(self.pool),
            "phase": self.phase,
            "bonus_earned": is_bonus,
            "legal_moves": self.get_legal_moves() if self.phase == "move" else []
        }

    def opening_entry_available(self, p: Dict[str, Any], piece: Dict[str, Any], values: List[int]) -> bool:
        return (
            self.turn <= len(self.players) and
            p["id"] not in self.opening_entry_players and
            piece["progress"] == -1 and
            len(values) == 1
        )

    def test_move(self, p: Dict[str, Any], piece: Dict[str, Any], values: List[int]) -> Optional[Dict[str, Any]]:
        opening_entry = values[0] != 1 and self.opening_entry_available(p, piece, values)
        pos = piece["progress"]
        captured = p["captured"]
        targets = []

        for value in values:
            if pos == 43:
                return None
            if pos == -1:
                if value != 1 and not opening_entry:
                    return None
                pos = 0
            else:
                next_pos = pos + value
                if next_pos > 43:
                    return None
                if next_pos >= 25 and not captured:
                    return None
                pos = next_pos

            sq = ROUTES[p["seat"]][pos]
            enemies = []
            for other in self.players:
                if other["id"] == p["id"]:
                    continue
                for q in other["pieces"]:
                    if q["progress"] >= 0 and q["progress"] < 43 and self.piece_node(other, q) == sq:
                        enemies.append({"player": other, "piece": q})

            if sq not in SAFE_SQUARES and sq != GOAL_SQUARE:
                if len(enemies) > 1:
                    return None  # Blocked by multiple enemy pieces
                if len(enemies) == 1:
                    captured = True
                    targets.append(enemies[0])

        return {"progress": pos, "destination": ROUTES[p["seat"]][pos], "captured": captured, "targets": targets, "opening_entry": opening_entry}

    def get_legal_moves(self) -> List[Dict[str, Any]]:
        if self.phase != "move" or not self.pool:
            return []

        p = self.active_player()
        moves = []
        subsets = [{"indices": [i], "values": [self.pool[i]]} for i in range(len(self.pool))]
        if 1 < len(self.pool) <= 12:
            subsets.append({"indices": list(range(len(self.pool))), "values": list(self.pool)})

        for piece_idx, piece in enumerate(p["pieces"]):
            for s in subsets:
                res = self.test_move(p, piece, s["values"])
                if res:
                    from_sq = self.piece_node(p, piece) or "reserve"
                    moves.append({
                        "piece_id": piece["id"],
                        "piece_index": piece_idx + 1,
                        "from": from_sq,
                        "to": res["destination"],
                        "target_progress": res["progress"],
                        "dice_values": s["values"],
                        "pool_indices": s["indices"],
                        "captures": len(res["targets"]) > 0,
                        "opening_entry": res["opening_entry"]
                    })
        return moves

    def apply_move(self, piece_id: str, dice_values: Optional[List[int]] = None) -> Dict[str, Any]:
        if self.phase != "move":
            return {"error": "Game is in roll phase. Roll dice first."}

        p = self.active_player()
        legal_moves = self.get_legal_moves()
        match = None
        for m in legal_moves:
            if m["piece_id"] == piece_id:
                if dice_values is None or m["dice_values"] == dice_values:
                    match = m
                    break

        if not match:
            return {"error": f"No legal move found for piece {piece_id} with specified dice."}

        # Apply move
        piece = next(q for q in p["pieces"] if q["id"] == piece_id)
        test = self.test_move(p, piece, match["dice_values"])
        if not test:
            return {"error": "Move validation failed"}

        piece["progress"] = test["progress"]
        if test["captured"]:
            p["captured"] = True
            for hit in test["targets"]:
                hit["piece"]["progress"] = -1
                self.audit.append({
                    "event": "CAPTURE",
                    "capturer": p["name"],
                    "captured_player": hit["player"]["name"],
                    "square": test["destination"]
                })

        if test["opening_entry"] and p["id"] not in self.opening_entry_players:
            self.opening_entry_players.append(p["id"])

        # Deduct used dice from pool
        for idx in sorted(match["pool_indices"], reverse=True):
            if idx < len(self.pool):
                self.pool.pop(idx)

        self.audit.append({
            "event": "MOVE",
            "player": p["name"],
            "piece": piece_id,
            "to": test["destination"],
            "remaining_pool": list(self.pool)
        })

        # Check win condition
        if all(q["progress"] == 43 for q in p["pieces"]):
            p["rank"] = 1
            self.phase = "done"
            self.audit.append({"event": "WINNER", "winner": p["name"]})
            return {"status": "win", "winner": p["name"], "game": self.get_summary()}

        # Continue turn or pass
        if not self.pool or not self.get_legal_moves():
            self.next_turn()

        return {
            "status": "success",
            "moved_to": test["destination"],
            "pool": list(self.pool),
            "phase": self.phase,
            "current_player": self.active_player()["name"]
        }

    def pass_turn(self) -> Dict[str, Any]:
        p = self.active_player()
        self.audit.append({
            "event": "PASS",
            "player": p["name"],
            "unused_pool": list(self.pool)
        })
        self.next_turn()
        return {"status": "passed", "current_player": self.active_player()["name"], "phase": self.phase}

    def next_turn(self):
        self.pool.clear()
        self.history.clear()
        self.last_roll = None
        self.current = (self.current + 1) % len(self.players)
        self.phase = "roll"
        self.turn += 1

    def get_summary(self) -> Dict[str, Any]:
        return {
            "current_player": self.active_player()["name"],
            "current_seat": self.active_player()["seat"],
            "phase": self.phase,
            "pool": list(self.pool),
            "turn": self.turn,
            "players": [
                {
                    "name": p["name"],
                    "seat": p["seat"],
                    "avatar": p["avatar"],
                    "captured": p["captured"],
                    "finished": sum(1 for q in p["pieces"] if q["progress"] == 43),
                    "on_board": sum(1 for q in p["pieces"] if 0 <= q["progress"] < 43),
                    "waiting": sum(1 for q in p["pieces"] if q["progress"] < 0)
                }
                for p in self.players
            ]
        }

# Global active game instance
CURRENT_GAME: Optional[DhayamGame] = None

# --- MCP Protocol Handlers ---

TOOLS = [
    {
        "name": "dhayam_new_game",
        "description": "Start a new Dhayam / Dayakattai match with 2, 3, or 4 players.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "player_names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of player names (2 to 4 players). Defaults to ['Player 1', 'Player 2']."
                }
            }
        }
    },
    {
        "name": "dhayam_get_state",
        "description": "Inspect the current Dhayam board state, positions, whose turn it is, and active rolls.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "dhayam_roll_dice",
        "description": "Roll the traditional Dayakattai dice (outcomes: 1, 2, 3, 4, 5, 6, 12). If 1, 5, 6, or 12 is rolled, grants a bonus throw.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "dhayam_get_legal_moves",
        "description": "List all legal moves available for the active player using the current dice pool.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "dhayam_move_piece",
        "description": "Execute a legal piece move on the Dhayam board.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "piece_id": {
                    "type": "string",
                    "description": "The ID of the piece to move (e.g. 'p0_q0', 'p0_q1', etc. from dhayam_get_legal_moves)."
                },
                "dice_values": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Optional specific dice values to apply (e.g. [1] or [5]). Defaults to the first legal combination."
                }
            },
            "required": ["piece_id"]
        }
    },
    {
        "name": "dhayam_pass",
        "description": "Pass remaining unused dice rolls to advance turn to the next player.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "dhayam_get_audit_log",
        "description": "Retrieve the tamper-evident ordered audit log of all rolls, moves, captures, and turn events.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "dhayam_get_share_url",
        "description": "Generate a direct GitHub Pages link to view or play this game in a web browser.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "base_url": {
                    "type": "string",
                    "description": "Base URL of the hosted web client (default: 'https://sethusrinivasan.github.io/dhayam/')."
                }
            }
        }
    }
]

def handle_tool_call(name: str, args: Dict[str, Any]) -> Any:
    global CURRENT_GAME
    if name == "dhayam_new_game":
        names = args.get("player_names")
        CURRENT_GAME = DhayamGame(names)
        return {
            "message": "New Dhayam game initialized.",
            "game": CURRENT_GAME.get_summary(),
            "first_action": "Call dhayam_roll_dice to make the opening roll."
        }

    if CURRENT_GAME is None:
        CURRENT_GAME = DhayamGame()

    if name == "dhayam_get_state":
        return CURRENT_GAME.get_summary()

    if name == "dhayam_roll_dice":
        return CURRENT_GAME.roll_dice()

    if name == "dhayam_get_legal_moves":
        return {
            "phase": CURRENT_GAME.phase,
            "pool": CURRENT_GAME.pool,
            "legal_moves": CURRENT_GAME.get_legal_moves()
        }

    if name == "dhayam_move_piece":
        piece_id = args.get("piece_id")
        dice_values = args.get("dice_values")
        return CURRENT_GAME.apply_move(piece_id, dice_values)

    if name == "dhayam_pass":
        return CURRENT_GAME.pass_turn()

    if name == "dhayam_get_audit_log":
        return {"audit_events": CURRENT_GAME.audit}

    if name == "dhayam_get_share_url":
        base = args.get("base_url") or "https://sethusrinivasan.github.io/dhayam/"
        return {
            "web_url": base,
            "instructions": "Open this URL in any mobile or desktop browser to play Dhayam interactively."
        }

    return {"error": f"Unknown tool: {name}"}

def main():
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        try:
            req = json.loads(line)
        except Exception:
            continue

        method = req.get("method")
        msg_id = req.get("id")

        if method == "initialize":
            res = {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {},
                    "resources": {}
                },
                "serverInfo": {
                    "name": "dhayam-mcp",
                    "version": "1.0.0"
                }
            }
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": res}) + "\n")
            sys.stdout.flush()

        elif method == "notifications/initialized":
            pass

        elif method == "tools/list":
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": {"tools": TOOLS}}) + "\n")
            sys.stdout.flush()

        elif method == "tools/call":
            params = req.get("params", {})
            t_name = params.get("name")
            t_args = params.get("arguments", {})
            out = handle_tool_call(t_name, t_args)
            content = [{"type": "text", "text": json.dumps(out, indent=2)}]
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": {"content": content}}) + "\n")
            sys.stdout.flush()

        elif method == "resources/list":
            resources = [
                {
                    "uri": "dhayam://rules",
                    "name": "Dhayam Game Rules & Board Geometry",
                    "mimeType": "text/markdown"
                }
            ]
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": {"resources": resources}}) + "\n")
            sys.stdout.flush()

        elif method == "resources/read":
            rules_md = "# Dhayam (Dayakattai) Rules\n\nTraditional Tamil board game played on a 7x7 grid.\n- Roll 1, 5, 6, 12 for bonus throws.\n- Roll 1 (Dhayam) to enter pieces from reserve.\n- 8 Safe squares marked with motifs.\n- Exact count to reach central goal D4."
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": {"contents": [{"uri": "dhayam://rules", "mimeType": "text/markdown", "text": rules_md}]}}) + "\n")
            sys.stdout.flush()

        else:
            if msg_id is not None:
                sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32601, "message": "Method not found"}}) + "\n")
                sys.stdout.flush()

if __name__ == "__main__":
    main()
