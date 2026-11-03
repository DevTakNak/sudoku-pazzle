// 元に戻す・やり直し(G-41〜G-44、G-53)。間違いの回数は変えない
import { applySnapshots } from "./state";
import type { GameState } from "./types";

export function undo(state: GameState): GameState {
  const entry = state.undoStack.at(-1);
  if (state.status !== "playing" || entry === undefined) return state;
  return {
    ...state,
    ...applySnapshots(state, entry.before),
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, entry],
  };
}

export function redo(state: GameState): GameState {
  const entry = state.redoStack.at(-1);
  if (state.status !== "playing" || entry === undefined) return state;
  return {
    ...state,
    ...applySnapshots(state, entry.after),
    undoStack: [...state.undoStack, entry],
    redoStack: state.redoStack.slice(0, -1),
  };
}
