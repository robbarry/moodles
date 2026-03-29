# Battle Mode Design Spec

## Overview

Battle Mode is a PvP mode where two players compete on a split board. Each player defends their half with towers and walls while sending enemies into their opponent's half. First player to lose all 5 lives loses.

The mode reuses the existing WebRTC multiplayer infrastructure (PeerJS, host-authoritative model) but replaces the cooperative wave system with head-to-head offense/defense gameplay.

## Board Layout

- The board is 20x15, split into two 10-column halves by a **logical seam** between columns 9 and 10. There is no physical wall cell — the seam is a rendering boundary and a hard rule boundary.
- No towers can target enemies across the seam. No enemies can path across it. No effects (projectiles, chain arcs, frost aura) cross it.
- Each half has its own **spawn** and **goal**:
  - Host's half (columns 0–9): spawn on the right edge (column 9), goal on the left edge (column 0). Guest's sent enemies walk right-to-left here.
  - Guest's half (columns 10–19): spawn on the left edge (column 10), goal on the right edge (column 19). Host's sent enemies walk left-to-right here.
- Each side pathfinds independently using its own `Grid` instance, spawn, goal, and cached path. Blocking all paths on your own side follows the same rules as the current game (placement rejected if no valid path exists).
- Players can only place towers and walls on their own half. Territory is enforced: host can only interact with columns 0–9, guest with columns 10–19.

## Win Condition

- Each player starts with 5 lives.
- When an enemy reaches a player's goal, that player loses 1 life.
- First player to reach 0 lives loses. The other player wins.

## Economy: Dual Resource Model

### Coins (Defense)

- Each player starts with 60 coins.
- Coins are spent on towers and walls (same costs as the current game).
- Kill bounties are **50% of solo mode** values:
  - Walker: 1, Sprinter: 1, Sneaker: 2, Tank: 5, Healer: 3
- Tower sell value remains 60% of total investment.
- No Coin Tree in Battle Mode. The building is removed from the build bar.

### Offense Meter (Attack)

A separate resource used exclusively to send enemies into the opponent's half.

**Passive drip:** Starts at 1.5 points/sec, increases at each tier unlock:
- 0:00 — 1.5 pts/sec
- 1:30 — 2.5 pts/sec
- 3:00 — 3.5 pts/sec
- 4:30 — 4.5 pts/sec

**Kill bonus:** +1 offense point per enemy killed.

**Send costs:**
| Enemy    | Cost (pts) | Available |
|----------|-----------|-----------|
| Walker   | 10        | 0:00      |
| Sprinter | 12        | 0:00      |
| Sneaker  | 20        | 1:30      |
| Tank     | 45        | 3:00      |
| Healer   | 35        | 4:30      |

**Wanderer is cut from Battle Mode.** Random pathing doesn't fit a mode where you deliberately choose what pressure to send.

## Send Queue

- Players queue enemies to send via the offense UI. Max **3 slots** in the queue at a time.
- Queued enemies spawn at the opponent's spawn point with **0.5 second spacing** (matches current wave spawner timing).
- Players can continue building towers/walls while sends are queued.
- Sent enemies use the same stats as their solo-mode counterparts (HP, speed, behavior) — no modifications for v1.

## Tier Unlock Timeline

Enemy types unlock on a match clock:

| Time | Unlock | Drip Rate |
|------|--------|-----------|
| 0:00 | Walker, Sprinter | 1.5 pts/sec |
| 1:30 | Sneaker | 2.5 pts/sec |
| 3:00 | Tank | 3.5 pts/sec |
| 4:30 | Healer | 4.5 pts/sec |

This creates natural match phases — early probing with cheap units, mid-game tech pressure with Sneakers, late-game heavy pushes with Tanks and Healers. The drip bump at each unlock ensures escalation even if players don't send aggressively.

## Game Flow

### No Ceasefire

There is no explicit build phase or ceasefire. The match starts immediately:
- Both players begin placing towers/walls with their 60 coins.
- Offense meter starts at 0 and begins filling.
- First Walker send is realistically available at ~7 seconds (10 pts / 1.5 pts/sec).
- This natural ramp gives players time to set up basic defenses without needing a formal build phase.

### Match Phases (Emergent)

1. **Opening (0:00–1:30):** Players establish mazes and probe with Walkers/Sprinters. Low offense meter means light pressure. Defense investment dominates.
2. **Mid-game (1:30–3:00):** Sneakers unlock and drip accelerates. Players must decide between upgrading existing towers or saving coins for new placements. Sneakers test maze quality (they avoid fire zones).
3. **Late-game (3:00+):** Tanks and Healers create serious pressure. Upgraded towers become essential. Offense meter flows fast enough for sustained sends. Matches should resolve in this window.

### Expected Match Length

Target: 3–6 minutes. The escalating drip rate and tier unlocks should prevent stalemates. If both players are evenly matched with mature defenses, the 4:30 Healer unlock + 4.5 pts/sec drip should force resolution.

## UI Changes

### Build Bar Toggle

