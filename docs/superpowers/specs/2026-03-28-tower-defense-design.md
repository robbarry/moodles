# Moodles: Tower Defense Game Design

## Overview

A quirky/humorous pixel-art tower defense game that runs in the browser. Players place walls and towers on a grid to route and destroy waves of enemies before they reach the goal. Ground enemies pathfind around obstacles but will bash through walls if fully blocked. Flying enemies ignore walls entirely.

**Stack**: TypeScript + HTML5 Canvas + Vite (zero game-framework dependencies)

## Grid & Map

- **Grid size**: 20 columns x 15 rows, 32x32px tiles = 640x480 canvas (scaled up 2x for crisp pixel art = 1280x960 display)
- **Cell types**: Empty, Wall, Tower, Spawn, Goal
- **Spawn**: fixed position(s) along top/left edge
- **Goal**: fixed position along bottom/right edge
- **Pathfinding**: A* recalculated on every wall/tower placement. If no valid path exists for ground enemies, they target the nearest wall to destroy.

## Walls

- Cheap to build (5 coins)
- HP: 100
- Destructible by ground enemies — when destroyed, cell becomes empty, path recalculates
- Block ground enemy movement but not flying enemies
- No attack capability

## Towers (3 types)

| Tower | Cost | Damage | Fire Rate | Range | Special |
|-------|------|--------|-----------|-------|---------|
| Pea Shooter | 15 | 10 | Fast (every 0.5s) | 3 tiles | None |
| Slop Cannon | 30 | 25 | Slow (every 1.5s) | 2 tiles | Splash damage (1 tile radius) |
| Zapper | 40 | 15 | Medium (every 1.0s) | 5 tiles | 2x damage to flying enemies |

- Towers occupy one grid cell and block pathing (indestructible)
- Target nearest enemy in range
- Cannot be placed on spawn/goal cells

## Enemies (2 types)

| Enemy | HP | Speed | Behavior | Coins on Kill |
|-------|-----|-------|----------|---------------|
| Ground (Walker) | 50 | 1 tile/s | Follows A* path; attacks walls if blocked (20 DPS to walls) | 5 |
| Flyer | 30 | 1.5 tiles/s | Ignores walls, beelines to goal | 8 |

- Enemies that reach the goal cost 1 life
- Player starts with 10 lives

## Waves

- 10 waves total for MVP
- Each wave announces for 3 seconds before spawning
- Enemies spawn one at a time with 0.5s spacing
- Wave composition scales: early waves are all walkers, flyers mix in around wave 4, later waves increase count and HP
- Completing wave 10 = win screen
- Losing all lives = game over screen

## Economy

- Starting coins: 50
- Income: coins per kill (see enemy table above)
- Bonus: 10 coins at end of each wave
- Costs: walls (5), towers (15-40)

## UI Layout

```
+--------------------------------------------------+
|  Lives: 10  |  Coins: 50  |  Wave: 1/10  | Start |
+--------------------------------------------------+
|                                                    |
|                   GAME GRID                        |
|                  (640x480)                         |
|                                                    |
+--------------------------------------------------+
|  [Wall] [Pea Shooter] [Slop Cannon] [Zapper]     |
+--------------------------------------------------+
```

- **Top bar**: lives, coins, wave counter, start-wave button
- **Center**: the game grid
- **Bottom bar**: buildable items with cost labels; click to select, click grid to place
- **Hover**: highlight the cell under cursor; show range preview for towers
- Right-click or ESC to deselect

## Game Loop

1. **Build phase**: player places walls/towers freely. Click "Start Wave" to begin.
2. **Wave phase**: enemies spawn and navigate. Player can still build during waves.
3. **Between waves**: brief pause, bonus coins awarded.
4. **Win**: survive all 10 waves.
5. **Lose**: lives reach 0.

## Rendering

- 32x32 pixel art sprites drawn on canvas
- Sprites can be simple programmatic pixel art (no external asset files needed for MVP)
- Grid lines visible in build mode
- Projectiles rendered as small dots/shapes traveling toward targets
- Health bars above enemies
- Damage numbers floating up on hit (optional but fun)

## Project Structure

```
moodles/
  src/
    main.ts          -- entry point, game initialization
    game.ts          -- game loop, state management
    grid.ts          -- grid data structure, cell types
    pathfinding.ts   -- A* implementation
    tower.ts         -- tower types, targeting, firing
    enemy.ts         -- enemy types, movement, wall-attacking
    wall.ts          -- wall entity, HP
    wave.ts          -- wave definitions, spawning logic
    renderer.ts      -- canvas rendering, sprites
    ui.ts            -- HUD, build bar, input handling
    sprites.ts       -- programmatic pixel art generation
    types.ts         -- shared type definitions
  index.html
  package.json
  tsconfig.json
  vite.config.ts
```

## Verification

1. `npm run dev` — opens in browser, grid renders
2. Can place walls and towers on the grid
3. Clicking "Start Wave" spawns enemies that pathfind to the goal
4. Towers fire at enemies in range
5. Walls block ground enemies; flyers ignore walls
6. Fully blocking ground enemies causes them to attack walls
7. Killing enemies awards coins; enemies reaching goal costs lives
8. Surviving 10 waves shows win screen; losing all lives shows game over
