// @vitest-environment jsdom
// ゲーム画面のキーボード操作(T-406)と、操作できない間の確認(T-407)
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GameScreen } from "@/components/game-screen";
import type { GameState, SavedStats } from "@/lib/game/types";

import {
  BLANK_A,
  SOLUTION_A,
  almostSolved,
  clearedGame,
  failedGame,
  freshGame,
  richPlayingGame,
  withNotes,
  withValues,
} from "../../helpers/game";
import {
  boardSignature,
  button,
  cellAt,
  mistakesText,
  renderScreen,
  resume,
  savedGame,
  savedStats,
  seedGame,
  seedStats,
  selectCell,
  selectedIndex,
} from "../../helpers/screen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// 盤面は UNIQUE_PUZZLE。idx 2(1 行 3 列)は空欄で解は 4、idx 3(1 行 4 列)の解は 6、idx 0 は手がかりの 5
const EMPTY_2 = "1 行 3 列、空欄";

beforeEach(() => {
  window.localStorage.clear();
  router.push.mockClear();
  router.replace.mockClear();
});

// 保存したゲームを読み込み、一時停止を解いて遊べる状態にする
async function openPlaying(game: GameState = freshGame()) {
  seedGame(game);
  const user = userEvent.setup();
  renderScreen(<GameScreen />);
  await resume(user);
  return user;
}

const UNDO_KEYS: [string, string][] = [
  ["Ctrl+Z", "{Control>}z{/Control}"],
  ["Meta+Z", "{Meta>}z{/Meta}"],
];

const REDO_KEYS: [string, string][] = [
  ["Ctrl+Shift+Z", "{Control>}{Shift>}Z{/Shift}{/Control}"],
  ["Meta+Shift+Z", "{Meta>}{Shift>}Z{/Shift}{/Meta}"],
  ["Ctrl+Y", "{Control>}y{/Control}"],
];

describe("T-406: 矢印キー", () => {
  it.each(["{ArrowUp}", "{ArrowDown}", "{ArrowLeft}", "{ArrowRight}"])(
    "T-406: どのマスも選んでいないとき、%s で左上(idx 0)を選ぶ",
    async (key) => {
      const user = await openPlaying();
      expect(selectedIndex()).toBeNull();

      await user.keyboard(key);

      expect(selectedIndex()).toBe(0);
    },
  );

  it.each([
    ["{ArrowRight}", 41],
    ["{ArrowLeft}", 39],
    ["{ArrowUp}", 31],
    ["{ArrowDown}", 49],
  ])("T-406: 真ん中(idx 40)から %s で idx %i に動く", async (key, expected) => {
    const user = await openPlaying();
    await selectCell(user, 40);

    await user.keyboard(key);

    expect(selectedIndex()).toBe(expected);
  });

  it.each([
    ["左上から左", 0, "{ArrowLeft}", 0],
    ["左上から上", 0, "{ArrowUp}", 0],
    ["右上から右", 8, "{ArrowRight}", 8],
    ["右上から上", 8, "{ArrowUp}", 8],
    ["左下から左", 72, "{ArrowLeft}", 72],
    ["左下から下", 72, "{ArrowDown}", 72],
    ["右下から右", 80, "{ArrowRight}", 80],
    ["右下から下", 80, "{ArrowDown}", 80],
    ["2 行目の左端から左(前の行の右端へ回らない)", 9, "{ArrowLeft}", 9],
    ["2 行目の右端から右(次の行の左端へ回らない)", 17, "{ArrowRight}", 17],
    ["上端の途中から上", 4, "{ArrowUp}", 4],
    ["下端の途中から下", 76, "{ArrowDown}", 76],
  ])("T-406: 端で止まる(%s)", async (_label, from, key, expected) => {
    const user = await openPlaying();
    await selectCell(user, from);

    await user.keyboard(key);

    expect(selectedIndex()).toBe(expected);
  });

  it.each([
    ["左上から右", 0, "{ArrowRight}", 1],
    ["左上から下", 0, "{ArrowDown}", 9],
    ["右下から左", 80, "{ArrowLeft}", 79],
    ["右下から上", 80, "{ArrowUp}", 71],
    ["右上から左", 8, "{ArrowLeft}", 7],
    ["左下から右", 72, "{ArrowRight}", 73],
    ["左下から上", 72, "{ArrowUp}", 63],
  ])("T-406: 端から内側へは動く(%s)", async (_label, from, key, expected) => {
    const user = await openPlaying();
    await selectCell(user, from);

    await user.keyboard(key);

    expect(selectedIndex()).toBe(expected);
  });

  it("T-406: 手がかりのマスの上でも矢印で動ける", async () => {
    const user = await openPlaying();
    await selectCell(user, 0); // 手がかりの 5

    await user.keyboard("{ArrowRight}{ArrowRight}");

    expect(selectedIndex()).toBe(2);
  });
});

