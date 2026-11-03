// @vitest-environment jsdom
// ホーム画面(T-401〜T-403)
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameProvider } from "@/components/game-provider";
import { HomeScreen } from "@/components/home-screen";
import type { GameState } from "@/lib/game/types";
import { GAME_KEY } from "@/lib/storage/storage";
import type { Difficulty } from "@/lib/sudoku/grid";

import { clearedGame, failedGame, freshGame } from "../../helpers/game";
import { UNIQUE_PUZZLE, UNIQUE_SOLUTION } from "../../helpers/grid";
import {
  installFakeWorker,
  isStorePaused,
  renderScreen,
  savedGame,
  seedGame,
} from "../../helpers/screen";
import type { FakeWorker } from "../../helpers/screen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const LABELS: Record<Difficulty, string> = {
  easy: "かんたん",
  normal: "ふつう",
  hard: "むずかしい",
};

let workers: FakeWorker[] = [];

beforeEach(() => {
  window.localStorage.clear();
  router.push.mockClear();
  router.replace.mockClear();
  workers = installFakeWorker();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const user = userEvent.setup();
  renderScreen(<HomeScreen />);
  return { user };
}

function playing(difficulty: Difficulty, elapsedSeconds: number): GameState {
  return { ...freshGame(difficulty), elapsedSeconds };
}

function requestsSent() {
  return workers.flatMap((w) => w.messages);
}

// 進行中のゲームを置いて、難易度を押し、確認の「始める」まで進める
async function startOverExistingGame(
  user: ReturnType<typeof userEvent.setup>,
  difficulty: Difficulty,
) {
  seedGame(freshGame("easy"));
  renderScreen(<HomeScreen />);
  await user.click(screen.getByRole("button", { name: LABELS[difficulty] }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "始める" }));
}

describe("T-401: ホームの表示と「続きから」", () => {
  it("T-401: 保存したゲームが無いとき、見出し・難易度のボタン・成績のリンクが出て、「続きから」は出ない", () => {
    setup();

    expect(
      screen.getByRole("heading", { level: 1, name: "数独パズル" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "新しいゲーム" }),
    ).toBeInTheDocument();
    for (const label of Object.values(LABELS)) {
      expect(screen.getByRole("button", { name: label })).toBeEnabled();
    }
    expect(screen.getByRole("link", { name: "成績" })).toHaveAttribute(
      "href",
      "/stats",
    );
    expect(
      screen.queryByRole("button", { name: /続きから/ }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["easy", 754, "かんたん・12:34"],
    ["normal", 3725, "ふつう・1:02:05"],
    ["hard", 0, "むずかしい・00:00"],
  ] as const)(
    "T-401: 進行中の %s のゲーム(%i 秒)があると「続きから(%s)」を出す",
    (difficulty, elapsedSeconds, text) => {
      seedGame(playing(difficulty, elapsedSeconds));
      setup();

      expect(
        screen.getByRole("button", { name: `続きから(${text})` }),
      ).toBeEnabled();
    },
  );

  it.each([
    ["クリアしたゲーム", clearedGame()],
    ["失敗したゲーム", failedGame()],
  ])("T-401: %s では「続きから」を出さない", (_label, game) => {
    seedGame(game);
    setup();

    expect(
      screen.queryByRole("button", { name: /続きから/ }),
    ).not.toBeInTheDocument();
    // 難易度のボタンは使える
    expect(screen.getByRole("button", { name: "かんたん" })).toBeEnabled();
  });

  it("T-401: 保存した値が壊れているとき、画面は動き、「続きから」は出ない", () => {
    window.localStorage.setItem(GAME_KEY, "{ not json");
    setup();

    expect(
      screen.getByRole("heading", { name: "新しいゲーム" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /続きから/ }),
    ).not.toBeInTheDocument();
  });

  it("T-401: 「続きから」を押すと /play へ移る", async () => {
    seedGame(playing("easy", 754));
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "続きから(かんたん・12:34)" }),
    );

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/play");
    expect(workers).toHaveLength(0);
  });

  it("T-401: サーバーの描画では保存を読まず、「読み込み中…」を出す", () => {
    seedGame(playing("easy", 754));

    const html = renderToString(
      <GameProvider>
        <HomeScreen />
      </GameProvider>,
    );

    expect(html).toContain("読み込み中…");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("続きから");
  });
});

