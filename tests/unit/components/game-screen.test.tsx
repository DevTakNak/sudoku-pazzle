// @vitest-environment jsdom
// ゲーム画面の一時停止とタイマー(T-408、T-409)、操作のボタン(T-410)
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameProvider, useGameSnapshot } from "@/components/game-provider";
import { GameScreen } from "@/components/game-screen";
import type { GameState } from "@/lib/game/types";
import { GAME_KEY } from "@/lib/storage/storage";

import {
  clearedGame,
  freshGame,
  richPlayingGame,
  withValues,
} from "../../helpers/game";
import {
  StartGameControl,
  allCells,
  boardSignature,
  button,
  cellAt,
  installFakeClock,
  isStorePaused,
  mistakesText,
  renderScreen,
  resume,
  savedGame,
  seedGame,
  selectCell,
  timerText,
  uninstallFakeClock,
} from "../../helpers/screen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  window.localStorage.clear();
  router.push.mockClear();
  router.replace.mockClear();
  // タイマーに関わるものと Date だけを偽物にする(React のスケジューラは本物のまま)
  installFakeClock();
});

afterEach(() => {
  uninstallFakeClock();
});

function setup(game: GameState) {
  seedGame(game);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const view = renderScreen(<GameScreen />);
  return { user, view };
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

// richPlayingGame: 125 秒(02:05)、idx 2 に正解の 4、idx 3 に誤りの 1(解は 6)、
// idx 5 にメモ 1 3 8、idx 6 にメモ 2 9、間違い 1 回、元に戻す 2 件・やり直し 1 件

describe("T-408: 一時停止中は数字とメモが無く、再開で戻る", () => {
  it("T-408: 読み込んだ直後は一時停止で、「一時停止中」と 2 つの「再開」を出し、数字もメモも DOM に無い", () => {
    setup(richPlayingGame());

    expect(screen.getByText("一時停止中")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "再開" })).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "一時停止" }),
    ).not.toBeInTheDocument();
    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列");
    expect(cellAt(3)).toHaveAccessibleName("1 行 4 列");
    expect(cellAt(5)).toHaveAccessibleName("1 行 6 列");
    for (const cell of allCells()) expect(cell.textContent).toBe("");
  });

  it.each([0, 1])(
    "T-408: 「再開」(%i 番目のボタン)を押すと、数字とメモが戻り、ヘッダーのボタンは「一時停止」になる",
    async (which) => {
      const { user } = setup(richPlayingGame());

      await user.click(screen.getAllByRole("button", { name: "再開" })[which]!);

      expect(screen.queryByText("一時停止中")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "再開" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "一時停止" })).toBeEnabled();
      expect(cellAt(0)).toHaveAccessibleName("1 行 1 列、5、手がかり");
      expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");
      expect(cellAt(3)).toHaveAccessibleName("1 行 4 列、1、誤り");
      expect(cellAt(5)).toHaveAccessibleName("1 行 6 列、メモ 1 3 8");
      expect(cellAt(6)).toHaveAccessibleName("1 行 7 列、メモ 2 9");
      expect(cellAt(5).textContent).toBe("138");
      expect(isStorePaused()).toBe(false);
    },
  );

  it("T-408: 「一時停止」を押すと、数字とメモが消えて「一時停止中」が出て、「再開」で同じ盤面に戻る", async () => {
    const { user } = setup(richPlayingGame());
    await resume(user);
    const before = boardSignature();

    await user.click(screen.getByRole("button", { name: "一時停止" }));

    expect(screen.getByText("一時停止中")).toBeInTheDocument();
    for (const cell of allCells()) expect(cell.textContent).toBe("");
    expect(isStorePaused()).toBe(true);

    await resume(user);

    expect(boardSignature()).toEqual(before);
  });

  it("T-408: 一時停止のまま時間がたっても、タイマーは進まない", () => {
    setup(richPlayingGame());
    expect(timerText()).toBe("02:05");

    advance(5000);

    expect(timerText()).toBe("02:05");
    expect(savedGame()!.elapsedSeconds).toBe(125);
  });

  it("T-408: 再開すると 1 秒ごとにタイマーが進み(999ms では進まず 1000ms で 1 秒)、保存した時間も進む", async () => {
    const { user } = setup(richPlayingGame());
    await resume(user);
    expect(timerText()).toBe("02:05");

    advance(999);
    expect(timerText()).toBe("02:05");

    advance(1);
    expect(timerText()).toBe("02:06");

    advance(3000);
    expect(timerText()).toBe("02:09");
    expect(savedGame()!.elapsedSeconds).toBe(129);
  });

  it("T-408: 一時停止するとタイマーが止まり、再開するとそこから進む", async () => {
    const { user } = setup(richPlayingGame());
    await resume(user);
    advance(2000);
    expect(timerText()).toBe("02:07");

    await user.click(screen.getByRole("button", { name: "一時停止" }));
    advance(10000);
    expect(timerText()).toBe("02:07");

    await resume(user);
    advance(1000);
    expect(timerText()).toBe("02:08");
  });

  it("T-408: 1 時間をまたぐと、表示が h:mm:ss になる(3599 秒 → 1:00:00)", async () => {
    const { user } = setup({ ...freshGame(), elapsedSeconds: 3599 });
    expect(timerText()).toBe("59:59");
    await resume(user);

    advance(1000);

    expect(timerText()).toBe("1:00:00");
  });

  it("T-408: 生成して始めたゲーム(ストアに startGame したもの)は一時停止にならず、タイマーが進む", async () => {
    renderScreen(
      <>
        <StartGameControl game={{ ...freshGame("hard"), elapsedSeconds: 10 }} />
        <GameScreen />
      </>,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.click(
      screen.getByRole("button", { name: "テスト用ゲーム開始" }),
    );

    expect(screen.queryByText("一時停止中")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一時停止" })).toBeEnabled();
    expect(screen.getByText("むずかしい")).toBeInTheDocument();
    advance(2000);
    expect(timerText()).toBe("00:12");
  });
});