describe("T-406: 数字のキー", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])(
    "T-406: 選んだ空欄(解は 4)に %i を入れると、4 は正解、それ以外は誤りで回数が 1 になる",
    async (digit) => {
      const user = await openPlaying();
      await selectCell(user, 2);

      await user.keyboard(String(digit));

      if (digit === 4) {
        expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");
        expect(cellAt(2)).toHaveAttribute("data-kind", "correct");
        expect(mistakesText()).toBe("間違い 0/3");
      } else {
        expect(cellAt(2)).toHaveAccessibleName(`1 行 3 列、${digit}、誤り`);
        expect(cellAt(2)).toHaveAttribute("data-kind", "wrong");
        expect(mistakesText()).toBe("間違い 1/3");
      }
    },
  );

  it("T-406: 0 のキーは数字として入力されない", async () => {
    const user = await openPlaying();
    await selectCell(user, 2);

    await user.keyboard("0");

    expect(cellAt(2)).toHaveAccessibleName(EMPTY_2);
    expect(mistakesText()).toBe("間違い 0/3");
  });

  it("T-406: マスを選んでいないとき、数字のキーは何も入力しない", async () => {
    const user = await openPlaying();
    const before = boardSignature();

    await user.keyboard("4");

    expect(boardSignature()).toEqual(before);
    expect(mistakesText()).toBe("間違い 0/3");
    expect(savedGame()!.values).toEqual(freshGame().values);
  });

  it("T-406: 手がかりのマスに数字のキーを押しても変わらず、回数も増えない", async () => {
    const user = await openPlaying();
    await selectCell(user, 0);

    await user.keyboard("3");

    expect(cellAt(0)).toHaveAccessibleName("1 行 1 列、5、手がかり");
    expect(mistakesText()).toBe("間違い 0/3");
  });

  it("T-406: 入力した正解のマスに別の数字のキーを押しても変わらず、回数も増えない", async () => {
    const user = await openPlaying(withValues(freshGame(), { 2: 4 }));
    await selectCell(user, 2);

    await user.keyboard("1");

    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");
    expect(mistakesText()).toBe("間違い 0/3");
  });
});

describe("T-406: 消すキー", () => {
  it.each(["{Backspace}", "{Delete}"])(
    "T-406: %s で誤りの数字が消え、間違いの回数は減らない",
    async (key) => {
      const user = await openPlaying();
      await selectCell(user, 2);
      await user.keyboard("1");
      expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、1、誤り");

      await user.keyboard(key);

      expect(cellAt(2)).toHaveAccessibleName(EMPTY_2);
      expect(mistakesText()).toBe("間違い 1/3");
    },
  );

  it.each(["{Backspace}", "{Delete}"])(
    "T-406: %s でメモが消える",
    async (key) => {
      const user = await openPlaying(withNotes(freshGame(), { 2: [1, 5] }));
      await selectCell(user, 2);
      expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、メモ 1 5");

      await user.keyboard(key);

      expect(cellAt(2)).toHaveAccessibleName(EMPTY_2);
    },
  );

  it.each(["{Backspace}", "{Delete}"])(
    "T-406: マスを選んでいないとき、%s は何も消さない",
    async (key) => {
      const user = await openPlaying(withValues(freshGame(), { 3: 1 }));
      const before = boardSignature();

      await user.keyboard(key);

      expect(boardSignature()).toEqual(before);
      expect(cellAt(3)).toHaveAccessibleName("1 行 4 列、1、誤り");
    },
  );

  it.each(["{Backspace}", "{Delete}"])(
    "T-406: 手がかりのマスで %s を押しても消えない",
    async (key) => {
      const user = await openPlaying();
      await selectCell(user, 0);

      await user.keyboard(key);

      expect(cellAt(0)).toHaveAccessibleName("1 行 1 列、5、手がかり");
    },
  );
});

