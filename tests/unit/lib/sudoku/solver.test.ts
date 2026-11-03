import { describe, expect, it } from "vitest";

import { countSolutions } from "@/lib/sudoku/solver";

import {
  UNIQUE_PUZZLE,
  UNIQUE_SOLUTION,
  gridFrom,
} from "../../../helpers/grid";

describe("countSolutions", () => {
  describe("T-004: 解の数の判定", () => {
    it("T-004: 解が 1 つだけの問題は 1 を返す", () => {
      expect(countSolutions(UNIQUE_PUZZLE)).toBe(1);
    });

    it("T-004: 完成した盤面は 1 を返す", () => {
      expect(countSolutions(UNIQUE_SOLUTION)).toBe(1);
    });

    it("T-004: 4 マスの数字を入れ替えられる盤面は 2 を返す", () => {
      // UNIQUE_SOLUTION の 4 行目と 5 行目の 6・9 列目(1 と 3、3 と 1)を空けた盤面
      const twoSolutions = gridFrom(
        "534678912672195348198342567859760420426850790713924856961537284287419635345286179",
      );
      expect(countSolutions(twoSolutions)).toBe(2);
    });

    it("T-004: 上限を 3 にすると、解が 2 つの盤面は 2 のまま、空の盤面は 3 で止まる", () => {
      const twoSolutions = gridFrom(
        "534678912672195348198342567859760420426850790713924856961537284287419635345286179",
      );
      expect(countSolutions(twoSolutions, 3)).toBe(2);
      expect(countSolutions(new Array<number>(81).fill(0), 3)).toBe(3);
    });

    it("T-004: 同じ単位に重なりは無いが解けない盤面は 0 を返す", () => {
      // UNIQUE_PUZZLE の 3 マス目に、行・列・ブロックと重ならない 1 を入れた盤面
      const noSolution = gridFrom(
        "531070000600195000098000060800060003400803001700020006060000280000419005000080079",
      );
      expect(countSolutions(noSolution)).toBe(0);
    });

    it("T-004: 渡した盤面を書き換えない", () => {
      const puzzle = [...UNIQUE_PUZZLE];
      countSolutions(puzzle);
      expect(puzzle).toEqual(UNIQUE_PUZZLE);
    });
  });

  describe("T-005: 解が 1 つだけの問題にならない盤面", () => {
    it("T-005: 空の盤面は 2 を返す(既定の上限)", () => {
      expect(countSolutions(new Array<number>(81).fill(0))).toBe(2);
    });

    it("T-005: 同じ行に同じ数字がある盤面は 0 を返す", () => {
      const grid = new Array<number>(81).fill(0);
      grid[0] = 5;
      grid[8] = 5;
      expect(countSolutions(grid)).toBe(0);
    });

    it("T-005: 同じ列に同じ数字がある盤面は 0 を返す", () => {
      const grid = new Array<number>(81).fill(0);
      grid[0] = 5;
      grid[72] = 5;
      expect(countSolutions(grid)).toBe(0);
    });

    it("T-005: 同じブロックに同じ数字がある盤面は 0 を返す(行も列も違うマス)", () => {
      const grid = new Array<number>(81).fill(0);
      grid[0] = 5;
      grid[20] = 5;
      expect(countSolutions(grid)).toBe(0);
    });

    it("T-005: 完成した盤面に重なりが 1 つあると 0 を返す", () => {
      const grid = [...UNIQUE_SOLUTION];
      grid[80] = grid[79] ?? 0;
      expect(countSolutions(grid)).toBe(0);
    });

    it("T-005: 80 要素と 82 要素の盤面は 0 を返す", () => {
      expect(countSolutions(UNIQUE_PUZZLE.slice(0, 80))).toBe(0);
      expect(countSolutions([...UNIQUE_PUZZLE, 0])).toBe(0);
      expect(countSolutions([])).toBe(0);
    });

    it("T-005: 0〜9 の整数でない値がある盤面は 0 を返す", () => {
      for (const bad of [10, -1, 1.5, Number.NaN]) {
        const grid = [...UNIQUE_PUZZLE];
        grid[2] = bad;
        expect(countSolutions(grid), String(bad)).toBe(0);
      }
      // 完成した盤面の 1 マスを 0.5 にしても、解が 1 つとは数えない
      const solved = [...UNIQUE_SOLUTION];
      solved[0] = 0.5;
      expect(countSolutions(solved)).toBe(0);
    });
  });
});
