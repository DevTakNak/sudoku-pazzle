import { describe, expect, it } from "vitest";

import { eraseCell, inputDigit } from "@/lib/game/input";
import { redo, undo } from "@/lib/game/history";
import { toggleNote } from "@/lib/game/notes";

import {
  BLANK_A,
  BLANK_B,
  BOX_PEER,
  OUTSIDE,
  ROW_PEER,
  SOLUTION_A,
  entry,
  freshGame,
  snapshot,
  withNotes,
  withValues,
} from "../../../helpers/game";
import { UNIQUE_SOLUTION } from "../../../helpers/grid";

const WRONG = 1; // マス 2(BLANK_A)の解は 4

describe("T-121: 1 操作ずつ元に戻して、やり直す", () => {
  it("T-121: 数字の入力を元に戻すと、数字とメモが入力の前に戻り、やり直しで入力の後に戻る", () => {
    const before = withNotes(freshGame(), { [BLANK_A]: [1, 4] });
    const after = inputDigit(before, BLANK_A, SOLUTION_A);
    expect(after.values[BLANK_A]).toBe(4);

    const undone = undo(after);
    expect(undone.values[BLANK_A]).toBe(0);
    expect(undone.notes[BLANK_A]).toEqual([1, 4]);
    expect(undone.undoStack).toEqual([]);
    expect(undone.redoStack).toHaveLength(1);
    expect({ ...undone, redoStack: [] }).toEqual(before);

    const redone = redo(undone);
    expect(redone).toEqual(after);
  });

  it("T-121: 消すを元に戻すと、誤りの数字が戻り、やり直しで再び消える", () => {
    const wrong = inputDigit(freshGame(), BLANK_A, WRONG);
    const erased = eraseCell(wrong, BLANK_A);
    expect(erased.values[BLANK_A]).toBe(0);

    const undone = undo(erased);
    expect(undone.values[BLANK_A]).toBe(WRONG);
    expect(undone.notes[BLANK_A]).toEqual([]);

    const redone = redo(undone);
    expect(redone).toEqual(erased);
  });

  it("T-121: メモだけのマスを消すを元に戻すと、メモが戻る", () => {
    const noted = withNotes(freshGame(), { [BLANK_A]: [2, 6] });
    const erased = eraseCell(noted, BLANK_A);
    expect(erased.notes[BLANK_A]).toEqual([]);
    const undone = undo(erased);
    expect(undone.notes[BLANK_A]).toEqual([2, 6]);
    expect(redo(undone)).toEqual(erased);
  });

  it("T-121: メモの変更を元に戻すと、メモが変更の前に戻り、やり直しで変更の後に戻る", () => {
    const before = withNotes(freshGame(), { [BLANK_A]: [2] });
    const after = toggleNote(before, BLANK_A, 5);
    expect(after.notes[BLANK_A]).toEqual([2, 5]);

    const undone = undo(after);
    expect(undone.notes[BLANK_A]).toEqual([2]);
    expect(redo(undone)).toEqual(after);
  });

  it("T-121: 誤りの数字を正解で上書きした操作を元に戻すと、誤りの数字に戻る", () => {
    const wrong = inputDigit(freshGame(), BLANK_A, WRONG);
    const right = inputDigit(wrong, BLANK_A, SOLUTION_A);
    const undone = undo(right);
    expect(undone.values[BLANK_A]).toBe(WRONG);
    expect(undone.undoStack).toHaveLength(1);
  });

  it("T-121: 複数の操作を、新しいものから 1 つずつ元に戻し、古いものから 1 つずつやり直せる", () => {
    const s0 = freshGame();
    const s1 = toggleNote(s0, BLANK_B, 3);
    const s2 = toggleNote(s1, BLANK_B, 5);
    const s3 = inputDigit(s2, BLANK_A, SOLUTION_A);
    expect(s3.undoStack).toHaveLength(3);

    const u1 = undo(s3);
    expect(u1.values[BLANK_A]).toBe(0);
    expect(u1.notes[BLANK_B]).toEqual([3, 5]);
    const u2 = undo(u1);
    expect(u2.notes[BLANK_B]).toEqual([3]);
    const u3 = undo(u2);
    expect(u3.notes[BLANK_B]).toEqual([]);
    expect(u3.undoStack).toEqual([]);
    expect(u3.redoStack).toHaveLength(3);

    const r1 = redo(u3);
    expect(r1.notes[BLANK_B]).toEqual([3]);
    const r2 = redo(r1);
    expect(r2.notes[BLANK_B]).toEqual([3, 5]);
    expect(r2.values[BLANK_A]).toBe(0);
    const r3 = redo(r2);
    expect(r3).toEqual(s3);
  });

  it("T-121: 元に戻す履歴の要素は、undoStack の末尾から redoStack の末尾へ移る", () => {
    const first = entry(snapshot(BLANK_A, 0, []), snapshot(BLANK_A, 4, []));
    const second = entry(snapshot(BLANK_B, 0, [2]), snapshot(BLANK_B, 0, []));
    const state = {
      ...withValues(withNotes(freshGame(), {}), { [BLANK_A]: 4 }),
      undoStack: [first, second],
      redoStack: [],
    };
    const undone = undo(state);
    expect(undone.undoStack).toEqual([first]);
    expect(undone.redoStack).toEqual([second]);
    expect(undone.notes[BLANK_B]).toEqual([2]);

    const redone = redo(undone);
    expect(redone.undoStack).toEqual([first, second]);
    expect(redone.redoStack).toEqual([]);
    expect(redone.notes[BLANK_B]).toEqual([]);
  });

  it("T-121: 渡した状態を書き換えない", () => {
    const state = undo(inputDigit(freshGame(), BLANK_A, SOLUTION_A));
    const copy = structuredClone(state);
    redo(state);
    undo(state);
    expect(state).toEqual(copy);
  });
});

