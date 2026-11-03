// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redo, undo } from "@/lib/game/history";
import { eraseCell, inputDigit } from "@/lib/game/input";
import { toggleNote } from "@/lib/game/notes";
import { createGame } from "@/lib/game/state";
import { createEmptyStats } from "@/lib/game/stats";
import type { GameState, SavedStats } from "@/lib/game/types";
import {
  GAME_KEY,
  STATS_KEY,
  getBrowserStorage,
  loadGame,
  loadStats,
  parseGame,
  saveGame,
  saveStats,
} from "@/lib/storage/storage";

import {
  BLANK_A,
  BLANK_B,
  BLANK_C,
  EDGE_PUZZLE,
  clearedGame,
  entry,
  failedGame,
  freshGame,
  richPlayingGame,
  snapshot,
} from "../../../helpers/game";
import {
  UNIQUE_PUZZLE,
  UNIQUE_SOLUTION,
  isSolvedGrid,
} from "../../../helpers/grid";

const GAME = "sudoku:v1:game";
const STATS = "sudoku:v1:stats";

// 型に合わない値も作るので、壊した値は unknown で持つ
type Case = [name: string, make: () => unknown];

function omit(obj: object, key: string): unknown {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

function replaceAt<T>(
  items: readonly T[],
  index: number,
  value: unknown,
): unknown[] {
  return items.map((item, i) => (i === index ? value : item));
}

function swapped(grid: readonly number[], a: number, b: number): number[] {
  const copy = [...grid];
  copy[a] = grid[b]!;
  copy[b] = grid[a]!;
  return copy;
}

// 行・列・ブロックそれぞれで、1〜9 が 1 つずつそろっているか(本番のコードを使わない)
function unitsOk(grid: readonly number[]): {
  rows: boolean;
  cols: boolean;
  boxes: boolean;
} {
  const ok = (cells: number[]) =>
    cells
      .map((i) => grid[i])
      .sort()
      .join("") === "123456789";
  const range = Array.from({ length: 9 }, (_, k) => k);
  return {
    rows: range.every((r) => ok(range.map((k) => r * 9 + k))),
    cols: range.every((c) => ok(range.map((k) => k * 9 + c))),
    boxes: range.every((b) =>
      ok(
        range.map(
          (k) =>
            (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 +
            (b % 3) * 3 +
            (k % 3),
        ),
      ),
    ),
  };
}

function storeGame(value: unknown): void {
  localStorage.setItem(GAME, JSON.stringify(value));
}

function storeStats(value: unknown): void {
  localStorage.setItem(STATS, JSON.stringify(value));
}

function sampleStats(): SavedStats {
  return {
    easy: { cleared: 3, failed: 1, bestSeconds: 200 },
    normal: { cleared: 0, failed: 2, bestSeconds: null },
    hard: { cleared: 1, failed: 0, bestSeconds: 0 },
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("保存のキー", () => {
  it("T-301: キーは sudoku:v1:game と sudoku:v1:stats", () => {
    expect(GAME_KEY).toBe(GAME);
    expect(STATS_KEY).toBe(STATS);
  });
});

describe("T-301: 保存して読み込むと同じ内容に戻る", () => {
  it.each<[string, () => GameState]>([
    ["初めの状態", () => freshGame("easy")],
    ["メモ・誤り・履歴のある進行中", () => richPlayingGame()],
    ["失敗", () => failedGame()],
    ["クリア", () => clearedGame()],
  ])("T-301: ゲーム(%s)", (_, make) => {
    const game = make();
    expect(saveGame(localStorage, game)).toBe(true);
    expect(loadGame(localStorage)).toEqual(game);
  });

  it("T-301: ゲームは sudoku:v1:game に JSON で保存される", () => {
    const game = richPlayingGame();
    saveGame(localStorage, game);
    const stored = localStorage.getItem(GAME);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(game);
    expect(localStorage.getItem(STATS)).toBeNull();
  });

  it("T-301: 保存し直すと、最後のゲーム 1 つだけが残る", () => {
    saveGame(localStorage, freshGame("easy"));
    const second = richPlayingGame();
    saveGame(localStorage, second);
    expect(loadGame(localStorage)).toEqual(second);
  });

  it("T-301: 成績(ベストタイムあり・なし・0 秒を含む)", () => {
    const stats = sampleStats();
    expect(saveStats(localStorage, stats)).toBe(true);
    expect(loadStats(localStorage)).toEqual(stats);
  });

  it("T-301: 成績は sudoku:v1:stats に JSON で保存される", () => {
    saveStats(localStorage, sampleStats());
    const stored = localStorage.getItem(STATS);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(sampleStats());
    expect(localStorage.getItem(GAME)).toBeNull();
  });

  it("T-301: 空の成績も保存して読み込める", () => {
    saveStats(localStorage, createEmptyStats());
    expect(loadStats(localStorage)).toEqual(createEmptyStats());
  });

  it("T-301: ゲームと成績は別々に読み込める", () => {
    const game = richPlayingGame();
    saveGame(localStorage, game);
    saveStats(localStorage, sampleStats());
    expect(loadGame(localStorage)).toEqual(game);
    expect(loadStats(localStorage)).toEqual(sampleStats());
  });

  it("T-301: 保存する前は、ゲームなし・成績なし", () => {
    expect(loadGame(localStorage)).toBeNull();
    expect(loadStats(localStorage)).toEqual(createEmptyStats());
  });

  it("T-301: 保存した後に元の状態を書き換えても、読み込む値は変わらない", () => {
    const game = richPlayingGame();
    saveGame(localStorage, game);
    game.mistakes = 2;
    game.notes[0]!.push(9);
    expect(loadGame(localStorage)).toEqual(richPlayingGame());
  });
});

describe("T-301: 境界の値は読み込める", () => {
  const base = richPlayingGame;

  it.each<Case>([
    ["回数 0 の進行中", () => ({ ...freshGame(), mistakes: 0 })],
    ["回数 2 の進行中", () => ({ ...base(), mistakes: 2 })],
    ["時間 0 秒", () => ({ ...base(), elapsedSeconds: 0 })],
    ["時間 36000 秒", () => ({ ...base(), elapsedSeconds: 36000 })],
    ["難易度 normal", () => ({ ...base(), difficulty: "normal" })],
    ["難易度 hard", () => ({ ...base(), difficulty: "hard" })],
    [
      // 履歴は手がかりのマスを指せないので、0 番と 80 番の手がかりを抜いた問題を使う
      "履歴のマスの番号 0・80、数字 0・9",
      () => ({
        ...base(),
        puzzle: [...EDGE_PUZZLE],
        values: replaceAt(replaceAt(base().values, 0, 0), 80, 0),
        undoStack: [
          entry(snapshot(0, 0, []), snapshot(80, 9, [])),
          entry(snapshot(80, 0, [1, 9]), snapshot(80, 0, [])),
        ],
        redoStack: [entry(snapshot(80, 0, [9]), snapshot(0, 9, []))],
      }),
    ],
    [
      "履歴の before と after が複数のマス",
      () => ({
        ...base(),
        undoStack: [
          {
            before: [snapshot(BLANK_A, 0, []), snapshot(BLANK_B, 0, [3])],
            after: [snapshot(BLANK_A, 5, []), snapshot(BLANK_B, 0, [])],
          },
        ],
      }),
    ],
    ["履歴が空", () => ({ ...base(), undoStack: [], redoStack: [] })],
    [
      "メモが 1〜9 のすべて",
      () => ({
        ...base(),
        notes: replaceAt(base().notes, BLANK_C, [1, 2, 3, 4, 5, 6, 7, 8, 9]),
      }),
    ],
  ])("T-301: %s", (_, make) => {
    storeGame(make());
    expect(loadGame(localStorage)).toEqual(make());
  });
});

describe("T-302: ゲームの読み込み: 値が無い・JSON でない・形が違う", () => {
  it("T-302: 値が無いと null", () => {
    expect(loadGame(localStorage)).toBeNull();
  });

  it.each([
    ["壊れた JSON", "{not json"],
    ["空文字", ""],
    ["途中で切れた JSON", JSON.stringify(richPlayingGame()).slice(0, 100)],
    ["JSON ではない語", "undefined"],
    ["null", "null"],
    ["配列", "[]"],
    ["数値", "123"],
    ["文字列", '"text"'],
    ["空のオブジェクト", "{}"],
  ])("T-302: 保存された値が %s なら null", (_, text) => {
    localStorage.setItem(GAME, text);
    expect(loadGame(localStorage)).toBeNull();
  });

  const shapeCases: Case[] = [
    // puzzle、solution、values
    [
      "puzzle が 80 要素",
      () => ({ ...richPlayingGame(), puzzle: UNIQUE_PUZZLE.slice(0, 80) }),
    ],
    [
      "puzzle が 82 要素",
      () => ({ ...richPlayingGame(), puzzle: [...UNIQUE_PUZZLE, 0] }),
    ],
    [
      "puzzle に 10 がある",
      () => ({ ...richPlayingGame(), puzzle: replaceAt(UNIQUE_PUZZLE, 4, 10) }),
    ],
    [
      "puzzle に -1 がある",
      () => ({ ...richPlayingGame(), puzzle: replaceAt(UNIQUE_PUZZLE, 4, -1) }),
    ],
    [
      "puzzle に小数がある",
      () => ({
        ...richPlayingGame(),
        puzzle: replaceAt(UNIQUE_PUZZLE, 4, 1.5),
      }),
    ],
    [
      "puzzle に文字列の数字がある",
      () => ({
        ...richPlayingGame(),
        puzzle: replaceAt(UNIQUE_PUZZLE, 4, "7"),
      }),
    ],
    [
      "puzzle に null がある",
      () => ({
        ...richPlayingGame(),
        puzzle: replaceAt(UNIQUE_PUZZLE, 4, null),
      }),
    ],
    [
      "puzzle が配列でない",
      () => ({ ...richPlayingGame(), puzzle: UNIQUE_PUZZLE.join("") }),
    ],
    [
      "values が 80 要素",
      () => ({
        ...richPlayingGame(),
        values: richPlayingGame().values.slice(0, 80),
      }),
    ],
    [
      "values に 10 がある",
      () => ({
        ...richPlayingGame(),
        values: replaceAt(richPlayingGame().values, 7, 10),
      }),
    ],
    [
      "values に -1 がある",
      () => ({
        ...richPlayingGame(),
        values: replaceAt(richPlayingGame().values, 7, -1),
      }),
    ],
    [
      "solution が 80 要素",
      () => ({ ...richPlayingGame(), solution: UNIQUE_SOLUTION.slice(0, 80) }),
    ],
    [
      "solution に 10 がある",
      () => ({
        ...richPlayingGame(),
        solution: replaceAt(UNIQUE_SOLUTION, BLANK_A, 10),
      }),
    ],
    [
      "solution に空欄(0)がある",
      () => ({
        ...richPlayingGame(),
        solution: replaceAt(UNIQUE_SOLUTION, BLANK_A, 0),
      }),
    ],
    [
      "solution に小数がある",
      () => ({
        ...richPlayingGame(),
        solution: replaceAt(UNIQUE_SOLUTION, BLANK_A, 4.5),
      }),
    ],
    // notes
    [
      "notes が 80 要素",
      () => ({
        ...richPlayingGame(),
        notes: richPlayingGame().notes.slice(0, 80),
      }),
    ],
    [
      "notes が 82 要素",
      () => ({ ...richPlayingGame(), notes: [...richPlayingGame().notes, []] }),
    ],
    [
      "notes に 0 がある",
      () => ({
        ...richPlayingGame(),
        notes: replaceAt(richPlayingGame().notes, BLANK_C, [0, 3]),
      }),
    ],
    [
      "notes に 10 がある",
      () => ({
        ...richPlayingGame(),
        notes: replaceAt(richPlayingGame().notes, BLANK_C, [3, 10]),
      }),
    ],
    [
      "notes に小数がある",
      () => ({
        ...richPlayingGame(),
        notes: replaceAt(richPlayingGame().notes, BLANK_C, [1.5]),
      }),
    ],
    [
      "notes に文字列の数字がある",
      () => ({
        ...richPlayingGame(),
        notes: replaceAt(richPlayingGame().notes, BLANK_C, ["3"]),
      }),
    ],
    [
      "notes のマスが配列でない",
      () => ({
        ...richPlayingGame(),
        notes: replaceAt(richPlayingGame().notes, BLANK_C, null),
      }),
    ],
    ["notes が配列でない", () => ({ ...richPlayingGame(), notes: {} })],
    // mistakes、elapsedSeconds
    ["回数が 4", () => ({ ...richPlayingGame(), mistakes: 4 })],
    ["回数が -1", () => ({ ...richPlayingGame(), mistakes: -1 })],
    ["回数が 4(クリアの状態)", () => ({ ...clearedGame(), mistakes: 4 })],
    ["回数が -1(クリアの状態)", () => ({ ...clearedGame(), mistakes: -1 })],
    ["回数が小数", () => ({ ...richPlayingGame(), mistakes: 1.5 })],
    ["回数が文字列", () => ({ ...richPlayingGame(), mistakes: "1" })],
    ["回数が null", () => ({ ...richPlayingGame(), mistakes: null })],
    ["時間が -1", () => ({ ...richPlayingGame(), elapsedSeconds: -1 })],
    ["時間が小数", () => ({ ...richPlayingGame(), elapsedSeconds: 12.5 })],
    ["時間が文字列", () => ({ ...richPlayingGame(), elapsedSeconds: "125" })],
    ["時間が null", () => ({ ...richPlayingGame(), elapsedSeconds: null })],
    // difficulty、status
    ["未知の難易度", () => ({ ...richPlayingGame(), difficulty: "expert" })],
    ["大文字の難易度", () => ({ ...richPlayingGame(), difficulty: "EASY" })],
    ["数値の難易度", () => ({ ...richPlayingGame(), difficulty: 1 })],
    ["未知の状態", () => ({ ...richPlayingGame(), status: "paused" })],
    ["数値の状態", () => ({ ...richPlayingGame(), status: 0 })],
    // undoStack、redoStack
    ["undoStack が配列でない", () => ({ ...richPlayingGame(), undoStack: {} })],
    [
      "redoStack が配列でない",
      () => ({ ...richPlayingGame(), redoStack: null }),
    ],
    [
      "undoStack の要素が null",
      () => ({ ...richPlayingGame(), undoStack: [null] }),
    ],
    [
      "undoStack の要素に before が無い",
      () => ({
        ...richPlayingGame(),
        undoStack: [{ after: [snapshot(2, 4)] }],
      }),
    ],
    [
      "undoStack の要素に after が無い",
      () => ({
        ...richPlayingGame(),
        undoStack: [{ before: [snapshot(2, 0)] }],
      }),
    ],
    [
      "undoStack の before が配列でない",
      () => ({
        ...richPlayingGame(),
        undoStack: [{ before: snapshot(2, 0), after: [snapshot(2, 4)] }],
      }),
    ],
    [
      "redoStack の after が配列でない",
      () => ({
        ...richPlayingGame(),
        redoStack: [{ before: [snapshot(2, 0)], after: "x" }],
      }),
    ],
    [
      "履歴のマスの番号が 81",
      () => ({
        ...richPlayingGame(),
        undoStack: [{ before: [snapshot(81, 0)], after: [snapshot(2, 4)] }],
      }),
    ],
    [
      "履歴のマスの番号が -1",
      () => ({
        ...richPlayingGame(),
        undoStack: [{ before: [snapshot(2, 0)], after: [snapshot(-1, 4)] }],
      }),
    ],
    [
      "履歴のマスの番号が小数",
      () => ({
        ...richPlayingGame(),
        redoStack: [{ before: [snapshot(2.5, 0)], after: [snapshot(2, 4)] }],
      }),
    ],
    [
      "履歴のマスの番号が文字列",
      () => ({
        ...richPlayingGame(),
        undoStack: [
          {
            before: [{ index: "2", value: 0, notes: [] }],
            after: [snapshot(2, 4)],
          },
        ],
      }),
    ],
    [
      "履歴の数字が 10",
      () => ({
        ...richPlayingGame(),
        undoStack: [{ before: [snapshot(2, 0)], after: [snapshot(2, 10)] }],
      }),
    ],
    [
      "履歴の数字が -1",
      () => ({
        ...richPlayingGame(),
        redoStack: [{ before: [snapshot(2, -1)], after: [snapshot(2, 4)] }],
      }),
    ],
    [
      "履歴の数字が小数",
      () => ({
        ...richPlayingGame(),
        undoStack: [{ before: [snapshot(2, 0.5)], after: [snapshot(2, 4)] }],
      }),
    ],
    [
      "履歴のメモに 0 がある",
      () => ({
        ...richPlayingGame(),
        undoStack: [{ before: [snapshot(2, 0, [0])], after: [snapshot(2, 4)] }],
      }),
    ],
    [
      "履歴のメモに 10 がある",
      () => ({
        ...richPlayingGame(),
        undoStack: [
          { before: [snapshot(2, 0, [10])], after: [snapshot(2, 4)] },
        ],
      }),
    ],
    [
      "履歴のメモが昇順でない",
      () => ({
        ...richPlayingGame(),
        undoStack: [
          { before: [snapshot(2, 0, [3, 1])], after: [snapshot(2, 4)] },
        ],
      }),
    ],
    [
      "履歴のメモに重なりがある",
      () => ({
        ...richPlayingGame(),
        redoStack: [
          { before: [snapshot(2, 0)], after: [snapshot(2, 0, [3, 3])] },
        ],
      }),
    ],
    [
      "履歴のメモが配列でない",
      () => ({
        ...richPlayingGame(),
        undoStack: [
          {
            before: [{ index: 2, value: 0, notes: 3 }],
            after: [snapshot(2, 4)],
          },
        ],
      }),
    ],
    [
      "履歴のマスに notes が無い",
      () => ({
        ...richPlayingGame(),
        undoStack: [
          { before: [{ index: 2, value: 0 }], after: [snapshot(2, 4)] },
        ],
      }),
    ],
    [
      "履歴のマスに index が無い",
      () => ({
        ...richPlayingGame(),
        undoStack: [
          { before: [{ value: 0, notes: [] }], after: [snapshot(2, 4)] },
        ],
      }),
    ],
    [
      "履歴のマスが null",
      () => ({
        ...richPlayingGame(),
        undoStack: [{ before: [null], after: [snapshot(2, 4)] }],
      }),
    ],
  ];

  it.each(shapeCases)("T-302: %s なら null", (_, make) => {
    storeGame(make());
    expect(loadGame(localStorage)).toBeNull();
  });

  it.each(Object.keys(richPlayingGame()))(
    "T-302: 項目 %s が欠けていると null",
    (key) => {
      storeGame(omit(richPlayingGame(), key));
      expect(loadGame(localStorage)).toBeNull();
    },
  );

  it("T-302: 壊れた値のあとでも、正しい値を保存し直せば読み込める", () => {
    localStorage.setItem(GAME, "{not json");
    expect(loadGame(localStorage)).toBeNull();
    const game = richPlayingGame();
    saveGame(localStorage, game);
    expect(loadGame(localStorage)).toEqual(game);
  });

  it("T-302: getItem が例外を投げても、例外を出さず null", () => {
    saveGame(localStorage, richPlayingGame());
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => loadGame(localStorage)).not.toThrow();
    expect(loadGame(localStorage)).toBeNull();
  });
});

describe("T-302: 成績の読み込み: 値が無い・JSON でない・形が違う", () => {
  it("T-302: 値が無いと、成績なし(0 回)", () => {
    expect(loadStats(localStorage)).toEqual(createEmptyStats());
  });

  it.each([
    ["壊れた JSON", "{not json"],
    ["空文字", ""],
    ["null", "null"],
    ["配列", "[]"],
    ["数値", "5"],
    ["文字列", '"stats"'],
    ["空のオブジェクト", "{}"],
  ])("T-302: 保存された値が %s なら成績なし", (_, text) => {
    localStorage.setItem(STATS, text);
    expect(loadStats(localStorage)).toEqual(createEmptyStats());
  });

  const good = sampleStats;
  const shapeCases: Case[] = [
    ["hard が無い", () => omit(good(), "hard")],
    ["easy が無い", () => omit(good(), "easy")],
    ["normal が null", () => ({ ...good(), normal: null })],
    ["easy が配列", () => ({ ...good(), easy: [3, 1, 200] })],
    [
      "クリア数が -1",
      () => ({ ...good(), easy: { ...good().easy, cleared: -1 } }),
    ],
    [
      "クリア数が小数",
      () => ({ ...good(), easy: { ...good().easy, cleared: 1.5 } }),
    ],
    [
      "クリア数が文字列",
      () => ({ ...good(), easy: { ...good().easy, cleared: "3" } }),
    ],
    [
      "クリア数が無い",
      () => ({ ...good(), easy: omit(good().easy, "cleared") }),
    ],
    [
      "失敗数が -1",
      () => ({ ...good(), normal: { ...good().normal, failed: -1 } }),
    ],
    [
      "失敗数が小数",
      () => ({ ...good(), normal: { ...good().normal, failed: 0.5 } }),
    ],
    [
      "失敗数が null",
      () => ({ ...good(), normal: { ...good().normal, failed: null } }),
    ],
    [
      "失敗数が無い",
      () => ({ ...good(), normal: omit(good().normal, "failed") }),
    ],
    [
      "ベストタイムが -1",
      () => ({ ...good(), easy: { ...good().easy, bestSeconds: -1 } }),
    ],
    [
      "ベストタイムが小数",
      () => ({ ...good(), easy: { ...good().easy, bestSeconds: 12.5 } }),
    ],
    [
      "ベストタイムが文字列",
      () => ({ ...good(), easy: { ...good().easy, bestSeconds: "200" } }),
    ],
    [
      "ベストタイムが無い",
      () => ({ ...good(), easy: omit(good().easy, "bestSeconds") }),
    ],
  ];

  it.each(shapeCases)("T-302: %s なら成績なし", (_, make) => {
    storeStats(make());
    expect(loadStats(localStorage)).toEqual(createEmptyStats());
  });

  it("T-302: 1 つの難易度だけが壊れていても、成績全体を捨てる(ほかの難易度の値を残さない)", () => {
    storeStats({
      ...good(),
      hard: { cleared: -1, failed: 0, bestSeconds: null },
    });
    expect(loadStats(localStorage)).toEqual(createEmptyStats());
  });

  it("T-302: getItem が例外を投げても、例外を出さず成績なし", () => {
    saveStats(localStorage, good());
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => loadStats(localStorage)).not.toThrow();
    expect(loadStats(localStorage)).toEqual(createEmptyStats());
  });

  it("T-302: 空の成績を返すたびに、別のオブジェクトを返す", () => {
    const a = loadStats(localStorage);
    const b = loadStats(localStorage);
    expect(a).not.toBe(b);
    expect(a.easy).not.toBe(b.easy);
  });
});

describe("T-304: ゲームの読み込み: 形は正しいが中身が食い違う", () => {
  // 食い違いを 1 つだけ入れる。ほかの規則には合うようにしてある
  const relabeled = UNIQUE_SOLUTION.map((v) => (v === 5 ? 3 : v === 3 ? 5 : v));
  // 同じ列・同じブロックの空欄 2 マス(2 と 11)を入れ替える: 行だけが崩れる
  const rowOnlyBroken = swapped(UNIQUE_SOLUTION, 2, 11);
  // 同じ行・同じブロックの空欄 2 マス(10 と 11)を入れ替える: 列だけが崩れる
  const colOnlyBroken = swapped(UNIQUE_SOLUTION, 10, 11);
  // 行と列は 1〜9 がそろうが、ブロックはそろわない盤面。手がかりは先頭の 40 マス
  const cyclic = Array.from(
    { length: 81 },
    (_, i) => ((Math.floor(i / 9) + (i % 9)) % 9) + 1,
  );
  const cyclicPuzzle = cyclic.map((v, i) => (i < 40 ? v : 0));

  const cases: Case[] = [
    // 手がかりと入力
    [
      "手がかりのマスの数字が values で違う",
      () => ({
        ...richPlayingGame(),
        values: replaceAt(richPlayingGame().values, 0, 4),
      }),
    ],
    [
      "手がかりのマスが values で空欄",
      () => ({
        ...richPlayingGame(),
        values: replaceAt(richPlayingGame().values, 0, 0),
      }),
    ],
    // solution
    [
      "solution の 1 マスだけを変えて、行・列・ブロックに重なりがある",
      () => ({
        ...richPlayingGame(),
        solution: replaceAt(UNIQUE_SOLUTION, BLANK_A, 6),
      }),
    ],
    [
      "solution の行だけに重なりがある(列とブロックは正しい)",
      () => ({
        ...richPlayingGame(),
        solution: rowOnlyBroken,
      }),
    ],
    [
      "solution の列だけに重なりがある(行とブロックは正しい)",
      () => ({
        ...richPlayingGame(),
        solution: colOnlyBroken,
      }),
    ],
    [
      "solution のブロックだけに重なりがある(行と列は正しい)",
      () => ({
        ...freshGame("easy", cyclicPuzzle, cyclic),
      }),
    ],
    [
      "solution が手がかりと違う(数字 5 と 3 を入れ替えた、ルールには合う解)",
      () => ({
        ...richPlayingGame(),
        solution: relabeled,
      }),
    ],
    // notes
    [
      "正解の入ったマスにメモがある",
      () => ({
        ...richPlayingGame(),
        notes: replaceAt(richPlayingGame().notes, BLANK_A, [1]),
      }),
    ],
    [
      "誤りの入ったマスにメモがある",
      () => ({
        ...richPlayingGame(),
        notes: replaceAt(richPlayingGame().notes, BLANK_B, [2]),
      }),
    ],
    [
      "手がかりのマスにメモがある",
      () => ({
        ...richPlayingGame(),
        notes: replaceAt(richPlayingGame().notes, 0, [1]),
      }),
    ],
    [
      "メモが昇順でない",
      () => ({
        ...richPlayingGame(),
        notes: replaceAt(richPlayingGame().notes, BLANK_C, [3, 1]),
      }),
    ],
    [
      "メモに同じ数字が重なる",
      () => ({
        ...richPlayingGame(),
        notes: replaceAt(richPlayingGame().notes, BLANK_C, [3, 3]),
      }),
    ],
    // 状態と中身
    ["failed なのに回数が 2", () => ({ ...failedGame(), mistakes: 2 })],
    ["failed なのに回数が 0", () => ({ ...failedGame(), mistakes: 0 })],
    [
      "failed なのに全部のマスが正解",
      () => ({ ...clearedGame(), status: "failed", mistakes: 3 }),
    ],
    ["playing なのに回数が 3", () => ({ ...richPlayingGame(), mistakes: 3 })],
    [
      "cleared なのに空欄がある",
      () => ({
        ...clearedGame(),
        values: replaceAt(clearedGame().values, BLANK_A, 0),
      }),
    ],
    [
      "cleared なのに誤りの数字がある",
      () => ({
        ...clearedGame(),
        values: replaceAt(clearedGame().values, BLANK_A, 1),
      }),
    ],
    [
      "cleared なのに、進行中の値(空欄とメモがある)",
      () => ({
        ...richPlayingGame(),
        status: "cleared",
      }),
    ],
    [
      "playing なのに全部のマスが正解",
      () => ({
        ...clearedGame(),
        status: "playing",
      }),
    ],
    ["cleared なのに回数が 3", () => ({ ...clearedGame(), mistakes: 3 })],
    // 履歴の中身(2026-11-03 にユーザが足すと決めた)
    [
      "元に戻す履歴の before が手がかりのマスを指す",
      () => ({
        ...richPlayingGame(),
        undoStack: [entry(snapshot(0, 0, []), snapshot(BLANK_A, 4, []))],
      }),
    ],
    [
      "やり直しの履歴の after が手がかりのマスを指す",
      () => ({
        ...richPlayingGame(),
        redoStack: [entry(snapshot(BLANK_A, 0, []), snapshot(0, 5, []))],
      }),
    ],
    [
      "履歴の数字の入ったマスにメモがある",
      () => ({
        ...richPlayingGame(),
        undoStack: [
          entry(snapshot(BLANK_A, 0, [1]), snapshot(BLANK_A, 4, [1])),
        ],
      }),
    ],
  ];

  it("T-304: 前提: 入れ替えた解はルールを満たすが、手がかりと違う", () => {
    expect(isSolvedGrid(relabeled)).toBe(true);
    expect(relabeled[0]).not.toBe(UNIQUE_PUZZLE[0]);
  });

  it("T-304: 前提: solution の壊し方が、狙った単位だけに重なりを作る", () => {
    expect(unitsOk(rowOnlyBroken)).toEqual({
      rows: false,
      cols: true,
      boxes: true,
    });
    expect(unitsOk(colOnlyBroken)).toEqual({
      rows: true,
      cols: false,
      boxes: true,
    });
    expect(unitsOk(cyclic)).toEqual({ rows: true, cols: true, boxes: false });
    // 入れ替えたマスは、手がかりではない(手がかりと solution の食い違いが混ざらない)
    for (const i of [2, 10, 11]) expect(UNIQUE_PUZZLE[i]).toBe(0);
    // 1 マスだけ変えると行・列・ブロックのすべてが崩れる(どの数字も各単位に 1 つあるため)
    expect(unitsOk(replaceAt(UNIQUE_SOLUTION, BLANK_A, 6) as number[])).toEqual(
      {
        rows: false,
        cols: false,
        boxes: false,
      },
    );
    expect(UNIQUE_PUZZLE[BLANK_A]).toBe(0);
    // 手がかりは solution と同じ(崩れた単位の規則だけを確かめるため)
    expect(cyclicPuzzle.every((v, i) => v === 0 || v === cyclic[i])).toBe(true);
  });

  it.each(cases)("T-304: %sなら null", (_, make) => {
    storeGame(make());
    expect(loadGame(localStorage)).toBeNull();
  });

  it("T-304: 前提: 履歴の壊し方で使った 0 番は手がかり、空欄のマスにメモの付いた履歴は読み込める", () => {
    expect(UNIQUE_PUZZLE[0]).not.toBe(0);
    storeGame({
      ...richPlayingGame(),
      undoStack: [entry(snapshot(BLANK_A, 0, [1]), snapshot(BLANK_A, 0, []))],
    });
    expect(loadGame(localStorage)).not.toBeNull();
  });

  it("T-304: 前提: 食い違いの元にした値(進行中・失敗・クリア)そのものは読み込める", () => {
    for (const game of [richPlayingGame(), failedGame(), clearedGame()]) {
      storeGame(game);
      expect(loadGame(localStorage)).toEqual(game);
    }
  });

  it("T-304: 型に無い項目(トップレベル)は、読み込んだ値に残らない", () => {
    storeGame({ ...richPlayingGame(), extra: 1, version: "x" });
    const loaded = loadGame(localStorage);
    expect(loaded).toEqual(richPlayingGame());
    expect(loaded).not.toHaveProperty("extra");
    expect(loaded).not.toHaveProperty("version");
  });

  it("T-304: 型に無い項目(履歴の要素とマスの中)は、読み込んだ値に残らない", () => {
    storeGame({
      ...richPlayingGame(),
      undoStack: [
        {
          before: [{ index: BLANK_A, value: 0, notes: [1, 4], memo: "x" }],
          after: [{ index: BLANK_A, value: 4, notes: [], memo: "y" }],
          label: "z",
        },
      ],
      redoStack: [],
    });
    const loaded = loadGame(localStorage);
    expect(loaded?.undoStack).toEqual([
      entry(snapshot(BLANK_A, 0, [1, 4]), snapshot(BLANK_A, 4, [])),
    ]);
    expect(loaded?.undoStack[0]).not.toHaveProperty("label");
    expect(loaded?.undoStack[0]?.before[0]).not.toHaveProperty("memo");
    expect(loaded?.undoStack[0]?.after[0]).not.toHaveProperty("memo");
  });

  it("T-304: 型に無い項目があっても、値の壊れたゲームは null のまま", () => {
    storeGame({ ...richPlayingGame(), extra: 1, mistakes: 4 });
    expect(loadGame(localStorage)).toBeNull();
  });
});

describe("T-304: 成績の読み込み: 形は正しいが中身が食い違う", () => {
  const good = sampleStats;
  const cases: Case[] = [
    [
      "クリアが 0 なのにベストタイムがある",
      () => ({
        ...good(),
        normal: { cleared: 0, failed: 2, bestSeconds: 100 },
      }),
    ],
    [
      "クリアが 0 なのにベストタイムが 0 秒",
      () => ({
        ...good(),
        normal: { cleared: 0, failed: 2, bestSeconds: 0 },
      }),
    ],
    [
      "回数がすべて 0 なのにベストタイムがある",
      () => ({
        ...good(),
        hard: { cleared: 0, failed: 0, bestSeconds: 5 },
      }),
    ],
    [
      "クリアが 1 以上なのにベストタイムが無い",
      () => ({
        ...good(),
        easy: { cleared: 2, failed: 1, bestSeconds: null },
      }),
    ],
  ];

  it.each(cases)("T-304: %sなら成績なし", (_, make) => {
    storeStats(make());
    expect(loadStats(localStorage)).toEqual(createEmptyStats());
  });

  it("T-304: 前提: クリアが 1 でベストタイムが 0 秒の成績は読み込める", () => {
    storeStats(good());
    expect(loadStats(localStorage)).toEqual(good());
  });

  it("T-304: 型に無い項目は、読み込んだ値に残らない(成績の直下と難易度の中)", () => {
    storeStats({
      ...good(),
      expert: { cleared: 1, failed: 0, bestSeconds: 1 },
      easy: { ...good().easy, memo: "x" },
    });
    const loaded = loadStats(localStorage);
    expect(loaded).toEqual(good());
    expect(loaded).not.toHaveProperty("expert");
    expect(loaded.easy).not.toHaveProperty("memo");
  });
});

describe("T-303: 保存で例外が出る", () => {
  const quotaExceeded = () => {
    throw new DOMException(
      "The quota has been exceeded.",
      "QuotaExceededError",
    );
  };

  it("T-303: setItem が容量超過で例外を投げても、saveGame は例外を出さず false を返す", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(quotaExceeded);
    expect(() => saveGame(localStorage, richPlayingGame())).not.toThrow();
    expect(saveGame(localStorage, richPlayingGame())).toBe(false);
  });

  it("T-303: setItem が例外を投げても、saveStats は例外を出さず false を返す", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(quotaExceeded);
    expect(() => saveStats(localStorage, sampleStats())).not.toThrow();
    expect(saveStats(localStorage, sampleStats())).toBe(false);
  });

  it("T-303: DOMException 以外の例外(無効にされているなど)でも false を返す", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(saveGame(localStorage, freshGame())).toBe(false);
    expect(saveStats(localStorage, createEmptyStats())).toBe(false);
  });

  it("T-303: 保存できなかったとき、以前の値は書き換わらない", () => {
    const old = richPlayingGame();
    saveGame(localStorage, old);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(quotaExceeded);
    saveGame(localStorage, freshGame("hard"));
    vi.restoreAllMocks();
    expect(loadGame(localStorage)).toEqual(old);
  });

  it("T-303: 保存が成功したときは true を返す", () => {
    expect(saveGame(localStorage, richPlayingGame())).toBe(true);
    expect(saveStats(localStorage, sampleStats())).toBe(true);
  });
});

