import { describe, expect, it } from "vitest";

import { DEFAULT_TIME_LIMIT_MS, generatePuzzle } from "@/lib/sudoku/generator";

describe("generatePuzzle の時間", () => {
  it(
    "T-009: むずかしいの問題を 20 回作り、どれも既定の時間の上限の中で作れる(時間は出力に記録する)",
    { timeout: 20 * DEFAULT_TIME_LIMIT_MS },
    () => {
      const times: number[] = [];
      for (let seed = 1; seed <= 20; seed++) {
        const start = performance.now();
        const result = generatePuzzle("hard", seed);
        times.push(performance.now() - start);
        expect(result.ok, `乱数の元 ${seed}`).toBe(true);
      }

      const sorted = [...times].sort((a, b) => a - b);
      const average = times.reduce((sum, t) => sum + t, 0) / times.length;
      const median = (sorted[9]! + sorted[10]!) / 2;
      // スマホの目標(N-02 の 3 秒以内)の参考にするため、PC での時間を残す
      console.info(
        `T-009 むずかしい 20 回(ミリ秒): 平均 ${average.toFixed(0)}、中央値 ${median.toFixed(0)}、` +
          `最小 ${sorted[0]!.toFixed(0)}、最大 ${sorted[19]!.toFixed(0)}(上限 ${DEFAULT_TIME_LIMIT_MS})`,
      );
    },
  );
});
