import { describe, expect, it } from "vitest";

import { eraseCell, inputDigit } from "@/lib/game/input";
import { PEERS } from "@/lib/sudoku/grid";
import { countSolutions } from "@/lib/sudoku/solver";

import {
  BLANK_A,
  BLANK_B,
  BLANK_C,
  BLANK_D,
  BOX_PEER,
  CLUE_INDEX,
  COL_PEER,
  EDGE_PUZZLE,
  OUTSIDE,
  ROW_PEER,
  SOLUTION_A,
  SOLUTION_B,
  SOLUTION_C,
  SOLUTION_D,
  emptyNotes,
  entry,
  freshGame,
  snapshot,
  withNotes,
  withValues,
} from "../../../helpers/game";
import {
  UNIQUE_PUZZLE,
  UNIQUE_SOLUTION,
  isSolvedGrid,
} from "../../../helpers/grid";

// 前提: マス 2(BLANK_A)の解は 4。誤りの数字には 1 を使う
const WRONG = 1;

describe("前提", () => {
  it("T-108: 手がかりを抜いた EDGE_PUZZLE の解は 1 つで、UNIQUE_SOLUTION と一致する", () => {
    expect(EDGE_PUZZLE[0]).toBe(0);
    expect(EDGE_PUZZLE[80]).toBe(0);
    expect(countSolutions(EDGE_PUZZLE)).toBe(1);
    // UNIQUE_SOLUTION はルールを満たし、手がかりとも合うので、ただ 1 つの解はこれになる
    expect(isSolvedGrid(UNIQUE_SOLUTION)).toBe(true);
    EDGE_PUZZLE.forEach((v, i) => {
      if (v !== 0) expect(UNIQUE_SOLUTION[i]).toBe(v);
    });
    expect(UNIQUE_SOLUTION[0]).toBe(5);
    expect(UNIQUE_SOLUTION[80]).toBe(9);
  });

  it("T-101: 使うマスの前提(0 は手がかり、2・3・5・6 は空欄で解は 4・6・8・9)", () => {
    expect(UNIQUE_PUZZLE[CLUE_INDEX]).toBe(5);
    expect(UNIQUE_SOLUTION[CLUE_INDEX]).toBe(5);
    const blanks: [number, number][] = [
      [BLANK_A, SOLUTION_A],
      [BLANK_B, SOLUTION_B],
      [BLANK_C, SOLUTION_C],
      [BLANK_D, SOLUTION_D],
    ];
    for (const [index, solution] of blanks) {
      expect(UNIQUE_PUZZLE[index]).toBe(0);
      expect(UNIQUE_SOLUTION[index]).toBe(solution);
    }
    // 誤りの数字は、どの空欄の解とも違う
    for (const [index] of blanks) {
      expect(UNIQUE_SOLUTION[index]).not.toBe(WRONG);
    }
  });
});

