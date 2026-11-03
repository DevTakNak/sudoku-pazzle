import { describe, expect, it } from "vitest";

import { redo, undo } from "@/lib/game/history";
import { eraseCell, inputDigit } from "@/lib/game/input";
import { toggleNote } from "@/lib/game/notes";
import { createGame, restartGame } from "@/lib/game/state";
import type { GameState } from "@/lib/game/types";

import {
  BLANK_A,
  BLANK_B,
  BLANK_C,
  SOLUTION_A,
  SOLUTION_B,
  almostSolved,
  clearedGame,
  emptyNotes,
  entry,
  failedGame,
  freshGame,
  richPlayingGame,
  snapshot,
  withNotes,
  withValues,
} from "../../../helpers/game";
import { UNIQUE_PUZZLE, UNIQUE_SOLUTION } from "../../../helpers/grid";

const WRONG = 1; // マス 2・3・5 の解は 4・6・8 なので、1 はどれでも誤り

describe("T-131: クリア", () => {
  it("T-131: 残り 1 マスに正解を入れると、クリアになる", () => {
    const state = almostSolved([BLANK_A]);
    const next = inputDigit(state, BLANK_A, SOLUTION_A);
    expect(next.values).toEqual(UNIQUE_SOLUTION);
    expect(next.status).toBe("cleared");
    expect(next.mistakes).toBe(0);
  });

  it("T-131: 残り 2 マスは、1 つ目を入れてもクリアにならず、2 つ目を入れるとクリアになる", () => {
    const state = almostSolved([BLANK_A, BLANK_B]);
    const half = inputDigit(state, BLANK_A, SOLUTION_A);
    expect(half.status).toBe("playing");
    const done = inputDigit(half, BLANK_B, SOLUTION_B);
    expect(done.status).toBe("cleared");
    expect(done.values).toEqual(UNIQUE_SOLUTION);
  });

  it("T-131: 誤りが残っているとき、最後の空欄に正解を入れてもクリアにならない", () => {
    // マス 2 は誤り(1)、マス 3 だけが空欄
    const state = withValues(almostSolved([BLANK_B]), { [BLANK_A]: WRONG });
    const next = inputDigit(state, BLANK_B, SOLUTION_B);
    expect(next.values[BLANK_B]).toBe(SOLUTION_B);
    expect(next.values[BLANK_A]).toBe(WRONG);
    expect(next.status).toBe("playing");
  });

  it("T-131: 空欄が無くなっても、誤りを入れたのならクリアにならない", () => {
    const state = almostSolved([BLANK_A]);
    const next = inputDigit(state, BLANK_A, WRONG);
    expect(next.values[BLANK_A]).toBe(WRONG);
    expect(next.status).toBe("playing");
    expect(next.mistakes).toBe(1);
  });

  it("T-131: 誤りを消してから正解を入れると、クリアになる", () => {
    const wrongLast = inputDigit(almostSolved([BLANK_A]), BLANK_A, WRONG);
    const next = inputDigit(wrongLast, BLANK_A, SOLUTION_A);
    expect(next.status).toBe("cleared");
  });

  it("T-131: 回数が 2 でも、最後に正解を入れればクリアになる(失敗にならない)", () => {
    const state = { ...almostSolved([BLANK_A]), mistakes: 2 };
    const next = inputDigit(state, BLANK_A, SOLUTION_A);
    expect(next.status).toBe("cleared");
    expect(next.mistakes).toBe(2);
  });

  it("T-131: 時間はクリアしても変わらない", () => {
    const state = { ...almostSolved([BLANK_A]), elapsedSeconds: 321 };
    expect(inputDigit(state, BLANK_A, SOLUTION_A).elapsedSeconds).toBe(321);
  });

  it("T-131: メモの付け外しと消すでは、クリアにならない", () => {
    const state = withNotes(almostSolved([BLANK_A, BLANK_B]), {
      [BLANK_A]: [4],
    });
    expect(toggleNote(state, BLANK_B, 6).status).toBe("playing");
    expect(eraseCell(state, BLANK_A).status).toBe("playing");
  });
});

