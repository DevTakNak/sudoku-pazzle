// 盤面の型と、行・列・ブロックの補助関数(src/lib/CLAUDE.md の「保存(localStorage)」の型)

import { isIntInRange } from "@/lib/guards";

// 易しい順
export const DIFFICULTIES = ["easy", "normal", "hard"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.some((d) => d === value);
}

// 盤面は 81 要素の配列。行ごとに左上から右下へ並べる。数字は 1〜9、空欄は 0
export type Grid = number[];

export const CELL_COUNT = 81;

export function rowOf(index: number): number {
  return Math.floor(index / 9);
}

export function colOf(index: number): number {
  return index % 9;
}

export function boxOf(index: number): number {
  return Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3);
}

function buildUnits(pick: (unit: number, k: number) => number): number[][] {
  return Array.from({ length: 9 }, (_, unit) =>
    Array.from({ length: 9 }, (_, k) => pick(unit, k)),
  );
}

export const ROWS: readonly (readonly number[])[] = buildUnits(
  (r, k) => r * 9 + k,
);
export const COLS: readonly (readonly number[])[] = buildUnits(
  (c, k) => k * 9 + c,
);
export const BOXES: readonly (readonly number[])[] = buildUnits(
  (b, k) =>
    (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3),
);

// 行・列・ブロックの 27 個の単位
export const UNITS: readonly (readonly number[])[] = [
  ...ROWS,
  ...COLS,
  ...BOXES,
];

// マスごとの、同じ行・列・ブロックにあるほかの 20 マス
export const PEERS: readonly (readonly number[])[] = Array.from(
  { length: CELL_COUNT },
  (_, i) => {
    const peers = new Set([
      ...ROWS[rowOf(i)]!,
      ...COLS[colOf(i)]!,
      ...BOXES[boxOf(i)]!,
    ]);
    peers.delete(i);
    return [...peers];
  },
);

// 81 要素で、どれも 0〜9 の整数か
export function isGridShape(value: unknown): value is Grid {
  return (
    Array.isArray(value) &&
    value.length === CELL_COUNT &&
    (value as unknown[]).every((v) => isIntInRange(v, 0, 9))
  );
}

// 0 でない数字どうしが、同じ行・列・ブロックで重なるか
export function hasConflict(grid: readonly number[]): boolean {
  return grid.some((v, i) => v !== 0 && PEERS[i]!.some((p) => grid[p] === v));
}

// 候補は 1〜9 をビット(1 << 数字)で持つ
export const ALL_DIGITS = 0b1111111110;

export const bit = (digit: number): number => 1 << digit;

export function bitCount(mask: number): number {
  let n = 0;
  for (let m = mask; m !== 0; m &= m - 1) n++;
  return n;
}
