import {
  COLS, ROWS, TILE,
  CellType, TowerKind, EnemyKind,
  TOWER_DEFS, ENEMY_DEFS,
  STARTING_COINS, STARTING_LIVES, WALL_COST, WAVE_BONUS,
  GamePhase, Projectile, Position,
} from './types';
import { Grid } from './grid';
import { findPath, CostMap } from './pathfinding';
import { WAVES, generateEndlessWave } from './wave';
import { Renderer } from './renderer';
import {
  sfxShoot, sfxSlopShoot, sfxZapShoot, sfxPlace, sfxSell, sfxUpgrade,
  sfxEnemyDeath, sfxWaveStart, sfxLifeLost, sfxWin, sfxLose,
  sfxFrostHit, sfxChainBounce, sfxCoinIncome, sfxHealPulse,
  startMusic, toggleMusic,
} from './audio';
import { Effects } from './effects';
import { type PeerConnection, type Role, type NetMessage } from './net';

// ── Entity types ──

export interface WallEntity {
  col: number;
  row: number;
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
  recoilTimer: number;
  owner: 'host' | 'guest' | 'solo';
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
  reward: number;
  wanderAngle: number;
  hitFlashTimer: number;
  slowTimer: number;
  speedMultiplier: number;
  healCooldown: number;
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

  coins: number;       // solo mode coins (also used as "current player" view)
  hostCoins: number;
  guestCoins: number;
  lives: number;
  phase: GamePhase;
  currentWave: number;
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
  gameSpeed: number;
  musicOn: boolean;
  audioInitialized: boolean;
  mouseDown: boolean;

  // Path cache
  cachedPath: Position[] | null;
  lockedPathCells: Set<string>;
  towerCostMap: CostMap;

  // Juice
  gameTime: number;
  displayCoins: number;
  displayLives: number;

  // Scoring
  score: number;
  enemiesKilled: number;
  coinsEarned: number;
  highScore: number;
  isEndless: boolean;
  notifications: { text: string; timer: number }[];

  // Multiplayer
  peerCursorCol: number;
  peerCursorRow: number;
}

let nextEnemyId = 0;

const HIGH_SCORE_KEY = 'moodles_high_score';

function getHighScore(): number {
  try { return parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10); } catch { return 0; }
}

function saveHighScore(score: number): void {
  try {
    const prev = getHighScore();
    if (score > prev) localStorage.setItem(HIGH_SCORE_KEY, score.toString());
  } catch { /* localStorage unavailable */ }
}

