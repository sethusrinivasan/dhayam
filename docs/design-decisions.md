# Design decisions

| Decision                         | Why                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Static hosting                   | The game requires no account, database, or application server.                                                                                   |
| `crypto.getRandomValues` dice    | Browser cryptographic randomness avoids predictable pseudo-random rolls. `% 4` is exact because the 32-bit range divides evenly into four faces. |
| Diminishing bonus chains         | Special dice values remain fair while unusually long turns become progressively less likely.                                                     |
| Numbered pieces and family table | Piece numbers remove ambiguity in stacks; Waiting, On board, and Home make state visible.                                                        |
| Capture animation before removal | The UI names the losing player and piece, animates it away, then returns it to Waiting.                                                          |
| Responsive dice-first layout     | Dice scale up on laptop and tablet screens, while secondary controls compact and the layout becomes single-column on phones.                     |
| Plaintext audit                  | Supports fairness and stuck-game analysis without collecting game data on a server.                                                              |
| First completed set wins         | The first player to finish all six pieces is announced immediately; later turns are disabled.                                                    |
| Match-local player names         | Organizers can rename players without accounts. Names flow through the table, commentary, and audit.                                             |
| Intro preference cookie          | The welcome screen is shown by default; a local cookie only records an opt-out choice.                                                           |
