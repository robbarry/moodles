import {
  COLS, ROWS, TILE,
  CellType, TowerKind, EnemyKind,
  TOWER_DEFS, ENEMY_DEFS,
  STARTING_COINS, STARTING_LIVES, WALL_COST, WAVE_BONUS,
  GamePhase, Projectile, Position,
} from './types';
import { Grid } from './grid';
import { findPath, findNearestWall, CostMap } from './pathfinding';
import { WAVES } from './wave';
import { Renderer } from './renderer';
import {
  sfxShoot, sfxSlopShoot, sfxZapShoot, sfxPlace, sfxSell, sfxUpgrade,
  sfxEnemyDeath, sfxWallBreak, sfxWaveStart, sfxLifeLost, sfxWin, sfxLose,
  startMusic, toggleMusic,
} from './audio';

// ── Entity types ──

export interface WallEntity {
  col: number;
  row: number;
  hp: number;
  maxHp: number;
}

export const MAX_UPGRADE = 3;

export type UpgradeStat = 'range' | 'speed' | 'damage';

// Cost multiplier per level: level 1 = 1x base, level 2 = 1.5x, level 3 = 2x
export function upgradeCost(tower: TowerEntity, stat: UpgradeStat): number {
  const level = stat === 'range' ? tower.rangeLevel
    : stat === 'speed' ? tower.speedLevel
    : tower.damageLevel;
  if (level >= MAX_UPGRADE) return Infinity;
  const base = TOWER_DEFS[tower.kind].cost;
  return Math.round(base * (0.5 + level * 0.5));
}

export function towerRange(tower: TowerEntity): number {
  const base = TOWER_DEFS[tower.kind].range;
  return base + tower.rangeLevel * 0.6;
}

export function towerFireRate(tower: TowerEntity): number {
  const base = TOWER_DEFS[tower.kind].fireRate;
  return base * Math.pow(0.75, tower.speedLevel);
}

export function towerDamage(tower: TowerEntity): number {
  const base = TOWER_DEFS[tower.kind].damage;
  return Math.round(base * (1 + tower.damageLevel * 0.35));
}

/** Total coins invested in a tower (base + all upgrades) */
export function towerTotalInvested(tower: TowerEntity): number {
  const base = TOWER_DEFS[tower.kind].cost;
  let total = base;
  for (let i = 0; i < tower.rangeLevel; i++) total += Math.round(base * (0.5 + i * 0.5));
  for (let i = 0; i < tower.speedLevel; i++) total += Math.round(base * (0.5 + i * 0.5));
  for (let i = 0; i < tower.damageLevel; i++) total += Math.round(base * (0.5 + i * 0.5));
  return total;
}

export function sellValue(tower: TowerEntity): number {
  return Math.floor(towerTotalInvested(tower) * 0.6);
}

export interface TowerEntity {
  col: number;
  row: number;
  kind: TowerKind;
  cooldown: number;
  rangeLevel: number;
  speedLevel: number;
  damageLevel: number;
  hp: number;
  maxHp: number;
}

export function towerMaxHp(kind: TowerKind): number {
  return TOWER_DEFS[kind].cost * 10;
}

export interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  x: number;     // pixel position (center)
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  path: Position[];
  pathIndex: number;
  wallTarget: Position | null;
  towerTarget: TowerEntity | null;
  reward: number;
  wallDps: number;
  wanderAngle: number;  // for Wanderer's semi-random movement
  attackTimer: number;  // seconds remaining to attack current target
}

export interface FloatingDamage {
  x: number;
  y: number;
  amount: number;
  age: number;
  lifetime: number;
}

// ── Game state ──

export interface GameState {
  grid: Grid;
  walls: WallEntity[];
  towers: TowerEntity[];
  enemies: EnemyEntity[];
  projectiles: Projectile[];
  floatingDamage: FloatingDamage[];

  coins: number;
  lives: number;
  phase: GamePhase;
  currentWave: number;
  totalWaves: number;
  waveCountdown: number;

  // Spawning state
  spawnQueue: { kind: EnemyKind; hpMult: number }[];
  spawnTimer: number;

  // UI state
  selectedBuild: 'wall' | TowerKind | null;
  selectedTower: TowerEntity | null;
  hoverCol: number;
  hoverRow: number;
  autoStart: boolean;
  gameSpeed: number;  // 1, 2, or 3
  musicOn: boolean;
  audioInitialized: boolean;
  mouseDown: boolean;