export function createGameState(): GameState {
  return {
    grid: new Grid(),
    walls: [],
    towers: [],
    enemies: [],
    projectiles: [],
    floatingDamage: [],
    coins: STARTING_COINS,
    hostCoins: STARTING_COINS,
    guestCoins: STARTING_COINS,
    lives: STARTING_LIVES,
    phase: GamePhase.Build,
    currentWave: 1,
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
    lockedPathCells: new Set(),
    towerCostMap: buildTowerCostMap([]),
    gameTime: 0,
    displayCoins: STARTING_COINS,
    displayLives: STARTING_LIVES,
    score: 0,
    enemiesKilled: 0,
    coinsEarned: 0,
    highScore: getHighScore(),
    isEndless: false,
    notifications: [],
    peerCursorCol: -1,
    peerCursorRow: -1,
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
  computeLockedCells(state);
}

/** Find path cells where placing a wall would kill the only route */
function computeLockedCells(state: GameState): void {
  state.lockedPathCells = new Set();
  if (!state.cachedPath) return;

  for (const p of state.cachedPath) {
    const cell = state.grid.getCell(p.col, p.row);
    if (cell !== CellType.Empty) continue; // spawn/goal/already built
    // Temporarily block this cell and see if a path still exists
    state.grid.setCell(p.col, p.row, CellType.Wall);
    const alt = findPath(state.grid, state.grid.spawn, state.grid.goal);
    state.grid.setCell(p.col, p.row, CellType.Empty);
    if (!alt) {
      state.lockedPathCells.add(`${p.col},${p.row}`);
    }
  }
}

/** Get the coin balance for a given owner */
export function getCoins(state: GameState, owner: 'host' | 'guest' | 'solo'): number {
  if (owner === 'host') return state.hostCoins;
  if (owner === 'guest') return state.guestCoins;
  return state.coins;
}

function addCoins(state: GameState, owner: 'host' | 'guest' | 'solo', amount: number): void {
  if (owner === 'host') state.hostCoins += amount;
  else if (owner === 'guest') state.guestCoins += amount;
  else state.coins += amount;
  state.coinsEarned += amount;
}

function spendCoins(state: GameState, owner: 'host' | 'guest' | 'solo', amount: number): void {
  if (owner === 'host') state.hostCoins -= amount;
  else if (owner === 'guest') state.guestCoins -= amount;
  else state.coins -= amount;
}

/** Check if placement would block the path */
export function canPlaceAt(state: GameState, col: number, row: number): boolean {
  if (!state.grid.canPlace(col, row)) return false;
  state.grid.setCell(col, row, CellType.Wall);
  const testPath = findPath(state.grid, state.grid.spawn, state.grid.goal);
  state.grid.setCell(col, row, CellType.Empty);
  return testPath !== null;
}

export function placeBuild(state: GameState, col: number, row: number, owner: 'host' | 'guest' | 'solo' = 'solo'): boolean {
  if (!state.grid.canPlace(col, row)) return false;
  if (state.selectedBuild === null) return false;

  const cost = state.selectedBuild === 'wall' ? WALL_COST : TOWER_DEFS[state.selectedBuild].cost;
  if (getCoins(state, owner) < cost) return false;

  // Tentatively place and check if a path still exists
  const cellType = state.selectedBuild === 'wall' ? CellType.Wall : CellType.Tower;
  state.grid.setCell(col, row, cellType);
  const testPath = findPath(state.grid, state.grid.spawn, state.grid.goal);
  if (!testPath) {
    state.grid.setCell(col, row, CellType.Empty);
    return false;
  }

  // Commit the placement
  spendCoins(state, owner, cost);
  if (state.selectedBuild === 'wall') {
    state.walls.push({ col, row });
  } else {
    state.towers.push({ col, row, kind: state.selectedBuild, cooldown: 0, rangeLevel: 0, speedLevel: 0, damageLevel: 0, recoilTimer: 0, owner });
  }

  recalcPath(state);

  // Recalc paths for walking enemies
  for (const enemy of state.enemies) {
    if (enemy.kind !== EnemyKind.Wanderer) {
      recalcEnemyPath(state, enemy);
    }
  }

  sfxPlace();
  return true;
}

// ── Upgrades ──

export function upgradeTower(state: GameState, tower: TowerEntity, stat: UpgradeStat): boolean {
  const cost = upgradeCost(tower, stat);
  if (cost === Infinity || getCoins(state, tower.owner) < cost) return false;
  spendCoins(state, tower.owner, cost);
  if (stat === 'range') tower.rangeLevel++;
  else if (stat === 'speed') tower.speedLevel++;
  else tower.damageLevel++;
  // Recalc sneaker cost map
  recalcPath(state);
  for (const enemy of state.enemies) {
    if (enemy.kind === EnemyKind.Sneaker) recalcEnemyPath(state, enemy);
  }
  sfxUpgrade();
  return true;
}

export function sellTower(state: GameState, tower: TowerEntity): void {
  sfxSell();
  addCoins(state, tower.owner, sellValue(tower));
  state.grid.setCell(tower.col, tower.row, CellType.Empty);
  state.towers = state.towers.filter((t) => t !== tower);
  state.selectedTower = null;
  recalcPath(state);
  for (const enemy of state.enemies) {
    if (enemy.kind !== EnemyKind.Wanderer) {
      recalcEnemyPath(state, enemy);
    }
  }
}

// ── Wave management ──

export function startWave(state: GameState): void {
  if (state.phase !== GamePhase.Build) return;
  const waveDef = state.currentWave <= WAVES.length
    ? WAVES[state.currentWave - 1]!
    : generateEndlessWave(state.currentWave);

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
    reward: def.reward,
    wanderAngle: Math.random() * Math.PI * 2,
    hitFlashTimer: 0,
    slowTimer: 0,
    speedMultiplier: 1,
    healCooldown: 0,
  };

  if (kind !== EnemyKind.Wanderer) {
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
  }
}