describe("T-132: 失敗", () => {
  it("T-132: 回数 0 で誤りを入れると、回数 1 でプレイ中のまま", () => {
    const next = inputDigit(freshGame(), BLANK_A, WRONG);
    expect(next.mistakes).toBe(1);
    expect(next.status).toBe("playing");
  });

  it("T-132: 回数 1 で誤りを入れると、回数 2 でプレイ中のまま", () => {
    const next = inputDigit({ ...freshGame(), mistakes: 1 }, BLANK_A, WRONG);
    expect(next.mistakes).toBe(2);
    expect(next.status).toBe("playing");
  });

  it("T-132: 回数 2 で誤りを入れると、回数 3 で失敗になる", () => {
    const next = inputDigit({ ...freshGame(), mistakes: 2 }, BLANK_A, WRONG);
    expect(next.mistakes).toBe(3);
    expect(next.status).toBe("failed");
    expect(next.values[BLANK_A]).toBe(WRONG);
  });

  it("T-132: 回数 2 で正解を入れても失敗にならない", () => {
    const next = inputDigit(
      { ...freshGame(), mistakes: 2 },
      BLANK_A,
      SOLUTION_A,
    );
    expect(next.mistakes).toBe(2);
    expect(next.status).toBe("playing");
  });

  it("T-132: 3 回の誤りを順に入れると、3 回目で失敗になる", () => {
    let state: GameState = freshGame();
    const statuses: string[] = [];
    for (const index of [BLANK_A, BLANK_B, BLANK_C]) {
      state = inputDigit(state, index, WRONG);
      statuses.push(state.status);
    }
    expect(state.mistakes).toBe(3);
    expect(statuses).toEqual(["playing", "playing", "failed"]);
  });

  it("T-132: 失敗になっても、時間と入力した数字は変わらない", () => {
    const state = { ...freshGame(), mistakes: 2, elapsedSeconds: 90 };
    const next = inputDigit(state, BLANK_A, WRONG);
    expect(next.elapsedSeconds).toBe(90);
    expect(next.values[BLANK_A]).toBe(WRONG);
  });

  it("T-132: 同じ誤りを入れ直しても回数は増えないので、失敗にならない", () => {
    const state = inputDigit({ ...freshGame(), mistakes: 1 }, BLANK_A, WRONG);
    expect(state.mistakes).toBe(2);
    const again = inputDigit(state, BLANK_A, WRONG);
    expect(again.mistakes).toBe(2);
    expect(again.status).toBe("playing");
  });
});