The bottom build bar gains a **Defense/Offense toggle**:
- **Defense mode** (default): Shows towers and walls, same as current game minus Coin Tree.
- **Offense mode**: Shows available enemy types with their offense meter cost. Locked types are grayed out with unlock time shown. Click to queue a send.
- Toggle via **Tab key** or an on-screen button.

### HUD Additions

- **Offense meter bar**: Displayed near the coin counter. Shows current points and fill rate.
- **Match clock**: Centered at top of screen. Shows elapsed time and next tier unlock.
- **Opponent lives**: Displayed alongside your own lives so you can see the score.
- **Send queue indicator**: Small icons showing queued enemies (0–3 slots).

### Split Board Rendering

- The renderer draws a visible dividing line (or wall) at column 10.
- Each player's half is labeled (P1/P2 or Host/Guest).
- Peer cursor continues to show on the opponent's half (yellow dashed box).

## Multiplayer Model

Battle Mode reuses the existing host-authoritative WebRTC model:

- **Host** runs both sides of the simulation (both grids, both economies, both offense meters).
- **Guest** sends commands: `place`, `sell`, `upgrade`, `send` (new), toggle defense/offense mode.
- Host validates all guest commands against guest's resources **and territory** before applying. Territory check: guest `place`/`sell`/`upgrade` commands must target columns 10–19. Host actions are similarly restricted to columns 0–9.
- State broadcast continues at 10fps via `setInterval`.

### New Command: `send`

```typescript
{ type: 'cmd', cmd: 'send', enemyKind: EnemyKind }
```

Host validates:
1. Enemy kind is unlocked (match clock check)
2. Guest has enough offense meter points
3. Send queue has room (< 3)

If valid, deducts cost from guest's offense meter and adds to guest's send queue (which spawns on host's board).

## GameState Additions

New fields on `GameState`:

```
matchClock: number           // Elapsed time in seconds
hostOffense: number          // Host's offense meter points
guestOffense: number         // Guest's offense meter points
offenseDrip: number          // Current drip rate (pts/sec)
hostSendQueue: SendEntry[]   // Host's queued sends (max 3)
guestSendQueue: SendEntry[]  // Guest's queued sends (max 3)
hostLives: number            // Host's lives (5)
guestLives: number           // Guest's lives (5)
unlockedTiers: EnemyKind[]   // Currently available enemy types
hostGrid: Grid               // Host's half (cols 0–9) with own spawn/goal/path cache
guestGrid: Grid              // Guest's half (cols 10–19) with own spawn/goal/path cache
```

Where `SendEntry` is `{ kind: EnemyKind }`.

**Two-grid model:** In battle mode, the single `grid` field is unused. Instead, `hostGrid` and `guestGrid` each hold an independent `Grid` with its own spawn position, goal position, cached path, locked cells, and tower cost map. Each grid's `findPath()` and `canPlaceAt()` operate only on that half. Enemies carry a `targetSide: 'host' | 'guest'` field indicating which grid they belong to — this determines which goal they path toward, which towers can target them, and who receives the kill bounty and offense bonus.

The existing `lives` field becomes display-only (shows current player's lives), similar to how `coins` works in co-op.

## GamePhase Changes

The existing `GamePhase` enum gets a new value:

```
GamePhase.Battle  // Active battle mode (replaces Build + Wave)
```

Battle Mode doesn't alternate between Build and Wave phases — building and combat happen simultaneously. A single `Battle` phase covers the entire match until someone loses, at which point it transitions to `GamePhase.Lost`.

## What's Cut from Battle Mode

- **Coin Tree tower**: Removed from build bar. Pure defense economy in v1.
- **Wanderer enemy**: Cut. Random pathing doesn't fit deliberate sends.
- **Wave system**: No waves, no wave bonuses, no auto-start toggle.
- **Game speed toggle**: Both players must play at the same speed (1x). Could revisit if both players agree.
- **Score/high score**: Replaced by win/loss. Could add ELO or win streaks later.

## Lobby Flow

The existing lobby gains a fourth option:

1. Solo
2. Host Co-op
3. Join Co-op
4. **Host Battle** / **Join Battle**

Or: Host and Join each get a mode selector (Co-op vs Battle) after connecting.

The simpler approach for v1: two new buttons in the lobby. Host Battle generates a room code, guest joins with the code, and the game starts in Battle Mode instead of Co-op.

## Known Risks and Tuning Levers

| Risk | Mitigation |
|------|-----------|
| Turtle meta (defense too strong) | Increase drip rate, lower send costs |
| Dump meta (constant spam) | Decrease drip rate, raise send costs, lower queue cap |
| Leader snowball | Reduce kill bounties further, cap offense kill bonus |
| Tank timing dominates | Push Tank unlock later (3:30 or 4:00) |
| Stalemate at 5+ minutes | Add sudden-death mechanic (double drip after 5:00) |
| 10-wide grid too cramped | Increase to 12 wide (24x15 total) |

All numbers in this spec are v1 starting points. The design is intentionally conservative — easier to heat up than cool down.
