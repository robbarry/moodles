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
  // Wave 3: sneakers appear — they dodge your towers
  {
    entries: [
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1.2 },
      { kind: EnemyKind.Sneaker, count: 3, hpMultiplier: 1 },
    ],
  },
  // Wave 4: flyers join the party
  {
    entries: [
      { kind: EnemyKind.Walker, count: 6, hpMultiplier: 1.3 },
      { kind: EnemyKind.Sneaker, count: 3, hpMultiplier: 1.1 },
      { kind: EnemyKind.Flyer, count: 3, hpMultiplier: 1 },
    ],
  },
  // Wave 5: mixed assault
  {
    entries: [
      { kind: EnemyKind.Walker, count: 8, hpMultiplier: 1.5 },
      { kind: EnemyKind.Sneaker, count: 5, hpMultiplier: 1.2 },
      { kind: EnemyKind.Flyer, count: 4, hpMultiplier: 1.2 },
    ],
  },
  // Wave 6: sneaker swarm
  {
    entries: [
      { kind: EnemyKind.Walker, count: 4, hpMultiplier: 1.5 },
      { kind: EnemyKind.Sneaker, count: 10, hpMultiplier: 1.3 },
      { kind: EnemyKind.Flyer, count: 4, hpMultiplier: 1.3 },
    ],
  },
  // Wave 7: beefy ground + air
  {
    entries: [
      { kind: EnemyKind.Walker, count: 10, hpMultiplier: 2.0 },
      { kind: EnemyKind.Sneaker, count: 6, hpMultiplier: 1.8 },
      { kind: EnemyKind.Flyer, count: 5, hpMultiplier: 1.5 },
    ],
  },
  // Wave 8: everything harder
  {
    entries: [
      { kind: EnemyKind.Walker, count: 12, hpMultiplier: 2.2 },
      { kind: EnemyKind.Sneaker, count: 8, hpMultiplier: 2.0 },
      { kind: EnemyKind.Flyer, count: 8, hpMultiplier: 1.8 },
    ],
  },
  // Wave 9: penultimate push
  {
    entries: [
      { kind: EnemyKind.Walker, count: 15, hpMultiplier: 2.5 },
      { kind: EnemyKind.Sneaker, count: 10, hpMultiplier: 2.2 },
      { kind: EnemyKind.Flyer, count: 10, hpMultiplier: 2.0 },
    ],
  },
  // Wave 10: final boss wave
  {
    entries: [
      { kind: EnemyKind.Walker, count: 15, hpMultiplier: 3.0 },
      { kind: EnemyKind.Sneaker, count: 12, hpMultiplier: 2.8 },
      { kind: EnemyKind.Flyer, count: 12, hpMultiplier: 2.5 },
    ],
  },
];