// ── Update loop ──

export function update(state: GameState, dt: number): void {
  state.gameTime += dt;

  // Smooth counter lerp
  const lerpRate = 200 * dt;
  state.displayCoins += Math.sign(state.coins - state.displayCoins) * Math.min(Math.abs(state.coins - state.displayCoins), lerpRate);
  state.displayLives += Math.sign(state.lives - state.displayLives) * Math.min(Math.abs(state.lives - state.displayLives), lerpRate * 0.5);

  // Notifications
  state.notifications = state.notifications.filter((n) => {
    n.timer -= dt;
    return n.timer > 0;
  });

  if (state.phase === GamePhase.Lost) return;

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
    // Wave bonus: both players get it in co-op
    state.coins += WAVE_BONUS;
    state.hostCoins += WAVE_BONUS;
    state.guestCoins += WAVE_BONUS;
    state.coinsEarned += WAVE_BONUS;
    state.score += state.currentWave * (state.isEndless ? 50 : 0) + 100;

    // Coin Tree income goes to the tower owner
    let hasCoinTree = false;
    for (const tower of state.towers) {
      if (tower.kind === TowerKind.CoinTree) {
        hasCoinTree = true;
        const def = TOWER_DEFS[TowerKind.CoinTree];
        const income = (def.incomePerWave ?? 8) * (1 + tower.damageLevel);
        addCoins(state, tower.owner, income);
      }
    }
    if (hasCoinTree) sfxCoinIncome();

    // Milestone at wave 10
    if (state.currentWave === 10 && !state.isEndless) {
      state.isEndless = true;
      state.notifications.push({ text: 'Endless mode begins!', timer: 3 });
      sfxWin();
    }

    state.currentWave++;
    state.phase = GamePhase.Build;
    if (state.autoStart) {
      startWave(state);
    }
  }

  // Check loss
  if (state.lives <= 0) {
    state.lives = 0;
    state.phase = GamePhase.Lost;
    saveHighScore(state.score);
    sfxLose();
  }
}

