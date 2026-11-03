import { expect, test } from "@playwright/test";

import {
  Player,
  clueCount,
  expectStatsRow,
  readLabels,
  readPuzzleAndSolution,
  startNewGame,
} from "./support";
import type { DifficultyLabel } from "./support";

// 手がかりの数の範囲(src/lib/CLAUDE.md の G-11〜G-13)
const CLUE_RANGES: { label: DifficultyLabel; min: number; max: number }[] = [
  { label: "かんたん", min: 38, max: 45 },
  { label: "ふつう", min: 30, max: 37 },
  { label: "むずかしい", min: 24, max: 29 },
];

const TIME_PATTERN = /^(\d+:)?\d{2}:\d{2}$/;

test("T-501: かんたんの問題を最後まで入れてクリアし、成績のクリア数が 1 になる", async ({
  page,
  hasTouch,
}) => {
  const player = new Player(page, hasTouch);

  // 初めは、どの難易度も 0 回
  await page.goto("/stats");
  await expectStatsRow(page, "かんたん", ["0", "0", "-", "-"]);
  await expectStatsRow(page, "ふつう", ["0", "0", "-", "-"]);
  await expectStatsRow(page, "むずかしい", ["0", "0", "-", "-"]);

  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: /^続きから/ })).toHaveCount(0);
  await startNewGame(page, "かんたん");

  // 画面に出た盤面から、問題と解を求める
  const { cells, puzzle, solution } = await readPuzzleAndSolution(page);
  expect(clueCount(cells)).toBeGreaterThanOrEqual(38);
  expect(clueCount(cells)).toBeLessThanOrEqual(45);
  await expect(page.getByText("かんたん", { exact: true })).toBeVisible();
  await expect(page.getByText("間違い 0/3", { exact: true })).toBeVisible();

  // 最後の 1 マスを残して入れる。まだクリアにならない
  const [last] = await player.fillCorrect(cells, solution, 1);
  expect(last).toBeDefined();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByText("間違い 0/3", { exact: true })).toBeVisible();

  // 最後のマスを入れるとクリア
  await player.enterByButtons(last!, solution[last!]!);
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("クリア!");
  await expect(dialog).toContainText("かんたんをクリアしました。");
  await expect(dialog).toContainText(/間違い\s*0 回/);
  const text = await dialog.innerText();
  const time = /タイム\s*(\d+(?::\d{2}){1,2})/.exec(text)?.[1];
  expect(time).toMatch(TIME_PATTERN);
  expect(/ベストタイム\s*(\d+(?::\d{2}){1,2})/.exec(text)?.[1]).toBe(time);
  await expect(dialog).toContainText("ベストタイムを更新しました!");

  // 盤面は、手がかりのまま、残りが解のとおりになっている
  const labels = await readLabels(page);
  labels.forEach((label, i) => {
    const row = Math.floor(i / 9) + 1;
    const col = (i % 9) + 1;
    const suffix =
      puzzle[i] !== 0 ? `${puzzle[i]}、手がかり` : `${solution[i]}`;
    expect(label).toBe(`${row} 行 ${col} 列、${suffix}`);
  });

  // 成績に反映される。ほかの難易度は変わらない
  await dialog.getByRole("button", { name: "成績を見る", exact: true }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expectStatsRow(page, "かんたん", ["1", "0", "100%", time!]);
  await expectStatsRow(page, "ふつう", ["0", "0", "-", "-"]);
  await expectStatsRow(page, "むずかしい", ["0", "0", "-", "-"]);

  // クリアしたゲームは「続きから」に出ない
  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: "かんたん", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^続きから/ })).toHaveCount(0);
});

for (const { label, min, max } of CLUE_RANGES) {
  test(`T-501: ${label}を選ぶと、${label}の問題ができ、手がかりが ${min}〜${max} 個で解が 1 つだけになる`, async ({
    page,
  }) => {
    await page.goto("/");
    await startNewGame(page, label, 30_000);

    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText("間違い 0/3", { exact: true })).toBeVisible();
    const { cells } = await readPuzzleAndSolution(page);
    expect(clueCount(cells)).toBeGreaterThanOrEqual(min);
    expect(clueCount(cells)).toBeLessThanOrEqual(max);
    // 初めは、手がかり以外が空欄
    expect(
      cells.filter((c) => c.kind !== "clue" && c.kind !== "empty"),
    ).toEqual([]);
  });
}
