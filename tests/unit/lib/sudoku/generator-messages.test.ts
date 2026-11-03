import { describe, expect, it } from "vitest";

import type { GenerateResult } from "@/lib/sudoku/generator";
import { countSolutions } from "@/lib/sudoku/solver";
import {
  handleGenerateMessage,
  parseGenerateRequest,
} from "@/lib/sudoku/generator-messages";

import { UNIQUE_PUZZLE, UNIQUE_SOLUTION } from "../../../helpers/grid";

const valid = { requestId: 7, difficulty: "easy", seed: 123 };

describe("parseGenerateRequest", () => {
  it("T-010: 要求の番号、3 つの難易度、乱数の元を受け付ける", () => {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      expect(parseGenerateRequest({ ...valid, difficulty })).toEqual({
        requestId: 7,
        difficulty,
        seed: 123,
      });
    }
  });

  it("T-010: 乱数の元の下限 0 と上限 2^32-1 を受け付け、その 1 つ外は捨てる", () => {
    expect(parseGenerateRequest({ ...valid, seed: 0 })?.seed).toBe(0);
    expect(parseGenerateRequest({ ...valid, seed: 0xffffffff })?.seed).toBe(
      0xffffffff,
    );
    expect(parseGenerateRequest({ ...valid, seed: -1 })).toBeNull();
    expect(parseGenerateRequest({ ...valid, seed: 0x100000000 })).toBeNull();
  });

  it("T-010: 整数でない乱数の元は捨てる", () => {
    for (const seed of [
      1.5,
      "1",
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(parseGenerateRequest({ ...valid, seed }), String(seed)).toBeNull();
    }
  });

  it("T-010: 要求の番号は 0 以上の整数だけを受け付ける", () => {
    expect(parseGenerateRequest({ ...valid, requestId: 0 })?.requestId).toBe(0);
    for (const requestId of [-1, 1.5, "1", undefined, Number.NaN]) {
      expect(
        parseGenerateRequest({ ...valid, requestId }),
        String(requestId),
      ).toBeNull();
    }
  });

  it("T-010: 余計な項目は捨てる", () => {
    expect(parseGenerateRequest({ ...valid, extra: true })).toEqual({
      requestId: 7,
      difficulty: "easy",
      seed: 123,
    });
  });

  it("T-010: オブジェクトでない値は捨てる", () => {
    for (const data of [null, undefined, "easy", 1, true]) {
      expect(parseGenerateRequest(data), String(data)).toBeNull();
    }
  });

  it("T-010: 未知の難易度や難易度の無いものは捨てる", () => {
    expect(parseGenerateRequest({ ...valid, difficulty: "expert" })).toBeNull();
    expect(parseGenerateRequest({ ...valid, difficulty: "EASY" })).toBeNull();
    expect(parseGenerateRequest({ requestId: 1, seed: 1 })).toBeNull();
  });
});

describe("handleGenerateMessage", () => {
  it("T-010: 生成の関数を渡さなければ、本物の生成で問題を作って返す", () => {
    const response = handleGenerateMessage({ ...valid, seed: 1 });
    if (!response.ok) throw new Error(`作れなかった: ${response.reason}`);
    expect(response.requestId).toBe(7);
    expect(response.difficulty).toBe("easy");
    expect(countSolutions(response.puzzle)).toBe(1);
  });

  it("T-010: 正しい要求には、要求の番号を付けた生成の結果を返す", () => {
    const calls: unknown[] = [];
    const generate = (
      difficulty: "easy" | "normal" | "hard",
      seed: number,
    ): GenerateResult => {
      calls.push([difficulty, seed]);
      return {
        ok: true,
        difficulty,
        puzzle: UNIQUE_PUZZLE,
        solution: UNIQUE_SOLUTION,
      };
    };
    expect(
      handleGenerateMessage({ ...valid, difficulty: "hard" }, generate),
    ).toEqual({
      requestId: 7,
      ok: true,
      difficulty: "hard",
      puzzle: UNIQUE_PUZZLE,
      solution: UNIQUE_SOLUTION,
    });
    expect(calls).toEqual([["hard", 123]]);
  });

  it("T-010: 生成の時間切れは、要求の番号を付けて timeout を返す", () => {
    const generate = (): GenerateResult => ({ ok: false, reason: "timeout" });
    expect(handleGenerateMessage(valid, generate)).toEqual({
      requestId: 7,
      ok: false,
      reason: "timeout",
    });
  });

  it("T-010: 生成中の例外は、要求の番号を付けて error を返す", () => {
    const generate = (): GenerateResult => {
      throw new Error("想定外");
    };
    expect(handleGenerateMessage(valid, generate)).toEqual({
      requestId: 7,
      ok: false,
      reason: "error",
    });
  });

  it("T-010: 不正な要求は生成せずに invalid-request を返す。番号が読めれば付ける", () => {
    let called = false;
    const generate = (): GenerateResult => {
      called = true;
      return { ok: false, reason: "timeout" };
    };
    expect(
      handleGenerateMessage({ ...valid, difficulty: "expert" }, generate),
    ).toEqual({ requestId: 7, ok: false, reason: "invalid-request" });
    expect(called).toBe(false);
  });

  it("T-010: 番号も読めない不正な要求は、番号を null にして invalid-request を返す", () => {
    for (const data of [
      null,
      "x",
      { ...valid, requestId: -1 },
      { ...valid, requestId: "7" },
    ]) {
      expect(
        handleGenerateMessage(data, () => ({ ok: false, reason: "timeout" })),
        JSON.stringify(data),
      ).toEqual({ requestId: null, ok: false, reason: "invalid-request" });
    }
  });
});
