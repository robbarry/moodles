import { EnemyKind } from './types';

export interface WaveEntry {
  kind: EnemyKind;
  count: number;
  hpMultiplier: number;
}

export interface WaveDef {
  entries: WaveEntry[];
}

export const WAVES: WaveDef[] = [
  // Wave 1: gentle intro
  { entries: [{ kind: EnemyKind.Walker, count: 5, hpMultiplier: 1 }] },
  // Wave 2: more walkers
  { entries: [{ kind: EnemyKind.Walker, count: 8, hpMultiplier: 1 }] },
  // Wave 3: sneakers appear
  {
    entries: [
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1.2 },
      { kind: EnemyKind.Sneaker, count: 3, hpMultiplier: 1 },
    ],
  },
  // Wave 4: flyers join
  {
    entries: [
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1.3 },
      { kind: EnemyKind.Sneaker, count: 3, hpMultiplier: 1.1 },
      { kind: EnemyKind.Flyer, count: 3, hpMultiplier: 1 },
    ],
  },
  // Wave 5: wanderers appear — they roam the whole board
  {
    entries: [
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1.5 },
      { kind: EnemyKind.Sneaker, count: 4, hpMultiplier: 1.2 },
      { kind: EnemyKind.Flyer, count: 3, hpMultiplier: 1.2 },
      { kind: EnemyKind.Wanderer, count: 2, hpMultiplier: 1 },
    ],
  },
  // Wave 6: sneaker + wanderer pressure
  {
    entries: [
      { kind: EnemyKind.Walker, count: 4, hpMultiplier: 1.5 },
      { kind: EnemyKind.Sneaker, count: 8, hpMultiplier: 1.3 },
      { kind: EnemyKind.Flyer, count: 4, hpMultiplier: 1.3 },
      { kind: EnemyKind.Wanderer, count: 4, hpMultiplier: 1.2 },
    ],
  },
  // Wave 7: beefy ground + air
  {
    entries: [
      { kind: EnemyKind.Walker, count: 8, hpMultiplier: 2.0 },
      { kind: EnemyKind.Sneaker, count: 5, hpMultiplier: 1.8 },
      { kind: EnemyKind.Flyer, count: 5, hpMultiplier: 1.5 },
      { kind: EnemyKind.Wanderer, count: 5, hpMultiplier: 1.5 },
    ],
  },
  // Wave 8: wanderer swarm
  {
    entries: [
      { kind: EnemyKind.Walker, count: 10, hpMultiplier: 2.2 },
      { kind: EnemyKind.Sneaker, count: 6, hpMultiplier: 2.0 },
      { kind: EnemyKind.Flyer, count: 6, hpMultiplier: 1.8 },
      { kind: EnemyKind.Wanderer, count: 8, hpMultiplier: 1.8 },
    ],
  },
  // Wave 9: penultimate push
  {
    entries: [
      { kind: EnemyKind.Walker, count: 12, hpMultiplier: 2.5 },
      { kind: EnemyKind.Sneaker, count: 8, hpMultiplier: 2.2 },
      { kind: EnemyKind.Flyer, count: 8, hpMultiplier: 2.0 },
      { kind: EnemyKind.Wanderer, count: 6, hpMultiplier: 2.0 },
    ],
  },
  // Wave 10: everything at once
  {
    entries: [
      { kind: EnemyKind.Walker, count: 12, hpMultiplier: 3.0 },
      { kind: EnemyKind.Sneaker, count: 10, hpMultiplier: 2.8 },
      { kind: EnemyKind.Flyer, count: 10, hpMultiplier: 2.5 },
      { kind: EnemyKind.Wanderer, count: 8, hpMultiplier: 2.5 },
    ],
  },
];
