# Dhayam

Dhayam is a local pass-and-play board-game prototype based on a provisional 7×7 house variant. The route is an original playable reconstruction and has not been historically verified as a traditional Tamil Nadu path.

Play the browser version at <https://sethusrinivasan.github.io/dhayam/>.

## Rules engine

The first production-oriented milestone is a dependency-free TypeScript rules engine in `src/game.ts`. It covers seating, rotational routes, Dayakattai values, entry, ordered roll allocation, the capture prerequisite, safe squares, captures, and exact finishing. The engine uses immutable move application so it can later support an authoritative multiplayer event service.

Run the tests with Node 22.18 or newer:

```sh
npm test
```

The static browser prototype is published from `site/` through GitHub Pages while its UI is migrated to the tested engine.
