// メモの付け外し(G-31、G-32)
import { changeCell, isCellIndex, isDigit } from "./state";
import type { GameState } from "./types";

export function toggleNote(
  state: GameState,
  index: number,
  digit: number,
): GameState {
  if (state.status !== "playing" || !isCellIndex(index) || !isDigit(digit)) {
    return state;
  }
  // 数字の入ったマス(手がかり、正解、誤り)にはメモを入れられない
  if (state.values[index] !== 0) return state;

  const current = state.notes[index]!;
  const notes = current.includes(digit)
    ? current.filter((d) => d !== digit)
    : [...current, digit].sort((a, b) => a - b);
  return changeCell(state, index, 0, notes);
}
