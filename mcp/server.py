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

START = {"N": "A4", "E": "D7", "S": "G4", "W": "D1"}

SEATS = ["N", "E", "S", "W"]

def build_route(seat: str) -> List[str]:
    start_outer = {"N": 0, "E": 6, "S": 12, "W": 18}[seat]
    outer_loop = [OUTER[(start_outer + i) % len(OUTER)] for i in range(len(OUTER))]
    start_inner = {"N": 0, "E": 12, "S": 8, "W": 4}[seat]
    inner_loop = [INNER[(start_inner + i) % len(INNER)] for i in range(len(INNER))]
    home = APPROACH[seat]
    return outer_loop + [outer_loop[0]] + inner_loop + [inner_loop[0]] + home

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

    def roll_dice(self, secret: str = "") -> Dict[str, Any]:
        if self.phase != "roll":
            return {"error": "Cannot roll dice during move phase. Move a piece first."}

        clean_secret = secret[:8] if isinstance(secret, str) else ""
        secret_hash = 0
        if clean_secret:
            secret_hash = 2166136261
            for character in clean_secret:
                secret_hash ^= ord(character)
                secret_hash = (secret_hash * 16777619) & 0xFFFFFFFF
        # Mix the optional secret into cryptographic entropy without changing
        # the uniform distribution of the outcome list.
        random_value = (secrets.randbits(32) ^ secret_hash) & 0xFFFFFFFF
        idx = random_value % len(DICE_OUTCOMES)
        a, b, val = DICE_OUTCOMES[idx]
        is_bonus = val in BONUS_VALUES

        self.pool.append(val)
        self.history.append(val)
        self.last_roll = {
            "a": a,
            "b": b,
            "value": val,
            "bonus": is_bonus,
            "secret_used": bool(clean_secret)
        }

        self.audit.append({
            "event": "ROLL",
            "player": self.active_player()["name"],
            "dice": {"a": a, "b": b},
            "value": val,
            "bonus": is_bonus,
            "secret_hash": secret_hash if clean_secret else None,
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
                        "piece_number": piece_idx + 1,
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
                    "waiting": sum(1 for q in p["pieces"] if q["progress"] < 0),
                }
                for p in self.players
            ],
        }

    def get_game_summary(self) -> Dict[str, Any]:
        return {
            "format": "dhayam-game-summary-v1",
            "game": {
                "phase": self.phase,
                "turn": self.turn,
                "current_player": self.active_player()["name"],
                "current_seat": self.active_player()["seat"],
                "pool": list(self.pool),
            },
            "players": [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "seat": p["seat"],
                    "captured": p["captured"],
                    "waiting": sum(1 for q in p["pieces"] if q["progress"] < 0),
                    "on_board": sum(1 for q in p["pieces"] if 0 <= q["progress"] < 43),
                    "finished": sum(1 for q in p["pieces"] if q["progress"] == 43),
                    "pieces": [
                        {
                            "piece_id": q["id"],
                            "piece_number": index + 1,
                            "progress": q["progress"],
                            "square": self.piece_node(p, q),
                        }
                        for index, q in enumerate(p["pieces"])
                    ],
                }
                for p in self.players
            ],
            "legal_moves": self.get_legal_moves(),
            "analysis_prompt": "Choose the strongest legal move for the current player. Explain safety, capture, progress, and overcrowding tradeoffs.",
        }

    def get_turn_details(self) -> Dict[str, Any]:
        turns: Dict[int, List[Dict[str, Any]]] = {}
        for event in self.audit:
            turn = int(event.get("turn", 0))
            turns.setdefault(turn, []).append(event)
        return {
            "format": "dhayam-turn-details-v1",
            "game": {
                "phase": self.phase,
                "current_turn": self.turn,
                "current_player": self.active_player()["name"],
            },
            "turns": [
                {
                    "turn": turn,
                    "player": next((event.get("player") for event in events if event.get("player")), None),
                    "events": events,
                }
                for turn, events in sorted(turns.items())
            ],
        }

    def serialize(self) -> Dict[str, Any]:
        return {
            "players": self.players,
            "current": self.current,
            "phase": self.phase,
            "pool": list(self.pool),
            "history": list(self.history),
            "last_roll": self.last_roll,
            "turn": self.turn,
            "opening_entry_players": list(self.opening_entry_players),
            "audit": list(self.audit)
        }

    def evaluate_moves(self, strategy: str = "balanced") -> List[Dict[str, Any]]:
        if self.phase != "move" or not self.pool:
            return []
        p = self.active_player()
        legal = self.get_legal_moves()
        if not legal:
            return []

        # Calculate occupancy map for active player to relieve overcrowding
        occupancy: Dict[str, int] = {}
        for piece in p["pieces"]:
            if 0 <= piece["progress"] < 43:
                sq = self.piece_node(p, piece)
                if sq:
                    occupancy[sq] = occupancy.get(sq, 0) + 1

        start_sq = START[p["seat"]]
        start_crowd = occupancy.get(start_sq, 0)

        scored_moves = []
        capture_weight = 75000 if strategy == "aggressive" else (35000 if strategy == "cautious" else 50000)
        safety_weight = 25000 if strategy == "cautious" else (5000 if strategy == "aggressive" else 12000)

        for m in legal:
            piece = next((q for q in p["pieces"] if q["id"] == m["piece_id"]), None)
            from_sq = self.piece_node(p, piece) if piece and piece["progress"] >= 0 else None
            crowding_at_origin = occupancy.get(from_sq, 1) if from_sq else 0
            will_finish = m["target_progress"] == 43
            will_capture = bool(m["captures"])
            is_entering = not piece or piece["progress"] < 0
            is_safe = m["to"] in SAFE_SQUARES
            tags = []
            score = 0

            if will_finish:
                score += 100000
                tags.append("GOAL_FINISH")
            if will_capture:
                score += capture_weight
                tags.append("CAPTURE")
            if is_safe and not will_finish:
                score += safety_weight
                tags.append("SAFETY_ZONE")
            if crowding_at_origin > 1:
                score += 15000 * crowding_at_origin
                tags.append("RELIEVE_OVERCROWDING")
            if is_entering:
                score += 2500 if start_crowd >= 2 else 8000
                tags.append("ENTER_BOARD")
            else:
                lag_boost = max(0, 43 - (piece["progress"] if piece else 0)) * 20
                score += lag_boost
                if m["target_progress"] >= 25 and (piece["progress"] < 25 if piece else False):
                    score += 10000
                    tags.append("ENTER_INNER_TRACK")

            if len(m.get("pool_indices", [])) > 1:
                score += 1000
                tags.append("COMBINE_DICE")

            score += m["target_progress"]

            explanation = f"Move piece #{m['piece_number']} from {m['from']} to {m['to']} ({'+'.join(map(str, m['dice_values']))})."
            if will_finish:
                explanation += " Reaches central goal to score +100 points!"
            elif will_capture:
                explanation += " Captures opponent piece sending it back to reserve!"
            elif crowding_at_origin > 1:
                explanation += f" Relieves {crowding_at_origin}-piece congestion at {m['from']}."
            elif is_entering:
                explanation += " Enters a fresh piece onto the board."
            elif is_safe:
                explanation += " Lands on safe sanctuary square protected from captures."

            scored_moves.append({
                **m,
                "score": score,
                "tags": tags,
                "explanation": explanation
            })

        scored_moves.sort(key=lambda x: x["score"], reverse=True)
        return scored_moves

    def get_best_move(self, strategy: str = "balanced") -> Optional[Dict[str, Any]]:
        scored = self.evaluate_moves(strategy)
        return scored[0] if scored else None

    def play_ai_turn(self, strategy: str = "balanced") -> Dict[str, Any]:
        if self.phase == "done":
            winner = next((p["name"] for p in self.players if p.get("rank") == 1), None)
            return {"status": "game_complete", "winner": winner, "summary": self.get_summary()}

        p = self.active_player()
        actions = []
        rolls_count = 0

        # 1. Roll phase: keep rolling while bonus throws are earned
        while self.phase == "roll" and rolls_count < 20:
            rolls_count += 1
            roll_res = self.roll_dice()
            actions.append({
                "type": "ROLL",
                "player": p["name"],
                "roll": roll_res.get("roll"),
                "bonus_earned": roll_res.get("bonus_earned"),
                "pool": list(self.pool)
            })
            if self.phase != "roll":
                break

        # 2. Move phase: play legal moves until pool is exhausted or no moves remain
        move_loops = 0
        while self.phase == "move" and self.pool and move_loops < 20:
            move_loops += 1
            best = self.get_best_move(strategy)
            if not best:
                pass_res = self.pass_turn()
                actions.append({
                    "type": "PASS",
                    "player": p["name"],
                    "reason": "NO_LEGAL_MOVES_LEFT",
                    "remaining_pool": pass_res.get("unused_pool")
                })
                break

            move_res = self.apply_move(best["piece_id"], best["dice_values"])
            actions.append({
                "type": "MOVE",
                "player": p["name"],
                "piece_id": best["piece_id"],
                "piece_number": best["piece_number"],
                "from": best["from"],
                "to": best["to"],
                "dice_values": best["dice_values"],
                "score": best["score"],
                "tags": best["tags"],
                "explanation": best["explanation"]
            })

            if move_res.get("status") == "win":
                break

        rolls_desc = ", ".join(str(a["roll"]["value"]) for a in actions if a["type"] == "ROLL" and a.get("roll"))
        moves_desc = [a for a in actions if a["type"] == "MOVE"]
        commentary = f"{p['name']} rolled [{rolls_desc}]."
        if moves_desc:
            details = "; ".join(f"Piece #{m['piece_number']} ({m['from']} → {m['to']})" for m in moves_desc)
            commentary += f" Executed: {details}."
        else:
            commentary += " No moves could be played, turn passed."

        return {
            "status": "success",
            "player": p["name"],
            "seat": p["seat"],
            "strategy": strategy,
            "actions": actions,
            "commentary": commentary,
            "summary": self.get_summary(),
            "state": self.serialize()
        }

    def simulate_ai_match(self, player_names: Optional[List[str]] = None, strategies: Optional[Any] = None, max_turns: int = 150) -> Dict[str, Any]:
        if player_names and len(player_names) >= 2:
            self.__init__(player_names)

        strat_map = {}
        for idx, p in enumerate(self.players):
            if isinstance(strategies, list) and idx < len(strategies):
                strat_map[p["name"]] = strategies[idx]
            elif isinstance(strategies, dict):
                strat_map[p["name"]] = strategies.get(p["name"], "balanced")
            else:
                strat_map[p["name"]] = "balanced"

        turn_logs = []
        turn_count = 0

        while self.phase != "done" and turn_count < max_turns:
            turn_count += 1
            current_active = self.active_player()["name"]
            strategy = strat_map.get(current_active, "balanced")
            turn_res = self.play_ai_turn(strategy)
            turn_logs.append({
                "turn": turn_count,
                "player": current_active,
                "strategy": strategy,
                "commentary": turn_res["commentary"],
                "actions": turn_res["actions"]
            })

        winner = next((p["name"] for p in self.players if p.get("rank") == 1), None)

        statistics = []
        for p in self.players:
            rolls = [a for a in self.audit if a.get("event") == "ROLL" and a.get("player") == p["name"]]
            captures = [a for a in self.audit if a.get("event") == "CAPTURE" and a.get("capturer") == p["name"]]
            moves = [a for a in self.audit if a.get("event") == "MOVE" and a.get("player") == p["name"]]
            statistics.append({
                "name": p["name"],
                "seat": p["seat"],
                "avatar": p["avatar"],
                "winner": winner == p["name"],
                "rank": p.get("rank"),
                "finished_pieces": sum(1 for q in p["pieces"] if q["progress"] == 43),
                "captures_count": len(captures),
                "total_rolls": len(rolls),
                "bonus_rolls_count": sum(1 for r in rolls if r.get("bonus")),
                "total_moves": len(moves)
            })

        return {
            "status": "completed" if winner else "max_turns_reached",
            "winner": winner,
            "total_turns": turn_count,
            "statistics": statistics,
            "recent_highlights": [
                t for t in turn_logs
                if any(a.get("type") == "MOVE" and ("GOAL_FINISH" in a.get("tags", []) or "CAPTURE" in a.get("tags", [])) for a in t.get("actions", []))
            ][-8:],
            "summary": self.get_summary(),
            "state": self.serialize()
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
        "description": "Roll the traditional Dayakattai dice with cryptographic randomness. An optional secret (up to 8 characters) is mixed into entropy without changing probabilities and is never returned.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "secret": {"type": "string", "maxLength": 8, "description": "Optional hidden roll secret."}
            }
        }
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
        "name": "dhayam_get_game_summary",
        "description": "Return an AI-ready snapshot of the current board, player progress, dice pool, and legal candidate moves for choosing the next best move.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "dhayam_get_turn_details",
        "description": "Return ordered turn-by-turn game events grouped by turn for AI analysis, fairness review, and explaining the next move.",
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
    },
    {
        "name": "dhayam_evaluate_moves",
        "description": "Evaluate and rank all legal moves for the active player with tactical heuristic scores, strategic tags (CAPTURE, GOAL_FINISH, RELIEVE_OVERCROWDING, SAFETY_ZONE, ENTER_INNER_TRACK), and natural language explanations. Ideal for LLM pair programming and AI vs AI decision making.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "strategy": {
                    "type": "string",
                    "enum": ["balanced", "aggressive", "cautious"],
                    "description": "AI evaluation strategy weighting. Defaults to 'balanced'."
                }
            }
        }
    },
    {
        "name": "dhayam_play_ai_turn",
        "description": "Execute a complete automated turn for the current AI / computer player. Automatically handles Dayakattai dice rolls (including bonus chains on 1, 5, 6, 12), evaluates and executes the optimal legal moves, captures opponent pieces, and passes when the turn is complete.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "strategy": {
                    "type": "string",
                    "enum": ["balanced", "aggressive", "cautious"],
                    "description": "AI play personality. 'aggressive' prioritizes captures; 'cautious' prioritizes safety zones; 'balanced' optimizes goal progress and overcrowding relief."
                }
            }
        }
    },
    {
        "name": "dhayam_simulate_ai_match",
        "description": "Simulate a complete Computer-to-Computer or AI-to-AI match (2 to 4 players) to conclusion or max turns. Returns the winner, match statistics, capture counts, bonus streaks, turn highlights, and shareable web link.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "player_names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of player/bot names (e.g. ['AlphaBot', 'BetaBot']). Defaults to ['Computer 1', 'Computer 2']."
                },
                "strategies": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["balanced", "aggressive", "cautious"]},
                    "description": "Strategy for each player respectively."
                },
                "max_turns": {
                    "type": "integer",
                    "description": "Maximum turns to simulate before stopping. Defaults to 150."
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
        return CURRENT_GAME.roll_dice(args.get("secret", ""))

    if name == "dhayam_get_legal_moves":
        return {
            "phase": CURRENT_GAME.phase,
            "pool": CURRENT_GAME.pool,
            "legal_moves": CURRENT_GAME.get_legal_moves()
        }

    if name == "dhayam_evaluate_moves":
        strategy = args.get("strategy", "balanced")
        scored = CURRENT_GAME.evaluate_moves(strategy)
        return {
            "current_player": CURRENT_GAME.active_player()["name"],
            "phase": CURRENT_GAME.phase,
            "pool": list(CURRENT_GAME.pool),
            "strategy": strategy,
            "recommended_move": scored[0] if scored else None,
            "scored_moves": scored
        }

    if name == "dhayam_play_ai_turn":
        strategy = args.get("strategy", "balanced")
        return CURRENT_GAME.play_ai_turn(strategy)

    if name == "dhayam_simulate_ai_match":
        player_names = args.get("player_names")
        strategies = args.get("strategies")
        max_turns = args.get("max_turns", 150)
        return CURRENT_GAME.simulate_ai_match(player_names, strategies, max_turns)

    if name == "dhayam_move_piece":
        piece_id = args.get("piece_id")
        dice_values = args.get("dice_values")
        return CURRENT_GAME.apply_move(piece_id, dice_values)

    if name == "dhayam_pass":
        return CURRENT_GAME.pass_turn()

    if name == "dhayam_get_audit_log":
        return {"audit_events": CURRENT_GAME.audit}

    if name == "dhayam_get_game_summary":
        return CURRENT_GAME.get_game_summary()

    if name == "dhayam_get_turn_details":
        return CURRENT_GAME.get_turn_details()

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
