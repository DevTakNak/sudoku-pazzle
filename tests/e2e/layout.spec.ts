import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  BLANK_A,
  BLANK_B,
  clearedGame,
  failedGame,
  freshGame,
  withNotes,
  withValues,
} from "../helpers/game";
import type { GameState, SavedStats } from "@/lib/game/types";
import {
  GAME_KEY,
  STATS_KEY,
  expectNoHorizontalOverflow,
  seedStorage,
} from "./support";

const NARROW = 320;

// 幅が最も広くなる文言(1 時間以上の時間、3 桁のクリア数)にした、進行中のゲームと成績
function playingGame(): GameState {
  const game = withNotes(withValues(freshGame("hard"), { [BLANK_B]: 1 }), {
    [BLANK_A]: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  });
  return { ...game, elapsedSeconds: 5025, mistakes: 1 };
}

const STATS: SavedStats = {
  easy: { cleared: 123, failed: 45, bestSeconds: 5025 },
  normal: { cleared: 7, failed: 100, bestSeconds: 3599 },
  hard: { cleared: 1, failed: 0, bestSeconds: 36000 },
};

async function seed(page: Page, game: GameState | null): Promise<void> {
  const items: Record<string, string> = { [STATS_KEY]: JSON.stringify(STATS) };
  if (game !== null) items[GAME_KEY] = JSON.stringify(game);
  await seedStorage(page, items);
}

async function expectInsideViewport(
  target: Locator,
  width: number,
): Promise<void> {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
}

test.describe("T-505: 幅 320px で横にはみ出さない", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: NARROW, height: 640 });
  });

  test("T-505: ホーム(続きあり)と、上書きの確認のダイアログ", async ({
    page,
  }) => {
    await seed(page, playingGame());
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "続きから(むずかしい・1:23:45)" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, NARROW);

    await page.getByRole("button", { name: "かんたん", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("新しいゲームを始めますか?");
    await expectNoHorizontalOverflow(page, NARROW);
    await expectInsideViewport(dialog, NARROW);
  });

  test("T-505: ホーム(続きなし)", async ({ page }) => {
    await seed(page, null);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "むずかしい", exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, NARROW);
  });

  test("T-505: 成績", async ({ page }) => {
    await seed(page, null);
    await page.goto("/stats");
    await expect(
      page.getByRole("rowheader", { name: "むずかしい", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "10:00:00" })).toBeVisible();
    await expectNoHorizontalOverflow(page, NARROW);
  });

  test("T-505: ゲーム(一時停止中と、再開後)", async ({ page }) => {
    await seed(page, playingGame());
    await page.goto("/play");
    await expect(page.getByText("一時停止中", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page, NARROW);
    const grid = page.getByRole("grid", { name: "数独の盤面" });
    await expectInsideViewport(grid, NARROW);

    await page
      .getByRole("main")
      .getByRole("button", { name: "再開", exact: true })
      .first()
      .click();
    await expect(page.getByText("一時停止中", { exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page, NARROW);
    await expectInsideViewport(grid, NARROW);
  });

  test("T-505: ゲーム(失敗のダイアログ)", async ({ page }) => {
    await seed(page, failedGame());
    await page.goto("/play");
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("失敗しました");
    await expectNoHorizontalOverflow(page, NARROW);
    await expectInsideViewport(dialog, NARROW);
  });

  test("T-505: ゲーム(クリアのダイアログ)", async ({ page }) => {
    await seed(page, clearedGame());
    await page.goto("/play");
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("クリア!");
    await expectNoHorizontalOverflow(page, NARROW);
    await expectInsideViewport(dialog, NARROW);
  });
});

test("T-505: 数字のボタンが、幅 320px で 5 列と 4 列、480px で 9 列、768px で 3×3 に並ぶ", async ({
  page,
}) => {
  await seed(page, playingGame());
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/play");
  await expect(page.getByRole("grid", { name: "数独の盤面" })).toBeVisible();

  // 9 つのボタンの位置を、行(y)ごとにまとめ、行ごとの個数を返す
  async function rowsOfDigitButtons(): Promise<{
    perRow: number[];
    columns: number;
  }> {
    const points: { x: number; y: number }[] = [];
    for (let digit = 1; digit <= 9; digit++) {
      const box = await page
        .getByRole("button", { name: String(digit), exact: true })
        .boundingBox();
      expect(box).not.toBeNull();
      points.push({ x: Math.round(box!.x), y: Math.round(box!.y) });
    }
    const ys = [...new Set(points.map((p) => p.y))].sort((a, b) => a - b);
    const xs = new Set(points.map((p) => p.x));
    return {
      perRow: ys.map((y) => points.filter((p) => p.y === y).length),
      columns: xs.size,
    };
  }

  // 幅 320px: 5 列と 4 列の 2 段
  expect(await rowsOfDigitButtons()).toEqual({ perRow: [5, 4], columns: 5 });

  // 幅 480px: 9 列の 1 段
  await page.setViewportSize({ width: 480, height: 800 });
  await expect.poll(rowsOfDigitButtons).toEqual({ perRow: [9], columns: 9 });

  // 幅 768px: 3×3
  await page.setViewportSize({ width: 768, height: 1000 });
  await expect
    .poll(rowsOfDigitButtons)
    .toEqual({ perRow: [3, 3, 3], columns: 3 });

  // 幅 479px(480px 未満)は 5 列と 4 列、幅 767px(768px 未満)は 9 列
  await page.setViewportSize({ width: 479, height: 800 });
  await expect.poll(rowsOfDigitButtons).toEqual({ perRow: [5, 4], columns: 5 });
  await page.setViewportSize({ width: 767, height: 800 });
  await expect.poll(rowsOfDigitButtons).toEqual({ perRow: [9], columns: 9 });
});

test("T-508: ページの HTML に noindex が入っている(ホーム、ゲーム、成績)", async ({
  request,
}) => {
  for (const path of ["/", "/play", "/stats"]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    const html = await response.text();
    const robots = /<meta name="robots" content="([^"]*)"/.exec(html);
    expect(robots, `${path} に robots のタグがある`).not.toBeNull();
    expect(robots![1]).toContain("noindex");
    expect(robots![1]).toContain("nofollow");
  }
});