  // Path cache (recalculated on build)
  cachedPath: Position[] | null;

  // Cost map for sneaker tower avoidance
  towerCostMap: CostMap;
}

let nextEnemyId = 0;

export function createGameState(): GameState {
  return {
    grid: new Grid(),
    walls: [],
    towers: [],
    enemies: [],
    projectiles: [],
    floatingDamage: [],
    coins: STARTING_COINS,
    lives: STARTING_LIVES,
    phase: GamePhase.Build,
    currentWave: 1,
    totalWaves: WAVES.length,
    waveCountdown: 0,
    spawnQueue: [],
    spawnTimer: 0,
    selectedBuild: null,
    selectedTower: null,
    hoverCol: -1,
    hoverRow: -1,
    autoStart: false,
    gameSpeed: 1,
    musicOn: false,
    audioInitialized: false,
    mouseDown: false,
    cachedPath: null,
    towerCostMap: buildTowerCostMap([]),
  };
}

// ── Tower cost map for sneaker avoidance ──

function buildTowerCostMap(towers: TowerEntity[]): CostMap {
  const map: CostMap = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 0)
  );
  for (const tower of towers) {
    const effectiveRange = towerRange(tower);
    const rangeInt = Math.ceil(effectiveRange);
    for (let dr = -rangeInt; dr <= rangeInt; dr++) {
      for (let dc = -rangeInt; dc <= rangeInt; dc++) {
        const r = tower.row + dr;
        const c = tower.col + dc;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        const dist = Math.sqrt(dc * dc + dr * dr);
        if (dist <= effectiveRange) {
          // Higher cost closer to tower, scaled by tower damage
          const dangerWeight = (1 - dist / towerRange(tower)) * (towerDamage(tower) / towerFireRate(tower));
          const row = map[r];
          if (row) row[c] = (row[c] ?? 0) + dangerWeight;
        }
      }
    }
  }
  return map;
}

// ── Building ──

function recalcPath(state: GameState): void {
  state.cachedPath = findPath(state.grid, state.grid.spawn, state.grid.goal);
  state.towerCostMap = buildTowerCostMap(state.towers);
}

export function placeBuild(state: GameState, col: number, row: number): boolean {
  if (!state.grid.canPlace(col, row)) return false;
  if (state.selectedBuild === null) return false;

  if (state.selectedBuild === 'wall') {
    if (state.coins < WALL_COST) return false;
    state.coins -= WALL_COST;
    state.grid.setCell(col, row, CellType.Wall);
    state.walls.push({ col, row, hp: 100, maxHp: 100 });
  } else {
    const def = TOWER_DEFS[state.selectedBuild];
    if (state.coins < def.cost) return false;
    state.coins -= def.cost;
    state.grid.setCell(col, row, CellType.Tower);
    const hp = towerMaxHp(state.selectedBuild);
    state.towers.push({ col, row, kind: state.selectedBuild, cooldown: 0, rangeLevel: 0, speedLevel: 0, damageLevel: 0, hp, maxHp: hp });
  }

  recalcPath(state);

  // Recalc paths for all ground enemies
  for (const enemy of state.enemies) {
    if (enemy.kind === EnemyKind.Walker || enemy.kind === EnemyKind.Sneaker) {
      recalcEnemyPath(state, enemy);
    }
  }

  sfxPlace();
  return true;
}

// ── Upgrades ──

export function upgradeTower(state: GameState, tower: TowerEntity, stat: UpgradeStat): boolean {
  const cost = upgradeCost(tower, stat);
  if (cost === Infinity || state.coins < cost) return false;
  state.coins -= cost;
  if (stat === 'range') {
    tower.rangeLevel++;
    // Recalc sneaker cost map since tower range changed
    recalcPath(state);
    for (const enemy of state.enemies) {
      if (enemy.kind === EnemyKind.Sneaker) {
        recalcEnemyPath(state, enemy);
      }
    }
  } else if (stat === 'speed') {
    tower.speedLevel++;
  } else {
    tower.damageLevel++;
    // Recalc sneaker cost map since tower danger changed
    recalcPath(state);
    for (const enemy of state.enemies) {
      if (enemy.kind === EnemyKind.Sneaker) {
        recalcEnemyPath(state, enemy);
      }
    }
  }
  sfxUpgrade();
  return true;
}

