# Moodles

A pixel-art tower defense game that runs in the browser. Built with TypeScript, HTML5 Canvas, and Vite. No game framework -- everything is hand-rolled.

**Play it now:** https://robbarry.github.io/moodles/

## How to Play

Place walls and towers on a grid to shape the enemy path through your kill zones. The path from spawn (green, top-left) to goal (red, bottom-right) is always visible and can never be fully blocked -- you're routing it, not eliminating it.

### Controls

| Input | Action |
|-------|--------|
| Click build bar / 1-7 | Select wall or tower type |
| Click grid | Place selected item |
| Click + drag | Paint walls quickly |
| Click placed tower/wall | Select it (upgrade, sell) |
| Right-click / Esc | Deselect |
| Space | Start next wave |
| 1x / 2x / 3x buttons | Game speed |
| Auto checkbox | Auto-start waves |
| M button | Toggle music |

### Towers

| Tower | Cost | Role |
|-------|------|------|
| Pea Shooter | $15 | Fast single-target damage |
| Slop Cannon | $30 | Splash damage vs clusters |
| Zapper | $40 | Long range single-target |
| Frost | $35 | Slows enemies to 40% speed |
| Chain | $50 | Bounces to 2 nearby enemies |
| Coin Tree | $60 | Generates income each wave |

Each tower has 3 upgradeable stats (range, speed, damage) with 3 levels each. Towers can be sold for 60% of total investment.

### Enemies

| Enemy | Behavior |
|-------|----------|
| Walker | Follows the path |
| Sneaker | Avoids tower fire zones |
| Wanderer | Semi-random movement toward goal |
| Tank | Very slow, massive HP |
| Sprinter | Very fast, low HP |
| Healer | Restores HP to nearby enemies |

### Endless Mode

After wave 10, the game continues with procedurally generated waves that scale infinitely. Score tracks kills, waves survived, and coins earned. High score persists in localStorage.

## Co-op Multiplayer

Two players can play together via WebRTC peer-to-peer (no server needed). Works on the same network or across the internet.

1. Player 1 clicks **Host Co-op** and gets a room code (e.g., `MOODLE-K7WP`)
2. Player 2 clicks **Join Co-op** and enters the code
3. Both players share the board with independent economies
4. Kill rewards go to the tower owner that made the kill
5. Wave bonus goes to both players

Uses PeerJS for signaling. Works on GitHub Pages.

## Development

```bash
npm install
npm run dev      # Start dev server
npm run build    # Type-check + production build
npm run preview  # Preview production build
```

### Project Structure

```
src/
  main.ts          Entry point, lobby UI
  game.ts          Game loop, state, mechanics, multiplayer
  renderer.ts      Canvas rendering, HUD, build bar
  types.ts         Type definitions, tower/enemy stats
  pathfinding.ts   A* with optional cost maps
  grid.ts          Grid data structure
  wave.ts          Wave definitions + endless generator
  sprites.ts       Programmatic pixel art (no asset files)
  audio.ts         Procedural chiptune music + SFX
  effects.ts       Particle system, screen shake
  net.ts           PeerJS WebRTC networking
```

### Tech

- TypeScript + Vite (vanilla, no framework)
- HTML5 Canvas 2D at 640x480 logical, 2x scale
- Web Audio API for all sound (no audio files)
- PeerJS for multiplayer signaling
- GitHub Pages for hosting, GitHub Actions for deploy

## License

Private.
