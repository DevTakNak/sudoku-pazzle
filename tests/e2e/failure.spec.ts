import { expect, test } from "@playwright/test";

import {
  Player,
  cellLabel,
  expectStatsRow,
  mistakesLocator,
  readLabels,
  readPuzzleAndSolution,
  startNewGame,
  timerSeconds,
} from "./support";

test("T-502: 間違いを 3 回入れて失敗し、「やり直す」で同じ問題が初めの状態に戻り、「新しいゲーム」でホームに戻る", async ({
  page,
  hasTouch,
}) => {
  const player = new Player(page, hasTouch);
  await page.goto("/");
  await startNewGame(page, "かんたん");

  const initialLabels = await readLabels(page);
  const { cells, solution } = await readPuzzleAndSolution(page);
  const blanks = cells.filter((c) => c.kind === "empty").map((c) => c.index);

  // 間違いを 1 回、2 回と入れる。誤りの数字は「誤り」と読み上げられ、回数が増える
  await mistakesLocator(page, 0).waitFor();
  await player.enterWrong(blanks[0]!, solution);
  await expect(mistakesLocator(page, 1)).toBeVisible();
  await expect(player.cell(blanks[0]!)).toHaveAttribute(
    "aria-label",
    cellLabel(blanks[0]!, `${(solution[blanks[0]!]! % 9) + 1}、誤り`),
  );
  await player.enterWrong(blanks[1]!, solution);
  await expect(mistakesLocator(page, 2)).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  // 3 回目の前に、時間が進んでいることを確かめる(「やり直す」で戻ることを確かめるため)
  await expect.poll(() => timerSeconds(page)).toBeGreaterThanOrEqual(2);
  const secondsBeforeFailure = await timerSeconds(page);
  await player.enterWrong(blanks[2]!, solution);

  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("失敗しました");
  await expect(dialog).toContainText("間違いが 3 回になりました。");

  // 「やり直す」で、同じ問題が初めの状態に戻る
  await dialog.getByRole("button", { name: "やり直す", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(mistakesLocator(page, 0)).toBeVisible();
  expect(await readLabels(page)).toEqual(initialLabels);
  await expect
    .poll(() => timerSeconds(page))
    .toBeLessThan(secondsBeforeFailure);
  // 履歴も初めに戻っている
  await expect(player.button("元に戻す")).toBeDisabled();
  await expect(player.button("やり直し")).toBeDisabled();

  // 同じ問題でもう一度失敗し、「新しいゲーム」でホームに戻る
  await player.enterWrong(blanks[3]!, solution);
  await player.enterWrong(blanks[4]!, solution);
  await player.enterWrong(blanks[5]!, solution);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("失敗しました");
  await dialog
    .getByRole("button", { name: "新しいゲーム", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "新しいゲーム", exact: true }),
  ).toBeVisible();
  // 失敗したゲームは「続きから」に出ない
  await expect(page.getByRole("button", { name: /^続きから/ })).toHaveCount(0);

  // 失敗は 1 回のゲームごとに 1 回ずつ、2 回と数える(「やり直す」で戻したことも別のゲーム)
  await page.getByRole("link", { name: "成績", exact: true }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expectStatsRow(page, "かんたん", ["0", "2", "0%", "-"]);
  await expectStatsRow(page, "ふつう", ["0", "0", "-", "-"]);
  await expectStatsRow(page, "むずかしい", ["0", "0", "-", "-"]);
});