export function sellTower(state: GameState, tower: TowerEntity): void {
  sfxSell();
  state.coins += sellValue(tower);
  state.grid.setCell(tower.col, tower.row, CellType.Empty);
  state.towers = state.towers.filter((t) => t !== tower);
  state.selectedTower = null;
  recalcPath(state);
  for (const enemy of state.enemies) {
    if (enemy.kind !== EnemyKind.Flyer) {
      recalcEnemyPath(state, enemy);
    }
  }
}

// ── Wave management ──

export function startWave(state: GameState): void {
  if (state.phase !== GamePhase.Build) return;
  const waveDef = WAVES[state.currentWave - 1];
  if (!waveDef) return;

  state.spawnQueue = [];
  for (const entry of waveDef.entries) {
    for (let i = 0; i < entry.count; i++) {
      state.spawnQueue.push({ kind: entry.kind, hpMult: entry.hpMultiplier });
    }
  }
  // Shuffle to mix enemy types
  for (let i = state.spawnQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j]!, state.spawnQueue[i]!];
  }

  state.waveCountdown = 3;
  sfxWaveStart();
  state.phase = GamePhase.Wave;
}

function spawnEnemy(state: GameState, kind: EnemyKind, hpMult: number): void {
  const def = ENEMY_DEFS[kind];
  const spawn = state.grid.spawn;
  const hp = Math.round(def.baseHp * hpMult);

  const enemy: EnemyEntity = {
    id: nextEnemyId++,
    kind,
    x: spawn.col * TILE + TILE / 2,
    y: spawn.row * TILE + TILE / 2,
    hp,
    maxHp: hp,
    speed: def.speed,
    path: [],
    pathIndex: 0,
    wallTarget: null,
    towerTarget: null,
    reward: def.reward,
    wallDps: def.wallDps,
    wanderAngle: Math.random() * Math.PI * 2,
    attackTimer: 0,
  };

  if (kind !== EnemyKind.Flyer) {
    recalcEnemyPath(state, enemy);
  }

  state.enemies.push(enemy);
}

function recalcEnemyPath(state: GameState, enemy: EnemyEntity): void {
  const currentTile: Position = {
    col: Math.floor(enemy.x / TILE),
    row: Math.floor(enemy.y / TILE),
  };
  // Sneakers use the tower cost map to avoid dangerous areas
  const costMap = enemy.kind === EnemyKind.Sneaker ? state.towerCostMap : undefined;
  const path = findPath(state.grid, currentTile, state.grid.goal, costMap);
  if (path) {
    enemy.path = path;
    enemy.pathIndex = 0;
    enemy.wallTarget = null;
    enemy.towerTarget = null;
  } else {
    enemy.path = [];
    // Find nearest wall or tower to attack
    const nearestWall = findNearestWall(state.grid, currentTile);
    const nearestTower = findNearestTower(state, currentTile);
    // Attack whichever is closer
    const wallDist = nearestWall ? Math.abs(nearestWall.col - currentTile.col) + Math.abs(nearestWall.row - currentTile.row) : Infinity;
    const towerDist = nearestTower ? Math.abs(nearestTower.col - currentTile.col) + Math.abs(nearestTower.row - currentTile.row) : Infinity;
    if (towerDist < wallDist && nearestTower) {
      enemy.towerTarget = nearestTower;
      enemy.wallTarget = null;
    } else {
      enemy.wallTarget = nearestWall;
      enemy.towerTarget = null;
    }
  }
}

function findNearestTower(state: GameState, from: Position): TowerEntity | null {
  let best: TowerEntity | null = null;
  let bestDist = Infinity;
  for (const tower of state.towers) {
    const dist = Math.abs(tower.col - from.col) + Math.abs(tower.row - from.row);
    if (dist < bestDist) {
      bestDist = dist;
      best = tower;
    }
  }
  return best;
}

// ── Update loop ──

