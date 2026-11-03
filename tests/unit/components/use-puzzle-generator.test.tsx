// @vitest-environment jsdom
// 問題の生成のフック。Worker は FakeWorker に差し替える(jsdom に Worker は無い)
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RESPONSE_TIMEOUT_MS,
  usePuzzleGenerator,
} from "@/components/use-puzzle-generator";
import type { GeneratedPuzzle } from "@/components/use-puzzle-generator";
import { DEFAULT_TIME_LIMIT_MS } from "@/lib/sudoku/generator";
import type { GenerateResponse } from "@/lib/sudoku/generator-messages";

import { UNIQUE_PUZZLE, UNIQUE_SOLUTION } from "../../helpers/grid";

// ---- 偽の Worker ----

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];

  readonly url: string;
  readonly options: WorkerOptions | undefined;
  readonly posted: unknown[] = [];
  terminateCount = 0;

  constructor(url: string | URL, options?: WorkerOptions) {
    super();
    this.url = String(url);
    this.options = options;
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminateCount += 1;
  }

  // Worker からの応答を、画面の側に届ける
  respond(data: GenerateResponse): void {
    act(() => {
      this.dispatchEvent(new MessageEvent("message", { data }));
    });
  }

  fail(): void {
    act(() => {
      this.dispatchEvent(new Event("error"));
    });
  }
}

function okResponse(requestId: number): GenerateResponse {
  return {
    requestId,
    ok: true,
    difficulty: "hard",
    puzzle: UNIQUE_PUZZLE,
    solution: UNIQUE_SOLUTION,
  };
}

function failResponse(
  requestId: number | null,
  reason: "timeout" | "invalid-request" | "error" = "timeout",
): GenerateResponse {
  return { requestId, ok: false, reason };
}

function setup() {
  const onGenerated = vi.fn<(result: GeneratedPuzzle) => void>();
  const hook = renderHook(() => usePuzzleGenerator(onGenerated));
  return { onGenerated, ...hook };
}

function worker(index = 0): FakeWorker {
  const w = FakeWorker.instances[index];
  if (w === undefined) throw new Error(`Worker ${index} が作られていない`);
  return w;
}

// getRandomValues が Uint32Array の先頭に入れる値を決める
function fixSeed(...seeds: number[]) {
  const queue = [...seeds];
  return vi
    .spyOn(globalThis.crypto, "getRandomValues")
    .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array) array[0] = queue.shift() ?? 1;
      return array;
    });
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("T-416: 前提", () => {
  it("T-416: 待ち時間の上限は DEFAULT_TIME_LIMIT_MS + 5 秒", () => {
    expect(RESPONSE_TIMEOUT_MS).toBe(DEFAULT_TIME_LIMIT_MS + 5_000);
  });

  it("T-416: jsdom に本物の Worker は無い(FakeWorker に差し替えている)", () => {
    expect(Worker).toBe(FakeWorker);
  });
});

