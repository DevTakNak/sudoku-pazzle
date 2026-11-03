import { describe, expect, it } from "vitest";

import {
  UNIQUE_SOLUTION,
  gridFrom,
  gridToString,
  isSolvedGrid,
} from "../../../helpers/grid";

// テストの判定に使う補助関数そのものを確かめる(T-001 の「解がルールを満たす」の判定)
describe("isSolvedGrid", () => {
  it("T-011: 正しく埋まった盤面は true", () => {
    expect(isSolvedGrid(UNIQUE_SOLUTION)).toBe(true);
  });

  it("T-011: 列とブロックは正しいが、行に重なりがあると false", () => {
    // 1 列目の 1 行目と 2 行目(同じブロック)を入れ替える。列とブロックの数字はそろったまま
    const grid = [...UNIQUE_SOLUTION];
    [grid[0], grid[9]] = [grid[9]!, grid[0]!];
    expect(isSolvedGrid(grid)).toBe(false);
  });

  it("T-011: 行とブロックは正しいが、列に重なりがあると false", () => {
    // 1 行目の 1 マス目と 2 マス目を入れ替える(同じ行・同じブロックの中なので、崩れるのは列だけ)
    const grid = gridFrom(
      "354678912672195348198342567859761423426853791713924856961537284287419635345286179",
    );
    expect(isSolvedGrid(grid)).toBe(false);
  });

  it("T-011: 行と列は正しいが、ブロックに重なりがあると false", () => {
    // 行と列は 1〜9 がそろうが、ブロックはそろわない盤面(行ごとに 1 つずつずらした並び)
    const rows = Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => ((r + c) % 9) + 1),
    );
    expect(isSolvedGrid(rows.flat())).toBe(false);
  });

  it("T-011: 空欄があると false", () => {
    const grid = [...UNIQUE_SOLUTION];
    grid[40] = 0;
    expect(isSolvedGrid(grid)).toBe(false);
  });

  it("T-011: 81 要素でない盤面は false", () => {
    expect(isSolvedGrid(UNIQUE_SOLUTION.slice(0, 80))).toBe(false);
    expect(isSolvedGrid([...UNIQUE_SOLUTION, 1])).toBe(false);
  });
});

describe("gridFrom と gridToString", () => {
  it("T-011: 81 文字の文字列から盤面を作り、. と 0 を空欄にする", () => {
    const text = "5.".padEnd(81, "0");
    const grid = gridFrom(text);
    expect(grid).toHaveLength(81);
    expect(grid.slice(0, 3)).toEqual([5, 0, 0]);
    expect(gridToString(grid)).toBe("5".padEnd(81, "0"));
  });

  it("T-011: 81 文字でない文字列や、数字と . 以外の文字は例外にする", () => {
    expect(() => gridFrom("1".repeat(80))).toThrow();
    expect(() => gridFrom("x".repeat(81))).toThrow();
  });
});