export function update(state: GameState, dt: number): void {
  if (state.phase === GamePhase.Won || state.phase === GamePhase.Lost) return;

  // Wave countdown
  if (state.waveCountdown > 0) {
    state.waveCountdown -= dt;
    if (state.waveCountdown <= 0) {
      state.waveCountdown = 0;
    }
    return;
  }

  // Spawn enemies
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const next = state.spawnQueue.shift()!;
      spawnEnemy(state, next.kind, next.hpMult);
      state.spawnTimer = 0.5;
    }
  }

  // Update enemies
  updateEnemies(state, dt);

  // Update towers
  updateTowers(state, dt);

  // Update projectiles
  updateProjectiles(state, dt);

  // Update floating damage
  state.floatingDamage = state.floatingDamage.filter((d) => {
    d.age += dt;
    return d.age < d.lifetime;
  });

  // Check wave complete
  if (
    state.phase === GamePhase.Wave &&
    state.spawnQueue.length === 0 &&
    state.enemies.length === 0
  ) {
    if (state.currentWave >= state.totalWaves) {
      state.phase = GamePhase.Won;
      sfxWin();
    } else {
      state.coins += WAVE_BONUS;
      state.currentWave++;
      state.phase = GamePhase.Build;
      if (state.autoStart) {
        startWave(state);
      }
    }
  }

  // Check loss
  if (state.lives <= 0) {
    state.lives = 0;
    state.phase = GamePhase.Lost;
    sfxLose();
  }
}

function updateEnemies(state: GameState, dt: number): void {
  const toRemove: number[] = [];

  for (const enemy of state.enemies) {
    if (enemy.kind === EnemyKind.Flyer) {
      // Flyers beeline to goal
      const goalX = state.grid.goal.col * TILE + TILE / 2;
      const goalY = state.grid.goal.row * TILE + TILE / 2;
      const dx = goalX - enemy.x;
      const dy = goalY - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        state.lives--;
        sfxLifeLost();
        toRemove.push(enemy.id);
        continue;
      }

      const move = enemy.speed * TILE * dt;
      enemy.x += (dx / dist) * move;
      enemy.y += (dy / dist) * move;
    } else if (enemy.kind === EnemyKind.Wanderer) {
      // Wanderer: semi-random movement biased toward goal
      updateWanderer(state, enemy, dt, toRemove);
    } else {
      // Walker/Sneaker — follow path, attack walls or towers if blocked
      if (enemy.towerTarget) {
        // Move toward tower and attack it
        const tower = enemy.towerTarget;
        // Check tower still exists
        if (!state.towers.includes(tower)) {
          enemy.towerTarget = null;
          recalcEnemyPath(state, enemy);
          continue;
        }
        const tx = tower.col * TILE + TILE / 2;
        const ty = tower.row * TILE + TILE / 2;
        const dx = tx - enemy.x;
        const dy = ty - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < TILE) {
          tower.hp -= enemy.wallDps * dt;
          if (tower.hp <= 0) {
            destroyTower(state, tower);
          }
        } else {
          const move = enemy.speed * TILE * dt;
          enemy.x += (dx / dist) * move;
          enemy.y += (dy / dist) * move;
        }
      } else if (enemy.wallTarget) {
        // Move toward wall and attack it
        const wx = enemy.wallTarget.col * TILE + TILE / 2;
        const wy = enemy.wallTarget.row * TILE + TILE / 2;
        const dx = wx - enemy.x;
        const dy = wy - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < TILE) {
          const wall = state.walls.find(
            (w) => w.col === enemy.wallTarget!.col && w.row === enemy.wallTarget!.row
          );
          if (wall) {
            wall.hp -= enemy.wallDps * dt;
            if (wall.hp <= 0) {
              sfxWallBreak();
              destroyWall(state, wall);
              for (const e of state.enemies) {
                if (e.kind !== EnemyKind.Flyer) {
                  recalcEnemyPath(state, e);
                }
              }
            }
          } else {
            recalcEnemyPath(state, enemy);
          }
        } else {
          const move = enemy.speed * TILE * dt;
          enemy.x += (dx / dist) * move;
          enemy.y += (dy / dist) * move;
        }
      } else if (enemy.path.length > 0) {
        const target = enemy.path[enemy.pathIndex];
        if (!target) {
          state.lives--;
          sfxLifeLost();
          toRemove.push(enemy.id);
          continue;
        }

        const tx = target.col * TILE + TILE / 2;
        const ty = target.row * TILE + TILE / 2;
        const dx = tx - enemy.x;
        const dy = ty - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2) {
          enemy.pathIndex++;
          if (enemy.pathIndex >= enemy.path.length) {
            state.lives--;
            sfxLifeLost();
            toRemove.push(enemy.id);
            continue;
          }
        } else {
          const move = enemy.speed * TILE * dt;
          enemy.x += (dx / dist) * move;
          enemy.y += (dy / dist) * move;
        }
      } else {
        recalcEnemyPath(state, enemy);
      }
    }
  }

  state.enemies = state.enemies.filter((e) => !toRemove.includes(e.id));
}