describe("T-406: メモのキー", () => {
  it.each(["m", "M"])(
    "T-406: %s でメモの状態が入り(aria-pressed)、数字のキーはメモになって回数は増えない",
    async (key) => {
      const user = await openPlaying();
      expect(button("メモ")).toHaveAttribute("aria-pressed", "false");
      await selectCell(user, 2);

      await user.keyboard(key);
      expect(button("メモ")).toHaveAttribute("aria-pressed", "true");
      await user.keyboard("1");
      await user.keyboard("4");

      expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、メモ 1 4");
      expect(cellAt(2)).toHaveAttribute("data-kind", "empty");
      expect(mistakesText()).toBe("間違い 0/3");
    },
  );

  it("T-406: メモの状態で同じ数字をもう一度押すと、メモが外れる", async () => {
    const user = await openPlaying();
    await selectCell(user, 2);

    await user.keyboard("m1");
    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、メモ 1");
    await user.keyboard("1");

    expect(cellAt(2)).toHaveAccessibleName(EMPTY_2);
  });

  it.each(["m", "M"])(
    "T-406: メモの状態で %s をもう一度押すと元に戻り、数字のキーは入力になってメモが消える",
    async (key) => {
      const user = await openPlaying();
      await selectCell(user, 2);
      await user.keyboard(`${key}1`);
      expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、メモ 1");

      await user.keyboard(key);
      expect(button("メモ")).toHaveAttribute("aria-pressed", "false");
      await user.keyboard("4");

      expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");
    },
  );
});

describe("T-406: 元に戻す・やり直しのキー", () => {
  it.each(UNDO_KEYS)(
    "T-406: %s で直前の入力が元に戻る(マスが空欄に戻る)",
    async (_label, keys) => {
      const user = await openPlaying();
      await selectCell(user, 2);
      await user.keyboard("4");
      expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");

      await user.keyboard(keys);

      expect(cellAt(2)).toHaveAccessibleName(EMPTY_2);
    },
  );

  it.each(REDO_KEYS)(
    "T-406: 元に戻したあと %s でやり直せる",
    async (_label, keys) => {
      const user = await openPlaying();
      await selectCell(user, 2);
      await user.keyboard("4");
      await user.keyboard("{Control>}z{/Control}");
      expect(cellAt(2)).toHaveAccessibleName(EMPTY_2);

      await user.keyboard(keys);

      expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");
    },
  );

  it("T-406: 元に戻しても間違いの回数は減らず、やり直しても増えない", async () => {
    const user = await openPlaying();
    await selectCell(user, 2);
    await user.keyboard("1");
    expect(mistakesText()).toBe("間違い 1/3");

    await user.keyboard("{Control>}z{/Control}");
    expect(cellAt(2)).toHaveAccessibleName(EMPTY_2);
    expect(mistakesText()).toBe("間違い 1/3");

    await user.keyboard("{Control>}y{/Control}");
    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、1、誤り");
    expect(mistakesText()).toBe("間違い 1/3");
  });

  it("T-406: 2 つの入力を 1 つずつ元に戻し、Ctrl+Shift+Z は元に戻すではなくやり直しとして働く", async () => {
    const user = await openPlaying();
    await selectCell(user, 2);
    await user.keyboard("4");
    await selectCell(user, 3);
    await user.keyboard("6");

    await user.keyboard("{Control>}z{/Control}");
    expect(cellAt(3)).toHaveAccessibleName("1 行 4 列、空欄");
    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");

    await user.keyboard("{Control>}z{/Control}");
    expect(cellAt(2)).toHaveAccessibleName(EMPTY_2);

    await user.keyboard("{Control>}{Shift>}Z{/Shift}{/Control}");
    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");
    expect(cellAt(3)).toHaveAccessibleName("1 行 4 列、空欄");
  });

  it("T-406: Shift を押しながらの小文字の z(key が z)でもやり直しになる", async () => {
    const user = await openPlaying();
    await selectCell(user, 2);
    await user.keyboard("4");
    await user.keyboard("{Control>}z{/Control}");

    fireEvent.keyDown(document, { key: "z", ctrlKey: true, shiftKey: true });

    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");
  });

  it("T-406: Ctrl も Meta も押さない z と y は何もしない", async () => {
    const user = await openPlaying();
    await selectCell(user, 2);
    await user.keyboard("4");
    await user.keyboard("z");
    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");

    await user.keyboard("{Control>}z{/Control}");
    expect(cellAt(2)).toHaveAccessibleName(EMPTY_2);
    await user.keyboard("y");

    expect(cellAt(2)).toHaveAccessibleName(EMPTY_2);
  });

  it.each([...UNDO_KEYS, ...REDO_KEYS])(
    "T-406: 履歴が空のとき %s を押しても何も変わらない",
    async (_label, keys) => {
      const user = await openPlaying();
      const before = boardSignature();

      await user.keyboard(keys);

      expect(boardSignature()).toEqual(before);
      expect(mistakesText()).toBe("間違い 0/3");
    },
  );
});

