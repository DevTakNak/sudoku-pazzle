import { describe, expect, it } from "vitest";

import { CLUE_RANGES, rateByTechniques } from "@/lib/sudoku/difficulty";
import { generatePuzzle } from "@/lib/sudoku/generator";
import type { Difficulty } from "@/lib/sudoku/grid";
import { countSolutions } from "@/lib/sudoku/solver";

import { gridToString, isSolvedGrid } from "../../../helpers/grid";

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];
const SEEDS = [1, 2, 3];
// 生成は時間がかかるので、Vitest の既定(5 秒)より長く待つ
const SLOW = { timeout: 120_000 };

describe("generatePuzzle", () => {
  describe("T-001: 作った問題", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        it(
          `T-001: ${difficulty}・乱数の元 ${seed} の問題は解が 1 つだけで、解が数独のルールを満たし、難易度の条件に合う`,
          SLOW,
          () => {
            const result = generatePuzzle(difficulty, seed, {
              timeLimitMs: 60_000,
            });
            if (!result.ok) throw new Error(`作れなかった: ${result.reason}`);
            const { puzzle, solution } = result;

            expect(result.difficulty).toBe(difficulty);
            expect(countSolutions(puzzle)).toBe(1);
            expect(isSolvedGrid(solution)).toBe(true);
            // 手がかりは解と同じ数字
            puzzle.forEach((v, i) => {
              if (v !== 0) expect(v, `マス ${i}`).toBe(solution[i]);
            });
            // 手筋と手がかりの数が、その難易度の条件に合う
            expect(rateByTechniques(puzzle)).toBe(difficulty);
            const clues = puzzle.filter((v) => v !== 0).length;
            expect(clues).toBeGreaterThanOrEqual(CLUE_RANGES[difficulty].min);
            expect(clues).toBeLessThanOrEqual(CLUE_RANGES[difficulty].max);
          },
        );
      }
    }
  });

  describe("T-001: 手がかりの数のばらつき(G-17)", () => {
    for (const difficulty of DIFFICULTIES) {
      it(
        `T-001: ${difficulty} を 6 つの乱数の元で作ると、手がかりの数が 2 通り以上になる`,
        SLOW,
        () => {
          const clues = new Set(
            [1, 2, 3, 4, 5, 6].map((seed) => {
              const result = generatePuzzle(difficulty, seed, {
                timeLimitMs: 60_000,
              });
              if (!result.ok) throw new Error(`作れなかった: ${result.reason}`);
              return result.puzzle.filter((v) => v !== 0).length;
            }),
          );
          expect(clues.size).toBeGreaterThanOrEqual(2);
        },
      );
    }
  });

  describe("T-002: 乱数の元", () => {
    it("T-002: 同じ乱数の元なら同じ問題と解になる", SLOW, () => {
      const a = generatePuzzle("normal", 42, { timeLimitMs: 60_000 });
      const b = generatePuzzle("normal", 42, { timeLimitMs: 60_000 });
      if (!a.ok || !b.ok) throw new Error("作れなかった");
      expect(gridToString(b.puzzle)).toBe(gridToString(a.puzzle));
      expect(gridToString(b.solution)).toBe(gridToString(a.solution));
    });

    it("T-002: 違う乱数の元なら違う問題になる", SLOW, () => {
      const puzzles = [10, 11, 12].map((seed) => {
        const result = generatePuzzle("easy", seed, { timeLimitMs: 60_000 });
        if (!result.ok) throw new Error("作れなかった");
        return gridToString(result.puzzle);
      });
      expect(new Set(puzzles).size).toBe(3);
    });
  });

  describe("T-003: 時間内に作れないとき", () => {
    it("T-003: 時間の上限が 0 なら、例外を出さずに失敗を返す", () => {
      for (const difficulty of DIFFICULTIES) {
        const result = generatePuzzle(difficulty, 1, { timeLimitMs: 0 });
        expect(result).toEqual({ ok: false, reason: "timeout" });
      }
    });

    it("T-003: 時計が上限を過ぎたら、作っている途中でも失敗を返す", () => {
      // 呼ばれるたびに 1 秒進む時計。上限 5 秒なら、数回で打ち切られる
      let clock = 0;
      const now = () => (clock += 1000);
      const result = generatePuzzle("hard", 1, { timeLimitMs: 5000, now });
      expect(result).toEqual({ ok: false, reason: "timeout" });
    });

    it("T-003: 時計が上限の手前なら打ち切らない", () => {
      const result = generatePuzzle("easy", 1, {
        timeLimitMs: 60_000,
        now: () => 0,
      });
      expect(result.ok).toBe(true);
    });
  });
});