describe("T-416: 要求の送り方(G-04)", () => {
  it("T-416: generate の前は idle で、Worker を作らない", () => {
    const { result } = setup();
    expect(result.current.status).toBe("idle");
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("T-416: generate で generating になり、module の Worker を作って、{ requestId: 0, difficulty, seed } を 1 度だけ送る", () => {
    fixSeed(123456);
    const { result } = setup();

    act(() => result.current.generate("normal"));

    expect(result.current.status).toBe("generating");
    expect(FakeWorker.instances).toHaveLength(1);
    expect(worker().url).toContain("generator.worker");
    expect(worker().options).toEqual({ type: "module" });
    expect(worker().posted).toEqual([
      { requestId: 0, difficulty: "normal", seed: 123456 },
    ]);
  });

  it.each(["easy", "normal", "hard"] as const)(
    "T-416: 難易度 %s をそのまま送る",
    (difficulty) => {
      const { result } = setup();
      act(() => result.current.generate(difficulty));
      expect(worker().posted).toHaveLength(1);
      expect(worker().posted[0]).toMatchObject({ difficulty });
    },
  );

  it.each([0, 1, 3_000_000_000, 4_294_967_295])(
    "T-416: seed は crypto.getRandomValues(Uint32Array(1)) の値 %i をそのまま送る(0〜2^32-1 の符号なしの整数)",
    (seed) => {
      const spy = fixSeed(seed);
      const { result } = setup();

      act(() => result.current.generate("easy"));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toBeInstanceOf(Uint32Array);
      expect(spy.mock.calls[0]?.[0]).toHaveLength(1);
      expect(worker().posted).toEqual([
        { requestId: 0, difficulty: "easy", seed },
      ]);
    },
  );

  it("T-416: 本物の乱数でも seed は 0〜2^32-1 の整数", () => {
    const { result } = setup();
    act(() => result.current.generate("easy"));

    const seed = (worker().posted[0] as { seed: number }).seed;
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(4_294_967_295);
  });

  it("T-416: 要求のたびに requestId が 0 から 1 ずつ増え、seed も引き直し、Worker は使い回す", () => {
    fixSeed(10, 20, 30);
    const { result } = setup();

    act(() => result.current.generate("easy"));
    worker().respond(okResponse(0));
    act(() => result.current.generate("normal"));
    worker().respond(okResponse(1));
    act(() => result.current.generate("hard"));

    expect(FakeWorker.instances).toHaveLength(1);
    expect(worker().posted).toEqual([
      { requestId: 0, difficulty: "easy", seed: 10 },
      { requestId: 1, difficulty: "normal", seed: 20 },
      { requestId: 2, difficulty: "hard", seed: 30 },
    ]);
  });

  it("T-416: generating の間の generate は何も送らず、番号も進めない", () => {
    const { result } = setup();
    act(() => result.current.generate("easy"));

    act(() => result.current.generate("hard"));
    act(() => result.current.generate("normal"));

    expect(worker().posted).toHaveLength(1);
    expect(FakeWorker.instances).toHaveLength(1);
    expect(result.current.status).toBe("generating");

    worker().respond(okResponse(0));
    act(() => result.current.generate("normal"));
    expect(worker().posted).toHaveLength(2);
    expect(worker().posted[1]).toMatchObject({ requestId: 1 });
  });
});

describe("T-416: 応答の受け取り", () => {
  it("T-416: 番号が合う成功の応答で、onGenerated を 1 度呼び、idle に戻る", () => {
    const { result, onGenerated } = setup();
    act(() => result.current.generate("hard"));

    worker().respond(okResponse(0));

    expect(onGenerated).toHaveBeenCalledTimes(1);
    expect(onGenerated).toHaveBeenCalledWith(
      expect.objectContaining({
        difficulty: "hard",
        puzzle: UNIQUE_PUZZLE,
        solution: UNIQUE_SOLUTION,
      }),
    );
    expect(result.current.status).toBe("idle");
    expect(worker().terminateCount).toBe(0);
  });

  it.each(["timeout", "invalid-request", "error"] as const)(
    "T-416: 番号が合う失敗の応答(%s)で failed になり、onGenerated は呼ばない。Worker は止めない",
    (reason) => {
      const { result, onGenerated } = setup();
      act(() => result.current.generate("hard"));

      worker().respond(failResponse(0, reason));

      expect(result.current.status).toBe("failed");
      expect(onGenerated).not.toHaveBeenCalled();
      expect(worker().terminateCount).toBe(0);
    },
  );

  it("T-416: 失敗の応答の後の generate は同じ Worker に、次の番号で送る", () => {
    const { result } = setup();
    act(() => result.current.generate("hard"));
    worker().respond(failResponse(0));

    act(() => result.current.dismiss());
    act(() => result.current.generate("hard"));

    expect(FakeWorker.instances).toHaveLength(1);
    expect(worker().posted).toHaveLength(2);
    expect(worker().posted[1]).toMatchObject({ requestId: 1 });
    expect(result.current.status).toBe("generating");
  });

  it("T-416: 失敗の状態から dismiss しなくても generate で作り直せる(failed は generating でない)", () => {
    const { result } = setup();
    act(() => result.current.generate("hard"));
    worker().respond(failResponse(0));
    expect(result.current.status).toBe("failed");

    act(() => result.current.generate("hard"));

    expect(result.current.status).toBe("generating");
    expect(worker().posted).toHaveLength(2);
  });

  it("T-416: 違う番号の成功の応答は捨てる(onGenerated を呼ばず、generating のまま)。合う番号が来れば受け取る", () => {
    const { result, onGenerated } = setup();
    act(() => result.current.generate("hard"));

    worker().respond(okResponse(1));
    worker().respond(okResponse(99));

    expect(onGenerated).not.toHaveBeenCalled();
    expect(result.current.status).toBe("generating");

    worker().respond(okResponse(0));
    expect(onGenerated).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
  });

  it("T-416: 違う番号の失敗の応答は捨てる(failed にならない)", () => {
    const { result } = setup();
    act(() => result.current.generate("hard"));

    worker().respond(failResponse(5));

    expect(result.current.status).toBe("generating");
  });

  it("T-416: 番号が null の失敗の応答(不正な要求で番号も読めない)は、今の要求のものではないので捨てる", () => {
    const { result } = setup();
    act(() => result.current.generate("hard"));

    worker().respond(failResponse(null, "invalid-request"));

    expect(result.current.status).toBe("generating");
  });

  it("T-416: 次の要求(番号 1)の間に、前の要求(番号 0)の遅い応答が来ても捨てる", () => {
    const { result, onGenerated } = setup();
    act(() => result.current.generate("easy"));
    worker().respond(okResponse(0));
    expect(onGenerated).toHaveBeenCalledTimes(1);
    act(() => result.current.generate("hard"));

    worker().respond(okResponse(0));
    worker().respond(failResponse(0));

    expect(onGenerated).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("generating");
  });

  it("T-416: 成功の応答の後に、同じ番号の遅い応答(成功も失敗も)が来ても捨てる", () => {
    const { result, onGenerated } = setup();
    act(() => result.current.generate("easy"));
    worker().respond(okResponse(0));
    expect(result.current.status).toBe("idle");

    worker().respond(okResponse(0));
    worker().respond(failResponse(0));

    expect(onGenerated).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
  });

  it("T-416: 失敗にした後に、同じ番号の遅い成功の応答が来ても捨てる(推測: 設計に明記なし)", () => {
    const { result, onGenerated } = setup();
    act(() => result.current.generate("easy"));
    worker().respond(failResponse(0));

    worker().respond(okResponse(0));

    expect(onGenerated).not.toHaveBeenCalled();
    expect(result.current.status).toBe("failed");
  });
});

describe("T-416: Worker の error イベント(G-03)", () => {
  it("T-416: error イベントで failed になり、Worker を 1 度 terminate する", () => {
    const { result, onGenerated } = setup();
    act(() => result.current.generate("hard"));

    worker().fail();

    expect(result.current.status).toBe("failed");
    expect(worker().terminateCount).toBe(1);
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it("T-416: error の後の generate は新しい Worker を作り、そこへ次の番号で送る(古い Worker には送らない)", () => {
    fixSeed(1, 2);
    const { result } = setup();
    act(() => result.current.generate("hard"));
    worker(0).fail();

    act(() => result.current.generate("hard"));

    expect(FakeWorker.instances).toHaveLength(2);
    expect(worker(0).posted).toHaveLength(1);
    expect(worker(1).posted).toEqual([
      { requestId: 1, difficulty: "hard", seed: 2 },
    ]);
    expect(worker(1).terminateCount).toBe(0);
    expect(result.current.status).toBe("generating");
  });

  it("T-416: 新しい Worker の応答を受け取れる。古い Worker の遅い応答は捨てる", () => {
    const { result, onGenerated } = setup();
    act(() => result.current.generate("hard"));
    worker(0).fail();
    act(() => result.current.generate("hard"));

    // 古い Worker が(止める前に)返した、今の番号と同じ 1 の応答
    worker(0).respond(okResponse(1));
    expect(onGenerated).not.toHaveBeenCalled();
    expect(result.current.status).toBe("generating");

    worker(1).respond(okResponse(1));
    expect(onGenerated).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
  });

  it("T-416: error の後に待ち時間が過ぎても、terminate を重ねて呼ばない", () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.generate("hard"));
    worker().fail();

    act(() => {
      vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS * 2);
    });

    expect(worker().terminateCount).toBe(1);
    expect(result.current.status).toBe("failed");
  });
});

describe("T-416: 待ち時間の上限(G-03)", () => {
  it("T-416: 上限のちょうど手前(上限 - 1ms)では failed にならず、上限で failed になって Worker を terminate する", () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.generate("hard"));

    act(() => {
      vi.advanceTimersByTime(DEFAULT_TIME_LIMIT_MS + 5_000 - 1);
    });
    expect(result.current.status).toBe("generating");
    expect(worker().terminateCount).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.status).toBe("failed");
    expect(worker().terminateCount).toBe(1);
  });

  it("T-416: 上限で failed にした後の generate は、新しい Worker を作って次の番号で送る", () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.generate("hard"));
    act(() => {
      vi.advanceTimersByTime(DEFAULT_TIME_LIMIT_MS + 5_000);
    });

    act(() => result.current.dismiss());
    act(() => result.current.generate("hard"));

    expect(FakeWorker.instances).toHaveLength(2);
    expect(worker(1).posted).toHaveLength(1);
    expect(worker(1).posted[0]).toMatchObject({ requestId: 1 });
    expect(worker(0).posted).toHaveLength(1);
  });

  it("T-416: 上限の前に成功の応答が来ると、上限が過ぎても failed にならず、terminate もしない", () => {
    vi.useFakeTimers();
    const { result, onGenerated } = setup();
    act(() => result.current.generate("hard"));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    worker().respond(okResponse(0));
    act(() => {
      vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS * 2);
    });

    expect(onGenerated).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
    expect(worker().terminateCount).toBe(0);
  });

  it("T-416: 上限の前に失敗の応答が来た後は、上限が過ぎても terminate しない", () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.generate("hard"));
    worker().respond(failResponse(0));

    act(() => {
      vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS * 2);
    });

    expect(result.current.status).toBe("failed");
    expect(worker().terminateCount).toBe(0);
  });

  it("T-416: 上限は要求を送ってから数える。違う番号の応答が来ても延びない", () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.generate("hard"));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    worker().respond(okResponse(7));
    act(() => {
      vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS - 10_000 - 1);
    });
    expect(result.current.status).toBe("generating");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.status).toBe("failed");
  });

  it("T-416: 上限は要求ごとに数え直す。前の要求の上限は残らない", () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.generate("easy"));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    worker().respond(okResponse(0));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    act(() => result.current.generate("hard"));

    // 2 つ目の要求を送ってから上限の 1ms 手前。1 つ目の上限(最初から数えた時刻)は過ぎている
    act(() => {
      vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS - 1);
    });
    expect(result.current.status).toBe("generating");
    expect(worker().terminateCount).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.status).toBe("failed");
    expect(worker().terminateCount).toBe(1);
  });
});