describe("T-406: Ctrl・Meta・Alt が付いたキーは扱わない", () => {
  it.each([
    ["Ctrl+4", "{Control>}4{/Control}"],
    ["Meta+4", "{Meta>}4{/Meta}"],
    ["Alt+4", "{Alt>}4{/Alt}"],
  ])("T-406: %s では数字が入力されない", async (_label, keys) => {
    const user = await openPlaying();
    await selectCell(user, 2);

    await user.keyboard(keys);

    expect(cellAt(2)).toHaveAccessibleName(EMPTY_2);
    expect(mistakesText()).toBe("間違い 0/3");
  });

  it.each([
    ["Ctrl+M", "{Control>}m{/Control}"],
    ["Meta+M", "{Meta>}m{/Meta}"],
    ["Alt+M", "{Alt>}m{/Alt}"],
  ])("T-406: %s ではメモの状態が切り替わらない", async (_label, keys) => {
    const user = await openPlaying();

    await user.keyboard(keys);

    expect(button("メモ")).toHaveAttribute("aria-pressed", "false");
  });

  it.each([
    ["Ctrl+→", "{Control>}{ArrowRight}{/Control}"],
    ["Meta+→", "{Meta>}{ArrowRight}{/Meta}"],
    ["Alt+→", "{Alt>}{ArrowRight}{/Alt}"],
  ])("T-406: %s ではマスを選ぶ位置が動かない", async (_label, keys) => {
    const user = await openPlaying();
    await selectCell(user, 40);

    await user.keyboard(keys);

    expect(selectedIndex()).toBe(40);
  });

  it.each([
    ["Ctrl+Backspace", "{Control>}{Backspace}{/Control}"],
    ["Meta+Delete", "{Meta>}{Delete}{/Meta}"],
  ])("T-406: %s では消えない", async (_label, keys) => {
    const user = await openPlaying(withValues(freshGame(), { 3: 1 }));
    await selectCell(user, 3);

    await user.keyboard(keys);

    expect(cellAt(3)).toHaveAccessibleName("1 行 4 列、1、誤り");
  });
});

// 一時停止の間に押すキー。押す前と押した後(再開した後)で、盤面・回数・履歴が変わらないこと
const KEYS_IGNORED_WHILE_PAUSED: [string, string][] = [
  ["数字 4", "4"],
  ["数字 1", "1"],
  ["Backspace", "{Backspace}"],
  ["Delete", "{Delete}"],
  ["m", "m"],
  ["Ctrl+Z", "{Control>}z{/Control}"],
  ["Meta+Z", "{Meta>}z{/Meta}"],
  ["Ctrl+Y", "{Control>}y{/Control}"],
  ["Ctrl+Shift+Z", "{Control>}{Shift>}Z{/Shift}{/Control}"],
];

describe("T-407: 一時停止中はキーとボタンが効かない", () => {
  it.each(KEYS_IGNORED_WHILE_PAUSED)(
    "T-407: 一時停止中に %s を押しても、盤面・間違いの回数・メモの状態・履歴が変わらない",
    async (_label, keys) => {
      // richPlayingGame: 誤りの数字(idx 3)、メモ、元に戻す 2 件・やり直し 1 件の履歴、回数 1
      const user = await openPlaying(richPlayingGame());
      await selectCell(user, 3);
      const before = boardSignature();
      await user.click(screen.getByRole("button", { name: "一時停止" }));

      await user.keyboard(keys);
      await resume(user);

      expect(boardSignature()).toEqual(before);
      expect(mistakesText()).toBe("間違い 1/3");
      expect(button("メモ")).toHaveAttribute("aria-pressed", "false");
      // 履歴も変わっていない: 元に戻すと idx 3 の誤りが消え、やり直すと idx 7 にメモの 5 が付く
      expect(savedGame()!.undoStack).toHaveLength(2);
      expect(savedGame()!.redoStack).toHaveLength(1);
    },
  );

  it("T-407: 読み込んだ直後(一時停止)の矢印キーは、マスを選ばない", async () => {
    seedGame(freshGame());
    const user = userEvent.setup();
    renderScreen(<GameScreen />);

    await user.keyboard("{ArrowDown}{ArrowRight}");
    await resume(user);

    expect(selectedIndex()).toBeNull();
  });

  it("T-407: 一時停止中は、操作のボタンと数字のボタンが押せず、再開のボタンは押せる", () => {
    seedGame(richPlayingGame());
    renderScreen(<GameScreen />);

    for (const name of ["元に戻す", "やり直し", "消す", "メモ"]) {
      expect(button(name)).toBeDisabled();
    }
    for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(button(String(digit))).toBeDisabled();
    }
    for (const resumeButton of screen.getAllByRole("button", {
      name: "再開",
    })) {
      expect(resumeButton).toBeEnabled();
    }
  });

  it("T-407: 再開すると、操作のボタンと数字のボタンが押せるようになる(「元に戻す」「やり直し」は履歴がある)", async () => {
    seedGame(richPlayingGame());
    const user = userEvent.setup();
    renderScreen(<GameScreen />);

    await resume(user);

    for (const name of ["元に戻す", "やり直し", "消す", "メモ"]) {
      expect(button(name)).toBeEnabled();
    }
    for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(button(String(digit))).toBeEnabled();
    }
  });
});