describe("T-122: 間違いの回数", () => {
  it("T-122: 誤りの入力を元に戻しても回数は減らない", () => {
    const wrong = inputDigit(freshGame(), BLANK_A, WRONG);
    expect(wrong.mistakes).toBe(1);
    const undone = undo(wrong);
    expect(undone.values[BLANK_A]).toBe(0);
    expect(undone.mistakes).toBe(1);
  });

  it("T-122: やり直しても回数は増えない", () => {
    const wrong = inputDigit(freshGame(), BLANK_A, WRONG);
    const redone = redo(undo(wrong));
    expect(redone.values[BLANK_A]).toBe(WRONG);
    expect(redone.mistakes).toBe(1);
  });

  it("T-122: 回数が 2 のとき、誤りを元に戻しても 2、やり直しても 2 のまま(失敗にもならない)", () => {
    const state = { ...freshGame(), mistakes: 1 };
    const wrong = inputDigit(state, BLANK_A, WRONG);
    expect(wrong.mistakes).toBe(2);
    const undone = undo(wrong);
    expect(undone.mistakes).toBe(2);
    expect(undone.status).toBe("playing");
    const redone = redo(undone);
    expect(redone.mistakes).toBe(2);
    expect(redone.status).toBe("playing");
  });

  it("T-122: 時間と問題と解は、元に戻す・やり直しで変わらない", () => {
    const state = { ...freshGame(), elapsedSeconds: 77 };
    const after = inputDigit(state, BLANK_A, SOLUTION_A);
    for (const next of [undo(after), redo(undo(after))]) {
      expect(next.elapsedSeconds).toBe(77);
      expect(next.puzzle).toEqual(state.puzzle);
      expect(next.solution).toEqual(state.solution);
      expect(next.difficulty).toBe(state.difficulty);
      expect(next.status).toBe("playing");
    }
  });
});

describe("T-123: 新しい操作でやり直しの履歴が消える", () => {
  it("T-123: 元に戻した後に数字を入力すると、やり直しの履歴が空になる", () => {
    const undone = undo(toggleNote(freshGame(), BLANK_B, 3));
    expect(undone.redoStack).toHaveLength(1);
    const next = inputDigit(undone, BLANK_A, SOLUTION_A);
    expect(next.redoStack).toEqual([]);
    expect(next.undoStack).toHaveLength(1);
  });

  it("T-123: 元に戻した後にメモを変えると、やり直しの履歴が空になる", () => {
    const undone = undo(inputDigit(freshGame(), BLANK_A, SOLUTION_A));
    expect(undone.redoStack).toHaveLength(1);
    const next = toggleNote(undone, BLANK_B, 3);
    expect(next.redoStack).toEqual([]);
  });

  it("T-123: 元に戻した後に消すを行うと、やり直しの履歴が空になる", () => {
    const wrong = withValues(freshGame(), { [BLANK_B]: 1 });
    const undone = undo(inputDigit(wrong, BLANK_A, SOLUTION_A));
    expect(undone.redoStack).toHaveLength(1);
    const next = eraseCell(undone, BLANK_B);
    expect(next.redoStack).toEqual([]);
  });

  it("T-123: 何も変わらなかった操作では、やり直しの履歴は残る", () => {
    const undone = undo(inputDigit(freshGame(), BLANK_A, SOLUTION_A));
    // 手がかりのマスへの入力は何も変わらない
    const next = inputDigit(undone, 0, 5);
    expect(next).toBe(undone);
    expect(next.redoStack).toHaveLength(1);
  });

  it("T-123: 新しい操作の後は、やり直しても何も変わらない", () => {
    const undone = undo(inputDigit(freshGame(), BLANK_A, SOLUTION_A));
    const next = toggleNote(undone, BLANK_B, 3);
    expect(redo(next)).toBe(next);
  });
});

