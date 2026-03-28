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
}

export interface TowerDef {
  kind: TowerKind;
  name: string;
  cost: number;
  damage: number;
  fireRate: number;   // seconds between shots
  range: number;      // in tiles
  splash: number;     // splash radius in tiles (0 = single target)
  flyerBonus: number; // damage multiplier vs flyers
  color: string;
}

export const TOWER_DEFS: Record<TowerKind, TowerDef> = {
  [TowerKind.PeaShooter]: {
    kind: TowerKind.PeaShooter,
    name: 'Pea Shooter',
    cost: 15,
    damage: 10,
    fireRate: 0.5,
    range: 3,
    splash: 0,
    flyerBonus: 1,
    color: '#4caf50',
  },
  [TowerKind.SlopCannon]: {
    kind: TowerKind.SlopCannon,
    name: 'Slop Cannon',
    cost: 30,
    damage: 25,
    fireRate: 1.5,
    range: 2,
    splash: 1,
    flyerBonus: 1,
    color: '#ff9800',
  },
  [TowerKind.Zapper]: {
    kind: TowerKind.Zapper,
    name: 'Zapper',
    cost: 40,
    damage: 15,
    fireRate: 1.0,
    range: 5,
    splash: 0,
    flyerBonus: 2,
    color: '#2196f3',
  },
};

// ── Enemies ──

export enum EnemyKind {
  Walker,
  Flyer,
  Sneaker,
  Wanderer,
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  baseHp: number;
  speed: number;      // tiles per second
  reward: number;      // coins on kill
  wallDps: number;     // damage per second to walls (0 for flyers)
  color: string;
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  [EnemyKind.Walker]: {
    kind: EnemyKind.Walker,
    name: 'Walker',
    baseHp: 50,
    speed: 1.0,
    reward: 5,
    wallDps: 20,
    color: '#e53935',
  },
  [EnemyKind.Flyer]: {
    kind: EnemyKind.Flyer,
    name: 'Flyer',
    baseHp: 30,
    speed: 1.5,
    reward: 8,
    wallDps: 0,
    color: '#ab47bc',
  },
  [EnemyKind.Sneaker]: {
    kind: EnemyKind.Sneaker,
    name: 'Sneaker',
    baseHp: 40,
    speed: 1.2,
    reward: 7,
    wallDps: 15,
    color: '#00bcd4',
  },
  [EnemyKind.Wanderer]: {
    kind: EnemyKind.Wanderer,
    name: 'Wanderer',
    baseHp: 80,
    speed: 0.9,
    reward: 6,
    wallDps: 40,
    color: '#ff5722',
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
  Won,
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
}