function updateEnemies(state: GameState, dt: number): void {
  const toRemove: number[] = [];

  for (const enemy of state.enemies) {
    // Decay timers
    if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer -= dt;
    if (enemy.slowTimer > 0) {
      enemy.slowTimer -= dt;
      if (enemy.slowTimer <= 0) enemy.speedMultiplier = 1;
    }

    // Healer: heal nearby enemies
    if (enemy.kind === EnemyKind.Healer) {
      enemy.healCooldown -= dt;
      if (enemy.healCooldown <= 0) {
        enemy.healCooldown = 1.5;
        for (const other of state.enemies) {
          if (other.id === enemy.id) continue;
          const edx = other.x - enemy.x;
          const edy = other.y - enemy.y;
          if (Math.sqrt(edx * edx + edy * edy) <= 2 * TILE) {
            other.hp = Math.min(other.maxHp, other.hp + 5);
          }
        }
        sfxHealPulse();
      }
    }

    if (enemy.kind === EnemyKind.Wanderer) {
      updateWanderer(state, enemy, dt, toRemove);
    } else {
      // All path-followers (Walker, Sneaker, Tank, Sprinter, Healer)
      if (enemy.path.length > 0) {
        const target = enemy.path[enemy.pathIndex];
        if (!target) {
          state.lives--;
          sfxLifeLost();
          effects.triggerShake(5, 0.15);
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
            effects.triggerShake(5, 0.15);
            toRemove.push(enemy.id);
            continue;
          }
        } else {
          const move = enemy.speed * enemy.speedMultiplier * TILE * dt;
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

  // Occasionally make a big random turn (every ~1-2 seconds on average)
  if (Math.random() < dt * 0.8) {
    enemy.wanderAngle += (Math.random() - 0.5) * Math.PI * 1.5;
  }
  // Continuous small drift
  enemy.wanderAngle += (Math.random() - 0.5) * 4.0 * dt;

  // Light goal bias — stronger when far from goal, weaker when close
  // This keeps them moving generally goalward without being predictable
  const goalAngle = Math.atan2(dy, dx);
  const goalBias = 0.3;
  // Blend using angular difference to avoid the weird oscillation
  let angleDiff = goalAngle - enemy.wanderAngle;
  // Normalize to [-PI, PI]
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  enemy.wanderAngle += angleDiff * goalBias * dt;

  const angle = enemy.wanderAngle;
  const move = enemy.speed * enemy.speedMultiplier * TILE * dt;
  let nx = enemy.x + Math.cos(angle) * move;
  let ny = enemy.y + Math.sin(angle) * move;

  const half = TILE / 2;
  nx = Math.max(half, Math.min(COLS * TILE - half, nx));
  ny = Math.max(half, Math.min(ROWS * TILE - half, ny));

  // Can't walk into walls or towers — bounce off
  const destCol = Math.floor(nx / TILE);
  const destRow = Math.floor(ny / TILE);
  const destCell = state.grid.getCell(destCol, destRow);

  if (destCell === CellType.Wall || destCell === CellType.Tower) {
    // Bounce: reflect angle away from the obstacle and add randomness
    enemy.wanderAngle += Math.PI * (0.5 + Math.random());
  } else {
    enemy.x = nx;
    enemy.y = ny;
  }
}



function updateTowers(state: GameState, dt: number): void {
  for (const tower of state.towers) {
    // Decay recoil
    if (tower.recoilTimer > 0) tower.recoilTimer -= dt;

    // CoinTree doesn't fire
    if (tower.kind === TowerKind.CoinTree) continue;

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
      tower.recoilTimer = 0.08;

      // Shoot sfx
      if (tower.kind === TowerKind.SlopCannon) sfxSlopShoot();
      else if (tower.kind === TowerKind.Zapper) sfxZapShoot();
      else if (tower.kind === TowerKind.Frost) sfxFrostHit();
      else if (tower.kind === TowerKind.Chain) sfxChainBounce();
      else sfxShoot();

      const damage = towerDamage(tower);

      state.projectiles.push({
        x: cx,
        y: cy,
        targetId: nearest.id,
        damage,
        splash: def.splash,
        speed: 300,
        color: def.color,
        sourceKind: tower.kind,
        sourceOwner: tower.owner,
        trail: [],
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

    // Trail
    proj.trail.push({ x: proj.x, y: proj.y });
    if (proj.trail.length > 5) proj.trail.shift();

    const dx = target.x - proj.x;
    const dy = target.y - proj.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 6) {
      // Hit!
      let splashCount = 0;
      if (proj.splash > 0) {
        const splashPixels = proj.splash * TILE;
        for (const enemy of state.enemies) {
          const edx = enemy.x - target.x;
          const edy = enemy.y - target.y;
          const edist = Math.sqrt(edx * edx + edy * edy);
          if (edist <= splashPixels) {
            damageEnemy(state, enemy, proj.damage, proj.sourceOwner);
            splashCount++;
          }
        }
        if (splashCount >= 3) effects.triggerShake(3, 0.1);
      } else {
        damageEnemy(state, target, proj.damage, proj.sourceOwner);
      }

      // Frost: apply slow
      if (proj.sourceKind === TowerKind.Frost) {
        const frostDef = TOWER_DEFS[TowerKind.Frost];
        // Don't stack, just refresh
        target.slowTimer = frostDef.slowDuration ?? 2;
        target.speedMultiplier = frostDef.slowFactor ?? 0.4;
      }

      // Chain: bounce to nearby enemies
      if (proj.sourceKind === TowerKind.Chain) {
        const chainDef = TOWER_DEFS[TowerKind.Chain];
        const maxBounces = chainDef.bounces ?? 2;
        const bounceRangePixels = (chainDef.bounceRange ?? 2) * TILE;
        let lastX = target.x;
        let lastY = target.y;
        let bounceDamage = proj.damage;
        const hitIds = new Set<number>([target.id]);

        for (let b = 0; b < maxBounces; b++) {
          bounceDamage = Math.round(bounceDamage * 0.7);
          let closest: EnemyEntity | null = null;
          let closestDist = Infinity;
          for (const enemy of state.enemies) {
            if (hitIds.has(enemy.id)) continue;
            const edx = enemy.x - lastX;
            const edy = enemy.y - lastY;
            const edist = Math.sqrt(edx * edx + edy * edy);
            if (edist <= bounceRangePixels && edist < closestDist) {
              closest = enemy;
              closestDist = edist;
            }
          }
          if (!closest) break;
          hitIds.add(closest.id);
          effects.spawnChainArc(lastX, lastY, closest.x, closest.y, chainDef.color);
          damageEnemy(state, closest, bounceDamage, proj.sourceOwner);
          lastX = closest.x;
          lastY = closest.y;
        }
      }

      toRemove.push(i);
    } else {
      const move = proj.speed * dt;
      proj.x += (dx / dist) * move;
      proj.y += (dy / dist) * move;
    }
  }

  for (let i = toRemove.length - 1; i >= 0; i--) {
    state.projectiles.splice(toRemove[i]!, 1);
  }
}

function damageEnemy(state: GameState, enemy: EnemyEntity, damage: number, killer: 'host' | 'guest' | 'solo' = 'solo'): void {
  enemy.hp -= damage;
  enemy.hitFlashTimer = 0.1;

  effects.spawnHitParticles(enemy.x, enemy.y, ENEMY_DEFS[enemy.kind].color);

  state.floatingDamage.push({
    x: enemy.x,
    y: enemy.y,
    amount: damage,
    age: 0,
    lifetime: 0.8,
  });

  if (enemy.hp <= 0) {
    addCoins(state, killer, enemy.reward);
    state.enemiesKilled++;
    state.score += 10;
    sfxEnemyDeath();
    effects.spawnDeathEffect(enemy.x, enemy.y, ENEMY_DEFS[enemy.kind].color);
    effects.triggerShake(1, 0.05);
    state.enemies = state.enemies.filter((e) => e.id !== enemy.id);
    state.projectiles = state.projectiles.filter((p) => p.targetId !== enemy.id);
  }
}

// ── Main game controller ──

export const effects = new Effects();

// ── State serialization for multiplayer ──

interface SerializedState {
  // Only the fields that need syncing — skip Grid class, recompute on receive
  cells: number[][];
  walls: WallEntity[];
  towers: TowerEntity[];
  enemies: EnemyEntity[];
  projectiles: Projectile[];
  floatingDamage: FloatingDamage[];
  coins: number;
  hostCoins: number;
  guestCoins: number;
  lives: number;
  phase: GamePhase;
  currentWave: number;
  waveCountdown: number;
  gameTime: number;
  score: number;
  enemiesKilled: number;
  isEndless: boolean;
  notifications: { text: string; timer: number }[];
  cachedPath: Position[] | null;
  lockedPathCells: string[];
  peerCursorCol: number;
  peerCursorRow: number;
  autoStart: boolean;
  gameSpeed: number;
  displayCoins: number;
  displayLives: number;
}

function serializeState(state: GameState): SerializedState {
  return {
    cells: state.grid.cells.map((row) => [...row]),
    walls: state.walls,
    towers: state.towers,
    enemies: state.enemies,
    projectiles: state.projectiles.map((p) => ({ ...p, trail: [] })),
    floatingDamage: state.floatingDamage,
    coins: state.coins,
    hostCoins: state.hostCoins,
    guestCoins: state.guestCoins,
    lives: state.lives,
    phase: state.phase,
    currentWave: state.currentWave,
    waveCountdown: state.waveCountdown,
    gameTime: state.gameTime,
    score: state.score,
    enemiesKilled: state.enemiesKilled,
    isEndless: state.isEndless,
    notifications: state.notifications,
    cachedPath: state.cachedPath,
    lockedPathCells: [...state.lockedPathCells],
    peerCursorCol: state.peerCursorCol,
    peerCursorRow: state.peerCursorRow,
    autoStart: state.autoStart,
    gameSpeed: state.gameSpeed,
    displayCoins: state.displayCoins,
    displayLives: state.displayLives,
  };
}

function applySerializedState(state: GameState, s: SerializedState): void {
  // Rebuild grid
  for (let r = 0; r < s.cells.length; r++) {
    const row = s.cells[r];
    if (row) {
      for (let c = 0; c < row.length; c++) {
        state.grid.cells[r]![c] = row[c]!;
      }
    }
  }
  state.walls = s.walls;
  state.towers = s.towers;
  state.enemies = s.enemies;
  state.projectiles = s.projectiles;
  state.floatingDamage = s.floatingDamage;
  state.coins = s.coins;
  state.hostCoins = s.hostCoins;
  state.guestCoins = s.guestCoins;
  state.lives = s.lives;
  state.phase = s.phase;
  state.currentWave = s.currentWave;
  state.waveCountdown = s.waveCountdown;
  state.gameTime = s.gameTime;
  state.score = s.score;
  state.enemiesKilled = s.enemiesKilled;
  state.isEndless = s.isEndless;
  state.notifications = s.notifications;
  state.cachedPath = s.cachedPath;
  state.lockedPathCells = new Set(s.lockedPathCells);
  state.peerCursorCol = s.peerCursorCol;
  state.peerCursorRow = s.peerCursorRow;
  state.autoStart = s.autoStart;
  state.gameSpeed = s.gameSpeed;
  state.displayCoins = s.displayCoins;
  state.displayLives = s.displayLives;
}

// ── Game controller ──

export class Game {
  state: GameState;
  renderer: Renderer;
  lastTime: number = 0;
  role: Role;
  peer: PeerConnection | null;
  broadcastTimer = 0;

  constructor(canvas: HTMLCanvasElement, role: Role = 'solo', peer: PeerConnection | null = null) {
    this.role = role;
    this.peer = peer;
    this.state = createGameState();
    this.renderer = new Renderer(canvas);
    recalcPath(this.state);
    this.setupInput(canvas);

    if (peer) {
      peer.onMessage = (msg) => this.handleNetMessage(msg);
      peer.onDisconnected = () => {
        this.state.notifications.push({ text: 'Peer disconnected!', timer: 5 });
        this.state.peerCursorCol = -1;
        this.state.peerCursorRow = -1;
      };
    }
  }

  start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    if (this.role === 'host') {
      // Broadcast on setInterval so it runs even when rAF is throttled
      // for background tabs. Simulation stays in rAF for smooth 60fps.
      setInterval(() => this.broadcastState(), 100);
    }
  }

  /** Send current state to the guest */
  private broadcastState(): void {
    if (!this.peer?.connected) return;
    this.peer.send({
      type: 'state',
      state: serializeState(this.state),
      hostCursorCol: this.state.hoverCol,
      hostCursorRow: this.state.hoverRow,
    });
  }

  private loop(time: number): void {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1) * this.state.gameSpeed;
    this.lastTime = time;

    if (this.role !== 'guest') {
      update(this.state, dt);
      effects.update(dt);
    }

    // Set coins for HUD display
    if (this.role === 'host') this.state.coins = this.state.hostCoins;
    else if (this.role === 'guest') {
      this.state.coins = this.state.guestCoins;
      // Guest needs its own display lerp since update() doesn't run
      this.state.gameTime += dt;
      const lerpRate = 200 * dt;
      this.state.displayCoins += Math.sign(this.state.coins - this.state.displayCoins) * Math.min(Math.abs(this.state.coins - this.state.displayCoins), lerpRate);
      this.state.displayLives += Math.sign(this.state.lives - this.state.displayLives) * Math.min(Math.abs(this.state.lives - this.state.displayLives), lerpRate * 0.5);
      // Tick notifications
      this.state.notifications = this.state.notifications.filter((n) => { n.timer -= dt; return n.timer > 0; });
    }

    this.renderer.draw(this.state);
    requestAnimationFrame((t) => this.loop(t));
  }

  private handleNetMessage(msg: NetMessage): void {
    if (this.role === 'guest' && msg.type === 'state') {
      // Preserve local UI state
      const selBuild = this.state.selectedBuild;
      const selTowerPos = this.state.selectedTower
        ? { col: this.state.selectedTower.col, row: this.state.selectedTower.row }
        : null;
      const hover = { col: this.state.hoverCol, row: this.state.hoverRow };

      applySerializedState(this.state, msg.state as SerializedState);

      // Restore local UI state
      this.state.selectedBuild = selBuild;
      this.state.hoverCol = hover.col;
      this.state.hoverRow = hover.row;
      // Re-resolve selectedTower by position (old reference is stale)
      if (selTowerPos) {
        this.state.selectedTower = this.state.towers.find(
          (t) => t.col === selTowerPos.col && t.row === selTowerPos.row
        ) ?? null;
      }
      // Host cursor becomes our peer cursor
      this.state.peerCursorCol = msg.hostCursorCol as number;
      this.state.peerCursorRow = msg.hostCursorRow as number;
    }

    if (this.role === 'host' && msg.type === 'cmd') {
      this.applyGuestCommand(msg);
      // Immediately broadcast so guest sees the result without waiting
      this.broadcastState();
    }

    if (this.role === 'host' && msg.type === 'cursor') {
      // Guest cursor position
      this.state.peerCursorCol = msg.col as number;
      this.state.peerCursorRow = msg.row as number;
    }
  }

  private applyGuestCommand(msg: NetMessage): void {
    const cmd = msg.cmd as string;
    if (cmd === 'place') {
      const prev = this.state.selectedBuild;
      this.state.selectedBuild = msg.build as 'wall' | TowerKind;
      placeBuild(this.state, msg.col as number, msg.row as number, 'guest');
      this.state.selectedBuild = prev;
    } else if (cmd === 'startWave') {
      startWave(this.state);
    } else if (cmd === 'sell') {
      const tower = this.state.towers.find(
        (t) => t.col === (msg.col as number) && t.row === (msg.row as number)
      );
      if (tower) sellTower(this.state, tower);
    } else if (cmd === 'upgrade') {
      const tower = this.state.towers.find(
        (t) => t.col === (msg.col as number) && t.row === (msg.row as number)
      );
      if (tower) upgradeTower(this.state, tower, msg.stat as UpgradeStat);
    } else if (cmd === 'speed') {
      this.state.gameSpeed = msg.speed as number;
    } else if (cmd === 'autoStart') {
      this.state.autoStart = !this.state.autoStart;
    }
  }

  /** For guest: send a command to the host instead of applying locally */
  private sendCmd(cmd: NetMessage): void {
    if (this.peer?.connected) {
      this.peer.send(cmd);
    }
  }

  private setupInput(canvas: HTMLCanvasElement): void {
    const isGuest = this.role === 'guest';

    canvas.addEventListener('mousemove', (e) => {
      const { col, row, inGrid } = this.renderer.mouseToGrid(e);
      if (inGrid) {
        this.state.hoverCol = col;
        this.state.hoverRow = row;
        // Send cursor to peer
        if (this.role === 'guest' && this.peer?.connected) {
          this.sendCmd({ type: 'cursor', col, row });
        }
        // Drag-to-place walls
        if (this.state.mouseDown && this.state.selectedBuild === 'wall') {
          if (isGuest) {
            this.sendCmd({ type: 'cmd', cmd: 'place', build: 'wall', col, row });
          } else {
            placeBuild(this.state, col, row, this.role === 'host' ? 'host' : 'solo');
          }
        }
      } else {
        this.state.hoverCol = -1;
        this.state.hoverRow = -1;
      }
    });

    canvas.addEventListener('mousedown', () => { this.state.mouseDown = true; });
    canvas.addEventListener('mouseup', () => { this.state.mouseDown = false; });
    canvas.addEventListener('mouseleave', () => { this.state.mouseDown = false; });

    canvas.addEventListener('click', (e) => {
      // Start music on first interaction (always local)
      if (!this.state.audioInitialized) {
        this.state.audioInitialized = true;
        startMusic();
        this.state.musicOn = true;
      }

      // Music toggle (always local)
      if (this.renderer.mouseToMusicBtn(e)) {
        this.state.musicOn = toggleMusic();
        return;
      }

      // Restart (host/solo only)
      if (this.state.phase === GamePhase.Lost && !isGuest) {
        this.state = createGameState();
        recalcPath(this.state);
        return;
      }

      // Speed buttons
      const spd = this.renderer.mouseToSpeedBtn(e);
      if (spd > 0) {
        if (isGuest) {
          this.sendCmd({ type: 'cmd', cmd: 'speed', speed: spd });
        } else {
          this.state.gameSpeed = spd;
        }
        return;
      }

      // Auto-start
      if (this.renderer.mouseToAutoStart(e)) {
        if (isGuest) {
          this.sendCmd({ type: 'cmd', cmd: 'autoStart' });
        } else {
          this.state.autoStart = !this.state.autoStart;
        }
        return;
      }

      // Start wave
      if (this.renderer.mouseToStartBtn(e)) {
        if (isGuest) {
          this.sendCmd({ type: 'cmd', cmd: 'startWave' });
        } else {
          startWave(this.state);
        }
        return;
      }

      // Tower upgrade/sell
      if (this.state.selectedTower) {
        if (this.renderer.mouseToSellBtn(e)) {
          if (isGuest) {
            this.sendCmd({ type: 'cmd', cmd: 'sell', col: this.state.selectedTower.col, row: this.state.selectedTower.row });
          } else {
            sellTower(this.state, this.state.selectedTower);
          }
          return;
        }
        const upgBtn = this.renderer.mouseToUpgradeBtn(e);
        if (upgBtn) {
          if (isGuest) {
            this.sendCmd({ type: 'cmd', cmd: 'upgrade', col: this.state.selectedTower.col, row: this.state.selectedTower.row, stat: upgBtn });
          } else {
            upgradeTower(this.state, this.state.selectedTower, upgBtn);
          }
          return;
        }
      }

      // Build bar buttons (local UI selection for both roles)
      if (!this.state.selectedTower) {
        const btnIdx = this.renderer.mouseToButton(e);
        if (btnIdx >= 0) {
          const builds: ('wall' | TowerKind)[] = [
            'wall', TowerKind.PeaShooter, TowerKind.SlopCannon, TowerKind.Zapper,
            TowerKind.Frost, TowerKind.Chain, TowerKind.CoinTree,
          ];
          const clicked = builds[btnIdx];
          if (clicked !== undefined) {
            this.state.selectedBuild = this.state.selectedBuild === clicked ? null : clicked;
          }
          return;
        }
      }

      // Grid click
      const { col, row, inGrid } = this.renderer.mouseToGrid(e);
      if (inGrid) {
        // Select tower (local UI)
        const clickedTower = this.state.towers.find((t) => t.col === col && t.row === row);
        if (clickedTower) {
          this.state.selectedTower = this.state.selectedTower === clickedTower ? null : clickedTower;
          this.state.selectedBuild = null;
          return;
        }

        if (this.state.selectedTower) {
          this.state.selectedTower = null;
        }

        // Place
        if (this.state.selectedBuild !== null) {
          if (isGuest) {
            this.sendCmd({ type: 'cmd', cmd: 'place', build: this.state.selectedBuild, col, row });
          } else {
            placeBuild(this.state, col, row, this.role === 'host' ? 'host' : 'solo');
          }
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
      if (e.key >= '1' && e.key <= '7') this.state.selectedTower = null;
      if (e.key === '1') this.state.selectedBuild = 'wall';
      if (e.key === '2') this.state.selectedBuild = TowerKind.PeaShooter;
      if (e.key === '3') this.state.selectedBuild = TowerKind.SlopCannon;
      if (e.key === '4') this.state.selectedBuild = TowerKind.Zapper;
      if (e.key === '5') this.state.selectedBuild = TowerKind.Frost;
      if (e.key === '6') this.state.selectedBuild = TowerKind.Chain;
      if (e.key === '7') this.state.selectedBuild = TowerKind.CoinTree;
      if (e.key === ' ') {
        e.preventDefault();
        if (isGuest) {
          this.sendCmd({ type: 'cmd', cmd: 'startWave' });
        } else {
          startWave(this.state);
        }
      }
    });
  }
}
