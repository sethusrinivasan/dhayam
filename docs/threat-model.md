# Threat model and privacy

Dhayam is a local casual game. It is not an anti-cheat system, competitive multiplayer service, or authoritative tournament record.

| Concern                        | Current treatment                                                                                                  | Limit                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Loaded or predictable dice     | Uses `crypto.getRandomValues`; audit records outcomes and bonus decisions.                                         | Browser developer tools or malicious extensions can change local state.               |
| Bonus-chain fairness           | Every player receives the same diminishing rule; audit includes depth, chance, and draw.                           | This is a house-rule policy, not a claim of historical rules.                         |
| Audit integrity                | Ordered events, timestamps, player IDs, piece numbers, and board snapshots are exported.                           | Browser-generated audits are not signed or tamper-proof.                              |
| Player privacy                 | No account, telemetry, analytics, or game data is sent to an application server.                                   | Copied audits can include player names and moves; users choose whether to share them. |
| Hosted-code integrity          | GitHub Pages serves committed static files over HTTPS.                                                             | Anyone who can change the repository or browser environment can alter the game.       |
| Speech, clipboard, and cookies | Speech is optional, clipboard writes require user action, and the intro cookie stores only a dismissal preference. | Browser and OS support varies.                                                        |

Do not treat a copied audit as proof of fair play. A future authoritative multiplayer version would need signed events, server-side rules evaluation, authenticated players, and an independently verifiable random source.