describe("T-303: ブラウザの Storage を取り出す", () => {
  it("T-303: 取り出せるときは window.localStorage を返す", () => {
    expect(getBrowserStorage()).toBe(window.localStorage);
  });

  it("T-303: window.localStorage の参照で例外が出ても、例外を出さず null を返す", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    expect(() => getBrowserStorage()).not.toThrow();
    expect(getBrowserStorage()).toBeNull();
  });

  it("T-303: window が無い(サーバーの描画)ときは null を返す(G-83)", () => {
    vi.stubGlobal("window", undefined);
    try {
      expect(getBrowserStorage()).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("T-304: 読み込んだ値は、渡された値と配列を共有しない", () => {
  it("T-304: parseGame の盤面・解・数字は、渡した値とは別の配列", () => {
    const source = richPlayingGame();
    const parsed = parseGame(source);
    expect(parsed).toEqual(source);
    expect(parsed?.puzzle).not.toBe(source.puzzle);
    expect(parsed?.solution).not.toBe(source.solution);
    expect(parsed?.values).not.toBe(source.values);
  });
});

describe("T-302: 整数の上限は安全な整数(2^53-1)まで", () => {
  const MAX = Number.MAX_SAFE_INTEGER;
  const OVER = 2 ** 53;

  it("T-302: 前提: 上限を 1 超えた値も、JSON で同じ値のまま保存される", () => {
    expect(JSON.parse(JSON.stringify(OVER))).toBe(OVER);
    expect(Number.isInteger(OVER)).toBe(true);
  });

  it("T-302: 時間が上限ちょうどのゲームは読み込める", () => {
    const game = { ...richPlayingGame(), elapsedSeconds: MAX };
    storeGame(game);
    expect(loadGame(localStorage)).toEqual(game);
  });

  it("T-302: 時間が上限を超えたゲームは null", () => {
    storeGame({ ...richPlayingGame(), elapsedSeconds: OVER });
    expect(loadGame(localStorage)).toBeNull();
  });

  it("T-302: クリア数・失敗数・ベストタイムが上限ちょうどの成績は読み込める", () => {
    const stats: SavedStats = {
      ...sampleStats(),
      easy: { cleared: MAX, failed: MAX, bestSeconds: MAX },
    };
    storeStats(stats);
    expect(loadStats(localStorage)).toEqual(stats);
  });

  it.each([
    ["クリア数", { cleared: OVER, failed: 0, bestSeconds: 10 }],
    ["失敗数", { cleared: 1, failed: OVER, bestSeconds: 10 }],
    ["ベストタイム", { cleared: 1, failed: 0, bestSeconds: OVER }],
  ])("T-302: %s が上限を超えた成績は、成績なし", (_, easy) => {
    storeStats({ ...sampleStats(), easy });
    expect(loadStats(localStorage)).toEqual(createEmptyStats());
  });
});

describe("T-301: 実際の操作で作った状態も、保存して読み込むと同じに戻る", () => {
  const blanks = UNIQUE_PUZZLE.flatMap((v, i) => (v === 0 ? [i] : []));

  function roundTrip(state: GameState): GameState | null {
    expect(saveGame(localStorage, state)).toBe(true);
    return loadGame(localStorage);
  }

  // 乱数の元から決まる操作の列(本番の乱数の関数を使わない、テストだけの線形合同法)
  function operations(seed: number): (state: GameState) => GameState {
    let x = seed;
    const next = (n: number) => {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      // 下位のビットは周期が短いので、上位のビットを使う
      return (x >>> 16) % n;
    };
    return (state) => {
      const index = blanks[next(blanks.length)]!;
      const digit = next(9) + 1;
      // 間違いが早く 3 回にならないよう、誤りの入力は 20 回に 1 回にする
      const op = next(20);
      if (op < 4) return inputDigit(state, index, UNIQUE_SOLUTION[index]!);
      if (op < 5) return inputDigit(state, index, digit);
      if (op < 9) return eraseCell(state, index);
      if (op < 14) return toggleNote(state, index, digit);
      if (op < 17) return undo(state);
      return redo(state);
    };
  }

  it.each([1, 2, 3, 4, 5])(
    "T-301: 乱数の元 %i の操作の列で、各操作の後の状態",
    (seed) => {
      const step = operations(seed);
      let state = createGame("normal", UNIQUE_PUZZLE, UNIQUE_SOLUTION);
      const seen = new Set<string>();
      for (let n = 0; n < 200; n++) {
        state = { ...step(state), elapsedSeconds: n };
        if (state.notes.some((notes) => notes.length > 0)) seen.add("notes");
        if (state.undoStack.length > 0) seen.add("undo");
        if (state.redoStack.length > 0) seen.add("redo");
        if (state.mistakes > 0) seen.add("mistakes");
        expect(roundTrip(state)).toEqual(state);
      }
      // 操作の列が、メモ・元に戻す・やり直し・間違いを含む状態を作ったこと
      expect([...seen].sort()).toEqual(["mistakes", "notes", "redo", "undo"]);
    },
  );

  it("T-301: 間違いを 3 回入れて失敗したゲーム", () => {
    let state = createGame("hard", UNIQUE_PUZZLE, UNIQUE_SOLUTION);
    state = toggleNote(state, blanks[3]!, 7);
    for (const index of blanks.slice(0, 3)) {
      const wrong = (UNIQUE_SOLUTION[index]! % 9) + 1;
      state = inputDigit(state, index, wrong);
    }
    expect(state.status).toBe("failed");
    expect(roundTrip(state)).toEqual(state);
  });

  it("T-301: 間違いと元に戻すを挟んで、全部正解にしてクリアしたゲーム", () => {
    let state = createGame("easy", UNIQUE_PUZZLE, UNIQUE_SOLUTION);
    const first = blanks[0]!;
    state = inputDigit(state, first, (UNIQUE_SOLUTION[first]! % 9) + 1);
    state = eraseCell(state, first);
    state = toggleNote(state, first, 1);
    state = undo(state);
    for (const index of blanks) {
      state = inputDigit(state, index, UNIQUE_SOLUTION[index]!);
    }
    expect(state.status).toBe("cleared");
    expect(state.mistakes).toBe(1);
    expect(roundTrip(state)).toEqual(state);
  });
});
