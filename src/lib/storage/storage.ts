// localStorage の読み書き(src/lib/CLAUDE.md の「保存(localStorage)」と「読み込みの検証(G-81)」)。
// Storage を引数で受け取り、例外は外に出さない(G-81、G-82)
import { createEmptyStats } from "@/lib/game/stats";
import { GAME_STATUSES, MAX_MISTAKES } from "@/lib/game/types";
import type {
  CellSnapshot,
  DifficultyStats,
  GameState,
  GameStatus,
  HistoryEntry,
  SavedStats,
} from "@/lib/game/types";
import { isIntInRange, isRecord } from "@/lib/guards";
import {
  CELL_COUNT,
  DIFFICULTIES,
  hasConflict,
  isDifficulty,
  isGridShape,
} from "@/lib/sudoku/grid";
import type { Grid } from "@/lib/sudoku/grid";

export const GAME_KEY = "sudoku:v1:game";
export const STATS_KEY = "sudoku:v1:stats";

// ブラウザの localStorage。参照で例外が出る(無効にされているなど)ときと、
// サーバーの描画(window が無く、参照で例外になる)ときは null(G-82、G-83)
export function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// 0 以上の安全な整数(2^53-1 まで)
function isNonNegativeInt(value: unknown): value is number {
  return isIntInRange(value, 0, Number.MAX_SAFE_INTEGER);
}

function isGameStatus(value: unknown): value is GameStatus {
  return GAME_STATUSES.some((s) => s === value);
}

// 1〜9 の整数の、重なりの無い昇順の配列
function parseNotes(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const notes: number[] = [];
  let prev = 0;
  for (const d of value as unknown[]) {
    if (!isIntInRange(d, 1, 9) || d <= prev) return null;
    notes.push(d);
    prev = d;
  }
  return notes;
}

// 履歴のマス。手がかりのマスを指さず、数字の入ったマスにメモは無い
function parseSnapshot(value: unknown, puzzle: Grid): CellSnapshot | null {
  if (!isRecord(value)) return null;
  const { index, value: cellValue } = value;
  const notes = parseNotes(value.notes);
  if (!isIntInRange(index, 0, CELL_COUNT - 1) || puzzle[index] !== 0) {
    return null;
  }
  if (!isIntInRange(cellValue, 0, 9) || notes === null) return null;
  if (cellValue !== 0 && notes.length > 0) return null;
  return { index, value: cellValue, notes };
}

function parseSnapshots(value: unknown, puzzle: Grid): CellSnapshot[] | null {
  if (!Array.isArray(value)) return null;
  const cells: CellSnapshot[] = [];
  for (const v of value as unknown[]) {
    const cell = parseSnapshot(v, puzzle);
    if (cell === null) return null;
    cells.push(cell);
  }
  return cells;
}

function parseHistory(value: unknown, puzzle: Grid): HistoryEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: HistoryEntry[] = [];
  for (const v of value as unknown[]) {
    if (!isRecord(v)) return null;
    const before = parseSnapshots(v.before, puzzle);
    const after = parseSnapshots(v.after, puzzle);
    if (before === null || after === null) return null;
    entries.push({ before, after });
  }
  return entries;
}

function isSolutionGrid(grid: Grid): boolean {
  return grid.every((v) => v !== 0) && !hasConflict(grid);
}

function sameGrid(a: Grid, b: Grid): boolean {
  return a.every((v, i) => v === b[i]);
}

export function parseGame(value: unknown): GameState | null {
  if (!isRecord(value)) return null;
  const { difficulty, puzzle, solution, values, mistakes, elapsedSeconds } =
    value;
  const status = value.status;
  if (!isDifficulty(difficulty) || !isGameStatus(status)) return null;
  if (!isGridShape(puzzle) || !isGridShape(solution) || !isGridShape(values)) {
    return null;
  }
  if (!isIntInRange(mistakes, 0, MAX_MISTAKES)) return null;
  if (!isNonNegativeInt(elapsedSeconds)) return null;

  if (!isSolutionGrid(solution)) return null;
  for (let i = 0; i < CELL_COUNT; i++) {
    const clue = puzzle[i]!;
    if (clue !== 0 && (solution[i] !== clue || values[i] !== clue)) {
      return null;
    }
  }

  if (!Array.isArray(value.notes) || value.notes.length !== CELL_COUNT) {
    return null;
  }
  const notes: number[][] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const cellNotes = parseNotes((value.notes as unknown[])[i]);
    if (cellNotes === null) return null;
    // メモがあるのは空欄のマスだけ
    if (cellNotes.length > 0 && values[i] !== 0) return null;
    notes.push(cellNotes);
  }

  // 失敗は誤りのマスが残ったまま止まり、クリアは 3 回目の間違いの前に決まる
  const solved = sameGrid(values, solution);
  const consistent =
    status === "failed"
      ? mistakes === MAX_MISTAKES && !solved
      : mistakes < MAX_MISTAKES && solved === (status === "cleared");
  if (!consistent) return null;

  const undoStack = parseHistory(value.undoStack, puzzle);
  const redoStack = parseHistory(value.redoStack, puzzle);
  if (undoStack === null || redoStack === null) return null;

  // 渡された値と配列を共有しないように写す
  return {
    difficulty,
    puzzle: [...puzzle],
    solution: [...solution],
    values: [...values],
    notes,
    mistakes,
    elapsedSeconds,
    status,
    undoStack,
    redoStack,
  };
}

function parseDifficultyStats(value: unknown): DifficultyStats | null {
  if (!isRecord(value)) return null;
  const { cleared, failed, bestSeconds } = value;
  if (!isNonNegativeInt(cleared) || !isNonNegativeInt(failed)) return null;
  if (bestSeconds !== null && !isNonNegativeInt(bestSeconds)) return null;
  // ベストタイムは、クリアが 1 回以上のときだけあり、そのときは必ずある
  if ((bestSeconds === null) !== (cleared === 0)) return null;
  return { cleared, failed, bestSeconds };
}

function parseStats(value: unknown): SavedStats | null {
  if (!isRecord(value)) return null;
  const stats = createEmptyStats();
  for (const d of DIFFICULTIES) {
    const parsed = parseDifficultyStats(value[d]);
    if (parsed === null) return null;
    stats[d] = parsed;
  }
  return stats;
}

function readJson(storage: Storage, key: string): unknown {
  try {
    const text = storage.getItem(key);
    return text === null ? null : (JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

function writeJson(storage: Storage, key: string, value: unknown): boolean {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage: Storage): GameState | null {
  return parseGame(readJson(storage, GAME_KEY));
}

export function saveGame(storage: Storage, game: GameState): boolean {
  return writeJson(storage, GAME_KEY, game);
}

export function loadStats(storage: Storage): SavedStats {
  return parseStats(readJson(storage, STATS_KEY)) ?? createEmptyStats();
}

export function saveStats(storage: Storage, stats: SavedStats): boolean {
  return writeJson(storage, STATS_KEY, stats);
}
