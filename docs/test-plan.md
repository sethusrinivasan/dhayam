# Test plan

## Automated checks

```sh
npm test
npm run test:coverage
```

The GitHub Actions workflow runs both commands on every push, pull request, and manual dispatch.

The Node suite covers seating, rotational routes, face-to-value mapping, entry, capture prerequisites, safe squares, illegal multi-opponent landings, immutable capture application, exact finishing, combined-roll allocation, forged move rejection, and capture-driven entry to the inner track.

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
