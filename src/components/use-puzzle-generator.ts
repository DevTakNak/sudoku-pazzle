"use client";

// 問題の生成を Web Worker に頼むフック(G-01、G-03、G-04、N-02)
import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_TIME_LIMIT_MS } from "@/lib/sudoku/generator";
import type {
  GenerateRequest,
  GenerateResponse,
} from "@/lib/sudoku/generator-messages";
import type { Difficulty, Grid } from "@/lib/sudoku/grid";

// Worker が応答しないときに失敗にするまでの時間(G-03)
export const RESPONSE_TIMEOUT_MS = DEFAULT_TIME_LIMIT_MS + 5_000;

export type GeneratorStatus = "idle" | "generating" | "failed";

export interface GeneratedPuzzle {
  difficulty: Difficulty;
  puzzle: Grid;
  solution: Grid;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

export function usePuzzleGenerator(
  onGenerated: (result: GeneratedPuzzle) => void,
): {
  status: GeneratorStatus;
  generate: (difficulty: Difficulty) => void;
  dismiss: () => void;
} {
  const [status, setStatus] = useState<GeneratorStatus>("idle");
  const workerRef = useRef<Worker | null>(null);
  const nextIdRef = useRef(0);
  // 応答を待っている要求の番号。待っていなければ null
  const pendingIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onGeneratedRef = useRef(onGenerated);

  useEffect(() => {
    onGeneratedRef.current = onGenerated;
  }, [onGenerated]);

  const finish = useCallback(() => {
    pendingIdRef.current = null;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 応答しない・壊れた Worker は止めて捨て、次の要求で作り直す
  const discardWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  const fail = useCallback(() => {
    finish();
    discardWorker();
    setStatus("failed");
  }, [finish, discardWorker]);

  const getWorker = useCallback((): Worker => {
    if (workerRef.current !== null) return workerRef.current;
    const worker = new Worker(
      new URL("../lib/sudoku/generator.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.addEventListener(
      "message",
      (event: MessageEvent<GenerateResponse>) => {
        const response = event.data;
        // 捨てた Worker の応答と、古い要求の応答は捨てる(G-04)
        if (
          workerRef.current !== worker ||
          pendingIdRef.current === null ||
          response.requestId !== pendingIdRef.current
        ) {
          return;
        }
        finish();
        if (response.ok) {
          setStatus("idle");
          onGeneratedRef.current({
            difficulty: response.difficulty,
            puzzle: response.puzzle,
            solution: response.solution,
          });
        } else {
          setStatus("failed");
        }
      },
    );
    worker.addEventListener("error", () => {
      if (workerRef.current === worker) fail();
    });
    workerRef.current = worker;
    return worker;
  }, [finish, fail]);

  const generate = useCallback(
    (difficulty: Difficulty) => {
      if (pendingIdRef.current !== null) return;
      const request: GenerateRequest = {
        requestId: nextIdRef.current++,
        difficulty,
        seed: randomSeed(),
      };
      const worker = getWorker();
      pendingIdRef.current = request.requestId;
      timerRef.current = setTimeout(fail, RESPONSE_TIMEOUT_MS);
      setStatus("generating");
      worker.postMessage(request);
    },
    [getWorker, fail],
  );

  const dismiss = useCallback(() => {
    setStatus((s) => (s === "failed" ? "idle" : s));
  }, []);

  useEffect(
    () => () => {
      finish();
      discardWorker();
    },
    [finish, discardWorker],
  );

  return { status, generate, dismiss };
}
