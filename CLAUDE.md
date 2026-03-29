# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Moodles is a pixel-art tower defense game (TypeScript + Canvas 2D + Vite). Players place walls and towers on a 20x15 grid to route enemies through kill zones. Supports WebRTC co-op multiplayer via PeerJS. Deployed to GitHub Pages.

## Commands

```bash
npm run dev        # Vite dev server with HMR
npm run build      # tsc --noEmit + vite build → dist/
npm run preview    # Preview production build locally
npx tsc --noEmit   # Type-check only (strict mode, noUnusedLocals)
```

No test framework. Verify by running `npm run build` (type-check + bundle) and manual play.

## Architecture

All game logic lives in `src/`. No framework, no ECS — plain functions and interfaces.

- **game.ts** (~1400 lines) — Central file. Contains `GameState` interface, `Game` class (loop + input + multiplayer), all game mechanics (`placeBuild`, `update`, `startWave`, `sellTower`, `upgradeTower`), state serialization for multiplayer, and the `effects` singleton.
- **renderer.ts** — Canvas 2D rendering. Reads `GameState` and the `effects` singleton. Handles mouse→grid coordinate conversion. Logical resolution 640x480 at 2x scale.
- **types.ts** — All enums (`TowerKind`, `EnemyKind`, `CellType`, `GamePhase`), stat definitions (`TOWER_DEFS`, `ENEMY_DEFS`), economy constants, and the `Projectile` interface.
- **pathfinding.ts** — A* with optional cost map (used by Sneaker enemies to avoid tower fire zones). `findPath()` returns `Position[]` or `null`. `canPlaceAt()` tentatively places and checks path validity.
- **wave.ts** — 10 hand-tuned waves + `generateEndlessWave()` for infinite scaling.
- **net.ts** — PeerJS wrapper. `PeerConnection` class handles host/join flow with room codes.
- **sprites.ts** — Programmatic 32x32 pixel art via offscreen canvas. No image assets.
- **audio.ts** — All sound is Web Audio API oscillators. Multi-section chiptune music with procedural variation.
- **effects.ts** — Particle pool, expanding rings, chain arcs, screen shake. Cosmetic only, not synced in multiplayer.

## Key Patterns

**Multiplayer model:** Host is authoritative. Host runs the game loop and broadcasts serialized state at 10fps via `setInterval` (not rAF, which browsers throttle for background tabs). Guest sends commands (`place`, `sell`, `upgrade`, `startWave`, etc.) that the host validates and applies. Guest commands trigger immediate state broadcast for responsiveness.

**Per-player economy:** `hostCoins`/`guestCoins` are the real balances. `state.coins` is a display-only field set each frame based on role. Use `getCoins(state, owner)`, `addCoins()`, `spendCoins()` — never mutate `state.coins` directly for economic operations.

**Tower/wall ownership:** Every tower and wall has an `owner` field (`'host' | 'guest' | 'solo'`). Players can only select/sell/upgrade their own entities. Guest commands are validated against `owner === 'guest'` before the host applies them.

**Path guarantee:** `placeBuild()` tentatively places, runs A*, and rejects if no path exists. `computeLockedCells()` marks path cells that can't be blocked (shown red on the grid).

**Sprite/enum alignment:** `TOWER_SPRITES[]` and `ENEMY_SPRITES[]` arrays are indexed by enum value. When adding new tower/enemy types, add the enum entry, the def, AND the sprite in matching order.

## Conventions

- No game framework — vanilla Canvas 2D with `requestAnimationFrame`
- All audio is procedural (Web Audio API oscillators + noise buffers), no asset files
- All sprites are programmatic (offscreen canvas), no image assets
- Delta-time based updates for consistent speed across frame rates
- `uv` for Python (if needed), `npm` for JS
- Default branch is `main`, deploy via GitHub Actions to GitHub Pages
- `vite.config.ts` sets `base: '/moodles/'` for Pages path
