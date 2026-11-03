// ゲームの状態と成績の型(src/lib/CLAUDE.md の「保存(localStorage)」の型)
import type { Difficulty, Grid } from "@/lib/sudoku/grid";

export const GAME_STATUSES = ["playing", "cleared", "failed"] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

// 終わったゲームの結果
export type GameResult = Exclude<GameStatus, "playing">;

export interface CellSnapshot {
  index: number; // 0〜80
  value: number;
  notes: number[]; // 昇順
}

export interface HistoryEntry {
  before: CellSnapshot[];
  after: CellSnapshot[];
}

// プレイ中の状態。保存形式の SavedGame と同じ形
export interface GameState {
  difficulty: Difficulty;
  puzzle: Grid; // 手がかり
  solution: Grid;
  values: Grid; // 手がかりと入力
  notes: number[][]; // マスごとのメモ
  mistakes: number; // 0〜3
  elapsedSeconds: number;
  status: GameStatus;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
}

// この回数の間違いで失敗(R-08、G-52)
export const MAX_MISTAKES = 3;

export interface DifficultyStats {
  cleared: number;
  failed: number;
  bestSeconds: number | null;
}

export type SavedStats = Record<Difficulty, DifficultyStats>;
