import { describe, expect, it } from "vitest";

import {
  createEmptyStats,
  formatBestTime,
  formatClearRate,
  recordResult,
} from "@/lib/game/stats";
import type { DifficultyStats, SavedStats } from "@/lib/game/types";
import type { Difficulty } from "@/lib/sudoku/grid";

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

// 難易度ごとに違う値を持つ成績(取り違えを見つけるため)
function sampleStats(): SavedStats {
  return {
    easy: { cleared: 3, failed: 1, bestSeconds: 200 },
    normal: { cleared: 5, failed: 2, bestSeconds: 400 },
    hard: { cleared: 7, failed: 4, bestSeconds: 800 },
  };
}

describe("createEmptyStats", () => {
  it("T-202: 3 つの難易度とも、クリア 0・失敗 0・ベストタイムなし", () => {
    expect(createEmptyStats()).toEqual({
      easy: { cleared: 0, failed: 0, bestSeconds: null },
      normal: { cleared: 0, failed: 0, bestSeconds: null },
      hard: { cleared: 0, failed: 0, bestSeconds: null },
    });
  });

  it("T-202: 呼ぶたびに別のオブジェクトを返す(書き換えが響き合わない)", () => {
    const a = createEmptyStats();
    const b = createEmptyStats();
    expect(a).not.toBe(b);
    expect(a.easy).not.toBe(b.easy);
    expect(a.easy).not.toBe(a.normal);
  });
});

describe("recordResult の回数", () => {
  it.each(DIFFICULTIES)(
    "T-202: %s でクリアすると、その難易度のクリア数だけが 1 増える(失敗数とほかの難易度は変わらない)",
    (difficulty) => {
      const before = sampleStats();
      // 1000 秒はどの難易度のベストタイムより長いので、ベストタイムは変わらない
      const after = recordResult(before, difficulty, "cleared", 1000);
      const expected = sampleStats();
      expected[difficulty].cleared += 1;
      expect(after).toEqual(expected);
      expect(after[difficulty].failed).toBe(before[difficulty].failed);
    },
  );

  it.each(DIFFICULTIES)(
    "T-202: %s で失敗すると、その難易度の失敗数だけが 1 増える(クリア数とベストタイムは変わらない)",
    (difficulty) => {
      const before = sampleStats();
      const after = recordResult(before, difficulty, "failed", 10);
      const expected = sampleStats();
      expected[difficulty].failed += 1;
      expect(after).toEqual(expected);
    },
  );

  it("T-202: 空の成績にクリアを記録すると、クリア 1・失敗 0 になる", () => {
    const after = recordResult(createEmptyStats(), "normal", "cleared", 90);
    expect(after.normal).toEqual({ cleared: 1, failed: 0, bestSeconds: 90 });
    expect(after.easy).toEqual({ cleared: 0, failed: 0, bestSeconds: null });
    expect(after.hard).toEqual({ cleared: 0, failed: 0, bestSeconds: null });
  });

  it("T-202: 空の成績に失敗を記録すると、失敗 1・クリア 0 になる", () => {
    const after = recordResult(createEmptyStats(), "hard", "failed", 90);
    expect(after.hard).toEqual({ cleared: 0, failed: 1, bestSeconds: null });
    expect(after.easy).toEqual(createEmptyStats().easy);
    expect(after.normal).toEqual(createEmptyStats().normal);
  });

  it("T-202: 続けて記録すると、回数が積み重なる", () => {
    let stats = createEmptyStats();
    stats = recordResult(stats, "easy", "cleared", 100);
    stats = recordResult(stats, "easy", "failed", 50);
    stats = recordResult(stats, "easy", "cleared", 120);
    expect(stats.easy).toEqual({ cleared: 2, failed: 1, bestSeconds: 100 });
  });

  it("T-202: 渡した成績を書き換えない", () => {
    const before = sampleStats();
    const copy = structuredClone(before);
    recordResult(before, "easy", "cleared", 1);
    recordResult(before, "normal", "failed", 1);
    expect(before).toEqual(copy);
  });

  it("T-202: 空の成績を渡しても、渡したオブジェクトは空のまま", () => {
    const empty = createEmptyStats();
    recordResult(empty, "easy", "cleared", 30);
    expect(empty).toEqual(createEmptyStats());
  });
});

