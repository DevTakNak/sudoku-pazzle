// @vitest-environment jsdom
// クリアと失敗のダイアログ(T-411、T-412)。部品を直接描画する確認と、ゲーム画面での確認
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameScreen } from "@/components/game-screen";
import { ClearedDialog, FailedDialog } from "@/components/game-dialogs";
import type { DifficultyStats, GameState, SavedStats } from "@/lib/game/types";
import type { Difficulty } from "@/lib/sudoku/grid";

import {
  BLANK_A,
  almostSolved,
  clearedGame,
  failedGame,
  freshGame,
} from "../../helpers/game";
import {
  button,
  cellAt,
  installFakeClock,
  isStorePaused,
  mistakesText,
  renderScreen,
  resume,
  savedGame,
  savedStats,
  seedGame,
  seedStats,
  selectCell,
  timerText,
  uninstallFakeClock,
} from "../../helpers/screen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const LABELS: Record<Difficulty, string> = {
  easy: "かんたん",
  normal: "ふつう",
  hard: "むずかしい",
};

const UPDATED_MESSAGE = "ベストタイムを更新しました!";

beforeEach(() => {
  window.localStorage.clear();
  router.push.mockClear();
  router.replace.mockClear();
});

// ダイアログの外側を押す操作(ポインターのイベントを一通り送る)
function clickOutside() {
  fireEvent.pointerDown(document.body);
  fireEvent.mouseDown(document.body);
  fireEvent.pointerUp(document.body);
  fireEvent.mouseUp(document.body);
  fireEvent.click(document.body);
}

// 空白を取り除いた、ダイアログ全体の文字(「タイム」「12:34」の並びを確かめるため)
function compactText(element: HTMLElement): string {
  return (element.textContent ?? "").replace(/\s+/g, "");
}

function buttonNames(dialog: HTMLElement): string[] {
  return within(dialog)
    .getAllByRole("button")
    .map((b) => b.textContent ?? "")
    .sort();
}

interface ClearedProps {
  difficulty?: Difficulty;
  elapsedSeconds?: number;
  mistakes?: number;
  stats?: DifficultyStats;
  bestUpdated?: boolean;
}

function renderCleared(props: ClearedProps = {}) {
  const onShowStats = vi.fn();
  const onNewGame = vi.fn();
  render(
    <ClearedDialog
      difficulty={props.difficulty ?? "easy"}
      elapsedSeconds={props.elapsedSeconds ?? 754}
      mistakes={props.mistakes ?? 1}
      stats={props.stats ?? { cleared: 4, failed: 1, bestSeconds: 605 }}
      bestUpdated={props.bestUpdated ?? false}
      onShowStats={onShowStats}
      onNewGame={onNewGame}
    />,
  );
  return { onShowStats, onNewGame };
}

function renderFailed() {
  const onNewGame = vi.fn();
  const onRestart = vi.fn();
  render(<FailedDialog onNewGame={onNewGame} onRestart={onRestart} />);
  return { onNewGame, onRestart };
}

