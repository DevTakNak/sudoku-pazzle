// ゲームの初めの状態と、マスを変える共通の処理
import { CELL_COUNT } from "@/lib/sudoku/grid";
import type { Difficulty, Grid } from "@/lib/sudoku/grid";

import type { CellSnapshot, GameState } from "./types";

export function createGame(
  difficulty: Difficulty,
  puzzle: Grid,
  solution: Grid,
): GameState {
  return {
    difficulty,
    puzzle: [...puzzle],
    solution: [...solution],
    values: [...puzzle],
    notes: Array.from({ length: CELL_COUNT }, () => []),
    mistakes: 0,
    elapsedSeconds: 0,
    status: "playing",
    undoStack: [],
    redoStack: [],
  };
}

// 同じ問題を初めの状態に戻す(G-55)
export function restartGame(state: GameState): GameState {
  return createGame(state.difficulty, state.puzzle, state.solution);
}

export function isCellIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < CELL_COUNT;
}

export function isDigit(digit: number): boolean {
  return Number.isInteger(digit) && digit >= 1 && digit <= 9;
}

function snapshotOf(state: GameState, index: number): CellSnapshot {
  return {
    index,
    value: state.values[index]!,
    notes: [...state.notes[index]!],
  };
}

// マスを書き換えた新しい盤面とメモを返す
export function applySnapshots(
  state: GameState,
  cells: readonly CellSnapshot[],
): Pick<GameState, "values" | "notes"> {
  const values = [...state.values];
  const notes = [...state.notes];
  for (const cell of cells) {
    values[cell.index] = cell.value;
    notes[cell.index] = [...cell.notes];
  }
  return { values, notes };
}

// 1 マスを変える操作を、履歴に足して反映する。やり直しの履歴は捨てる(G-43)
export function changeCell(
  state: GameState,
  index: number,
  value: number,
  notes: number[],
): GameState {
  const before = snapshotOf(state, index);
  const after: CellSnapshot = { index, value, notes };
  return {
    ...state,
    ...applySnapshots(state, [after]),
    undoStack: [...state.undoStack, { before: [before], after: [after] }],
    redoStack: [],
  };
}
