// @vitest-environment jsdom
// 盤面(T-404、T-405)。Board を直接描画して、マスごとの表示と読み上げの名前を確かめる
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Board } from "@/components/board";
import type { GameState } from "@/lib/game/types";
import type { Difficulty } from "@/lib/sudoku/grid";

import { freshGame, withNotes, withValues } from "../../helpers/game";
import {
  allCells,
  cellAt,
  expectedHighlights,
  highlights,
  kinds,
  peersOf,
  selectedIndex,
} from "../../helpers/screen";

// 盤面は UNIQUE_PUZZLE(tests/helpers/grid.ts)。マスの番号は 行 * 9 + 列(どちらも 0 始まり)。
//   1 行目 53. .7. ...   idx 2 は空欄(解は 4)、idx 0 は手がかりの 5
//   3 行目 .98 ... .6.   idx 20 は手がかりの 8(3 行 3 列)
//   9 行目 ... .8. .79   idx 80 は手がかりの 9(9 行 9 列)
// 同じ数字の位置(手がかり)
//   5: idx 0、14、71    4: idx 36、66    3: idx 1、35、41
//   8: idx 20、27、39、61、76

function renderBoard(
  game: GameState,
  options: { selected?: number | null; hidden?: boolean } = {},
) {
  const onSelect = vi.fn();
  render(
    <Board
      game={game}
      selected={options.selected ?? null}
      hidden={options.hidden ?? false}
      onSelect={onSelect}
    />,
  );
  return { onSelect };
}

// idx 2(1 行 3 列、解は 4)に 8 を入れた誤りの状態。
// 同じ行・列・ブロックに 8 を持つのは idx 20(3 行 3 列)だけ
function withWrongEight(difficulty: Difficulty = "easy"): GameState {
  return withValues(freshGame(difficulty), { 2: 8 });
}

describe("T-404: 盤面の構造", () => {
  it("T-404: 名前「数独の盤面」の grid に、9 つの row があり、各 row に 9 つの gridcell が左上から右下の順に並ぶ", () => {
    renderBoard(freshGame());

    const grid = screen.getByRole("grid", { name: "数独の盤面" });
    const rows = within(grid).getAllByRole("row");
    expect(rows).toHaveLength(9);
    const cellsByRow = rows.map((row) => within(row).getAllByRole("gridcell"));
    for (const cells of cellsByRow) expect(cells).toHaveLength(9);
    const flat = cellsByRow.flat();
    expect(flat).toHaveLength(81);
    flat.forEach((cell, i) => expect(cell).toBe(allCells()[i]));
    // 左上から右下の順(名前の「行」「列」が順に進む)
    flat.forEach((cell, i) => {
      const prefix = `${Math.floor(i / 9) + 1} 行 ${(i % 9) + 1} 列`;
      expect(cell).toHaveAccessibleName(new RegExp(`^${prefix}(、|$)`));
    });
  });
});