describe("T-402: 進行中のゲームがあるときの確認", () => {
  it("T-402: 進行中のゲームがあると、難易度を押しても作り始めず、確認を出す", async () => {
    seedGame(freshGame("easy"));
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "ふつう" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("新しいゲームを始めますか?"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "進行中のゲームは消え、成績にも記録されません。",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "キャンセル" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "始める" }),
    ).toBeInTheDocument();
    expect(requestsSent()).toHaveLength(0);
    expect(screen.queryByText("問題を作っています…")).not.toBeInTheDocument();
  });

  it("T-402: 「キャンセル」で確認が閉じ、何も作らず、ゲームも残る", async () => {
    const existing = playing("easy", 754);
    seedGame(existing);
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "むずかしい" }));
    const dialog = await screen.findByRole("alertdialog");

    await user.click(
      within(dialog).getByRole("button", { name: "キャンセル" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(requestsSent()).toHaveLength(0);
    expect(screen.queryByText("問題を作っています…")).not.toBeInTheDocument();
    expect(savedGame()).toEqual(existing);
    expect(
      screen.getByRole("button", { name: "続きから(かんたん・12:34)" }),
    ).toBeEnabled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each(["easy", "normal", "hard"] as const)(
    "T-402: 「始める」で、押した難易度(%s)の問題を作り始め、確認は閉じる",
    async (difficulty) => {
      const user = userEvent.setup();
      await startOverExistingGame(user, difficulty);

      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      const requests = requestsSent();
      expect(requests).toHaveLength(1);
      expect(requests[0]).toEqual({
        requestId: 0,
        difficulty,
        seed: expect.any(Number),
      });
      const seed = requests[0]!.seed;
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
      expect(screen.getByText("問題を作っています…")).toBeInTheDocument();
    },
  );

  it("T-402: 「始める」を押しても、問題ができるまでは進行中のゲームを消さない", async () => {
    const user = userEvent.setup();
    await startOverExistingGame(user, "hard");

    expect(savedGame()).toEqual(freshGame("easy"));
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each<[string, GameState | null]>([
    ["保存したゲームが無いとき", null],
    ["クリアしたゲームのとき", clearedGame()],
    ["失敗したゲームのとき", failedGame()],
  ])("T-402: %s、確認を出さずに作り始める", async (_label, game) => {
    if (game !== null) seedGame(game);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "ふつう" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(requestsSent()).toHaveLength(1);
    expect(requestsSent()[0]).toMatchObject({
      requestId: 0,
      difficulty: "normal",
    });
  });
});

describe("T-403: 問題を作っている間と、作れなかったとき", () => {
  it("T-403: 作っている間は「問題を作っています…」を出し、続きからと難易度のボタンは押せない", async () => {
    seedGame(playing("easy", 754));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "ふつう" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "始める",
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "問題を作っています…",
      ),
    );
    expect(
      screen.getByRole("button", { name: "続きから(かんたん・12:34)" }),
    ).toBeDisabled();
    for (const label of Object.values(LABELS)) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
  });

  it("T-403: 作っている間に難易度のボタンを押しても、要求を重ねて送らない", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "かんたん" }));
    expect(requestsSent()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "むずかしい" }));
    await user.click(screen.getByRole("button", { name: "かんたん" }));

    expect(requestsSent()).toHaveLength(1);
  });

  it.each(["timeout", "invalid-request", "error"] as const)(
    "T-403: 失敗の応答(%s)で、失敗のダイアログ(文言と 2 つのボタン)を出し、作っている表示は消える",
    async (reason) => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "かんたん" }));

      workers[0]!.respondFailure(reason);

      const dialog = await screen.findByRole("alertdialog");
      expect(
        within(dialog).getByText("問題を作れませんでした"),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText("もう一度お試しください。"),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", { name: "閉じる" }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", { name: "もう一度試す" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("問題を作っています…")).not.toBeInTheDocument();
      expect(router.push).not.toHaveBeenCalled();
    },
  );

  it("T-403: Worker のエラーでも、失敗のダイアログを出す", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "かんたん" }));

    workers[0]!.emitError();

    expect(
      within(await screen.findByRole("alertdialog")).getByText(
        "問題を作れませんでした",
      ),
    ).toBeInTheDocument();
  });

  it("T-403: 失敗のあと「もう一度試す」を押すと、同じ難易度の要求がもう一度送られる", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "むずかしい" }));
    workers[0]!.respondFailure("timeout");
    const dialog = await screen.findByRole("alertdialog");

    await user.click(
      within(dialog).getByRole("button", { name: "もう一度試す" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    const requests = requestsSent();
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ requestId: 0, difficulty: "hard" });
    expect(requests[1]).toMatchObject({ requestId: 1, difficulty: "hard" });
    expect(screen.getByText("問題を作っています…")).toBeInTheDocument();
  });

  it("T-403: Worker のエラーのあと「もう一度試す」を押しても、同じ難易度の要求が送られる", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "ふつう" }));
    workers[0]!.emitError();
    const dialog = await screen.findByRole("alertdialog");

    await user.click(
      within(dialog).getByRole("button", { name: "もう一度試す" }),
    );

    await waitFor(() => expect(requestsSent()).toHaveLength(2));
    expect(requestsSent()[1]).toMatchObject({ difficulty: "normal" });
  });

  it("T-403: 失敗のあと「閉じる」を押すと、ダイアログが閉じ、新しい要求は送られず、ボタンがまた押せる", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "かんたん" }));
    workers[0]!.respondFailure("error");
    const dialog = await screen.findByRole("alertdialog");

    await user.click(within(dialog).getByRole("button", { name: "閉じる" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(requestsSent()).toHaveLength(1);
    expect(screen.queryByText("問題を作っています…")).not.toBeInTheDocument();
    for (const label of Object.values(LABELS)) {
      expect(screen.getByRole("button", { name: label })).toBeEnabled();
    }
  });

  it("T-403: 失敗しても、保存してある進行中のゲームは残る", async () => {
    const existing = playing("easy", 754);
    seedGame(existing);
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "ふつう" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "始める",
      }),
    );

    workers[0]!.respondFailure("timeout");
    await screen.findByRole("alertdialog");

    expect(savedGame()).toEqual(existing);
  });

  it("T-403: 問題ができたら、初めの状態のゲームを保存して /play へ移り、一時停止にはしない", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "ふつう" }));

    workers[0]!.respondOk("normal", UNIQUE_PUZZLE, UNIQUE_SOLUTION);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play"));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(savedGame()).toEqual(freshGame("normal"));
    expect(isStorePaused()).toBe(false);
  });
});

// 2026-11-03 に、本番のコードを壊しても通った箇所を確かめるために足した
describe("T-402・T-403: ホームのダイアログの Esc", () => {
  it("T-402: 上書きの確認は Esc で閉じ、要求を送らず、ゲームも残る", async () => {
    const user = userEvent.setup();
    seedGame(freshGame("easy"));
    renderScreen(<HomeScreen />);
    await user.click(screen.getByRole("button", { name: "ふつう" }));
    await screen.findByRole("alertdialog");

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(requestsSent()).toHaveLength(0);
    expect(savedGame()?.difficulty).toBe("easy");
  });

  it("T-403: 作れなかったときのダイアログは Esc で閉じ、ボタンがまた押せる", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "かんたん" }));
    workers[0]!.respondFailure("timeout");
    await screen.findByRole("alertdialog", { name: "問題を作れませんでした" });

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "かんたん" })).toBeEnabled();
  });
});