describe("formatClearRate", () => {
  it.each<[string, number, number, string]>([
    ["0 回", 0, 0, "-"],
    ["1/3(33.3%)", 1, 2, "33%"],
    ["2/3(66.7%)", 2, 1, "67%"],
    ["すべてクリア", 5, 0, "100%"],
    ["1 回だけクリア", 1, 0, "100%"],
    ["すべて失敗", 0, 4, "0%"],
    ["1 回だけ失敗", 0, 1, "0%"],
    ["1/2(50%)", 1, 1, "50%"],
    ["1/8(12.5% は切り上げて 13%)", 1, 7, "13%"],
    ["3/8(37.5% は切り上げて 38%)", 3, 5, "38%"],
    ["1/200(0.5% は切り上げて 1%)", 1, 199, "1%"],
    // 割ってから 100 を掛けると 57.49999… になり、切り捨てられてしまう組
    ["23/40(57.5% は切り上げて 58%)", 23, 17, "58%"],
    ["46/80(57.5% は切り上げて 58%)", 46, 34, "58%"],
    ["29/200(14.5% は切り上げて 15%)", 29, 171, "15%"],
    ["1/9(11.1% は切り捨てて 11%)", 1, 8, "11%"],
  ])("T-203: クリア率: %s", (_, cleared, failed, expected) => {
    const stats: DifficultyStats = {
      cleared,
      failed,
      bestSeconds: cleared > 0 ? 100 : null,
    };
    expect(formatClearRate(stats)).toBe(expected);
  });
});

describe("recordResult のベストタイム", () => {
  it("T-204: 初めてのクリアは、そのタイムを記録する", () => {
    const after = recordResult(createEmptyStats(), "easy", "cleared", 125);
    expect(after.easy.bestSeconds).toBe(125);
  });

  it("T-204: 前より短いタイムは、更新する", () => {
    const before = recordResult(createEmptyStats(), "easy", "cleared", 125);
    const after = recordResult(before, "easy", "cleared", 124);
    expect(after.easy.bestSeconds).toBe(124);
    expect(after.easy.cleared).toBe(2);
  });

  it("T-204: 前と同じタイムは、変えない", () => {
    const before = recordResult(createEmptyStats(), "easy", "cleared", 125);
    const after = recordResult(before, "easy", "cleared", 125);
    expect(after.easy.bestSeconds).toBe(125);
    expect(after.easy.cleared).toBe(2);
  });

  it("T-204: 前より長いタイムは、変えない", () => {
    const before = recordResult(createEmptyStats(), "easy", "cleared", 125);
    const after = recordResult(before, "easy", "cleared", 126);
    expect(after.easy.bestSeconds).toBe(125);
    expect(after.easy.cleared).toBe(2);
  });

  it("T-204: 失敗は、ベストタイムが無いままなら無いまま", () => {
    const after = recordResult(createEmptyStats(), "easy", "failed", 5);
    expect(after.easy.bestSeconds).toBeNull();
  });

  it("T-204: 失敗は、ベストタイムより短い時間でも更新しない", () => {
    const before = recordResult(createEmptyStats(), "easy", "cleared", 125);
    const after = recordResult(before, "easy", "failed", 5);
    expect(after.easy.bestSeconds).toBe(125);
  });

  it("T-204: ベストタイムは難易度ごとに別々に持つ", () => {
    let stats = recordResult(createEmptyStats(), "easy", "cleared", 300);
    stats = recordResult(stats, "hard", "cleared", 900);
    stats = recordResult(stats, "easy", "cleared", 250);
    expect(stats.easy.bestSeconds).toBe(250);
    expect(stats.normal.bestSeconds).toBeNull();
    expect(stats.hard.bestSeconds).toBe(900);
  });

  it("T-204: 0 秒のクリアも記録し(null とは別)、次の長いタイムで上書きしない", () => {
    const first = recordResult(createEmptyStats(), "easy", "cleared", 0);
    expect(first.easy.bestSeconds).toBe(0);
    const second = recordResult(first, "easy", "cleared", 5);
    expect(second.easy.bestSeconds).toBe(0);
  });
});

describe("formatBestTime", () => {
  it.each<[string, number | null, string]>([
    ["ベストタイムが無い", null, "-"],
    ["0 秒", 0, "00:00"],
    ["59 秒", 59, "00:59"],
    ["125 秒", 125, "02:05"],
    ["3599 秒", 3599, "59:59"],
    ["3600 秒", 3600, "1:00:00"],
  ])("T-204: ベストタイムの表示: %s", (_, bestSeconds, expected) => {
    expect(
      formatBestTime({
        cleared: bestSeconds === null ? 0 : 1,
        failed: 0,
        bestSeconds,
      }),
    ).toBe(expected);
  });
});
