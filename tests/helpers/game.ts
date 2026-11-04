// ゲームの状態(GameState)を、本番のコードを使わずに組み立てる補助関数。
// 本番の createGame などに引きずられず、テストが期待する値を自分で持つため。
import type { CellSnapshot, GameState, HistoryEntry } from "@/lib/game/types";
import type { Difficulty, Grid } from "@/lib/sudoku/grid";

import { UNIQUE_PUZZLE, UNIQUE_SOLUTION } from "./grid";

// UNIQUE_PUZZLE の 1 行目は "53..7...."、UNIQUE_SOLUTION の 1 行目は "534678912"。
// マスの番号と、その解の数字
export const CLUE_INDEX = 0; // 手がかり(解も 5)
export const BLANK_A = 2; // 空欄(解は 4)
export const BLANK_B = 3; // 空欄(解は 6)
export const BLANK_C = 5; // 空欄(解は 8)
export const BLANK_D = 6; // 空欄(解は 9)
export const SOLUTION_A = 4;
export const SOLUTION_B = 6;
export const SOLUTION_C = 8;
export const SOLUTION_D = 9;

// マス 2(BLANK_A、0 行 2 列、左上のブロック)から見た、メモを置く空欄(G-33 のテストで使う)。
// 解はどれも 4 と違う。関係が名前のとおりであることは、input.test.ts の前提のテストで確かめる
export const ROW_PEER = BLANK_B; // 同じ行(0 行 3 列、解は 6)
export const BOX_PEER = 10; // 同じブロックだけ(1 行 1 列、解は 7)
export const COL_PEER = 29; // 同じ列だけ(3 行 2 列、解は 9)
export const OUTSIDE = 40; // 行・列・ブロックの外(4 行 4 列、解は 5)

// UNIQUE_PUZZLE の 1 マス目(解は 5)と 81 マス目(解は 9)の手がかりを抜いた問題。
// マスの番号の境界(0 と 80)に入力できることを確かめるために使う。
// 抜いても解が 1 つのままであることは、input.test.ts の前提のテストで確かめる
export const EDGE_PUZZLE: Grid = UNIQUE_PUZZLE.map((v, i) =>
  i === 0 || i === 80 ? 0 : v,
);

export function emptyNotes(): number[][] {
  return Array.from({ length: 81 }, () => []);
}

// 初めの状態(G-55)。本番の createGame とは別に書く
export function freshGame(
  difficulty: Difficulty = "easy",
  puzzle: Grid = UNIQUE_PUZZLE,
  solution: Grid = UNIQUE_SOLUTION,
): GameState {
  return {
    difficulty,
    puzzle: [...puzzle],
    solution: [...solution],
    values: [...puzzle],
    notes: emptyNotes(),
    mistakes: 0,
    elapsedSeconds: 0,
    status: "playing",
    undoStack: [],
    redoStack: [],
  };
}

// マスの数字を差し替えた写しを返す(渡した状態は変えない)
export function withValues(
  state: GameState,
  changes: Record<number, number>,
): GameState {
  const values = [...state.values];
  for (const [index, value] of Object.entries(changes)) {
    values[Number(index)] = value;
  }
  return { ...state, values };
}

// マスのメモを差し替えた写しを返す(渡した状態は変えない)
export function withNotes(
  state: GameState,
  changes: Record<number, number[]>,
): GameState {
  const notes = state.notes.map((n) => [...n]);
  for (const [index, digits] of Object.entries(changes)) {
    notes[Number(index)] = [...digits];
  }
  return { ...state, notes };
}

// 指定したマスだけが空欄で、あとは解のとおりの状態。
// 指定するマスは、問題の空欄でなければならない(手がかりを抜くと問題が変わるため)
export function almostSolved(
  blankIndices: readonly number[],
  base: GameState = freshGame(),
): GameState {
  for (const i of blankIndices) {
    if (base.puzzle[i] !== 0) {
      throw new Error(`マス ${i} は手がかりで、空欄にできない`);
    }
  }
  const values = [...base.solution];
  for (const i of blankIndices) values[i] = 0;
  return { ...base, values };
}

export function snapshot(
  index: number,
  value: number,
  notes: number[] = [],
): CellSnapshot {
  return { index, value, notes: [...notes] };
}

export function entry(before: CellSnapshot, after: CellSnapshot): HistoryEntry {
  return { before: [before], after: [after] };
}

// 保存の確かめに使う、中身の多い進行中の状態。
// 誤りの数字、メモ、元に戻す・やり直しの履歴、回数 1、時間 125 秒を持つ
export function richPlayingGame(): GameState {
  const state = freshGame("normal");
  return {
    ...withNotes(withValues(state, { [BLANK_A]: 4, [BLANK_B]: 1 }), {
      [BLANK_C]: [1, 3, 8],
      [BLANK_D]: [2, 9],
    }),
    mistakes: 1,
    elapsedSeconds: 125,
    undoStack: [
      entry(snapshot(BLANK_A, 0, [1, 4]), snapshot(BLANK_A, 4, [])),
      entry(snapshot(BLANK_B, 0, []), snapshot(BLANK_B, 1, [])),
    ],
    redoStack: [entry(snapshot(7, 0, []), snapshot(7, 0, [5]))],
  };
}

// 失敗した状態(回数 3)。誤りの数字が残り、空欄もある
export function failedGame(): GameState {
  const state = withValues(freshGame("hard"), { [BLANK_A]: 1, [BLANK_B]: 2 });
  return {
    ...state,
    mistakes: 3,
    elapsedSeconds: 600,
    status: "failed",
    undoStack: [
      entry(snapshot(BLANK_A, 0, [1]), snapshot(BLANK_A, 1, [])),
      entry(snapshot(BLANK_B, 0, []), snapshot(BLANK_B, 2, [])),
    ],
    redoStack: [entry(snapshot(7, 0, []), snapshot(7, 0, [5]))],
  };
}

// クリアした状態。すべてのマスが解のとおりで、メモは無い
export function clearedGame(): GameState {
  const state = freshGame("easy");
  return {
    ...state,
    values: [...state.solution],
    mistakes: 1,
    elapsedSeconds: 300,
    status: "cleared",
    undoStack: [entry(snapshot(BLANK_A, 0, []), snapshot(BLANK_A, 4, []))],
    redoStack: [entry(snapshot(7, 0, []), snapshot(7, 1, []))],
  };
}