describe("T-404: 読み上げの名前", () => {
  it.each<[string, number, GameState, string]>([
    ["手がかり(1 行 1 列)", 0, freshGame(), "1 行 1 列、5、手がかり"],
    ["手がかり(9 行 9 列)", 80, freshGame(), "9 行 9 列、9、手がかり"],
    ["空欄", 2, freshGame(), "1 行 3 列、空欄"],
    [
      "入力した正解は「手がかり」を付けない",
      2,
      withValues(freshGame(), { 2: 4 }),
      "1 行 3 列、4",
    ],
    [
      "誤り(数字 1)",
      2,
      withValues(freshGame(), { 2: 1 }),
      "1 行 3 列、1、誤り",
    ],
    [
      "誤り(数字 9)",
      2,
      withValues(freshGame(), { 2: 9 }),
      "1 行 3 列、9、誤り",
    ],
    [
      "メモ(2 行 3 列、1 2 5)",
      11,
      withNotes(freshGame(), { 11: [1, 2, 5] }),
      "2 行 3 列、メモ 1 2 5",
    ],
    [
      "メモ(1 つだけ)",
      2,
      withNotes(freshGame(), { 2: [7] }),
      "1 行 3 列、メモ 7",
    ],
    [
      "メモ(1 から 9 まで全部)",
      2,
      withNotes(freshGame(), { 2: [1, 2, 3, 4, 5, 6, 7, 8, 9] }),
      "1 行 3 列、メモ 1 2 3 4 5 6 7 8 9",
    ],
  ])("T-404: %s の名前", (_label, index, game, name) => {
    renderBoard(game);

    expect(cellAt(index)).toHaveAccessibleName(name);
    expect(screen.getByRole("gridcell", { name })).toBe(cellAt(index));
  });

  it.each<[string, number, GameState, string]>([
    ["手がかり", 0, freshGame(), "1 行 1 列"],
    ["空欄", 2, freshGame(), "1 行 3 列"],
    ["入力した正解", 2, withValues(freshGame(), { 2: 4 }), "1 行 3 列"],
    ["誤り", 2, withValues(freshGame(), { 2: 1 }), "1 行 3 列"],
    ["メモ", 11, withNotes(freshGame(), { 11: [1, 2, 5] }), "2 行 3 列"],
  ])(
    "T-404: 一時停止中(hidden)は、%s のマスの名前が「行・列」だけになる",
    (_label, index, game, name) => {
      renderBoard(game, { hidden: true });

      expect(cellAt(index)).toHaveAccessibleName(name);
    },
  );

  it("T-404: 一時停止中(hidden)は、どのマスにも数字もメモも DOM に出さず、data-kind も付けない", () => {
    const game = withNotes(withValues(freshGame(), { 2: 4, 3: 1 }), {
      5: [1, 3, 8],
    });
    renderBoard(game, { hidden: true });

    for (const cell of allCells()) {
      expect(cell.textContent).toBe("");
      expect(cell).not.toHaveAttribute("data-kind");
    }
  });
});

describe("T-404: マスの表示", () => {
  it("T-404: 手がかり・正解・誤りは数字を、メモは入れた数字だけを、空欄は何も表示しない", () => {
    const game = withNotes(withValues(freshGame(), { 2: 4, 3: 1 }), {
      5: [1, 2, 5],
    });
    renderBoard(game);

    expect(cellAt(0).textContent).toBe("5"); // 手がかり
    expect(cellAt(2).textContent).toBe("4"); // 入力した正解
    expect(cellAt(3).textContent).toBe("1"); // 誤り(解は 6)
    expect(cellAt(5).textContent).toBe("125"); // メモ
    expect(cellAt(6).textContent).toBe(""); // 空欄
  });

  it("T-404: メモは 3×3 に並べ、数字 d を左上から数えて d 番目の位置に出す", () => {
    renderBoard(withNotes(freshGame(), { 5: [1, 2, 5, 9] }));

    // 読み上げ用ではない、見た目のメモの並び(9 個の位置)
    const memo = cellAt(5).querySelector('[aria-hidden="true"]');
    expect(memo).not.toBeNull();
    expect(memo).toHaveClass("grid", "grid-cols-3");
    expect([...memo!.children].map((c) => c.textContent)).toEqual([
      "1",
      "2",
      "",
      "",
      "5",
      "",
      "",
      "",
      "9",
    ]);
  });

  it("T-404: 誤りの数字にだけ下線が付く(色だけに頼らない。N-03)", () => {
    // idx 3 は誤り(解は 6)、idx 2 は正解の 4、idx 0 は手がかりの 5
    renderBoard(withValues(freshGame(), { 2: 4, 3: 1 }));

    const digitOf = (index: number) => cellAt(index).querySelector("span");
    expect(digitOf(3)).toHaveClass("underline");
    expect(digitOf(2)).not.toHaveClass("underline");
    expect(digitOf(0)).not.toHaveClass("underline");
  });

  it("T-404: data-kind が、手がかりは clue、正解は correct、誤りは wrong、空欄とメモだけのマスは empty", () => {
    const game = withNotes(withValues(freshGame(), { 2: 4, 3: 1 }), {
      5: [1, 2, 5],
    });
    renderBoard(game);

    expect(cellAt(0)).toHaveAttribute("data-kind", "clue");
    expect(cellAt(80)).toHaveAttribute("data-kind", "clue");
    expect(cellAt(2)).toHaveAttribute("data-kind", "correct");
    expect(cellAt(3)).toHaveAttribute("data-kind", "wrong");
    expect(cellAt(5)).toHaveAttribute("data-kind", "empty");
    expect(cellAt(6)).toHaveAttribute("data-kind", "empty");
    // 全体の数: 手がかり 30、正解 1、誤り 1、空欄とメモ 49
    const all = kinds();
    expect(all.filter((k) => k === "clue")).toHaveLength(30);
    expect(all.filter((k) => k === "correct")).toHaveLength(1);
    expect(all.filter((k) => k === "wrong")).toHaveLength(1);
    expect(all.filter((k) => k === "empty")).toHaveLength(49);
  });
});