describe("inputDigit", () => {
  describe("T-101: 正解を入れる", () => {
    it("T-101: 空欄に正解を入れるとマスに入り、そのマスのメモが消え、回数は増えない", () => {
      const state = withNotes(freshGame(), {
        [BLANK_A]: [1, 4, 7],
        [BLANK_B]: [2, 5],
      });
      const next = inputDigit(state, BLANK_A, SOLUTION_A);
      expect(next.values[BLANK_A]).toBe(4);
      expect(next.notes[BLANK_A]).toEqual([]);
      expect(next.mistakes).toBe(0);
      expect(next.status).toBe("playing");
    });

    it("T-101: ほかのマスの数字と、入れた数字を含まないメモは変わらない(含むメモは T-113)", () => {
      const state = withNotes(freshGame(), {
        [BLANK_A]: [1, 4, 7],
        [BLANK_B]: [2, 5],
      });
      const next = inputDigit(state, BLANK_A, SOLUTION_A);
      expect(next.notes[BLANK_B]).toEqual([2, 5]);
      expect(next.values.filter((_, i) => i !== BLANK_A)).toEqual(
        state.values.filter((_, i) => i !== BLANK_A),
      );
      expect(next.puzzle).toEqual(state.puzzle);
      expect(next.solution).toEqual(state.solution);
      expect(next.elapsedSeconds).toBe(state.elapsedSeconds);
      expect(next.difficulty).toBe(state.difficulty);
    });

    it("T-101: 履歴に、変える前と変えた後のマスを 1 つ足す", () => {
      const state = withNotes(freshGame(), { [BLANK_A]: [1, 4, 7] });
      const next = inputDigit(state, BLANK_A, SOLUTION_A);
      expect(next.undoStack).toEqual([
        entry(snapshot(BLANK_A, 0, [1, 4, 7]), snapshot(BLANK_A, 4, [])),
      ]);
      expect(next.redoStack).toEqual([]);
    });

    it("T-101: 回数が 2 のときに正解を入れても回数は 2 のまま", () => {
      const state = { ...freshGame(), mistakes: 2 };
      const next = inputDigit(state, BLANK_A, SOLUTION_A);
      expect(next.mistakes).toBe(2);
      expect(next.status).toBe("playing");
    });

    it("T-101: 渡した状態を書き換えない", () => {
      const state = withNotes(freshGame(), { [BLANK_A]: [1, 4, 7] });
      const copy = structuredClone(state);
      inputDigit(state, BLANK_A, SOLUTION_A);
      inputDigit(state, BLANK_A, WRONG);
      expect(state).toEqual(copy);
    });
  });

  describe("T-102: 正解の入ったマス", () => {
    const solved = {
      ...withValues(freshGame(), { [BLANK_A]: SOLUTION_A }),
      mistakes: 1,
    };

    it.each([
      ["誤りの数字(1)", WRONG],
      ["別の正解でない数字(9)", 9],
      ["同じ正解の数字(4)", SOLUTION_A],
    ])("T-102: 正解の入ったマスに%sを入れても何も変わらない", (_, digit) => {
      const copy = structuredClone(solved);
      const next = inputDigit(solved, BLANK_A, digit);
      expect(next).toBe(solved);
      expect(solved).toEqual(copy);
    });

    it("T-102: 正解の入ったマスを消しても何も変わらない", () => {
      expect(eraseCell(solved, BLANK_A)).toBe(solved);
    });
  });

  describe("T-103: 誤りを入れる", () => {
    it("T-103: 空欄に誤りを入れるとマスに入り、そのマスのメモが消え、回数が 1 増える", () => {
      const state = withNotes(freshGame(), {
        [BLANK_A]: [1, 4, 7],
        [BLANK_B]: [2, 5],
      });
      const next = inputDigit(state, BLANK_A, WRONG);
      expect(next.values[BLANK_A]).toBe(WRONG);
      expect(next.notes[BLANK_A]).toEqual([]);
      expect(next.notes[BLANK_B]).toEqual([2, 5]);
      expect(next.mistakes).toBe(1);
      expect(next.status).toBe("playing");
    });

    it("T-103: 履歴に、変える前と変えた後のマスを 1 つ足す", () => {
      const state = withNotes(freshGame(), { [BLANK_A]: [1, 4, 7] });
      const next = inputDigit(state, BLANK_A, WRONG);
      expect(next.undoStack).toEqual([
        entry(snapshot(BLANK_A, 0, [1, 4, 7]), snapshot(BLANK_A, WRONG, [])),
      ]);
    });

    it("T-103: 回数が 1 のとき誤りを入れると 2 になり、まだ失敗にならない", () => {
      const state = { ...freshGame(), mistakes: 1 };
      const next = inputDigit(state, BLANK_A, WRONG);
      expect(next.mistakes).toBe(2);
      expect(next.status).toBe("playing");
    });

    it("T-103: 同じ行・列・ブロックの手がかりと重ならない数字でも、解と違えば誤りとして数える", () => {
      // マス 2 の行・列・ブロックの手がかりに 1 は無いが、解(4)と違うので誤り
      expect(PEERS[BLANK_A]!.map((p) => UNIQUE_PUZZLE[p])).not.toContain(WRONG);
      const next = inputDigit(freshGame(), BLANK_A, WRONG);
      expect(next.mistakes).toBe(1);
    });
  });

  describe("T-104: 誤りのマスに同じ数字", () => {
    it("T-104: 誤りのマスに同じ数字を入れても、何も変わらず、回数も増えず、履歴にも残らない", () => {
      const wrong = inputDigit(freshGame(), BLANK_A, WRONG);
      expect(wrong.mistakes).toBe(1);
      expect(wrong.undoStack).toHaveLength(1);
      const copy = structuredClone(wrong);

      const next = inputDigit(wrong, BLANK_A, WRONG);
      expect(next).toBe(wrong);
      expect(next.mistakes).toBe(1);
      expect(next.undoStack).toHaveLength(1);
      expect(wrong).toEqual(copy);
    });
  });

  describe("T-105: 誤りのマスに別の数字", () => {
    it("T-105: 誤りのマスに別の誤りを入れると、回数が 1 増える", () => {
      const wrong = inputDigit(freshGame(), BLANK_A, WRONG);
      const next = inputDigit(wrong, BLANK_A, 2);
      expect(next.values[BLANK_A]).toBe(2);
      expect(next.mistakes).toBe(2);
      expect(next.undoStack).toHaveLength(2);
      expect(next.undoStack[1]).toEqual(
        entry(snapshot(BLANK_A, WRONG, []), snapshot(BLANK_A, 2, [])),
      );
    });

    it("T-105: 誤りのマスに正解を入れると、マスに入り、回数は増えない", () => {
      const wrong = inputDigit(freshGame(), BLANK_A, WRONG);
      const next = inputDigit(wrong, BLANK_A, SOLUTION_A);
      expect(next.values[BLANK_A]).toBe(SOLUTION_A);
      expect(next.mistakes).toBe(1);
      expect(next.undoStack).toHaveLength(2);
      expect(next.undoStack[1]).toEqual(
        entry(snapshot(BLANK_A, WRONG, []), snapshot(BLANK_A, SOLUTION_A, [])),
      );
    });
  });

  describe("T-106: 手がかりのマス", () => {
    it.each([
      ["手がかりと同じ数字(5)", 5],
      ["手がかりと違う数字(1)", 1],
    ])("T-106: 手がかりのマスに%sを入れても何も変わらない", (_, digit) => {
      const state = { ...freshGame(), mistakes: 1 };
      const copy = structuredClone(state);
      const next = inputDigit(state, CLUE_INDEX, digit);
      expect(next).toBe(state);
      expect(next.mistakes).toBe(1);
      expect(state).toEqual(copy);
    });

    it("T-106: 手がかりのマスを消しても何も変わらない", () => {
      const state = freshGame();
      expect(eraseCell(state, CLUE_INDEX)).toBe(state);
    });
  });

  describe("T-108: 範囲外の数字とマス", () => {
    const state = { ...freshGame(), mistakes: 1 };

    it.each([
      ["0", 0],
      ["10", 10],
      ["-1", -1],
      ["1.5", 1.5],
      ["NaN", NaN],
      ["Infinity", Infinity],
    ])("T-108: 数字が %s なら何も変わらない", (_, digit) => {
      const copy = structuredClone(state);
      expect(inputDigit(state, BLANK_A, digit)).toBe(state);
      expect(state).toEqual(copy);
    });

    it.each([
      ["-1", -1],
      ["81", 81],
      ["100", 100],
      ["2.5", 2.5],
      ["NaN", NaN],
    ])("T-108: マスの番号が %s なら何も変わらない", (_, index) => {
      expect(inputDigit(state, index, SOLUTION_A)).toBe(state);
      expect(eraseCell(state, index)).toBe(state);
    });

    it("T-108: 数字の境界の 1 と 9 は入力できる(誤りとして回数が増える)", () => {
      const one = inputDigit(state, BLANK_A, 1);
      expect(one.values[BLANK_A]).toBe(1);
      expect(one.mistakes).toBe(2);
      const nine = inputDigit(state, BLANK_A, 9);
      expect(nine.values[BLANK_A]).toBe(9);
      expect(nine.mistakes).toBe(2);
    });

    it("T-108: マスの番号の境界の 0 と 80 は入力できる", () => {
      const edge = freshGame("easy", EDGE_PUZZLE, UNIQUE_SOLUTION);
      const first = inputDigit(edge, 0, 5);
      expect(first.values[0]).toBe(5);
      expect(first.mistakes).toBe(0);
      const last = inputDigit(edge, 80, 9);
      expect(last.values[80]).toBe(9);
      expect(last.mistakes).toBe(0);
      const wrongLast = inputDigit(edge, 80, 1);
      expect(wrongLast.values[80]).toBe(1);
      expect(wrongLast.mistakes).toBe(1);
    });
  });
});

