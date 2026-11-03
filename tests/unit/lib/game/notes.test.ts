import { describe, expect, it } from "vitest";

import { toggleNote } from "@/lib/game/notes";

import {
  BLANK_A,
  BLANK_B,
  CLUE_INDEX,
  EDGE_PUZZLE,
  SOLUTION_A,
  entry,
  freshGame,
  snapshot,
  withNotes,
  withValues,
} from "../../../helpers/game";
import { UNIQUE_SOLUTION } from "../../../helpers/grid";

describe("toggleNote", () => {
  describe("T-111: メモを付けて外す", () => {
    it("T-111: 空欄に 3 のメモを付けると [3] になり、数字は空欄のまま", () => {
      const next = toggleNote(freshGame(), BLANK_A, 3);
      expect(next.notes[BLANK_A]).toEqual([3]);
      expect(next.values[BLANK_A]).toBe(0);
      expect(next.mistakes).toBe(0);
    });

    it("T-111: 履歴に、変える前と変えた後のマスを 1 つ足し、やり直しの履歴を空にする", () => {
      const state = {
        ...withNotes(freshGame(), { [BLANK_A]: [2] }),
        redoStack: [entry(snapshot(7, 0, []), snapshot(7, 0, [5]))],
      };
      const next = toggleNote(state, BLANK_A, 5);
      expect(next.undoStack).toEqual([
        entry(snapshot(BLANK_A, 0, [2]), snapshot(BLANK_A, 0, [2, 5])),
      ]);
      expect(next.redoStack).toEqual([]);
    });

    it.each([
      ["9, 1, 5", [9, 1, 5], [1, 5, 9]],
      ["5, 2, 9", [5, 2, 9], [2, 5, 9]],
      ["1, 2, 3", [1, 2, 3], [1, 2, 3]],
      ["9, 8, 7", [9, 8, 7], [7, 8, 9]],
    ])(
      "T-111: 付ける順が %s でも、メモは昇順に保たれる",
      (_, order, expected) => {
        let state = freshGame();
        for (const digit of order) state = toggleNote(state, BLANK_A, digit);
        expect(state.notes[BLANK_A]).toEqual(expected);
      },
    );

    it.each([
      ["先頭の 2", 2, [5, 9]],
      ["途中の 5", 5, [2, 9]],
      ["末尾の 9", 9, [2, 5]],
    ])(
      "T-111: [2, 5, 9] から%sを外すと、残りは昇順のまま",
      (_, digit, expected) => {
        const state = withNotes(freshGame(), { [BLANK_A]: [2, 5, 9] });
        const next = toggleNote(state, BLANK_A, digit);
        expect(next.notes[BLANK_A]).toEqual(expected);
        expect(next.undoStack).toEqual([
          entry(
            snapshot(BLANK_A, 0, [2, 5, 9]),
            snapshot(BLANK_A, 0, expected),
          ),
        ]);
      },
    );

    it("T-111: 最後の 1 つを外すと空になる", () => {
      const state = withNotes(freshGame(), { [BLANK_A]: [7] });
      expect(toggleNote(state, BLANK_A, 7).notes[BLANK_A]).toEqual([]);
    });

    it("T-111: 同じ数字を 2 回続けると元のメモに戻る", () => {
      const state = withNotes(freshGame(), { [BLANK_A]: [2, 8] });
      const twice = toggleNote(toggleNote(state, BLANK_A, 5), BLANK_A, 5);
      expect(twice.notes).toEqual(state.notes);
    });

    it("T-111: ほかのマスのメモと数字は変わらない", () => {
      const state = withNotes(freshGame(), { [BLANK_B]: [1, 6] });
      const next = toggleNote(state, BLANK_A, 3);
      expect(next.notes[BLANK_B]).toEqual([1, 6]);
      expect(next.values).toEqual(state.values);
    });

    it("T-111: 数字の境界の 1 と 9 は付けられる", () => {
      let state = toggleNote(freshGame(), BLANK_A, 1);
      state = toggleNote(state, BLANK_A, 9);
      expect(state.notes[BLANK_A]).toEqual([1, 9]);
    });

    it("T-111: マスの番号の境界の 0 と 80 は付けられる", () => {
      const edge = freshGame("easy", EDGE_PUZZLE, UNIQUE_SOLUTION);
      expect(toggleNote(edge, 0, 4).notes[0]).toEqual([4]);
      expect(toggleNote(edge, 80, 4).notes[80]).toEqual([4]);
    });

    it("T-111: 渡した状態を書き換えない", () => {
      const state = withNotes(freshGame(), { [BLANK_A]: [2, 5] });
      const copy = structuredClone(state);
      toggleNote(state, BLANK_A, 3);
      toggleNote(state, BLANK_A, 2);
      expect(state).toEqual(copy);
    });

    it.each([
      ["0", 0],
      ["10", 10],
      ["-1", -1],
      ["1.5", 1.5],
      ["NaN", NaN],
    ])("T-111: 数字が %s なら何も変わらない", (_, digit) => {
      const state = withNotes(freshGame(), { [BLANK_A]: [2] });
      expect(toggleNote(state, BLANK_A, digit)).toBe(state);
    });

    it.each([
      ["-1", -1],
      ["81", 81],
      ["2.5", 2.5],
      ["NaN", NaN],
    ])("T-111: マスの番号が %s なら何も変わらない", (_, index) => {
      const state = freshGame();
      expect(toggleNote(state, index, 3)).toBe(state);
    });
  });

  describe("T-112: 数字の入ったマス", () => {
    it("T-112: 手がかりのマスにはメモを入れられない", () => {
      const state = freshGame();
      const next = toggleNote(state, CLUE_INDEX, 3);
      expect(next).toBe(state);
      expect(next.notes[CLUE_INDEX]).toEqual([]);
    });

    it("T-112: 正解の入ったマスにはメモを入れられない", () => {
      const state = withValues(freshGame(), { [BLANK_A]: SOLUTION_A });
      expect(toggleNote(state, BLANK_A, 3)).toBe(state);
    });

    it("T-112: 誤りの入ったマスにはメモを入れられない", () => {
      const state = {
        ...withValues(freshGame(), { [BLANK_A]: 1 }),
        mistakes: 1,
      };
      const next = toggleNote(state, BLANK_A, 3);
      expect(next).toBe(state);
      expect(next.mistakes).toBe(1);
      expect(next.undoStack).toEqual([]);
    });

    it("T-112: 空欄のマスのメモの付け外しで、回数は増えも減りもしない", () => {
      const state = { ...freshGame(), mistakes: 2 };
      const added = toggleNote(state, BLANK_A, 4);
      expect(added.mistakes).toBe(2);
      // 解と同じ数字、解と違う数字のどちらでも同じ
      const addedWrong = toggleNote(added, BLANK_A, 1);
      expect(addedWrong.mistakes).toBe(2);
      const removed = toggleNote(addedWrong, BLANK_A, 4);
      expect(removed.mistakes).toBe(2);
      expect(removed.status).toBe("playing");
    });
  });
});