describe("T-133: 終わったゲームは操作できない", () => {
  // 終わったゲームでも、操作が効くなら変わってしまう状態にしておく。
  // 失敗: 誤りの数字、空欄、履歴がある。クリア: 履歴がある
  const failed = failedGame();
  const cleared = clearedGame();
  // 本来は起きない(クリアなのに空欄がある)状態でも、操作を受け付けないことを確かめる。
  // BLANK_A を、メモの付いた空欄にして、入力・消す・メモが効くはずのマスにする
  const clearedWithBlank: GameState = withNotes(
    withValues(cleared, { [BLANK_A]: 0 }),
    { [BLANK_A]: [1] },
  );

  // 状態ごとに、操作が効くはずのマス(入力とメモを入れる空欄、消せるマス)
  const targets = new Map<GameState, { blank: number; erasable: number }>([
    [failed, { blank: BLANK_C, erasable: BLANK_A }],
    [cleared, { blank: BLANK_C, erasable: BLANK_A }],
    [clearedWithBlank, { blank: BLANK_A, erasable: BLANK_A }],
  ]);
  const target = (s: GameState) => targets.get(s)!;

  const operations: [string, (state: GameState) => GameState][] = [
    [
      "正解の数字を入れる",
      (s) => inputDigit(s, target(s).blank, UNIQUE_SOLUTION[target(s).blank]!),
    ],
    ["誤りの数字を入れる", (s) => inputDigit(s, target(s).blank, WRONG)],
    ["誤りの数字やメモを消す", (s) => eraseCell(s, target(s).erasable)],
    ["メモを付ける", (s) => toggleNote(s, target(s).blank, 3)],
    ["元に戻す", (s) => undo(s)],
    ["やり直す", (s) => redo(s)],
  ];

  it.each([
    ["失敗", failed],
    ["クリア", cleared],
    ["クリア(空欄が残る不整合な状態)", clearedWithBlank],
  ])("T-133: 前提: %sの状態は、元に戻す・やり直しの履歴を持つ", (_, state) => {
    expect(state.undoStack.length).toBeGreaterThan(0);
    expect(state.redoStack.length).toBeGreaterThan(0);
  });

  it("T-133: 前提: 失敗の状態には、消せる誤りの数字と、入力できる空欄がある", () => {
    expect(failed.values[BLANK_A]).toBe(WRONG);
    expect(failed.values[BLANK_C]).toBe(0);
    expect(failed.mistakes).toBe(3);
  });

  it("T-133: 前提: 空欄が残るクリアの状態では、狙うマスがメモ付きの空欄", () => {
    expect(clearedWithBlank.status).toBe("cleared");
    expect(clearedWithBlank.values[BLANK_A]).toBe(0);
    expect(clearedWithBlank.notes[BLANK_A]).toEqual([1]);
    expect(UNIQUE_SOLUTION[BLANK_A]).not.toBe(WRONG);
  });

  it("T-133: 前提: プレイ中なら、同じ操作でどれも状態が変わる(操作を拒むのは状態の判定だけ)", () => {
    const playing: GameState = { ...clearedWithBlank, status: "playing" };
    targets.set(playing, { blank: BLANK_A, erasable: BLANK_A });
    for (const [, operate] of operations.slice(0, 4)) {
      expect(operate(playing)).not.toBe(playing);
    }
  });

  describe.each([
    ["失敗", failed],
    ["クリア", cleared],
    ["クリア(空欄が残る不整合な状態)", clearedWithBlank],
  ])("%sのゲーム", (name, state) => {
    it.each(operations)(
      `T-133: ${name}のゲームで「%s」と、何も変わらない`,
      (_, operate) => {
        const copy = structuredClone(state);
        const next = operate(state);
        expect(next).toBe(state);
        expect(state).toEqual(copy);
      },
    );
  });

  it("T-133: 失敗した後の、消すと元に戻すでも回数は変わらない", () => {
    expect(eraseCell(failed, BLANK_A).mistakes).toBe(3);
    expect(undo(failed).mistakes).toBe(3);
  });

  it("T-133: 失敗は、プレイ中に最後の誤りを入れた直後から操作できなくなる", () => {
    const justFailed = inputDigit(
      { ...freshGame(), mistakes: 2 },
      BLANK_A,
      WRONG,
    );
    expect(justFailed.status).toBe("failed");
    expect(inputDigit(justFailed, BLANK_B, SOLUTION_B)).toBe(justFailed);
    expect(undo(justFailed)).toBe(justFailed);
  });

  it("T-133: クリアした直後から操作できなくなる", () => {
    const justCleared = inputDigit(
      almostSolved([BLANK_A]),
      BLANK_A,
      SOLUTION_A,
    );
    expect(justCleared.status).toBe("cleared");
    expect(undo(justCleared)).toBe(justCleared);
    expect(eraseCell(justCleared, BLANK_A)).toBe(justCleared);
  });
});

