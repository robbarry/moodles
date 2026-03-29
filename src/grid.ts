import { CellType, COLS, ROWS, Position } from './types';

export class Grid {
  cells: CellType[][];
  spawn: Position;
  goal: Position;
  cols: number;
  rows: number;

  constructor(cols: number = COLS, rows: number = ROWS, spawn?: Position, goal?: Position) {
    this.cols = cols;
    this.rows = rows;
    this.cells = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => CellType.Empty)
    );
    this.spawn = spawn ?? { col: 0, row: 0 };
    this.goal = goal ?? { col: cols - 1, row: rows - 1 };
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
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
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