const WANDERER_ATTACK_DURATION = 2.5; // seconds to lock onto a target

function updateWanderer(state: GameState, enemy: EnemyEntity, dt: number, toRemove: number[]): void {
  const goalX = state.grid.goal.col * TILE + TILE / 2;
  const goalY = state.grid.goal.row * TILE + TILE / 2;
  const dx = goalX - enemy.x;
  const dy = goalY - enemy.y;
  const goalDist = Math.sqrt(dx * dx + dy * dy);

  // Reached goal?
  if (goalDist < TILE / 2) {
    state.lives--;
    sfxLifeLost();
    toRemove.push(enemy.id);
    return;
  }

  // If locked onto a wall target, keep attacking it
  if (enemy.wallTarget && enemy.attackTimer > 0) {
    const wall = state.walls.find(
      (w) => w.col === enemy.wallTarget!.col && w.row === enemy.wallTarget!.row
    );
    if (wall) {
      // Move toward the wall
      const wx = wall.col * TILE + TILE / 2;
      const wy = wall.row * TILE + TILE / 2;
      const wdx = wx - enemy.x;
      const wdy = wy - enemy.y;
      const wdist = Math.sqrt(wdx * wdx + wdy * wdy);
      if (wdist > TILE) {
        const move = enemy.speed * TILE * dt;
        enemy.x += (wdx / wdist) * move;
        enemy.y += (wdy / wdist) * move;
      } else {
        // In range — deal damage
        wall.hp -= enemy.wallDps * dt;
        if (wall.hp <= 0) {
          sfxWallBreak();
          destroyWall(state, wall);
          for (const e of state.enemies) {
            if (e.kind !== EnemyKind.Flyer) recalcEnemyPath(state, e);
          }
          enemy.wallTarget = null;
          enemy.attackTimer = 0;
        }
      }
      enemy.attackTimer -= dt;
      return;
    }
    // Wall gone
    enemy.wallTarget = null;
    enemy.attackTimer = 0;
  }

  // If locked onto a tower target, keep attacking it
  if (enemy.towerTarget && enemy.attackTimer > 0) {
    const tower = enemy.towerTarget;
    if (!state.towers.includes(tower)) {
      enemy.towerTarget = null;
      enemy.attackTimer = 0;
    } else {
      const tx = tower.col * TILE + TILE / 2;
      const ty = tower.row * TILE + TILE / 2;
      const tdx = tx - enemy.x;
      const tdy = ty - enemy.y;
      const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
      if (tdist > TILE) {
        const move = enemy.speed * TILE * dt;
        enemy.x += (tdx / tdist) * move;
        enemy.y += (tdy / tdist) * move;
      } else {
        tower.hp -= enemy.wallDps * dt;
        if (tower.hp <= 0) {
          destroyTower(state, tower);
          enemy.towerTarget = null;
          enemy.attackTimer = 0;
        }
      }
      enemy.attackTimer -= dt;
      return;
    }
  }

  // Wander: bias toward goal with random drift
  const goalAngle = Math.atan2(dy, dx);
  enemy.wanderAngle += (Math.random() - 0.5) * 2.5 * dt;
  const angle = goalAngle * 0.6 + enemy.wanderAngle * 0.4;

  const move = enemy.speed * TILE * dt;
  let nx = enemy.x + Math.cos(angle) * move;
  let ny = enemy.y + Math.sin(angle) * move;

  const half = TILE / 2;
  nx = Math.max(half, Math.min(COLS * TILE - half, nx));
  ny = Math.max(half, Math.min(ROWS * TILE - half, ny));

  const destCol = Math.floor(nx / TILE);
  const destRow = Math.floor(ny / TILE);
  const destCell = state.grid.getCell(destCol, destRow);

  if (destCell === CellType.Wall) {
    // Lock onto this wall and attack it
    enemy.wallTarget = { col: destCol, row: destRow };
    enemy.towerTarget = null;
    enemy.attackTimer = WANDERER_ATTACK_DURATION;
  } else if (destCell === CellType.Tower) {
    // Lock onto this tower and attack it
    const tower = state.towers.find((t) => t.col === destCol && t.row === destRow);
    if (tower) {
      enemy.towerTarget = tower;
      enemy.wallTarget = null;
      enemy.attackTimer = WANDERER_ATTACK_DURATION;
    }
  } else {
    enemy.x = nx;
    enemy.y = ny;
  }
}