const KEYS_IGNORED_AFTER_END = [
  "8",
  "1",
  "{Backspace}",
  "{Delete}",
  "m",
  "{ArrowRight}",
  "{Control>}z{/Control}",
  "{Meta>}z{/Meta}",
  "{Control>}y{/Control}",
  "{Control>}{Shift>}Z{/Shift}{/Control}",
];

const STATS: SavedStats = {
  easy: { cleared: 3, failed: 1, bestSeconds: 200 },
  normal: { cleared: 5, failed: 2, bestSeconds: 400 },
  hard: { cleared: 7, failed: 4, bestSeconds: 800 },
};

describe("T-407: ゲームの終了後はキーとボタンが効かない", () => {
  it.each<[string, () => GameState, number]>([
    ["失敗", failedGame, 3],
    ["クリア", clearedGame, 3],
  ])(
    "T-407: %sしたゲームでは、キーを押しても盤面・保存したゲーム・成績が変わらず、ボタンは押せない",
    async (_label, makeGame, selectedCell) => {
      const game = makeGame();
      seedGame(game);
      seedStats(STATS);
      const user = userEvent.setup();
      renderScreen(<GameScreen />);
      // ダイアログが開いていても選べるよう、押す操作は fireEvent で行う
      fireEvent.click(cellAt(selectedCell));
      const before = boardSignature();

      for (const keys of KEYS_IGNORED_AFTER_END) {
        await user.keyboard(keys);
      }

      expect(boardSignature()).toEqual(before);
      expect(savedGame()).toEqual(game);
      expect(savedStats()).toEqual(STATS);
      for (const name of ["元に戻す", "やり直し", "消す", "メモ"]) {
        expect(button(name)).toBeDisabled();
      }
      for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        expect(button(String(digit))).toBeDisabled();
      }
    },
  );

  // 読み込んだ直後と違い、その場で終わったゲームは一時停止になっていない
  it.each<[string, GameState, string]>([
    ["クリア", almostSolved([BLANK_A]), String(SOLUTION_A)],
    ["失敗", { ...freshGame(), mistakes: 2 }, "1"],
  ])(
    "T-407: その場で%sした直後も、矢印・M のキーが効かず、操作と数字のボタンは押せない",
    async (_label, game, finalKey) => {
      const user = await openPlaying(game);
      await selectCell(user, BLANK_A);
      await user.keyboard(finalKey);
      expect(savedGame()!.status).not.toBe("playing");
      expect(selectedIndex()).toBe(BLANK_A);

      await user.keyboard("{ArrowRight}{ArrowDown}m");

      expect(selectedIndex()).toBe(BLANK_A);
      expect(button("メモ")).toHaveAttribute("aria-pressed", "false");
      for (const name of ["元に戻す", "やり直し", "消す", "メモ"]) {
        expect(button(name)).toBeDisabled();
      }
      for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        expect(button(String(digit))).toBeDisabled();
      }
    },
  );

  it("T-407: 失敗したゲームでは、空欄のマスに正解のキーを押しても入らない", async () => {
    // failedGame: idx 5(1 行 6 列)は空欄で解は 8
    seedGame(failedGame());
    const user = userEvent.setup();
    renderScreen(<GameScreen />);
    fireEvent.click(cellAt(5));

    await user.keyboard("8");

    expect(savedGame()!.values[5]).toBe(0);
    expect(savedGame()!.status).toBe("failed");
  });
});
