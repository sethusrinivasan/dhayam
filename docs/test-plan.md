# Test plan

## Automated checks

```sh
npm test              # Runs 31 unit, regression, and Cloudflare MCP tests
./test.sh             # Full 12-point suite: headless Chrome DOM, edge health, and MCP discovery
npm run test:coverage
```

The GitHub Actions workflow runs the test suite on every push, pull request, and manual dispatch.

### Test Suites Included:
1. **`test/game.test.ts` (13 tests)**:
   - Seating arrangements, 44-position rotational routes, Dayakattai dice face mapping (0+0 = 12).
   - Reserve piece entry on 1, inner circuit capture prerequisites, safe squares, illegal multi-opponent landings, exact-roll finish, combined-roll allocation, and forged move rejection.

2. **`test/multiplayer_regression.test.ts` (9 tests)**:
   - Piece ID normalization (`matchPieceId`) across client (`P0-0`) and Cloudflare Worker (`p0_q0`) conventions.
   - Acceptance of worker-formatted piece IDs in `applyMove`.
   - Dice value normalization guarding against `null` and `undefined` in `pool` and `history`.
   - Diminishing bonus decision logic on special rolls (1, 5, 6, 12).
   - Client animation state buffering (`pendingRemoteState`) preventing race conditions during 3D tumbling and piece movement.
   - Error event recovery resetting `rolling` and `moving` flags.
   - Opening Entry Allowance on Turn 1 with non-1 roll (e.g. 5).
   - Authoritative dice accumulation without duplicate inserts.
   - Automatic turn passing on 0 legal moves.

3. **`test/mcp_server.test.ts` (9 tests)**:
   - Live Cloudflare Edge health check (`GET /health`).
   - MCP service discovery (`GET /mcp`) and CORS preflight (`OPTIONS /mcp`).
   - JSON-RPC 2.0 handshake (`initialize`, `notifications/initialized`).
   - Tool catalog validation (`tools/list` with 8 tools) and documentation resources (`resources/list`).
   - Full tool execution loop (`dhayam_new_game`, `dhayam_roll_dice`, `dhayam_get_state`, `dhayam_get_legal_moves`, `dhayam_get_audit_log`, `dhayam_get_share_url`).
   - JSON-RPC error handling for method not found (`-32601`) and parse error (`-32700`).

## Browser acceptance pass

1. Roll and move a legal piece; confirm every square is visibly traversed.
2. Capture an opponent; confirm the named numbered piece animates away and moves from On board to Waiting.
3. Finish a sixth piece; confirm the winner is announced and no further turn is available.
4. Run the guided demo at 0.5×, 1×, 2×, and Super speed; confirm Super speed disables audio while preserving readable movement.
5. Copy an audit and inspect rolls, bonus-chain fields, move source, captures, passes, player-name change, and winner events.
6. Run a solo match with a computer player and confirm computer turns wait for animation and narration.
7. Rename a player; confirm the family table, color legend, commentary, and audit use the updated name.
8. Clear the `dhayam_intro_seen` cookie and confirm the splash returns; select its opt-out checkbox and confirm it stays hidden after reload.
9. Check 1440px, 1024px, 768px, and 390px widths for visible dice, usable controls, and no horizontal page overflow.
