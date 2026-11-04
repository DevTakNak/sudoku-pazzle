// 数字の入力と消す(G-21〜G-26、G-33、G-51〜G-53)
import { PEERS } from "@/lib/sudoku/grid";

import { changeCell, changeCells, isCellIndex, isDigit } from "./state";
import { MAX_MISTAKES } from "./types";
import type { CellSnapshot, GameState } from "./types";

// 手がかりか正解の入ったマスは変えられない
function isFixed(state: GameState, index: number): boolean {
  return (
    state.puzzle[index] !== 0 || state.values[index] === state.solution[index]
  );
}

export function inputDigit(
  state: GameState,
  index: number,
  digit: number,
): GameState {
  if (state.status !== "playing" || !isCellIndex(index) || !isDigit(digit)) {
    return state;
  }
  if (isFixed(state, index) || state.values[index] === digit) return state;

  if (digit !== state.solution[index]) {
    const next = changeCell(state, index, digit, []);
    const mistakes = state.mistakes + 1;
    return {
      ...next,
      mistakes,
      status: mistakes >= MAX_MISTAKES ? "failed" : "playing",
    };
  }
  // 正解なら、同じ行・列・ブロックのメモからその数字を消し、入力と 1 つの操作にする(G-33)
  const peerNotes: CellSnapshot[] = PEERS[index]!.filter((p) =>
    state.notes[p]!.includes(digit),
  ).map((p) => ({
    index: p,
    value: state.values[p]!,
    notes: state.notes[p]!.filter((d) => d !== digit),
  }));
  const next = changeCells(state, [
    { index, value: digit, notes: [] },
    ...peerNotes,
  ]);
  const solved = next.values.every((v, i) => v === next.solution[i]);
  return solved ? { ...next, status: "cleared" } : next;
}

export function eraseCell(state: GameState, index: number): GameState {
  if (state.status !== "playing" || !isCellIndex(index)) return state;
  if (isFixed(state, index)) return state;
  if (state.values[index] === 0 && state.notes[index]!.length === 0) {
    return state;
  }
  return changeCell(state, index, 0, []);
}