describe("T-404: 選択と強調", () => {
  it("T-404: 最初はどのマスも選ばれておらず、強調もすべて none", () => {
    renderBoard(freshGame(), { selected: null });

    expect(selectedIndex()).toBeNull();
    expect(highlights()).toEqual(expectedHighlights({}));
  });

  it.each([0, 40, 80])(
    "T-404: selected=%i のとき、aria-selected が true なのはそのマスだけ",
    (index) => {
      renderBoard(freshGame(), { selected: index });

      expect(selectedIndex()).toBe(index);
      expect(cellAt(index)).toHaveAttribute("aria-selected", "true");
      expect(
        allCells().filter((c) => c.getAttribute("aria-selected") === "true"),
      ).toHaveLength(1);
    },
  );

  it.each([0, 2, 80])(
    "T-404: マス %i を押すと onSelect(そのマスの番号)",
    async (index) => {
      const user = userEvent.setup();
      const { onSelect } = renderBoard(freshGame());

      await user.click(cellAt(index));

      // フォーカスと押下の両方で呼んでも、番号が正しければよい(回数は決めない)
      expect(onSelect).toHaveBeenCalled();
      for (const call of onSelect.mock.calls) expect(call).toEqual([index]);
    },
  );

  it("T-404: 手がかりのマスを選ぶと、同じ数字(5)のマスが same-digit、同じ行・列・ブロックが related、選んだマスが selected", () => {
    renderBoard(freshGame(), { selected: 0 });

    expect(highlights()).toEqual(
      expectedHighlights({
        selected: [0],
        "same-digit": [14, 71],
        related: peersOf(0),
      }),
    );
  });

  it("T-404: 空欄を選ぶと、same-digit は付かず(ほかの空欄も none)、同じ行・列・ブロックだけが related", () => {
    renderBoard(freshGame(), { selected: 2 });

    expect(highlights()).toEqual(
      expectedHighlights({ selected: [2], related: peersOf(2) }),
    );
  });

  it("T-404: 入力した正解(4)を選ぶと、同じ数字のマス(手がかりの 4)が same-digit になる", () => {
    renderBoard(withValues(freshGame(), { 2: 4 }), { selected: 2 });

    expect(highlights()).toEqual(
      expectedHighlights({
        selected: [2],
        "same-digit": [36, 66],
        related: peersOf(2),
      }),
    );
  });

  it("T-404: 同じ行・列・ブロックに同じ数字が重なる誤りは、誤りのマスと重なるマスが error(選択が無いとき)", () => {
    renderBoard(withWrongEight());

    // idx 2 は誤りの 8。同じ列・ブロックの idx 20 も 8。
    // 離れた場所の 8(idx 27、39、61、76)は重ならないので none
    expect(highlights()).toEqual(expectedHighlights({ error: [2, 20] }));
  });

  it("T-404: 誤りの数字と同じ数字が、同じ行・列・ブロックに無ければ、誤りのマスだけが error", () => {
    // 1 は idx 2 の同じ行・列・ブロックに無い(離れた idx 12 に 1 がある)
    renderBoard(withValues(freshGame(), { 2: 1 }));

    expect(highlights()).toEqual(expectedHighlights({ error: [2] }));
  });

  it("T-404: 誤りと重なるマスを選ぶと、選んだマスが selected、誤りのマスは error、同じ数字は same-digit、残りの同じ行・列・ブロックは related", () => {
    renderBoard(withWrongEight(), { selected: 20 });

    expect(highlights()).toEqual(
      expectedHighlights({
        selected: [20],
        error: [2],
        "same-digit": [27, 39, 61, 76],
        related: peersOf(20).filter((i) => i !== 2),
      }),
    );
  });

  it("T-404: 誤りのマス自身を選ぶと、そのマスが selected、重なるマスは error(same-digit より強い)", () => {
    renderBoard(withWrongEight(), { selected: 2 });

    expect(highlights()).toEqual(
      expectedHighlights({
        selected: [2],
        error: [20],
        "same-digit": [27, 39, 61, 76],
        related: peersOf(2).filter((i) => i !== 20),
      }),
    );
  });

  it("T-404: 誤りと離れた空欄を選ぶと、誤りは error のまま(related や none に埋もれない)", () => {
    renderBoard(withWrongEight(), { selected: 40 });

    expect(highlights()).toEqual(
      expectedHighlights({
        selected: [40],
        error: [2, 20],
        related: peersOf(40),
      }),
    );
  });

  it("T-404: 誤りのマスと同じ行・ブロックにある手がかり(3)を選ぶと、誤りは related より強い error、同じ数字(3)は same-digit", () => {
    renderBoard(withWrongEight(), { selected: 1 });

    expect(highlights()).toEqual(
      expectedHighlights({
        selected: [1],
        error: [2, 20],
        "same-digit": [35, 41],
        related: peersOf(1).filter((i) => i !== 2 && i !== 20),
      }),
    );
  });

  it("T-404: 一時停止中(hidden)は、選択・誤りがあっても強調がすべて none", () => {
    renderBoard(withWrongEight(), { selected: 40, hidden: true });

    expect(highlights()).toEqual(expectedHighlights({}));
  });
});