describe("eraseCell", () => {
  describe("T-107: 消す", () => {
    it("T-107: 誤りの数字を消すと空欄になり、回数は減らない", () => {
      const wrong = inputDigit(freshGame(), BLANK_A, WRONG);
      const next = eraseCell(wrong, BLANK_A);
      expect(next.values[BLANK_A]).toBe(0);
      expect(next.notes[BLANK_A]).toEqual([]);
      expect(next.mistakes).toBe(1);
      expect(next.status).toBe("playing");
    });

    it("T-107: 回数が 2 のときに誤りを消しても 2 のまま", () => {
      const state = {
        ...withValues(freshGame(), { [BLANK_A]: WRONG }),
        mistakes: 2,
      };
      expect(eraseCell(state, BLANK_A).mistakes).toBe(2);
    });

    it("T-107: メモだけのマスを消すと、メモが消える", () => {
      const state = withNotes(freshGame(), {
        [BLANK_A]: [1, 4],
        [BLANK_B]: [2],
      });
      const next = eraseCell(state, BLANK_A);
      expect(next.values[BLANK_A]).toBe(0);
      expect(next.notes[BLANK_A]).toEqual([]);
      expect(next.notes[BLANK_B]).toEqual([2]);
      expect(next.mistakes).toBe(0);
    });

    it("T-107: 履歴に、変える前と変えた後のマスを 1 つ足し、やり直しの履歴を空にする", () => {
      const state = {
        ...withNotes(withValues(freshGame(), { [BLANK_A]: WRONG }), {
          [BLANK_B]: [2],
        }),
        redoStack: [entry(snapshot(7, 0, []), snapshot(7, 0, [5]))],
      };
      const erasedValue = eraseCell(state, BLANK_A);
      expect(erasedValue.undoStack).toEqual([
        entry(snapshot(BLANK_A, WRONG, []), snapshot(BLANK_A, 0, [])),
      ]);
      expect(erasedValue.redoStack).toEqual([]);

      const erasedNotes = eraseCell(state, BLANK_B);
      expect(erasedNotes.undoStack).toEqual([
        entry(snapshot(BLANK_B, 0, [2]), snapshot(BLANK_B, 0, [])),
      ]);
    });

    it("T-107: もともと空欄でメモも無いマスでは、何も変わらず履歴にも残らない", () => {
      const state = freshGame();
      const next = eraseCell(state, BLANK_A);
      expect(next).toBe(state);
      expect(next.undoStack).toEqual([]);
    });

    it("T-107: 渡した状態を書き換えない", () => {
      const state = withNotes(withValues(freshGame(), { [BLANK_A]: WRONG }), {
        [BLANK_B]: [2],
      });
      const copy = structuredClone(state);
      eraseCell(state, BLANK_A);
      eraseCell(state, BLANK_B);
      expect(state).toEqual(copy);
    });
  });

  it("T-107: 消すとき、ほかのマスの数字とメモは変わらない", () => {
    const state = withNotes(withValues(freshGame(), { [BLANK_A]: WRONG }), {
      [BLANK_B]: [2],
    });
    const next = eraseCell(state, BLANK_A);
    expect(next.notes).toEqual(
      emptyNotes().map((_, i) => (i === BLANK_B ? [2] : [])),
    );
    expect(next.values).toEqual(UNIQUE_PUZZLE);
  });
});

