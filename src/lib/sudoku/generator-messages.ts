// 画面と Web Worker の間でやり取りするメッセージ(G-01、G-02、G-04)

import { isIntInRange, isRecord } from "@/lib/guards";

import { generatePuzzle } from "./generator";
import type { GenerateResult } from "./generator";
import { isDifficulty } from "./grid";
import type { Difficulty, Grid } from "./grid";

export interface GenerateRequest {
  requestId: number; // 0 以上の整数
  difficulty: Difficulty;
  seed: number; // 0〜2^32-1 の整数
}

type GenerateFailureReason = "timeout" | "invalid-request" | "error";

export type GenerateResponse =
  | {
      requestId: number;
      ok: true;
      difficulty: Difficulty;
      puzzle: Grid;
      solution: Grid;
    }
  | { requestId: number | null; ok: false; reason: GenerateFailureReason };

const MAX_SEED = 0xffffffff;

function isRequestId(value: unknown): value is number {
  return isIntInRange(value, 0, Number.POSITIVE_INFINITY);
}

function isSeed(value: unknown): value is number {
  return isIntInRange(value, 0, MAX_SEED);
}

// Worker が受け取った値を確かめる。形が違えば null
export function parseGenerateRequest(data: unknown): GenerateRequest | null {
  if (!isRecord(data)) return null;
  const { requestId, difficulty, seed } = data;
  if (!isRequestId(requestId) || !isDifficulty(difficulty) || !isSeed(seed)) {
    return null;
  }
  return { requestId, difficulty, seed };
}

// 受け取った値から、必ず 1 つの応答を作る(G-04)
export function handleGenerateMessage(
  data: unknown,
  generate: (difficulty: Difficulty, seed: number) => GenerateResult = (
    difficulty,
    seed,
  ) => generatePuzzle(difficulty, seed),
): GenerateResponse {
  const request = parseGenerateRequest(data);
  if (request === null) {
    const requestId = isRecord(data) ? data.requestId : undefined;
    return {
      requestId: isRequestId(requestId) ? requestId : null,
      ok: false,
      reason: "invalid-request",
    };
  }
  try {
    return {
      requestId: request.requestId,
      ...generate(request.difficulty, request.seed),
    };
  } catch {
    return { requestId: request.requestId, ok: false, reason: "error" };
  }
}
