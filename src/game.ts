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

// ── Entity types ──

export interface WallEntity {
  col: number;
  row: number;
  hp: number;
  maxHp: number;
}

export interface TowerEntity {
  col: number;
  row: number;
  kind: TowerKind;
  cooldown: number;
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
  reward: number;
  wallDps: number;
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
  hoverCol: number;
  hoverRow: number;
  autoStart: boolean;

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
    hoverCol: -1,
    hoverRow: -1,
    autoStart: false,
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
    const def = TOWER_DEFS[tower.kind];
    const range = Math.ceil(def.range);
    for (let dr = -range; dr <= range; dr++) {
      for (let dc = -range; dc <= range; dc++) {
        const r = tower.row + dr;
        const c = tower.col + dc;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        const dist = Math.sqrt(dc * dc + dr * dr);
        if (dist <= def.range) {
          // Higher cost closer to tower, scaled by tower damage
          const dangerWeight = (1 - dist / def.range) * (def.damage / def.fireRate);
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
    state.towers.push({ col, row, kind: state.selectedBuild, cooldown: 0 });
  }

  recalcPath(state);

  // Recalc paths for all ground enemies
  for (const enemy of state.enemies) {
    if (enemy.kind === EnemyKind.Walker || enemy.kind === EnemyKind.Sneaker) {
      recalcEnemyPath(state, enemy);
    }
  }

  return true;
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
    reward: def.reward,
    wallDps: def.wallDps,
  };

  if (kind === EnemyKind.Walker || kind === EnemyKind.Sneaker) {
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
  } else {
    enemy.path = [];
    enemy.wallTarget = findNearestWall(state.grid, currentTile);
  }
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
        toRemove.push(enemy.id);
        continue;
      }

      const move = enemy.speed * TILE * dt;
      enemy.x += (dx / dist) * move;
      enemy.y += (dy / dist) * move;
    } else {
      // Walker — follow path or attack wall
      if (enemy.wallTarget) {
        // Move toward wall and attack it
        const wx = enemy.wallTarget.col * TILE + TILE / 2;
        const wy = enemy.wallTarget.row * TILE + TILE / 2;
        const dx = wx - enemy.x;
        const dy = wy - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < TILE) {
          // Attack the wall
          const wall = state.walls.find(
            (w) => w.col === enemy.wallTarget!.col && w.row === enemy.wallTarget!.row
          );
          if (wall) {
            wall.hp -= enemy.wallDps * dt;
            if (wall.hp <= 0) {
              // Wall destroyed
              destroyWall(state, wall);
              // Recalc all ground enemy paths
              for (const e of state.enemies) {
                if (e.kind !== EnemyKind.Flyer) {
                  recalcEnemyPath(state, e);
                }
              }
            }
          } else {
            // Wall already gone, recalc
            recalcEnemyPath(state, enemy);
          }
        } else {
          const move = enemy.speed * TILE * dt;
          enemy.x += (dx / dist) * move;
          enemy.y += (dy / dist) * move;
        }
      } else if (enemy.path.length > 0) {
        // Follow path
        const target = enemy.path[enemy.pathIndex];
        if (!target) {
          // Reached goal
          state.lives--;
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
          // Check if we reached the goal
          if (enemy.pathIndex >= enemy.path.length) {
            state.lives--;
            toRemove.push(enemy.id);
            continue;
          }
        } else {
          const move = enemy.speed * TILE * dt;
          enemy.x += (dx / dist) * move;
          enemy.y += (dy / dist) * move;
        }
      } else {
        // No path and no wall target — recalc
        recalcEnemyPath(state, enemy);
      }
    }
  }

  state.enemies = state.enemies.filter((e) => !toRemove.includes(e.id));
}

function destroyWall(state: GameState, wall: WallEntity): void {
  state.grid.setCell(wall.col, wall.row, CellType.Empty);
  state.walls = state.walls.filter((w) => w !== wall);
  recalcPath(state);
}

function updateTowers(state: GameState, dt: number): void {
  for (const tower of state.towers) {
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;

    const def = TOWER_DEFS[tower.kind];
    const cx = tower.col * TILE + TILE / 2;
    const cy = tower.row * TILE + TILE / 2;
    const rangePixels = def.range * TILE;

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
      tower.cooldown = def.fireRate;

      // Calculate damage (with flyer bonus)
      let damage = def.damage;
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
    const dt = Math.min((time - this.lastTime) / 1000, 0.1); // cap dt to avoid spiral
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
      } else {
        this.state.hoverCol = -1;
        this.state.hoverRow = -1;
      }
    });

    canvas.addEventListener('click', (e) => {
      // Check for restart on game-over/win
      if (this.state.phase === GamePhase.Won || this.state.phase === GamePhase.Lost) {
        this.state = createGameState();
        recalcPath(this.state);
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

      // Check build bar buttons
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

      // Place on grid
      const { col, row, inGrid } = this.renderer.mouseToGrid(e);
      if (inGrid && this.state.selectedBuild !== null) {
        placeBuild(this.state, col, row);
      }
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.state.selectedBuild = null;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.state.selectedBuild = null;
      }
      // Hotkeys
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