function destroyWall(state: GameState, wall: WallEntity): void {
  state.grid.setCell(wall.col, wall.row, CellType.Empty);
  state.walls = state.walls.filter((w) => w !== wall);
  recalcPath(state);
}

function destroyTower(state: GameState, tower: TowerEntity): void {
  sfxWallBreak(); // reuse the crunch sound
  state.grid.setCell(tower.col, tower.row, CellType.Empty);
  state.towers = state.towers.filter((t) => t !== tower);
  if (state.selectedTower === tower) state.selectedTower = null;
  // Clear any enemies targeting this tower
  for (const enemy of state.enemies) {
    if (enemy.towerTarget === tower) {
      enemy.towerTarget = null;
    }
  }
  recalcPath(state);
  for (const enemy of state.enemies) {
    if (enemy.kind !== EnemyKind.Flyer) {
      recalcEnemyPath(state, enemy);
    }
  }
}

function updateTowers(state: GameState, dt: number): void {
  for (const tower of state.towers) {
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;

    const def = TOWER_DEFS[tower.kind];
    const cx = tower.col * TILE + TILE / 2;
    const cy = tower.row * TILE + TILE / 2;
    const rangePixels = towerRange(tower) * TILE;

    // Find nearest enemy in range
    let nearest: EnemyEntity | null = null;
    let nearestDist = Infinity;

    for (const enemy of state.enemies) {
      const dx = enemy.x - cx;
      const dy = enemy.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= rangePixels && dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    if (nearest) {
      tower.cooldown = towerFireRate(tower);

      // Shoot sfx
      if (tower.kind === TowerKind.SlopCannon) sfxSlopShoot();
      else if (tower.kind === TowerKind.Zapper) sfxZapShoot();
      else sfxShoot();

      // Calculate damage (with flyer bonus)
      let damage = towerDamage(tower);
      if (nearest.kind === EnemyKind.Flyer) {
        damage = Math.round(damage * def.flyerBonus);
      }

      state.projectiles.push({
        x: cx,
        y: cy,
        targetId: nearest.id,
        damage,
        splash: def.splash,
        speed: 300,
        color: def.color,
      });
    }
  }
}

function updateProjectiles(state: GameState, dt: number): void {
  const toRemove: number[] = [];

  for (let i = 0; i < state.projectiles.length; i++) {
    const proj = state.projectiles[i]!;
    const target = state.enemies.find((e) => e.id === proj.targetId);

    if (!target) {
      toRemove.push(i);
      continue;
    }

    const dx = target.x - proj.x;
    const dy = target.y - proj.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 6) {
      // Hit!
      if (proj.splash > 0) {
        // Splash damage
        const splashPixels = proj.splash * TILE;
        for (const enemy of state.enemies) {
          const edx = enemy.x - target.x;
          const edy = enemy.y - target.y;
          const edist = Math.sqrt(edx * edx + edy * edy);
          if (edist <= splashPixels) {
            damageEnemy(state, enemy, proj.damage);
          }
        }
      } else {
        damageEnemy(state, target, proj.damage);
      }
      toRemove.push(i);
    } else {
      const move = proj.speed * dt;
      proj.x += (dx / dist) * move;
      proj.y += (dy / dist) * move;
    }
  }

  // Remove hit projectiles (reverse order to preserve indices)
  for (let i = toRemove.length - 1; i >= 0; i--) {
    state.projectiles.splice(toRemove[i]!, 1);
  }
}

function damageEnemy(state: GameState, enemy: EnemyEntity, damage: number): void {
  enemy.hp -= damage;

  state.floatingDamage.push({
    x: enemy.x,
    y: enemy.y,
    amount: damage,
    age: 0,
    lifetime: 0.8,
  });

  if (enemy.hp <= 0) {
    state.coins += enemy.reward;
    sfxEnemyDeath();
    state.enemies = state.enemies.filter((e) => e.id !== enemy.id);
    // Also remove projectiles targeting this enemy
    state.projectiles = state.projectiles.filter((p) => p.targetId !== enemy.id);
  }
}

// ── Main game controller ──