describe("T-416: dismiss", () => {
  it("T-416: failed から idle に戻す", () => {
    const { result } = setup();
    act(() => result.current.generate("hard"));
    worker().respond(failResponse(0));
    expect(result.current.status).toBe("failed");

    act(() => result.current.dismiss());

    expect(result.current.status).toBe("idle");
  });

  it("T-416: idle のときは何も変えない", () => {
    const { result } = setup();

    act(() => result.current.dismiss());

    expect(result.current.status).toBe("idle");
  });

  it("T-416: generating のときは何も変えない(生成を取り消さない)", () => {
    const { result, onGenerated } = setup();
    act(() => result.current.generate("hard"));

    act(() => result.current.dismiss());

    expect(result.current.status).toBe("generating");
    worker().respond(okResponse(0));
    expect(onGenerated).toHaveBeenCalledTimes(1);
  });
});

describe("T-416: アンマウント", () => {
  it("T-416: 生成中のアンマウントで Worker を 1 度 terminate する", () => {
    const { result, unmount } = setup();
    act(() => result.current.generate("hard"));

    unmount();

    expect(worker().terminateCount).toBe(1);
  });

  it("T-416: 応答の後(idle)のアンマウントでも、使い回している Worker を terminate する", () => {
    const { result, unmount } = setup();
    act(() => result.current.generate("hard"));
    worker().respond(okResponse(0));

    unmount();

    expect(worker().terminateCount).toBe(1);
  });

  it("T-416: Worker を作る前のアンマウントは、例外を出さず、Worker も作らない", () => {
    const { unmount } = setup();

    expect(() => unmount()).not.toThrow();
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("T-416: error で止めて捨てた Worker は、アンマウントで重ねて terminate しない", () => {
    const { result, unmount } = setup();
    act(() => result.current.generate("hard"));
    worker().fail();

    unmount();

    expect(worker().terminateCount).toBe(1);
  });

  it("T-416: アンマウントの後に来た応答では onGenerated を呼ばない", () => {
    const { result, unmount, onGenerated } = setup();
    act(() => result.current.generate("hard"));
    unmount();

    worker().respond(okResponse(0));

    expect(onGenerated).not.toHaveBeenCalled();
  });

  it("T-416: アンマウントの後に待ち時間が過ぎても、terminate を重ねて呼ばない", () => {
    vi.useFakeTimers();
    const { result, unmount } = setup();
    act(() => result.current.generate("hard"));
    unmount();

    act(() => {
      vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS * 2);
    });

    expect(worker().terminateCount).toBe(1);
  });
});

// 2026-11-03 に、本番のコードを壊しても通った箇所を確かめるために足した
describe("T-416: 待っていない応答・捨てた Worker・コールバックの入れ替え", () => {
  it("T-416: 待っている要求が無いときに番号 null の失敗が来ても、idle のまま", () => {
    const { result, onGenerated } = setup();
    act(() => result.current.generate("easy"));
    worker().respond(okResponse(0));
    expect(result.current.status).toBe("idle");

    worker().respond(failResponse(null, "invalid-request"));
    expect(result.current.status).toBe("idle");
    expect(onGenerated).toHaveBeenCalledTimes(1);
  });

  it("T-416: error で捨てた Worker が、作り直した後にまた error を出しても、今の要求は失敗にならない", () => {
    const { result } = setup();
    act(() => result.current.generate("easy"));
    worker(0).fail();
    act(() => result.current.generate("easy"));
    expect(result.current.status).toBe("generating");

    worker(0).fail();
    expect(result.current.status).toBe("generating");
    expect(worker(1).terminateCount).toBe(0);
  });

  it("T-416: 再描画でコールバックを入れ替えると、応答では新しいコールバックを呼ぶ", () => {
    const first = vi.fn<(result: GeneratedPuzzle) => void>();
    const second = vi.fn<(result: GeneratedPuzzle) => void>();
    const { result, rerender } = renderHook(
      ({ onGenerated }) => usePuzzleGenerator(onGenerated),
      { initialProps: { onGenerated: first } },
    );
    act(() => result.current.generate("hard"));
    rerender({ onGenerated: second });

    worker().respond(okResponse(0));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
