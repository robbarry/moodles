import { CellType, COLS, ROWS, Position } from './types';

export class Grid {
  cells: CellType[][];
  spawn: Position;
  goal: Position;

  constructor() {
    this.cells = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => CellType.Empty)
    );
    this.spawn = { col: 0, row: 0 };
    this.goal = { col: COLS - 1, row: ROWS - 1 };
    this.cells[this.spawn.row]![this.spawn.col] = CellType.Spawn;
    this.cells[this.goal.row]![this.goal.col] = CellType.Goal;
  }

  getCell(col: number, row: number): CellType | undefined {
    return this.cells[row]?.[col];
  }

  setCell(col: number, row: number, type: CellType): void {
    const r = this.cells[row];
    if (r) r[col] = type;
  }

  isInBounds(col: number, row: number): boolean {
    return col >= 0 && col < COLS && row >= 0 && row < ROWS;
  }

  canPlace(col: number, row: number): boolean {
    if (!this.isInBounds(col, row)) return false;
    const cell = this.getCell(col, row);
    return cell === CellType.Empty;
  }

  /** 4-directional neighbours */
  getNeighbors(pos: Position): Position[] {
    const dirs: [number, number][] = [
      [0, -1], [1, 0], [0, 1], [-1, 0],
    ];
    const result: Position[] = [];
    for (const [dc, dr] of dirs) {
      const nc = pos.col + dc;
      const nr = pos.row + dr;
      if (this.isInBounds(nc, nr)) {
        result.push({ col: nc, row: nr });
      }
    }
    return result;
  }
}
