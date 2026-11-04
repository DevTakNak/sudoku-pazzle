// 入れ終わった数字(画面仕様書の「数字のボタン」)
import type { GameState } from "./types";

// 9 か所すべてに正解が入った数字(手がかりを含む)。誤りの数字は数えない
export function completedDigits(state: GameState): Set<number> {
  const counts = new Map<number, number>();
  state.values.forEach((v, i) => {
    if (v !== 0 && v === state.solution[i]) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  });
  return new Set([...counts].filter(([, n]) => n === 9).map(([d]) => d));
}