describe("T-134: createGame と やり直す(restartGame)", () => {
  it("T-134: createGame は、問題の写しを数字とし、メモ・回数・時間・履歴が空の初めの状態を作る", () => {
    const game = createGame("normal", UNIQUE_PUZZLE, UNIQUE_SOLUTION);
    expect(game.difficulty).toBe("normal");
    expect(game.puzzle).toEqual(UNIQUE_PUZZLE);
    expect(game.solution).toEqual(UNIQUE_SOLUTION);
    expect(game.values).toEqual(UNIQUE_PUZZLE);
    expect(game.values).not.toBe(game.puzzle);
    expect(game.notes).toEqual(emptyNotes());
    expect(game.notes).toHaveLength(81);
    expect(game.mistakes).toBe(0);
    expect(game.elapsedSeconds).toBe(0);
    expect(game.status).toBe("playing");
    expect(game.undoStack).toEqual([]);
    expect(game.redoStack).toEqual([]);
  });

  it("T-134: createGame の数字・問題・解は、渡した盤面とは別の配列(写し)", () => {
    const puzzle = [...UNIQUE_PUZZLE];
    const solution = [...UNIQUE_SOLUTION];
    const game = createGame("easy", puzzle, solution);
    expect(game.values).not.toBe(puzzle);
    expect(game.values).toEqual(puzzle);
    expect(game.puzzle).not.toBe(puzzle);
    expect(game.puzzle).toEqual(puzzle);
    expect(game.solution).not.toBe(solution);
    expect(game.solution).toEqual(solution);
  });

  it("T-134: createGame の 81 個のメモは、それぞれ別の配列", () => {
    const game = createGame("easy", UNIQUE_PUZZLE, UNIQUE_SOLUTION);
    expect(game.notes[0]).not.toBe(game.notes[1]);
  });

  it("T-134: createGame の後の入力で、渡した問題の盤面は書き換わらない", () => {
    const puzzle = [...UNIQUE_PUZZLE];
    const game = createGame("easy", puzzle, UNIQUE_SOLUTION);
    inputDigit(game, BLANK_A, SOLUTION_A);
    expect(puzzle).toEqual(UNIQUE_PUZZLE);
  });

  it.each([
    ["プレイ中", richPlayingGame()],
    ["失敗", failedGame()],
    ["クリア", clearedGame()],
  ])(
    "T-134: %sのゲームをやり直すと、問題と解は同じで、そのほかが初めの状態に戻る",
    (_, state) => {
      const next = restartGame(state);
      expect(next.difficulty).toBe(state.difficulty);
      expect(next.puzzle).toEqual(state.puzzle);
      expect(next.solution).toEqual(state.solution);
      expect(next.values).toEqual(state.puzzle);
      expect(next.notes).toEqual(emptyNotes());
      expect(next.undoStack).toEqual([]);
      expect(next.redoStack).toEqual([]);
      expect(next.mistakes).toBe(0);
      expect(next.elapsedSeconds).toBe(0);
      expect(next.status).toBe("playing");
    },
  );

  it.each([
    ["easy", clearedGame()],
    ["hard", failedGame()],
    ["normal", richPlayingGame()],
  ])(
    "T-134: やり直した状態は、%sの createGame と同じ内容になる",
    (_, state) => {
      expect(restartGame(state)).toEqual(
        createGame(state.difficulty, state.puzzle, state.solution),
      );
    },
  );

  it("T-134: やり直すと、入力済みの数字が消えて手がかりだけになる", () => {
    const state = failedGame();
    expect(state.values).not.toEqual(state.puzzle);
    expect(restartGame(state).values).toEqual(UNIQUE_PUZZLE);
  });

  it("T-134: やり直した後は、元に戻す・やり直しが何も変えず、再び入力できる", () => {
    const next = restartGame(failedGame());
    expect(undo(next)).toBe(next);
    expect(redo(next)).toBe(next);
    const entered = inputDigit(next, BLANK_A, SOLUTION_A);
    expect(entered.values[BLANK_A]).toBe(SOLUTION_A);
    expect(entered.undoStack).toEqual([
      entry(snapshot(BLANK_A, 0, []), snapshot(BLANK_A, SOLUTION_A, [])),
    ]);
  });

  it("T-134: 渡した状態を書き換えない", () => {
    const state = failedGame();
    const copy = structuredClone(state);
    restartGame(state);
    expect(state).toEqual(copy);
  });

  it("T-134: やり直した状態の数字と問題は別の配列(後の入力が元の状態に響かない)", () => {
    const state = failedGame();
    const next = restartGame(state);
    expect(next.values).not.toBe(state.values);
    expect(next.values).not.toBe(next.puzzle);
  });
});
