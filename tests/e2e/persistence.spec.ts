import { expect, test } from "@playwright/test";

import { freshGame } from "../helpers/game";
import {
  GAME_KEY,
  Player,
  SAVE_NOTICE,
  STATS_KEY,
  cellLabel,
  expectStatsRow,
  mistakesLocator,
  readLabels,
  readPuzzleAndSolution,
  seedStorage,
  startNewGame,
  openDigits,
  timerSeconds,
  wrongDigit,
} from "./support";

const TIME_PATTERN = /タイム\s*(\d+(?::\d{2}){1,2})/;

test.describe("T-503: 再読み込みの後", () => {
  test("T-503: 途中で再読み込みすると、盤面、メモ、回数、時間が戻り、一時停止から再開できる", async ({
    page,
    hasTouch,
  }) => {
    const player = new Player(page, hasTouch);
    await page.goto("/");
    await startNewGame(page, "かんたん");
    const { cells, puzzle, solution } = await readPuzzleAndSolution(page);
    const blanks = cells.filter((c) => c.kind === "empty").map((c) => c.index);
    const [correctCell, wrongCell, noteCell, otherCell] = blanks as [
      number,
      number,
      number,
      number,
    ];
    // 正解を入れた後の盤面で、入れ終わっていない数字を選ぶ
    const values = puzzle.map((v, i) => (i === correctCell ? solution[i]! : v));
    const wrong = wrongDigit(wrongCell, solution, values);
    const [note1, note2] = openDigits(solution, values) as [number, number];

    // 正解を 1 つ、誤りを 1 つ、メモを 2 つ入れる
    await player.enterByButtons(correctCell, solution[correctCell]!);
    await player.enterByButtons(wrongCell, wrong);
    await expect(mistakesLocator(page, 1)).toBeVisible();
    await player.press(player.button("メモ"));
    await player.enterByButtons(noteCell, note1);
    await player.enterByButtons(noteCell, note2);
    await expect(player.cell(noteCell)).toHaveAttribute(
      "aria-label",
      cellLabel(noteCell, `メモ ${note1} ${note2}`),
    );
    await expect.poll(() => timerSeconds(page)).toBeGreaterThanOrEqual(2);
    const secondsBefore = await timerSeconds(page);
    const labelsBefore = await readLabels(page);

    await page.reload();

    // 再読み込みの後は一時停止から始まる。回数と時間は保存した値
    await expect(page.getByText("一時停止中", { exact: true })).toBeVisible();
    await expect(mistakesLocator(page, 1)).toBeVisible();
    expect(await timerSeconds(page)).toBeGreaterThanOrEqual(secondsBefore);
    expect(await timerSeconds(page)).toBeLessThanOrEqual(secondsBefore + 3);

    // 再開すると、盤面とメモが入力したときのまま戻る
    await page
      .getByRole("main")
      .getByRole("button", { name: "再開", exact: true })
      .first()
      .click();
    await expect(page.getByText("一時停止中", { exact: true })).toHaveCount(0);
    expect(await readLabels(page)).toEqual(labelsBefore);
    await expect(player.cell(correctCell)).toHaveAttribute(
      "aria-label",
      cellLabel(correctCell, `${solution[correctCell]}`),
    );
    await expect(player.cell(wrongCell)).toHaveAttribute(
      "aria-label",
      cellLabel(wrongCell, `${wrong}、誤り`),
    );
    await expect(player.cell(noteCell)).toHaveAttribute(
      "aria-label",
      cellLabel(noteCell, `メモ ${note1} ${note2}`),
    );
    // 手を付けていないマスは空欄のまま
    await expect(player.cell(otherCell)).toHaveAttribute(
      "aria-label",
      cellLabel(otherCell, "空欄"),
    );
    // 履歴も戻っているので、元に戻せる(メモの入力を戻す)
    await player.press(player.button("元に戻す"));
    await expect(player.cell(noteCell)).toHaveAttribute(
      "aria-label",
      cellLabel(noteCell, `メモ ${note1}`),
    );
    // 間違いの回数は、元に戻しても減らない
    await expect(mistakesLocator(page, 1)).toBeVisible();
  });

  test("T-503: クリアの後に再読み込みしても、同じダイアログが出て、成績は 1 回のまま", async ({
    page,
    hasTouch,
  }) => {
    const player = new Player(page, hasTouch);
    await page.goto("/");
    await startNewGame(page, "かんたん");
    const { cells, solution } = await readPuzzleAndSolution(page);
    await player.fillCorrect(cells, solution);

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("クリア!");
    const time = TIME_PATTERN.exec(await dialog.innerText())?.[1];
    expect(time).toBeDefined();
    const labelsBefore = await readLabels(page);

    // 再読み込みしても、クリアのダイアログが同じ内容で出る(ベストタイムの更新は、その場だけ)
    await page.reload();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("クリア!");
    await expect(dialog).toContainText("かんたんをクリアしました。");
    expect(TIME_PATTERN.exec(await dialog.innerText())?.[1]).toBe(time);
    await expect(dialog).not.toContainText("ベストタイムを更新しました!");
    expect(await readLabels(page)).toEqual(labelsBefore);

    // もう一度再読み込みしても、成績は 1 回のまま
    await page.reload();
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "成績を見る", exact: true })
      .click();
    await expect(page).toHaveURL(/\/stats$/);
    await expectStatsRow(page, "かんたん", ["1", "0", "100%", time!]);
    await expectStatsRow(page, "ふつう", ["0", "0", "-", "-"]);
    await expectStatsRow(page, "むずかしい", ["0", "0", "-", "-"]);

    // 成績の画面で再読み込みしても変わらない
    await page.reload();
    await expectStatsRow(page, "かんたん", ["1", "0", "100%", time!]);
  });

  test("T-503: 失敗の後に再読み込みしても、同じダイアログが出て、成績は 1 回のまま", async ({
    page,
    hasTouch,
  }) => {
    const player = new Player(page, hasTouch);
    await page.goto("/");
    await startNewGame(page, "かんたん");
    const { cells, puzzle, solution } = await readPuzzleAndSolution(page);
    const blanks = cells.filter((c) => c.kind === "empty").map((c) => c.index);
    for (const index of blanks.slice(0, 3)) {
      await player.enterWrong(index, solution, puzzle);
    }
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("失敗しました");

    await page.reload();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("失敗しました");
    await expect(dialog).toContainText("間違いが 3 回になりました。");
    await page.reload();
    await expect(dialog).toBeVisible();

    await dialog
      .getByRole("button", { name: "新しいゲーム", exact: true })
      .click();
    await expect(page).toHaveURL("/");
    await page.getByRole("link", { name: "成績", exact: true }).click();
    await expectStatsRow(page, "かんたん", ["0", "1", "0%", "-"]);
    await expectStatsRow(page, "ふつう", ["0", "0", "-", "-"]);
    await expectStatsRow(page, "むずかしい", ["0", "0", "-", "-"]);
  });
});