describe("T-113: 正解を入れたときのメモの自動の消去", () => {
  it("T-113: 前提(メモを置くマスは空欄で、行・列・ブロックの関係が名前のとおり)", () => {
    for (const i of [ROW_PEER, BOX_PEER, COL_PEER, OUTSIDE]) {
      expect(UNIQUE_PUZZLE[i]).toBe(0);
      expect(UNIQUE_SOLUTION[i]).not.toBe(SOLUTION_A);
    }
    // 本番の PEERS を使わず、行・列・ブロックの番号を計算して確かめる
    const row = (i: number) => Math.floor(i / 9);
    const col = (i: number) => i % 9;
    const box = (i: number) =>
      Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);
    const relation = (i: number) => [
      row(i) === row(BLANK_A),
      col(i) === col(BLANK_A),
      box(i) === box(BLANK_A),
    ];
    expect(relation(ROW_PEER)).toEqual([true, false, false]);
    expect(relation(BOX_PEER)).toEqual([false, false, true]);
    expect(relation(COL_PEER)).toEqual([false, true, false]);
    expect(relation(OUTSIDE)).toEqual([false, false, false]);
  });

  function notedGame() {
    return withNotes(freshGame(), {
      [BLANK_A]: [1, 4],
      [ROW_PEER]: [1, 4, 6],
      [BOX_PEER]: [4, 7],
      [COL_PEER]: [1, 4],
      [OUTSIDE]: [4, 5],
    });
  }

  it("T-113: 同じ行・列・ブロックのメモからその数字だけが消え、外のメモは残る", () => {
    const next = inputDigit(notedGame(), BLANK_A, SOLUTION_A);
    expect(next.values[BLANK_A]).toBe(SOLUTION_A);
    expect(next.notes[BLANK_A]).toEqual([]);
    expect(next.notes[ROW_PEER]).toEqual([1, 6]);
    expect(next.notes[BOX_PEER]).toEqual([7]);
    expect(next.notes[COL_PEER]).toEqual([1]);
    expect(next.notes[OUTSIDE]).toEqual([4, 5]);
    expect(next.mistakes).toBe(0);
  });

  it("T-113: 消したメモは入力と 1 つの操作として履歴に残る", () => {
    const state = notedGame();
    const next = inputDigit(state, BLANK_A, SOLUTION_A);
    expect(next.undoStack).toHaveLength(1);
    const { before, after } = next.undoStack[0]!;
    const byIndex = (cells: typeof before) =>
      Object.fromEntries(cells.map((c) => [c.index, c]));
    expect(byIndex(before)).toEqual({
      [BLANK_A]: snapshot(BLANK_A, 0, [1, 4]),
      [ROW_PEER]: snapshot(ROW_PEER, 0, [1, 4, 6]),
      [BOX_PEER]: snapshot(BOX_PEER, 0, [4, 7]),
      [COL_PEER]: snapshot(COL_PEER, 0, [1, 4]),
    });
    expect(byIndex(after)).toEqual({
      [BLANK_A]: snapshot(BLANK_A, SOLUTION_A, []),
      [ROW_PEER]: snapshot(ROW_PEER, 0, [1, 6]),
      [BOX_PEER]: snapshot(BOX_PEER, 0, [7]),
      [COL_PEER]: snapshot(COL_PEER, 0, [1]),
    });
    // 消すメモが無いときは、入力したマスだけが履歴に残る
    const plain = inputDigit(freshGame(), BLANK_A, SOLUTION_A);
    expect(plain.undoStack).toEqual([
      entry(snapshot(BLANK_A, 0, []), snapshot(BLANK_A, SOLUTION_A, [])),
    ]);
  });

  it("T-113: 誤りの数字を入れたときは、ほかのマスのメモを消さない", () => {
    const state = notedGame();
    const next = inputDigit(state, BLANK_A, WRONG);
    expect(next.values[BLANK_A]).toBe(WRONG);
    expect(next.notes[BLANK_A]).toEqual([]);
    expect(next.notes[ROW_PEER]).toEqual([1, 4, 6]);
    expect(next.notes[COL_PEER]).toEqual([1, 4]);
    expect(next.undoStack).toEqual([
      entry(snapshot(BLANK_A, 0, [1, 4]), snapshot(BLANK_A, WRONG, [])),
    ]);
  });
});
