import { describe, expect, it } from "vitest";

import { completedDigits } from "@/lib/game/digits";

import { BLANK_A, freshGame, withValues } from "../../../helpers/game";
import { UNIQUE_PUZZLE, UNIQUE_SOLUTION } from "../../../helpers/grid";

// 解で数字 d が入るマスの番号(9 か所)
function cellsOf(digit: number): number[] {
  return UNIQUE_SOLUTION.flatMap((v, i) => (v === digit ? [i] : []));
}

// 数字 d のマスを、except を除いて解のとおりに埋めた状態
function filled(digit: number, except: number[] = []) {
  const changes: Record<number, number> = {};
  for (const i of cellsOf(digit)) if (!except.includes(i)) changes[i] = digit;
  return withValues(freshGame(), changes);
}

describe("T-135: 入れ終わった数字", () => {
  it("T-135: 前提(マス 2 の解は 4 で、4 は手がかりに 2 か所ある)", () => {
    expect(cellsOf(4)).toHaveLength(9);
    expect(cellsOf(4)).toContain(BLANK_A);
    expect(cellsOf(4).filter((i) => UNIQUE_PUZZLE[i] === 4)).toHaveLength(2);
  });

  it("T-135: 初めの盤面では、入れ終わった数字は無い", () => {
    expect(completedDigits(freshGame())).toEqual(new Set());
  });

  it("T-135: 手がかりと入力した正解で 9 か所そろった数字だけが入る", () => {
    expect(completedDigits(filled(4))).toEqual(new Set([4]));
  });

  it("T-135: 8 か所のときは入れ終わっていない", () => {
    expect(completedDigits(filled(4, [BLANK_A]))).toEqual(new Set());
  });

  it("T-135: 8 か所の正解と、別のマスの誤りの同じ数字で 9 か所になっても、入れ終わっていない", () => {
    // マス 3(解は 6)に誤りの 4 を入れる
    const state = withValues(filled(4, [BLANK_A]), { 3: 4 });
    expect(state.values.filter((v) => v === 4)).toHaveLength(9);
    expect(completedDigits(state)).toEqual(new Set());
  });

  it("T-135: 複数の数字がそろえば、すべて入る", () => {
    const state = withValues(filled(4), {
      ...Object.fromEntries(cellsOf(9).map((i) => [i, 9])),
    });
    expect(completedDigits(state)).toEqual(new Set([4, 9]));
  });
});