test.describe("T-507: 保存の値が無い・壊れているとき", () => {
  test("T-507: 保存したゲームなしで /play を開くと / に移る", async ({
    page,
  }) => {
    await page.goto("/play");
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "数独パズル", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "かんたん", exact: true }),
    ).toBeEnabled();
    await expect(page.getByRole("button", { name: /^続きから/ })).toHaveCount(
      0,
    );
    // 保存できる環境なので、保存できない知らせは出ない
    await expect(page.getByText(SAVE_NOTICE)).toHaveCount(0);
  });

  // 保存のキーごとの壊れた値(src/lib/CLAUDE.md の「読み込みの検証」)
  const brokenGame = JSON.stringify({ ...freshGame("easy"), status: "failed" });
  const cases: { name: string; game: string; stats: string }[] = [
    { name: "JSON でない", game: "{これは JSON ではない", stats: "<<<" },
    {
      name: "形が違う",
      game: JSON.stringify({ difficulty: "easy" }),
      stats: JSON.stringify({ easy: { cleared: "1" } }),
    },
    {
      // 失敗なのに回数が 0 のゲーム、クリアが 0 回なのにベストタイムがある成績
      name: "中身が食い違う",
      game: brokenGame,
      stats: JSON.stringify({
        easy: { cleared: 0, failed: 0, bestSeconds: 30 },
        normal: { cleared: 0, failed: 0, bestSeconds: null },
        hard: { cleared: 0, failed: 0, bestSeconds: null },
      }),
    },
  ];

  for (const { name, game, stats } of cases) {
    test(`T-507: ゲームと成績が${name}値でも、ホーム・成績・ゲームの画面が動き、新しいゲームを始めて続きから遊べる`, async ({
      page,
      hasTouch,
    }) => {
      const player = new Player(page, hasTouch);
      await seedStorage(page, { [GAME_KEY]: game, [STATS_KEY]: stats });

      // ホーム: 続きは出ず、新しいゲームを始められる
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "数独パズル", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "かんたん", exact: true }),
      ).toBeEnabled();
      await expect(page.getByRole("button", { name: /^続きから/ })).toHaveCount(
        0,
      );
      await expect(page.getByText(SAVE_NOTICE)).toHaveCount(0);

      // 成績: 壊れた値は捨てて、0 回と表示する
      await page.getByRole("link", { name: "成績", exact: true }).click();
      await expectStatsRow(page, "かんたん", ["0", "0", "-", "-"]);
      await expectStatsRow(page, "ふつう", ["0", "0", "-", "-"]);
      await expectStatsRow(page, "むずかしい", ["0", "0", "-", "-"]);

      // ゲーム: 保存したゲームが無いので、ホームに移る
      await page.goto("/play");
      await expect(page).toHaveURL("/");

      // 新しいゲームを始めて、入力し、再読み込みの後に続きから遊べる
      await startNewGame(page, "かんたん");
      const { cells, solution } = await readPuzzleAndSolution(page);
      const target = cells.find((c) => c.kind === "empty")!.index;
      await player.enterByButtons(target, solution[target]!);
      const label = cellLabel(target, `${solution[target]}`);
      await expect(player.cell(target)).toHaveAttribute("aria-label", label);

      await page.reload();
      await page
        .getByRole("main")
        .getByRole("button", { name: "再開", exact: true })
        .first()
        .click();
      await expect(player.cell(target)).toHaveAttribute("aria-label", label);
    });
  }
});

