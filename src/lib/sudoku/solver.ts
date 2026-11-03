// 解の数を数える処理(G-01)。候補をビットで持ち、候補の少ないマスから試す

import {
  ALL_DIGITS,
  CELL_COUNT,
  PEERS,
  bit,
  bitCount,
  hasConflict,
  isGridShape,
} from "./grid";

// 解の数を、limit で打ち切って数える。形が違う盤面と、手がかりが重なる盤面は 0
export function countSolutions(grid: readonly number[], limit = 2): number {
  if (!isGridShape(grid) || hasConflict(grid)) return 0;

  const cells = [...grid];
  let found = 0;

  const candidates = (i: number): number => {
    let used = 0;
    for (const p of PEERS[i]!) used |= bit(cells[p]!);
    return ALL_DIGITS & ~used;
  };

  const search = (): void => {
    // 候補の一番少ない空欄を選ぶ
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (cells[i] !== 0) continue;
      const mask = candidates(i);
      const count = bitCount(mask);
      if (count < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = count;
        if (count <= 1) break;
      }
    }
    if (best === -1) {
      found++;
      return;
    }
    for (let v = 1; v <= 9 && found < limit; v++) {
      if ((bestMask & bit(v)) === 0) continue;
      cells[best] = v;
      search();
    }
    cells[best] = 0;
  };

  search();
  return found;
}