describe("T-405: 誤りの表示は難易度によらない", () => {
  it.each(["easy", "normal", "hard"] as const)(
    "T-405: %s でも、誤りのマスは wrong・error・名前に「誤り」、重なるマスは error",
    (difficulty) => {
      renderBoard(withWrongEight(difficulty), { selected: 40 });

      expect(cellAt(2)).toHaveAttribute("data-kind", "wrong");
      expect(cellAt(2)).toHaveAttribute("data-highlight", "error");
      expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、8、誤り");
      expect(cellAt(20)).toHaveAttribute("data-kind", "clue");
      expect(cellAt(20)).toHaveAttribute("data-highlight", "error");
      expect(cellAt(20)).toHaveAccessibleName("3 行 3 列、8、手がかり");
      expect(highlights()).toEqual(
        expectedHighlights({
          selected: [40],
          error: [2, 20],
          related: peersOf(40),
        }),
      );
      expect(kinds().filter((k) => k === "wrong")).toHaveLength(1);
    },
  );
});

// 2026-11-03 に、本番のコードを壊しても通った箇所を確かめるために足した(N-03 のキーボードと読み上げ)
describe("T-404: 盤面のフォーカス", () => {
  it("T-404: Tab で入れるのは 1 マスだけ。未選択なら左上、選んでいればそのマス", () => {
    const game = freshGame("easy");
    const { unmount } = render(
      <Board game={game} selected={null} hidden={false} onSelect={vi.fn()} />,
    );
    expect(
      allCells().filter((c) => c.getAttribute("tabindex") === "0"),
    ).toEqual([cellAt(0)]);
    unmount();

    renderBoard(game, { selected: 40 });
    expect(
      allCells().filter((c) => c.getAttribute("tabindex") === "0"),
    ).toEqual([cellAt(40)]);
    expect(cellAt(41)).toHaveAttribute("tabindex", "-1");
  });

  it("T-404: マスにフォーカスが入ると、そのマスを選ぶ", () => {
    const { onSelect } = renderBoard(freshGame("easy"));
    act(() => cellAt(30).focus());
    expect(onSelect).toHaveBeenCalledWith(30);
  });

  it("T-404: 盤面にフォーカスがあるときは、選んだマスが変わるとフォーカスも移る", () => {
    const game = freshGame("easy");
    const { rerender } = render(
      <Board game={game} selected={0} hidden={false} onSelect={vi.fn()} />,
    );
    act(() => cellAt(0).focus());
    rerender(
      <Board game={game} selected={1} hidden={false} onSelect={vi.fn()} />,
    );
    expect(document.activeElement).toBe(cellAt(1));
  });

  it("T-404: 盤面の外にフォーカスがあるときは、選んだマスが変わってもフォーカスを動かさない", () => {
    const game = freshGame("easy");
    const outside = document.createElement("button");
    document.body.append(outside);
    const { rerender } = render(
      <Board game={game} selected={0} hidden={false} onSelect={vi.fn()} />,
    );
    outside.focus();
    rerender(
      <Board game={game} selected={1} hidden={false} onSelect={vi.fn()} />,
    );
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