describe("T-408: 読み込み前の表示", () => {
  it("T-408: サーバーの描画では保存を読まず、「読み込み中…」だけを出す(盤面も出さない)", () => {
    seedGame(richPlayingGame());

    const html = renderToString(
      <GameProvider>
        <GameScreen />
      </GameProvider>,
    );

    expect(html).toContain("読み込み中…");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("gridcell");
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("T-408: 画面の表示(ヘッダー)", () => {
  it("T-408: ホームへのリンク、難易度、間違いの回数(aria-live)、タイマーを出す", () => {
    setup({ ...richPlayingGame(), difficulty: "normal" });

    expect(screen.getByRole("link", { name: "ホーム" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByText("ふつう")).toBeInTheDocument();
    expect(screen.getByText("間違い 1/3")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(timerText()).toBe("02:05");
  });

  it.each([
    ["easy", "かんたん"],
    ["normal", "ふつう"],
    ["hard", "むずかしい"],
  ] as const)("T-408: 難易度 %s は「%s」と表示する", (difficulty, label) => {
    setup(freshGame(difficulty));

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("T-408: 盤面は 9 行 9 列の grid(名前は「数独の盤面」)", () => {
    setup(freshGame());

    const grid = screen.getByRole("grid", { name: "数独の盤面" });
    expect(within(grid).getAllByRole("row")).toHaveLength(9);
    expect(allCells()).toHaveLength(81);
  });

  it("T-408: 最初はどのマスも選んでいない(再開しても)", async () => {
    const { user } = setup(freshGame());
    await resume(user);

    expect(
      allCells().filter((c) => c.getAttribute("aria-selected") === "true"),
    ).toHaveLength(0);
  });
});

describe("T-507 の単体での確認: 保存したゲームが無いとき", () => {
  it("T-507: 保存したゲームが無いと /play から / へ移る", () => {
    renderScreen(<GameScreen />);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("T-507: 壊れた値が保存されていても、例外を出さず / へ移る", () => {
    window.localStorage.setItem(GAME_KEY, "{ not json");

    renderScreen(<GameScreen />);

    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("T-507: 保存したゲームがあると、/ へは移らない", () => {
    setup(freshGame());

    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("T-409: タブが隠れる・画面を離れると一時停止になる", () => {
  function setVisibility(state: "visible" | "hidden") {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
  }

  it("T-409: タブが隠れると、一時停止になり、数字が隠れ、タイマーが止まる", async () => {
    const { user } = setup(richPlayingGame());
    await resume(user);
    advance(1000);
    expect(timerText()).toBe("02:06");

    setVisibility("hidden");

    expect(screen.getByText("一時停止中")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "再開" })).toHaveLength(2);
    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列");
    expect(isStorePaused()).toBe(true);
    advance(5000);
    expect(timerText()).toBe("02:06");
  });

  it("T-409: タブが見える状態に戻っても、自動では再開しない", async () => {
    const { user } = setup(richPlayingGame());
    await resume(user);

    setVisibility("hidden");
    setVisibility("visible");

    expect(screen.getByText("一時停止中")).toBeInTheDocument();
    expect(isStorePaused()).toBe(true);
    advance(3000);
    expect(timerText()).toBe("02:05");
  });

  it("T-409: タブが見える状態の visibilitychange では、一時停止にならない", async () => {
    const { user } = setup(richPlayingGame());
    await resume(user);

    setVisibility("visible");

    expect(screen.queryByText("一時停止中")).not.toBeInTheDocument();
    expect(isStorePaused()).toBe(false);
    advance(1000);
    expect(timerText()).toBe("02:06");
  });

  it("T-409: 隠れて一時停止にした後に手で再開すると、またタイマーが進む", async () => {
    const { user } = setup(richPlayingGame());
    await resume(user);
    setVisibility("hidden");
    setVisibility("visible");

    await resume(user);
    advance(1000);

    expect(timerText()).toBe("02:06");
  });

  it("T-409: 画面を離れる(アンマウントする)と、一時停止になり、保存した時間も進まない", async () => {
    const { user, view } = setup(richPlayingGame());
    await resume(user);
    advance(2000);
    expect(isStorePaused()).toBe(false);

    view.removeScreen();

    expect(isStorePaused()).toBe(true);
    const elapsed = savedGame()!.elapsedSeconds;
    expect(elapsed).toBe(127);
    advance(5000);
    expect(savedGame()!.elapsedSeconds).toBe(elapsed);
  });
});

describe("T-410: 「元に戻す」「やり直し」は、できないときに押せない", () => {
  it("T-410: 履歴が空のとき、「元に戻す」も「やり直し」も押せない", async () => {
    const { user } = setup(freshGame());
    await resume(user);

    expect(button("元に戻す")).toBeDisabled();
    expect(button("やり直し")).toBeDisabled();
  });

  it("T-410: 元に戻す履歴だけがあるとき(1 回入力した後)、「元に戻す」は押せて「やり直し」は押せない", async () => {
    const { user } = setup(freshGame());
    await resume(user);
    await selectCell(user, 2);

    await user.click(button("4"));

    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");
    expect(button("元に戻す")).toBeEnabled();
    expect(button("やり直し")).toBeDisabled();
  });

  it("T-410: 「元に戻す」を押すと入力が戻り、履歴がなくなれば「元に戻す」は押せなくなり、「やり直し」が押せる", async () => {
    const { user } = setup(freshGame());
    await resume(user);
    await selectCell(user, 2);
    await user.click(button("4"));

    await user.click(button("元に戻す"));

    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、空欄");
    expect(button("元に戻す")).toBeDisabled();
    expect(button("やり直し")).toBeEnabled();
  });

  it("T-410: 「やり直し」を押すと入力が戻り、やり直しの履歴がなくなれば「やり直し」は押せなくなる", async () => {
    const { user } = setup(freshGame());
    await resume(user);
    await selectCell(user, 2);
    await user.click(button("4"));
    await user.click(button("元に戻す"));

    await user.click(button("やり直し"));

    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");
    expect(button("元に戻す")).toBeEnabled();
    expect(button("やり直し")).toBeDisabled();
  });

  it("T-410: 元に戻した後に新しく入力すると、「やり直し」は押せなくなる", async () => {
    const { user } = setup(freshGame());
    await resume(user);
    await selectCell(user, 2);
    await user.click(button("4"));
    await user.click(button("元に戻す"));
    expect(button("やり直し")).toBeEnabled();

    await user.click(button("1"));

    expect(button("やり直し")).toBeDisabled();
    expect(button("元に戻す")).toBeEnabled();
  });

  it("T-410: 元に戻す履歴もやり直しの履歴もあるゲームでは、両方押せる", async () => {
    const { user } = setup(richPlayingGame());
    await resume(user);

    expect(button("元に戻す")).toBeEnabled();
    expect(button("やり直し")).toBeEnabled();
  });

  it("T-410: 履歴 1 件のゲームで元に戻すと、そのマスは空欄に戻り、押せない状態になる", async () => {
    const { user } = setup(withHistoryOfOne());
    await resume(user);
    expect(button("元に戻す")).toBeEnabled();

    await user.click(button("元に戻す"));

    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、空欄");
    expect(button("元に戻す")).toBeDisabled();
  });

  it("T-410: メモの付け外しも、元に戻す履歴に入る", async () => {
    const { user } = setup(freshGame());
    await resume(user);
    await selectCell(user, 2);
    await user.click(button("メモ"));
    await user.click(button("1"));
    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、メモ 1");

    await user.click(button("元に戻す"));

    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、空欄");
  });
});

// 履歴が 1 件だけある状態(idx 2 に正解の 4 を入れた直後)
function withHistoryOfOne(): GameState {
  const base = withValues(freshGame(), { 2: 4 });
  return {
    ...base,
    undoStack: [
      {
        before: [{ index: 2, value: 0, notes: [] }],
        after: [{ index: 2, value: 4, notes: [] }],
      },
    ],
  };
}

describe("T-410: 操作のボタン(消す・メモ・数字)", () => {
  it("T-410: 数字のボタンで選んだマスに入力でき、4 は正解、1 は誤りで回数が増える", async () => {
    const { user } = setup(freshGame());
    await resume(user);
    await selectCell(user, 2);

    await user.click(button("4"));
    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");
    expect(mistakesText()).toBe("間違い 0/3");

    await selectCell(user, 3);
    await user.click(button("1"));
    expect(cellAt(3)).toHaveAccessibleName("1 行 4 列、1、誤り");
    expect(mistakesText()).toBe("間違い 1/3");
  });

  it("T-410: マスを選んでいないとき、数字のボタンも「消す」も何も変えない", async () => {
    const { user } = setup(withValues(freshGame(), { 3: 1 }));
    await resume(user);
    const before = boardSignature();

    await user.click(button("4"));
    await user.click(button("消す"));

    expect(boardSignature()).toEqual(before);
    expect(mistakesText()).toBe("間違い 0/3");
  });

  it("T-410: 「消す」で誤りの数字が消え、間違いの回数は減らない", async () => {
    const { user } = setup(freshGame());
    await resume(user);
    await selectCell(user, 3);
    await user.click(button("1"));
    expect(mistakesText()).toBe("間違い 1/3");

    await user.click(button("消す"));

    expect(cellAt(3)).toHaveAccessibleName("1 行 4 列、空欄");
    expect(mistakesText()).toBe("間違い 1/3");
  });

  it("T-410: 「メモ」を押すと aria-pressed が切り替わり、押している間の数字のボタンはメモになる", async () => {
    const { user } = setup(freshGame());
    await resume(user);
    await selectCell(user, 2);
    expect(button("メモ")).toHaveAttribute("aria-pressed", "false");

    await user.click(button("メモ"));
    expect(button("メモ")).toHaveAttribute("aria-pressed", "true");
    await user.click(button("1"));
    await user.click(button("5"));
    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、メモ 1 5");
    expect(mistakesText()).toBe("間違い 0/3");

    await user.click(button("メモ"));
    expect(button("メモ")).toHaveAttribute("aria-pressed", "false");
  });

  it("T-410: 保存したゲームの時間以外の内容(盤面、回数)は、入力のたびに保存される", async () => {
    const { user } = setup(freshGame());
    await resume(user);
    await selectCell(user, 2);

    await user.click(button("1"));

    const saved = savedGame()!;
    expect(saved.values[2]).toBe(1);
    expect(saved.mistakes).toBe(1);
    expect(saved.undoStack).toHaveLength(1);
  });
});

// 2026-11-03 に、本番のコードを壊しても通った箇所を確かめるために足した
describe("T-407・T-408: 一時停止中と終わったゲームの選択と表示", () => {
  it("T-408: 選んでから一時停止すると、どのマスも選ばれていない(読み上げに選んだマスを出さない)", async () => {
    const { user } = setup(richPlayingGame());
    await resume(user);
    await selectCell(user, 40);
    expect(cellAt(40)).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "一時停止" }));
    expect(
      allCells().filter((c) => c.getAttribute("aria-selected") === "true"),
    ).toHaveLength(0);
  });

  it("T-407: 一時停止中にマスを押しても選ばない(再開した後も未選択)", async () => {
    const { user } = setup(richPlayingGame());
    await selectCell(user, 40);
    await resume(user);
    expect(
      allCells().filter((c) => c.getAttribute("aria-selected") === "true"),
    ).toHaveLength(0);
  });

  it("T-407: クリアしたゲームは、読み込んだ後も盤面を隠さず、マスを押しても選ばず、一時停止のボタンは押せない", async () => {
    const { user } = setup(clearedGame());
    expect(screen.queryByText("一時停止中")).not.toBeInTheDocument();
    expect(cellAt(2)).toHaveAccessibleName("1 行 3 列、4");
    expect(cellAt(2)).toHaveAttribute("data-kind", "correct");

    await user.click(cellAt(40));
    expect(cellAt(40)).toHaveAttribute("aria-selected", "false");
    // ダイアログの外側は役割で引けないことがあるので、文字で引く
    expect(screen.getByText("一時停止", { selector: "button" })).toBeDisabled();
  });

  it("T-406: Ctrl+Alt+Z では元に戻さない", async () => {
    const { user } = setup(richPlayingGame());
    await resume(user);
    const before = boardSignature();
    await user.keyboard("{Control>}{Alt>}z{/Alt}{/Control}");
    expect(boardSignature()).toEqual(before);
    expect(savedGame()?.undoStack).toHaveLength(2);
  });
});

describe("T-408: hydration の間", () => {
  it("T-408: 保存したゲームがあれば、サーバーの HTML を hydrate する間にホームへ移さない", async () => {
    seedGame(richPlayingGame());
    const ui = (
      <GameProvider>
        <GameScreen />
      </GameProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(ui);
    document.body.append(container);

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, ui);
    });
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(81);
    expect(router.replace).not.toHaveBeenCalled();
    act(() => root?.unmount());
    container.remove();
  });
});

describe("T-407: 一時停止中は Tab で盤面に入らない", () => {
  it("T-407: 一時停止中に Tab を押していっても、盤面のマスにフォーカスが入らない(再開すると入る)", async () => {
    const { user } = setup(richPlayingGame());
    const focused: (string | null)[] = [];
    for (let i = 0; i < 6; i++) {
      await user.tab();
      focused.push(document.activeElement?.getAttribute("role") ?? null);
    }
    expect(focused).not.toContain("gridcell");

    await resume(user);
    (document.activeElement as HTMLElement | null)?.blur();
    const afterResume: (string | null)[] = [];
    for (let i = 0; i < 6; i++) {
      await user.tab();
      afterResume.push(document.activeElement?.getAttribute("role") ?? null);
    }
    expect(afterResume).toContain("gridcell");
  });
});

// ストアにゲームを始めさせてから、ゲーム画面を開く(ホームで問題を作り、/play に移るときと同じ順)
function StartThenOpen({ show, strict }: { show: boolean; strict: boolean }) {
  const tree = (
    <GameProvider>
      <StartGameControl game={freshGame("normal")} />
      <PausedText />
      {show && <GameScreen />}
    </GameProvider>
  );
  return strict ? <StrictMode>{tree}</StrictMode> : tree;
}

function PausedText() {
  const { paused } = useGameSnapshot();
  return <span data-testid="paused">{paused ? "paused" : "running"}</span>;
}

async function startThenOpen(strict: boolean) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const view = render(<StartThenOpen show={false} strict={strict} />);
  await user.click(screen.getByRole("button", { name: "テスト用ゲーム開始" }));
  view.rerender(<StartThenOpen show strict={strict} />);
  return { user, view };
}

describe("T-409: タブが隠れている間にゲームの画面を開く", () => {
  it("T-409: 始めたゲームの画面を、タブが隠れている間に開くと、一時停止になりタイマーが進まない", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    await startThenOpen(false);

    expect(screen.getByTestId("paused")).toHaveTextContent("paused");
    expect(screen.getByText("一時停止中")).toBeInTheDocument();
    advance(3000);
    expect(timerText()).toBe("00:00");
  });

  it("T-409: タブが見えている間に開くと、一時停止にならずタイマーが進む", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

    await startThenOpen(false);

    expect(screen.getByTestId("paused")).toHaveTextContent("running");
    advance(3000);
    expect(timerText()).toBe("00:03");
  });
});

describe("T-408: React の StrictMode(開発サーバー)でも同じに動く", () => {
  it("T-408: StrictMode でも、始めたゲームの画面を開くと一時停止にならず、タイマーが進む", async () => {
    await startThenOpen(true);

    expect(screen.getByTestId("paused")).toHaveTextContent("running");
    expect(screen.queryByText("一時停止中")).not.toBeInTheDocument();
    advance(2000);
    expect(timerText()).toBe("00:02");
  });

  it("T-408: StrictMode でも、保存したゲームを読み込んだ直後は一時停止のまま(付け直しで再開しない)", () => {
    seedGame(richPlayingGame());

    render(
      <StrictMode>
        <GameProvider>
          <PausedText />
          <GameScreen />
        </GameProvider>
      </StrictMode>,
    );

    expect(screen.getByTestId("paused")).toHaveTextContent("paused");
    expect(screen.getByText("一時停止中")).toBeInTheDocument();
  });

  it("T-408: StrictMode でも、画面を離れる(外す)と一時停止になる", async () => {
    const { view } = await startThenOpen(true);
    expect(screen.getByTestId("paused")).toHaveTextContent("running");

    view.rerender(<StartThenOpen show={false} strict />);

    expect(screen.getByTestId("paused")).toHaveTextContent("paused");
  });

  it.each([false, true])(
    "T-408: StrictMode が %s のとき、その場で失敗して「やり直す」を押すと、フォーカスが選んでいたマスに戻る",
    async (strict) => {
      seedGame({ ...freshGame(), mistakes: 2 });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const ui = (
        <GameProvider>
          <GameScreen />
        </GameProvider>
      );
      render(strict ? <StrictMode>{ui}</StrictMode> : ui);
      await resume(user);
      await selectCell(user, 2);
      await user.keyboard("1");
      expect(
        screen.getByRole("alertdialog", { name: "失敗しました" }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "やり直す" }));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(document.activeElement).toBe(cellAt(2));
      expect(cellAt(2)).toHaveAttribute("aria-selected", "true");
    },
  );
});

describe("T-418: 入れ終わった数字のボタンとキー", () => {
  // 4 のマスを、マス 2(解は 4)を除いて解のとおりに埋めた状態
  function eightFours(): GameState {
    const changes: Record<number, number> = {};
    freshGame().solution.forEach((v, i) => {
      if (v === 4 && i !== 2) changes[i] = 4;
    });
    return withValues(freshGame(), changes);
  }

  it("T-418: 9 か所目の 4 を入れると、4 のボタンが押せず灰色になり、ほかの数字は押せる", async () => {
    const { user } = setup(eightFours());
    await resume(user);
    expect(button("4")).toBeEnabled();

    await selectCell(user, 2);
    await user.click(button("4"));

    expect(button("4")).toBeDisabled();
    expect(button("4")).toHaveClass("bg-gray-200", "text-gray-400");
    expect(button("5")).toBeEnabled();
    expect(button("5")).not.toHaveClass("bg-gray-200");
  });

  it("T-418: 入れ終わった 4 のキーは、空欄に押しても何も入れず、回数も増えない", async () => {
    const { user } = setup(eightFours());
    await resume(user);
    await selectCell(user, 2);
    await user.keyboard("4");
    expect(button("4")).toBeDisabled();

    // マス 3(解は 6)に 4 を押す。入れば誤りで回数が増えるはず
    await selectCell(user, 3);
    await user.keyboard("4");

    expect(cellAt(3)).toHaveAccessibleName("1 行 4 列、空欄");
    expect(mistakesText()).toBe("間違い 0/3");
  });

  it("T-418: メモの状態でも、4 のボタンは押せず、4 のキーでメモが付かない", async () => {
    const { user } = setup(eightFours());
    await resume(user);
    await selectCell(user, 2);
    await user.click(button("4"));
    await user.click(button("メモ"));

    expect(button("4")).toBeDisabled();
    await selectCell(user, 3);
    await user.keyboard("4");
    await user.keyboard("5");

    expect(cellAt(3)).toHaveAccessibleName("1 行 4 列、メモ 5");
  });

  it("T-418: 読み込んだ時点で 9 か所そろっている数字も押せない。灰色は不透明で、一時停止中だけ薄くする", async () => {
    const { user } = setup(withValues(eightFours(), { 2: 4 }));
    // 読み込んだ直後は一時停止中
    expect(button("4")).toBeDisabled();
    expect(button("4")).toHaveClass("opacity-40");

    await resume(user);

    expect(button("4")).toBeDisabled();
    expect(button("4")).toHaveClass("bg-gray-200", "text-gray-400");
    // not.toHaveClass に複数を渡すと「すべてを持つ」の否定になるので、1 つずつ確かめる
    expect(button("4")).not.toHaveClass("opacity-40");
    expect(button("4")).not.toHaveClass("disabled:opacity-40");
    // ほかの押せない状態(一時停止中など)の薄さは、入れ終わっていないボタンに残る
    expect(button("5")).toHaveClass("disabled:opacity-40");
  });

  it("T-418: 失敗の後の「やり直す」で入力が初めに戻ると、4 のボタンがまた押せる", async () => {
    const { user } = setup(eightFours());
    await resume(user);
    await selectCell(user, 2);
    await user.click(button("4"));
    expect(button("4")).toBeDisabled();

    // マス 3(解は 6)に誤りを 3 回入れて失敗にする
    await selectCell(user, 3);
    await user.keyboard("1");
    await user.keyboard("2");
    await user.keyboard("3");
    await user.click(screen.getByRole("button", { name: "やり直す" }));

    expect(button("4")).toBeEnabled();
  });

  it("T-418: 元に戻して 8 か所に減ると、4 のボタンがまた押せる", async () => {
    const { user } = setup(eightFours());
    await resume(user);
    await selectCell(user, 2);
    await user.click(button("4"));
    expect(button("4")).toBeDisabled();

    await user.click(button("元に戻す"));

    expect(button("4")).toBeEnabled();
    expect(button("4")).not.toHaveClass("bg-gray-200");
  });
});
