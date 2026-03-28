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
 * Find the wall cell closest to `from` that, if removed, would most likely
 * open a path. Simple heuristic: find the nearest wall by manhattan distance.
 */
export function findNearestWall(grid: Grid, from: Position): Position | null {
  let best: Position | null = null;
  let bestDist = Infinity;

  for (let r = 0; r < grid.cells.length; r++) {
    const row = grid.cells[r]!;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === CellType.Wall) {
        const dist = Math.abs(c - from.col) + Math.abs(r - from.row);
        if (dist < bestDist) {
          bestDist = dist;
          best = { col: c, row: r };
        }
      }
    }
  }

  return best;
}
