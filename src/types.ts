// ── Grid ──

export const COLS = 20;
export const ROWS = 15;
export const TILE = 32;
export const SCALE = 2;
export const CANVAS_W = COLS * TILE;
export const CANVAS_H = ROWS * TILE;

export const HUD_TOP_H = 40;    // pixels (logical)
export const HUD_BOT_H = 48;

export enum CellType {
  Empty,
  Wall,
  Tower,
  Spawn,
  Goal,
}

export interface Position {
  col: number;
  row: number;
}

// ── Towers ──

export enum TowerKind {
  PeaShooter,
  SlopCannon,
  Zapper,
  Frost,
  Chain,
  CoinTree,
}

export interface TowerDef {
  kind: TowerKind;
  name: string;
  shortName: string;
  cost: number;
  damage: number;
  fireRate: number;   // seconds between shots
  range: number;      // in tiles
  splash: number;     // splash radius in tiles (0 = single target)
  color: string;
  // Frost
  slowFactor?: number;
  slowDuration?: number;
  // Chain
  bounces?: number;
  bounceRange?: number;
  // CoinTree
  incomePerWave?: number;
}

export const TOWER_DEFS: Record<TowerKind, TowerDef> = {
  [TowerKind.PeaShooter]: {
    kind: TowerKind.PeaShooter,
    name: 'Pea Shooter',
    shortName: 'Pea',
    cost: 15,
    damage: 10,
    fireRate: 0.5,
    range: 3,
    splash: 0,
    color: '#4caf50',
  },
  [TowerKind.SlopCannon]: {
    kind: TowerKind.SlopCannon,
    name: 'Slop Cannon',
    shortName: 'Slop',
    cost: 30,
    damage: 25,
    fireRate: 1.5,
    range: 2,
    splash: 1,
    color: '#ff9800',
  },
  [TowerKind.Zapper]: {
    kind: TowerKind.Zapper,
    name: 'Zapper',
    shortName: 'Zap',
    cost: 40,
    damage: 15,
    fireRate: 1.0,
    range: 5,
    splash: 0,
    color: '#2196f3',
  },
  [TowerKind.Frost]: {
    kind: TowerKind.Frost,
    name: 'Frost Tower',
    shortName: 'Frost',
    cost: 35,
    damage: 3,
    fireRate: 1.0,
    range: 2.5,
    splash: 0,
    color: '#80deea',
    slowFactor: 0.4,
    slowDuration: 2.0,
  },
  [TowerKind.Chain]: {
    kind: TowerKind.Chain,
    name: 'Chain Tower',
    shortName: 'Chain',
    cost: 50,
    damage: 12,
    fireRate: 1.2,
    range: 3.5,
    splash: 0,
    color: '#ab47bc',
    bounces: 2,
    bounceRange: 2,
  },
  [TowerKind.CoinTree]: {
    kind: TowerKind.CoinTree,
    name: 'Coin Tree',
    shortName: 'Coin',
    cost: 60,
    damage: 0,
    fireRate: 0,
    range: 0,
    splash: 0,
    color: '#ffd54f',
    incomePerWave: 8,
  },
};

// ── Enemies ──

export enum EnemyKind {
  Walker,
  Sneaker,
  Wanderer,
  Tank,
  Sprinter,
  Healer,
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  baseHp: number;
  speed: number;      // tiles per second
  reward: number;      // coins on kill
  color: string;
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  [EnemyKind.Walker]: {
    kind: EnemyKind.Walker,
    name: 'Walker',
    baseHp: 50,
    speed: 1.0,
    reward: 5,
    color: '#e53935',
  },
  [EnemyKind.Sneaker]: {
    kind: EnemyKind.Sneaker,
    name: 'Sneaker',
    baseHp: 40,
    speed: 1.2,
    reward: 7,
    color: '#00bcd4',
  },
  [EnemyKind.Wanderer]: {
    kind: EnemyKind.Wanderer,
    name: 'Wanderer',
    baseHp: 80,
    speed: 0.9,
    reward: 6,
    color: '#ff5722',
  },
  [EnemyKind.Tank]: {
    kind: EnemyKind.Tank,
    name: 'Tank',
    baseHp: 300,
    speed: 0.4,
    reward: 20,
    color: '#546e7a',
  },
  [EnemyKind.Sprinter]: {
    kind: EnemyKind.Sprinter,
    name: 'Sprinter',
    baseHp: 20,
    speed: 2.5,
    reward: 3,
    color: '#ffeb3b',
  },
  [EnemyKind.Healer]: {
    kind: EnemyKind.Healer,
    name: 'Healer',
    baseHp: 60,
    speed: 0.8,
    reward: 12,
    color: '#66bb6a',
  },
};

// ── Economy ──

export const STARTING_COINS = 50;
export const STARTING_LIVES = 10;
export const WALL_COST = 3;
export const WAVE_BONUS = 10;

// ── Game state ──

export enum GamePhase {
  Build,
  Wave,
  Lost,
}

export interface Projectile {
  x: number;
  y: number;
  targetId: number;
  damage: number;
  splash: number;
  speed: number;       // pixels per second
  color: string;
  sourceKind?: TowerKind;
  sourceOwner?: 'host' | 'guest' | 'solo';
  trail: { x: number; y: number }[];
}