export class Game {
  state: GameState;
  renderer: Renderer;
  lastTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.state = createGameState();
    this.renderer = new Renderer(canvas);
    recalcPath(this.state);
    this.setupInput(canvas);
  }

  start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(time: number): void {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1) * this.state.gameSpeed;
    this.lastTime = time;

    update(this.state, dt);
    this.renderer.draw(this.state);

    requestAnimationFrame((t) => this.loop(t));
  }

  private setupInput(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('mousemove', (e) => {
      const { col, row, inGrid } = this.renderer.mouseToGrid(e);
      if (inGrid) {
        this.state.hoverCol = col;
        this.state.hoverRow = row;
        // Drag-to-place walls
        if (this.state.mouseDown && this.state.selectedBuild === 'wall') {
          placeBuild(this.state, col, row);
        }
      } else {
        this.state.hoverCol = -1;
        this.state.hoverRow = -1;
      }
    });

    canvas.addEventListener('mousedown', () => {
      this.state.mouseDown = true;
    });
    canvas.addEventListener('mouseup', () => {
      this.state.mouseDown = false;
    });
    canvas.addEventListener('mouseleave', () => {
      this.state.mouseDown = false;
    });

    canvas.addEventListener('click', (e) => {
      // Start music on first interaction
      if (!this.state.audioInitialized) {
        this.state.audioInitialized = true;
        startMusic();
        this.state.musicOn = true;
      }

      // Check music toggle
      if (this.renderer.mouseToMusicBtn(e)) {
        this.state.musicOn = toggleMusic();
        return;
      }

      // Check for restart on game-over/win
      if (this.state.phase === GamePhase.Won || this.state.phase === GamePhase.Lost) {
        this.state = createGameState();
        recalcPath(this.state);
        return;
      }

      // Check speed buttons
      const spd = this.renderer.mouseToSpeedBtn(e);
      if (spd > 0) {
        this.state.gameSpeed = spd;
        return;
      }

      // Check auto-start checkbox
      if (this.renderer.mouseToAutoStart(e)) {
        this.state.autoStart = !this.state.autoStart;
        return;
      }

      // Check start button
      if (this.renderer.mouseToStartBtn(e)) {
        startWave(this.state);
        return;
      }

      // If a tower is selected, check upgrade/sell buttons
      if (this.state.selectedTower) {
        if (this.renderer.mouseToSellBtn(e)) {
          sellTower(this.state, this.state.selectedTower);
          return;
        }
        const upgBtn = this.renderer.mouseToUpgradeBtn(e);
        if (upgBtn) {
          upgradeTower(this.state, this.state.selectedTower, upgBtn);
          return;
        }
      }

      // Check build bar buttons (only when no tower selected)
      if (!this.state.selectedTower) {
        const btnIdx = this.renderer.mouseToButton(e);
        if (btnIdx >= 0) {
          const builds: ('wall' | TowerKind)[] = [
            'wall', TowerKind.PeaShooter, TowerKind.SlopCannon, TowerKind.Zapper,
          ];
          const clicked = builds[btnIdx];
          if (clicked !== undefined) {
            this.state.selectedBuild = this.state.selectedBuild === clicked ? null : clicked;
          }
          return;
        }
      }

      // Click on grid
      const { col, row, inGrid } = this.renderer.mouseToGrid(e);
      if (inGrid) {
        // Check if clicking an existing tower
        const clickedTower = this.state.towers.find((t) => t.col === col && t.row === row);
        if (clickedTower) {
          this.state.selectedTower = this.state.selectedTower === clickedTower ? null : clickedTower;
          this.state.selectedBuild = null;
          return;
        }

        // Deselect tower when clicking elsewhere on grid
        if (this.state.selectedTower) {
          this.state.selectedTower = null;
        }

        // Place on grid
        if (this.state.selectedBuild !== null) {
          placeBuild(this.state, col, row);
        }
      }
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.state.selectedBuild = null;
      this.state.selectedTower = null;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.state.selectedBuild = null;
        this.state.selectedTower = null;
      }
      // Hotkeys
      if (e.key >= '1' && e.key <= '4') this.state.selectedTower = null;
      if (e.key === '1') this.state.selectedBuild = 'wall';
      if (e.key === '2') this.state.selectedBuild = TowerKind.PeaShooter;
      if (e.key === '3') this.state.selectedBuild = TowerKind.SlopCannon;
      if (e.key === '4') this.state.selectedBuild = TowerKind.Zapper;
      if (e.key === ' ') {
        e.preventDefault();
        startWave(this.state);
      }
    });
  }
}