describe("T-411: クリアのダイアログ(部品)", () => {
  it("T-411: タイトル「クリア!」、本文、タイム・間違い・ベストタイムの値、2 つのボタンを出す", () => {
    renderCleared({
      difficulty: "easy",
      elapsedSeconds: 754,
      mistakes: 1,
      stats: { cleared: 4, failed: 1, bestSeconds: 605 },
    });

    const dialog = screen.getByRole("alertdialog", { name: "クリア!" });
    expect(within(dialog).getByText("クリア!")).toBeInTheDocument();
    expect(
      within(dialog).getByText("かんたんをクリアしました。"),
    ).toBeInTheDocument();
    const text = compactText(dialog);
    expect(text).toContain("タイム12:34");
    expect(text).toContain("間違い1回");
    expect(text).toContain("ベストタイム10:05");
    expect(buttonNames(dialog)).toEqual(["成績を見る", "新しいゲーム"].sort());
  });

  it.each(["easy", "normal", "hard"] as const)(
    "T-411: 難易度 %s の本文に、その難易度の名前を入れる",
    (difficulty) => {
      renderCleared({ difficulty });

      expect(
        screen.getByText(`${LABELS[difficulty]}をクリアしました。`),
      ).toBeInTheDocument();
    },
  );

  it.each([
    [0, "間違い0回"],
    [2, "間違い2回"],
  ])("T-411: 間違い %i 回を「%s」と表示する", (mistakes, expected) => {
    renderCleared({ mistakes });

    expect(compactText(screen.getByRole("alertdialog"))).toContain(expected);
  });

  it("T-411: 1 時間以上のタイムは h:mm:ss で表示する", () => {
    renderCleared({ elapsedSeconds: 3725 });

    expect(compactText(screen.getByRole("alertdialog"))).toContain(
      "タイム1:02:05",
    );
  });

  it("T-411: ベストタイムを更新したとき(bestUpdated)は、「ベストタイムを更新しました!」を出す", () => {
    renderCleared({
      elapsedSeconds: 754,
      stats: { cleared: 1, failed: 0, bestSeconds: 754 },
      bestUpdated: true,
    });

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(UPDATED_MESSAGE)).toBeInTheDocument();
    expect(compactText(dialog)).toContain("ベストタイム12:34");
  });

  it("T-411: 更新していないとき(bestUpdated が false)は、「ベストタイムを更新しました!」を出さない", () => {
    renderCleared({ bestUpdated: false });

    expect(screen.queryByText(UPDATED_MESSAGE)).not.toBeInTheDocument();
  });

  it("T-411: 「成績を見る」を押すと onShowStats だけが呼ばれる", async () => {
    const user = userEvent.setup();
    const { onShowStats, onNewGame } = renderCleared();

    await user.click(screen.getByRole("button", { name: "成績を見る" }));

    expect(onShowStats).toHaveBeenCalledTimes(1);
    expect(onNewGame).not.toHaveBeenCalled();
  });

  it("T-411: 「新しいゲーム」を押すと onNewGame だけが呼ばれる", async () => {
    const user = userEvent.setup();
    const { onShowStats, onNewGame } = renderCleared();

    await user.click(screen.getByRole("button", { name: "新しいゲーム" }));

    expect(onNewGame).toHaveBeenCalledTimes(1);
    expect(onShowStats).not.toHaveBeenCalled();
  });

  it("T-411: Esc を押しても閉じず、ボタンの動きも起きない", async () => {
    const user = userEvent.setup();
    const { onShowStats, onNewGame } = renderCleared();

    await user.keyboard("{Escape}");

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onShowStats).not.toHaveBeenCalled();
    expect(onNewGame).not.toHaveBeenCalled();
  });

  it("T-411: 外側を押しても閉じず、ボタンの動きも起きない", () => {
    const { onShowStats, onNewGame } = renderCleared();

    clickOutside();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onShowStats).not.toHaveBeenCalled();
    expect(onNewGame).not.toHaveBeenCalled();
  });
});

describe("T-412: 失敗のダイアログ(部品)", () => {
  it("T-412: タイトル「失敗しました」、本文、「新しいゲーム」と「やり直す」の 2 つのボタンだけを出す", () => {
    renderFailed();

    const dialog = screen.getByRole("alertdialog", { name: "失敗しました" });
    expect(within(dialog).getByText("失敗しました")).toBeInTheDocument();
    expect(
      within(dialog).getByText("間違いが 3 回になりました。"),
    ).toBeInTheDocument();
    expect(buttonNames(dialog)).toEqual(["やり直す", "新しいゲーム"].sort());
  });

  it("T-412: 「新しいゲーム」を押すと onNewGame だけが呼ばれる", async () => {
    const user = userEvent.setup();
    const { onNewGame, onRestart } = renderFailed();

    await user.click(screen.getByRole("button", { name: "新しいゲーム" }));

    expect(onNewGame).toHaveBeenCalledTimes(1);
    expect(onRestart).not.toHaveBeenCalled();
  });

  it("T-412: 「やり直す」を押すと onRestart だけが呼ばれる", async () => {
    const user = userEvent.setup();
    const { onNewGame, onRestart } = renderFailed();

    await user.click(screen.getByRole("button", { name: "やり直す" }));

    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onNewGame).not.toHaveBeenCalled();
  });

  it("T-412: Esc を押しても閉じず、ボタンの動きも起きない", async () => {
    const user = userEvent.setup();
    const { onNewGame, onRestart } = renderFailed();

    await user.keyboard("{Escape}");

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onNewGame).not.toHaveBeenCalled();
    expect(onRestart).not.toHaveBeenCalled();
  });

  it("T-412: 外側を押しても閉じず、ボタンの動きも起きない", () => {
    const { onNewGame, onRestart } = renderFailed();

    clickOutside();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onNewGame).not.toHaveBeenCalled();
    expect(onRestart).not.toHaveBeenCalled();
  });
});

