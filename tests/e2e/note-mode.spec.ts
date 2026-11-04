import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

import { freshGame } from "../helpers/game";
import { GAME_KEY, seedStorage } from "./support";

// 画面での位置と大きさ(見つからなければテストを止める)
async function boxOf(target: Locator) {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("T-510: メモの状態に切り替えても盤面が動かず、「メモ入力中」が盤面の真上の中央に出て、薄い黄色の背景が画面の下まで広がる", async ({
  page,
}) => {
  await seedStorage(page, { [GAME_KEY]: JSON.stringify(freshGame()) });
  await page.goto("/play");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "再開", exact: true }).first().click();
  await expect(page.getByText("一時停止中", { exact: true })).toHaveCount(0);

  const grid = page.getByRole("grid", { name: "数独の盤面", exact: true });
  const before = await boxOf(grid);

  await page.keyboard.press("m");
  const status = main.getByText("メモ入力中", { exact: true });
  await expect(status).toBeVisible();

  // 文言の行の高さは取っておくので、盤面は動かない
  const after = await boxOf(grid);
  expect(after.y).toBe(before.y);
  expect(after.x).toBe(before.x);

  // 文言は盤面の上にあり、中央が盤面の中央とそろう。
  // 要素(行)の幅ではなく、文字の並んだ範囲で測る(中央寄せかどうかは行の幅には出ないため)
  const text = await status.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  expect(text.width).toBeGreaterThan(0);
  expect(text.y + text.height).toBeLessThanOrEqual(after.y);
  expect(
    Math.abs(text.x + text.width / 2 - (after.x + after.width / 2)),
  ).toBeLessThanOrEqual(1);

  // 背景は薄い黄色(Tailwind の bg-yellow-100 が CSS に入っている)で、画面の下まで広がる
  const color = await main.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(color).not.toBe("rgba(0, 0, 0, 0)");
  const viewport = page.viewportSize()!;
  const mainBox = await boxOf(main);
  expect(mainBox.y + mainBox.height).toBeGreaterThanOrEqual(
    viewport.height - 1,
  );

  // PC の幅(768px 以上)では、右の操作のボタンの上端が盤面の上端とそろう
  if (viewport.width >= 768) {
    const undo = await boxOf(
      main.getByRole("button", { name: "元に戻す", exact: true }),
    );
    expect(Math.abs(undo.y - after.y)).toBeLessThanOrEqual(1);
  }

  // 数字の状態に戻すと、見える文言は消え、背景も元に戻り、盤面は動かない
  await page.keyboard.press("m");
  await expect(status).toHaveCount(0);
  const back = await boxOf(grid);
  expect(back.y).toBe(before.y);
  expect(
    await main.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe(color);
});