test.describe("T-509: localStorage を参照すると例外が出るブラウザ", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("denied", "SecurityError");
        },
      });
    });
  });

  test("T-509: ホーム、ゲーム、成績の各画面に保存できない知らせが出て、クリアまで遊べ、成績がメモリに残る", async ({
    page,
    hasTouch,
  }) => {
    const player = new Player(page, hasTouch);
    const notice = page.getByText(SAVE_NOTICE);

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "数独パズル", exact: true }),
    ).toBeVisible();
    await expect(notice).toBeVisible();

    await startNewGame(page, "かんたん");
    await expect(notice).toBeVisible();

    // 入力でき、盤面に反映される
    const { cells, solution } = await readPuzzleAndSolution(page);
    const first = cells.find((c) => c.kind === "empty")!.index;
    await player.enterByButtons(first, solution[first]!);
    await expect(player.cell(first)).toHaveAttribute(
      "aria-label",
      cellLabel(first, `${solution[first]}`),
    );

    // 最後まで入れてクリアできる
    await player.fillCorrect(cells, solution);
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("クリア!");

    // 成績は、保存できなくても、このページを開いている間はメモリで数える
    await dialog
      .getByRole("button", { name: "成績を見る", exact: true })
      .click();
    await expect(page).toHaveURL(/\/stats$/);
    await expect(notice).toBeVisible();
    await expectStatsRow(page, "かんたん", [
      "1",
      "0",
      "100%",
      /^(\d+:)?\d{2}:\d{2}$/,
    ]);
    await expectStatsRow(page, "ふつう", ["0", "0", "-", "-"]);

    await page.getByRole("link", { name: "ホーム", exact: true }).click();
    await expect(page).toHaveURL("/");
    await expect(notice).toBeVisible();
  });

  test("T-509: 途中でホームに戻ると、メモリの状態から続きから遊べる", async ({
    page,
    hasTouch,
  }) => {
    const player = new Player(page, hasTouch);
    await page.goto("/");
    await startNewGame(page, "かんたん");
    const { cells, solution } = await readPuzzleAndSolution(page);
    const target = cells.find((c) => c.kind === "empty")!.index;
    await player.enterByButtons(target, solution[target]!);

    await page.getByRole("link", { name: "ホーム", exact: true }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByText(SAVE_NOTICE)).toBeVisible();
    await page.getByRole("button", { name: /^続きから\(かんたん・/ }).click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByText(SAVE_NOTICE)).toBeVisible();
    await page
      .getByRole("main")
      .getByRole("button", { name: "再開", exact: true })
      .first()
      .click();
    await expect(player.cell(target)).toHaveAttribute(
      "aria-label",
      cellLabel(target, `${solution[target]}`),
    );
  });

  test("T-509: ページを直接開いても、成績とゲームの画面に知らせが出る", async ({
    page,
  }) => {
    await page.goto("/stats");
    await expect(
      page.getByRole("heading", { name: "成績", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(SAVE_NOTICE)).toBeVisible();
    await expectStatsRow(page, "かんたん", ["0", "0", "-", "-"]);

    // 保存したゲームが無いので、ホームに移る。知らせは出たまま
    await page.goto("/play");
    await expect(page).toHaveURL("/");
    await expect(page.getByText(SAVE_NOTICE)).toBeVisible();
  });
});