const BASE_STATS: SavedStats = {
  easy: { cleared: 4, failed: 1, bestSeconds: 300 },
  normal: { cleared: 2, failed: 2, bestSeconds: 500 },
  hard: { cleared: 1, failed: 4, bestSeconds: 900 },
};

function statsWithEasy(easy: DifficultyStats): SavedStats {
  return { ...BASE_STATS, easy };
}

describe("T-411: ゲーム画面で、保存したクリアのゲームを読み込んだとき", () => {
  // clearedGame: かんたん、300 秒(05:00)、間違い 1 回
  it("T-411: 再読み込みの後もクリアのダイアログを出し、その時のタイム・間違い・保存したベストタイムを表示する", () => {
    seedGame(clearedGame());
    seedStats(statsWithEasy({ cleared: 4, failed: 1, bestSeconds: 200 }));

    renderScreen(<GameScreen />);

    const dialog = screen.getByRole("alertdialog", { name: "クリア!" });
    expect(
      within(dialog).getByText("かんたんをクリアしました。"),
    ).toBeInTheDocument();
    const text = compactText(dialog);
    expect(text).toContain("タイム05:00");
    expect(text).toContain("間違い1回");
    expect(text).toContain("ベストタイム03:20");
  });

  it.each<[Difficulty, string, string]>([
    ["normal", "ふつう", "08:20"],
    ["hard", "むずかしい", "15:00"],
  ])(
    "T-411: 難易度 %s のクリアしたゲームでは、本文とベストタイムがその難易度のものになる",
    (difficulty, label, bestText) => {
      seedGame({ ...clearedGame(), difficulty });
      seedStats(BASE_STATS);

      renderScreen(<GameScreen />);

      const dialog = screen.getByRole("alertdialog", { name: "クリア!" });
      expect(
        within(dialog).getByText(`${label}をクリアしました。`),
      ).toBeInTheDocument();
      expect(compactText(dialog)).toContain(`ベストタイム${bestText}`);
    },
  );

  it("T-411: 読み込んだゲームでは、ベストタイムがこのゲームの時間と同じでも「ベストタイムを更新しました!」を出さない", () => {
    seedGame(clearedGame());
    seedStats(statsWithEasy({ cleared: 4, failed: 1, bestSeconds: 300 }));

    renderScreen(<GameScreen />);

    const dialog = screen.getByRole("alertdialog", { name: "クリア!" });
    expect(compactText(dialog)).toContain("ベストタイム05:00");
    expect(screen.queryByText(UPDATED_MESSAGE)).not.toBeInTheDocument();
  });

  it("T-411: 読み込んだだけでは、成績を重ねて記録しない", () => {
    seedGame(clearedGame());
    seedStats(BASE_STATS);

    renderScreen(<GameScreen />);

    expect(savedStats()).toEqual(BASE_STATS);
  });

  it("T-411: 「成績を見る」で /stats へ、「新しいゲーム」で / へ移る", async () => {
    seedGame(clearedGame());
    seedStats(BASE_STATS);
    const user = userEvent.setup();
    renderScreen(<GameScreen />);
    const dialog = screen.getByRole("alertdialog");

    await user.click(
      within(dialog).getByRole("button", { name: "成績を見る" }),
    );
    expect(router.push).toHaveBeenLastCalledWith("/stats");

    await user.click(
      within(dialog).getByRole("button", { name: "新しいゲーム" }),
    );
    expect(router.push).toHaveBeenLastCalledWith("/");
    expect(router.push).toHaveBeenCalledTimes(2);
  });

  it("T-411: Esc でも外側を押しても閉じない", async () => {
    seedGame(clearedGame());
    const user = userEvent.setup();
    renderScreen(<GameScreen />);

    await user.keyboard("{Escape}");
    clickOutside();

    expect(screen.getByRole("alertdialog", { name: "クリア!" })).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("T-411: 進行中のゲームではダイアログを出さない", () => {
    seedGame(freshGame());

    renderScreen(<GameScreen />);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("T-411: その場でクリアしたとき", () => {
  beforeEach(() => {
    // 再開してから最後のマスを入れるまでの間に、タイマーが進まないようにする
    installFakeClock();
  });

  afterEach(() => {
    uninstallFakeClock();
  });

  // idx 2(1 行 3 列、解は 4)だけが空欄。754 秒(12:34)、間違い 1 回
  function almostCleared(): GameState {
    return {
      ...almostSolved([BLANK_A]),
      elapsedSeconds: 754,
      mistakes: 1,
    };
  }

  async function clearInPlace() {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const view = renderScreen(<GameScreen />);
    await resume(user);
    await selectCell(user, BLANK_A);
    await user.keyboard("4");
    return { user, view };
  }

  it.each<[string, DifficultyStats, boolean, string, number]>([
    [
      "初めてのクリア(ベストタイムが無い)",
      { cleared: 0, failed: 2, bestSeconds: null },
      true,
      "12:34",
      754,
    ],
    [
      "前のベストタイム(800 秒)より短い",
      { cleared: 3, failed: 0, bestSeconds: 800 },
      true,
      "12:34",
      754,
    ],
    [
      "前のベストタイムと同じ(754 秒)",
      { cleared: 3, failed: 0, bestSeconds: 754 },
      false,
      "12:34",
      754,
    ],
    [
      "前のベストタイム(600 秒)より長い",
      { cleared: 3, failed: 0, bestSeconds: 600 },
      false,
      "10:00",
      600,
    ],
  ])(
    "T-411: %s とき、ベストタイムの更新の表示は更新=%s、ベストタイムの表示は %s",
    async (_label, easyStats, updated, bestText, savedBest) => {
      seedGame(almostCleared());
      seedStats(statsWithEasy(easyStats));

      await clearInPlace();

      const dialog = screen.getByRole("alertdialog", { name: "クリア!" });
      const text = compactText(dialog);
      expect(text).toContain("タイム12:34");
      expect(text).toContain("間違い1回");
      expect(text).toContain(`ベストタイム${bestText}`);
      if (updated) {
        expect(within(dialog).getByText(UPDATED_MESSAGE)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(UPDATED_MESSAGE)).not.toBeInTheDocument();
      }
      // 成績: かんたんのクリアだけが 1 増え、ほかの難易度は変わらない
      expect(savedStats()).toEqual({
        ...BASE_STATS,
        easy: {
          cleared: easyStats.cleared + 1,
          failed: easyStats.failed,
          bestSeconds: savedBest,
        },
      });
      expect(savedGame()!.status).toBe("cleared");
    },
  );

  it.each<[Difficulty, boolean, string, number]>([
    ["normal", false, "08:20", 500],
    ["hard", true, "12:34", 754],
  ])(
    "T-411: 難易度 %s でクリアすると、その難易度の成績で更新(%s)・ベストタイム(%s)を判定し、その難易度だけを記録する",
    async (difficulty, updated, bestText, savedBest) => {
      seedGame({
        ...almostSolved([BLANK_A], freshGame(difficulty)),
        elapsedSeconds: 754,
        mistakes: 1,
      });
      seedStats(BASE_STATS);

      await clearInPlace();

      const dialog = screen.getByRole("alertdialog", { name: "クリア!" });
      expect(
        within(dialog).getByText(`${LABELS[difficulty]}をクリアしました。`),
      ).toBeInTheDocument();
      expect(compactText(dialog)).toContain(`ベストタイム${bestText}`);
      expect(screen.queryByText(UPDATED_MESSAGE) !== null).toBe(updated);
      expect(savedStats()).toEqual({
        ...BASE_STATS,
        [difficulty]: {
          ...BASE_STATS[difficulty],
          cleared: BASE_STATS[difficulty].cleared + 1,
          bestSeconds: savedBest,
        },
      });
    },
  );

  it("T-411: クリアしたその場で更新したあと、ページを開いたまま画面を離れて戻っても、更新の表示が出る", async () => {
    seedGame(almostCleared());
    seedStats(statsWithEasy({ cleared: 3, failed: 0, bestSeconds: 800 }));
    const { view } = await clearInPlace();
    expect(screen.getByText(UPDATED_MESSAGE)).toBeInTheDocument();

    // ホームや成績へ移った(ゲーム画面を外した)後、ゲーム画面に戻る
    view.removeScreen();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    view.showScreen(<GameScreen />);

    const dialog = screen.getByRole("alertdialog", { name: "クリア!" });
    expect(within(dialog).getByText(UPDATED_MESSAGE)).toBeInTheDocument();
    expect(savedStats()!.easy.cleared).toBe(4);
  });

  it("T-411: クリアしたその場で出したあと、再読み込みすると同じダイアログが出るが、更新の表示は出ず、成績は重ならない", async () => {
    seedGame(almostCleared());
    seedStats(statsWithEasy({ cleared: 3, failed: 0, bestSeconds: 800 }));
    const { view } = await clearInPlace();
    expect(screen.getByText(UPDATED_MESSAGE)).toBeInTheDocument();
    const statsAfterClear = savedStats();

    // 再読み込み(新しい Provider とストアで描画し直す)
    view.unmount();
    renderScreen(<GameScreen />);

    const dialog = screen.getByRole("alertdialog", { name: "クリア!" });
    expect(compactText(dialog)).toContain("ベストタイム12:34");
    expect(screen.queryByText(UPDATED_MESSAGE)).not.toBeInTheDocument();
    expect(savedStats()).toEqual(statsAfterClear);
    expect(savedStats()!.easy.cleared).toBe(4);
  });

  it("T-411: 最後のマスに誤りの数字を入れても、クリアにならずダイアログも出ない", async () => {
    seedGame(almostCleared());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderScreen(<GameScreen />);
    await resume(user);
    await selectCell(user, BLANK_A);

    await user.keyboard("1");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mistakesText()).toBe("間違い 2/3");
    expect(savedGame()!.status).toBe("playing");
  });
});

describe("T-412: ゲーム画面で、失敗したとき", () => {
  beforeEach(() => {
    // 保存した時間(elapsedSeconds)が、実際の時間で進まないようにする
    installFakeClock();
  });

  afterEach(() => {
    uninstallFakeClock();
  });

  // failedGame: むずかしい、600 秒(10:00)、間違い 3 回、idx 2 に 1、idx 3 に 2 の誤りが残る
  it("T-412: 再読み込みの後も失敗のダイアログを出す", () => {
    seedGame(failedGame());
    seedStats(BASE_STATS);

    renderScreen(<GameScreen />);

    const dialog = screen.getByRole("alertdialog", { name: "失敗しました" });
    expect(
      within(dialog).getByText("間違いが 3 回になりました。"),
    ).toBeInTheDocument();
    expect(buttonNames(dialog)).toEqual(["やり直す", "新しいゲーム"].sort());
    expect(screen.queryByRole("alertdialog", { name: "クリア!" })).toBeNull();
  });

  it("T-412: 読み込んだだけでは、失敗を成績に重ねて記録しない", () => {
    seedGame(failedGame());
    seedStats(BASE_STATS);

    renderScreen(<GameScreen />);

    expect(savedStats()).toEqual(BASE_STATS);
  });

  it("T-412: Esc でも外側を押しても閉じない", async () => {
    seedGame(failedGame());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderScreen(<GameScreen />);

    await user.keyboard("{Escape}");
    clickOutside();

    expect(
      screen.getByRole("alertdialog", { name: "失敗しました" }),
    ).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("T-412: 「新しいゲーム」を押すと / へ移り、ゲームも成績もそのまま", async () => {
    const game = failedGame();
    seedGame(game);
    seedStats(BASE_STATS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderScreen(<GameScreen />);

    await user.click(screen.getByRole("button", { name: "新しいゲーム" }));

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/");
    expect(savedGame()).toEqual(game);
    expect(savedStats()).toEqual(BASE_STATS);
  });

  it("T-412: 「やり直す」を押すと、同じ問題が初めの状態に戻り(入力・メモ・履歴・回数・時間)、ダイアログが閉じ、移動しない", async () => {
    seedGame(failedGame());
    seedStats(BASE_STATS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderScreen(<GameScreen />);

    await user.click(screen.getByRole("button", { name: "やり直す" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(savedGame()).toEqual(freshGame("hard"));
    expect(mistakesText()).toBe("間違い 0/3");
    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、空欄");
    expect(cellAt(3)).toHaveAccessibleName("1 行 4 列、空欄");
    expect(timerText()).toBe("00:00");
    expect(button("元に戻す")).toBeDisabled();
    expect(router.push).not.toHaveBeenCalled();
    // やり直しは失敗として数え直さない(成績は変わらない)
    expect(savedStats()).toEqual(BASE_STATS);
  });

  it("T-412: 「やり直す」の後は一時停止にならず、動いている", async () => {
    seedGame(failedGame());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderScreen(<GameScreen />);
    expect(isStorePaused()).toBe(true);

    await user.click(screen.getByRole("button", { name: "やり直す" }));

    expect(isStorePaused()).toBe(false);
    expect(screen.getByRole("button", { name: "一時停止" })).toBeEnabled();
    expect(screen.queryByText("一時停止中")).not.toBeInTheDocument();
    expect(cellAt(0)).toHaveAccessibleName("1 行 1 列、5、手がかり");
  });

  it("T-412: やり直したゲームで、また 3 回間違えて失敗すると、別のゲームとして失敗が 1 つ増える", async () => {
    seedGame(failedGame());
    seedStats(BASE_STATS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderScreen(<GameScreen />);
    await user.click(screen.getByRole("button", { name: "やり直す" }));
    await selectCell(user, 2);

    await user.keyboard("1");
    await user.keyboard("2");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mistakesText()).toBe("間違い 2/3");
    await user.keyboard("3");

    expect(
      screen.getByRole("alertdialog", { name: "失敗しました" }),
    ).toBeInTheDocument();
    expect(mistakesText()).toBe("間違い 3/3");
    expect(savedStats()).toEqual({
      ...BASE_STATS,
      hard: { ...BASE_STATS.hard, failed: BASE_STATS.hard.failed + 1 },
    });
  });

  it("T-412: 3 回目の間違いで失敗のダイアログが出て、その難易度の失敗だけが 1 つ増える(1 回・2 回ではまだ出ない)", async () => {
    seedGame(freshGame("normal"));
    seedStats(BASE_STATS);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderScreen(<GameScreen />);
    await resume(user);
    await selectCell(user, 2);

    await user.keyboard("1");
    expect(mistakesText()).toBe("間違い 1/3");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.keyboard("2");
    expect(mistakesText()).toBe("間違い 2/3");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.keyboard("3");

    expect(
      screen.getByRole("alertdialog", { name: "失敗しました" }),
    ).toBeInTheDocument();
    expect(savedStats()).toEqual({
      ...BASE_STATS,
      normal: { ...BASE_STATS.normal, failed: BASE_STATS.normal.failed + 1 },
    });
    expect(savedGame()!.status).toBe("failed");
  });
});
