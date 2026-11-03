import { describe, expect, it } from "vitest";

import { createRandom, shuffle } from "@/lib/sudoku/random";

describe("createRandom", () => {
  it("T-011: 0 以上 1 未満の数を返す(乱数の元の 0 と 2^32-1 でも)", () => {
    for (const seed of [0, 1, 42, 0xffffffff]) {
      const random = createRandom(seed);
      for (let i = 0; i < 10_000; i++) {
        const value = random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });

  it("T-011: 同じ乱数の元なら同じ並び、違う元なら違う並びになる", () => {
    const take = (seed: number) => {
      const random = createRandom(seed);
      return Array.from({ length: 5 }, () => random());
    };
    expect(take(7)).toEqual(take(7));
    expect(take(7)).not.toEqual(take(8));
  });

  it("T-011: 値が偏らない(10 等分した区間に、それぞれ 1 割前後入る)", () => {
    const random = createRandom(123);
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 10_000; i++) {
      const index = Math.floor(random() * 10);
      buckets[index] = (buckets[index] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(900);
      expect(count).toBeLessThan(1100);
    }
  });
});

describe("shuffle", () => {
  it("T-011: 入力を変えずに、同じ要素の並べ替えを返す", () => {
    const items = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const result = shuffle(items, createRandom(1));
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result).not.toBe(items);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("T-011: 乱数で順が変わる(乱数の元を変えると、どれかは元の順と違う)", () => {
    const orders = [1, 2, 3].map((seed) =>
      shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], createRandom(seed)).join(""),
    );
    expect(orders.some((order) => order !== "123456789")).toBe(true);
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it("T-011: 先頭と末尾の要素も動く(どの位置の要素も、どこにでも来うる)", () => {
    const random = createRandom(99);
    const firstPositions = new Set<number>();
    const lastPositions = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const result = shuffle([0, 1, 2, 3, 4], random);
      firstPositions.add(result.indexOf(0));
      lastPositions.add(result.indexOf(4));
    }
    expect(firstPositions.size).toBe(5);
    expect(lastPositions.size).toBe(5);
  });

  it("T-011: 空の配列と 1 要素の配列はそのまま返す", () => {
    expect(shuffle([], createRandom(1))).toEqual([]);
    expect(shuffle(["a"], createRandom(1))).toEqual(["a"]);
  });
});