describe("T-124: 履歴が空のとき", () => {
  it("T-124: 履歴が空の初めの状態で、元に戻すもやり直しも何も変えない", () => {
    const state = freshGame();
    expect(undo(state)).toBe(state);
    expect(redo(state)).toBe(state);
  });

  it("T-124: すべて元に戻した後にさらに元に戻しても、何も変わらない", () => {
    const undone = undo(inputDigit(freshGame(), BLANK_A, SOLUTION_A));
    expect(undone.undoStack).toEqual([]);
    expect(undo(undone)).toBe(undone);
  });

  it("T-124: すべてやり直した後にさらにやり直しても、何も変わらない", () => {
    const after = inputDigit(freshGame(), BLANK_A, SOLUTION_A);
    const redone = redo(undo(after));
    expect(redone.redoStack).toEqual([]);
    expect(redo(redone)).toBe(redone);
  });

  it("T-124: 何も変わらない操作は履歴に残らない(手がかりへの入力の後も元に戻せる操作は増えない)", () => {
    const state = freshGame();
    const next = inputDigit(state, 0, 1);
    expect(next.undoStack).toEqual([]);
    expect(undo(next)).toBe(next);
  });
});

describe("T-125: 元に戻した正解のマス", () => {
  it("T-125: 正解を入れて元に戻したマスに、もう一度正解を入力できる", () => {
    const right = inputDigit(freshGame(), BLANK_A, SOLUTION_A);
    const undone = undo(right);
    expect(undone.values[BLANK_A]).toBe(0);

    const again = inputDigit(undone, BLANK_A, SOLUTION_A);
    expect(again.values[BLANK_A]).toBe(SOLUTION_A);
    expect(again.mistakes).toBe(0);
    expect(again.undoStack).toHaveLength(1);
  });

  it("T-125: 正解を入れて元に戻したマスに誤りを入れると、回数が 1 増える", () => {
    const undone = undo(inputDigit(freshGame(), BLANK_A, SOLUTION_A));
    const wrong = inputDigit(undone, BLANK_A, WRONG);
    expect(wrong.values[BLANK_A]).toBe(WRONG);
    expect(wrong.mistakes).toBe(1);
  });

  it("T-125: 誤りで増えた回数は、元に戻して誤りを入れ直すと、さらに 1 増える", () => {
    const first = inputDigit(freshGame(), BLANK_A, WRONG);
    const second = inputDigit(undo(first), BLANK_A, WRONG);
    expect(first.mistakes).toBe(1);
    expect(second.mistakes).toBe(2);
  });

  it("T-125: 元に戻して正解のマスが空欄に戻ると、消すは何も変えない", () => {
    const undone = undo(inputDigit(freshGame(), BLANK_A, SOLUTION_A));
    expect(eraseCell(undone, BLANK_A)).toBe(undone);
  });
});

describe("T-126: 自動で消えたメモの元に戻す・やり直し", () => {
  it("T-126: 元に戻す 1 回で、入力と消えたメモが一緒に戻り、やり直しで再び消える", () => {
    // 同じ行(ROW_PEER)と同じブロック(BOX_PEER)のメモの 4 が消える
    const before = withNotes(freshGame(), {
      [BLANK_A]: [4, 7],
      [ROW_PEER]: [4, 6],
      [BOX_PEER]: [4, 7],
    });
    const after = inputDigit(before, BLANK_A, SOLUTION_A);
    expect(after.notes[ROW_PEER]).toEqual([6]);
    expect(after.notes[BOX_PEER]).toEqual([7]);

    const undone = undo(after);
    expect({ ...undone, redoStack: [] }).toEqual(before);

    const redone = redo(undone);
    expect(redone).toEqual(after);
  });
});

describe("T-127: 入れ終わったときに消えたメモの元に戻す・やり直し", () => {
  it("T-127: 元に戻す 1 回で、9 か所目の入力と、行・列・ブロックの外で消えたメモが一緒に戻る", () => {
    // 4 のマスを、マス 2(BLANK_A)を除いて解のとおりに埋める
    const changes: Record<number, number> = {};
    UNIQUE_SOLUTION.forEach((v, i) => {
      if (v === 4 && i !== BLANK_A) changes[i] = 4;
    });
    const before = withNotes(withValues(freshGame(), changes), {
      [OUTSIDE]: [4, 5],
    });
    const after = inputDigit(before, BLANK_A, SOLUTION_A);
    expect(after.notes[OUTSIDE]).toEqual([5]);

    const undone = undo(after);
    expect({ ...undone, redoStack: [] }).toEqual(before);
    expect(redo(undone)).toEqual(after);
  });
});
