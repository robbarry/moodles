import { CellType, Position } from './types';
import { Grid } from './grid';

interface Node {
  pos: Position;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

function heuristic(a: Position, b: Position): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function posKey(p: Position): string {
  return `${p.col},${p.row}`;
}

/** Optional per-cell cost penalties (e.g. for tower avoidance) */
export type CostMap = number[][];

/**
 * A* pathfinding on the grid.
 * Treats walls and towers as impassable.
 * Optional costMap adds extra movement cost per tile (for sneaker tower avoidance).
 * Returns the path as an array of positions (start to goal), or null if blocked.
 */
export function findPath(grid: Grid, start: Position, goal: Position, costMap?: CostMap): Position[] | null {
  const openSet = new Map<string, Node>();
  const closedSet = new Set<string>();

  const startNode: Node = {
    pos: start,
    g: 0,
    h: heuristic(start, goal),
    f: heuristic(start, goal),
    parent: null,
  };
  openSet.set(posKey(start), startNode);

  while (openSet.size > 0) {
    // Find node with lowest f
    let current: Node | null = null;
    for (const node of openSet.values()) {
      if (!current || node.f < current.f) {
        current = node;
      }
    }
    if (!current) break;

    if (current.pos.col === goal.col && current.pos.row === goal.row) {
      // Reconstruct path
      const path: Position[] = [];
      let n: Node | null = current;
      while (n) {
        path.unshift(n.pos);
        n = n.parent;
      }
      return path;
    }

    const currentKey = posKey(current.pos);
    openSet.delete(currentKey);
    closedSet.add(currentKey);

    for (const neighbor of grid.getNeighbors(current.pos)) {
      const nKey = posKey(neighbor);
      if (closedSet.has(nKey)) continue;

      const cell = grid.getCell(neighbor.col, neighbor.row);
      if (cell === CellType.Wall || cell === CellType.Tower) continue;

      const extra = costMap?.[neighbor.row]?.[neighbor.col] ?? 0;
      const g = current.g + 1 + extra;
      const existing = openSet.get(nKey);

      if (!existing || g < existing.g) {
        const h = heuristic(neighbor, goal);
        const node: Node = { pos: neighbor, g, h, f: g + h, parent: current };
        openSet.set(nKey, node);
      }
    }
  }

  return null;
}

/**
 * Find the best obstacle to attack to open a path to the goal.
 * Runs A* treating walls/towers as passable but very expensive.
 * Returns the first wall or tower cell on that path — the obstacle
 * that, if removed, most directly opens a route.
 * Also returns whether it's a wall or tower cell.
 */
export function findBestObstacleToAttack(
  grid: Grid, from: Position, goal: Position
): { pos: Position; type: CellType } | null {
  // A* where walls/towers cost 100 instead of being impassable
  const OBSTACLE_COST = 100;
  const openSet = new Map<string, Node>();
  const closedSet = new Set<string>();

  const startNode: Node = {
    pos: from,
    g: 0,
    h: heuristic(from, goal),
    f: heuristic(from, goal),
    parent: null,
  };
  openSet.set(posKey(from), startNode);

  while (openSet.size > 0) {
    let current: Node | null = null;
    for (const node of openSet.values()) {
      if (!current || node.f < current.f) {
        current = node;
      }
    }
    if (!current) break;

    if (current.pos.col === goal.col && current.pos.row === goal.row) {
      // Walk the path and find the first obstacle
      const path: Position[] = [];
      let n: Node | null = current;
      while (n) {
        path.unshift(n.pos);
        n = n.parent;
      }
      for (const p of path) {
        const cell = grid.getCell(p.col, p.row);
        if (cell === CellType.Wall || cell === CellType.Tower) {
          return { pos: p, type: cell };
        }
      }
      return null;
    }

    const currentKey = posKey(current.pos);
    openSet.delete(currentKey);
    closedSet.add(currentKey);

    for (const neighbor of grid.getNeighbors(current.pos)) {
      const nKey = posKey(neighbor);
      if (closedSet.has(nKey)) continue;

      const cell = grid.getCell(neighbor.col, neighbor.row);
      const cost = (cell === CellType.Wall || cell === CellType.Tower) ? OBSTACLE_COST : 1;
      const g = current.g + cost;
      const existing = openSet.get(nKey);

      if (!existing || g < existing.g) {
        const h = heuristic(neighbor, goal);
        const node: Node = { pos: neighbor, g, h, f: g + h, parent: current };
        openSet.set(nKey, node);
      }
    }
  }

  return null;
}
