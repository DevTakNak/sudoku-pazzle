import { expect, test } from "@playwright/test";

import { BLANK_A, freshGame, withNotes } from "../helpers/game";
import { GAME_KEY, seedStorage } from "./support";

// 画面の幅ごとの、メモの数字の文字の大きさ(スマホは今のまま、PC の幅だけ大きくする)
const SIZES = [
  { width: 375, fontSize: "8px" },
  { width: 700, fontSize: "10px" },
  { width: 768, fontSize: "14px" },
  { width: 1470, fontSize: "14px" },
];

test("T-511: メモの数字は、幅 768px 以上で 14px、それより狭い幅では今の大きさで、どの幅でも少し濃い灰色(gray-600)になる", async ({
  page,
}) => {
  await seedStorage(page, {
    [GAME_KEY]: JSON.stringify(
      withNotes(freshGame(), { [BLANK_A]: [1, 2, 3, 4, 5, 6, 7, 8, 9] }),
    ),
  });
  await page.goto("/play");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "再開", exact: true }).first().click();
  await expect(page.getByText("一時停止中", { exact: true })).toHaveCount(0);

  // マス 2(1 行 3 列)のメモの、1 の数字
  const cell = page.getByRole("gridcell", {
    name: "1 行 3 列、メモ 1 2 3 4 5 6 7 8 9",
  });
  const one = cell.locator('[aria-hidden="true"] > span').first();
  await expect(one).toHaveText("1");

  // 比べる色: Tailwind の text-gray-600 を付けた要素の色
  const gray600 = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.className = "text-gray-600";
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  // text-gray-600 の CSS が無いと、本文の色を受け継いで比べられないので、先に確かめる
  const bodyColor = await page.evaluate(
    () => getComputedStyle(document.body).color,
  );
  expect(gray600).not.toBe(bodyColor);

  for (const { width, fontSize } of SIZES) {
    await page.setViewportSize({ width, height: 900 });
    const style = await one.evaluate((el) => {
      const s = getComputedStyle(el);
      return { fontSize: s.fontSize, color: s.color };
    });
    expect(style.fontSize, `幅 ${width}px の大きさ`).toBe(fontSize);
    expect(style.color, `幅 ${width}px の色`).toBe(gray600);
  }

  // 14px の 9 つの数字が、1 マスの中に重ならずに収まる(PC の幅)
  await page.setViewportSize({ width: 768, height: 900 });
  const box = await cell.boundingBox();
  const digits = cell.locator('[aria-hidden="true"] > span');
  for (let i = 0; i < 9; i++) {
    const d = await digits.nth(i).boundingBox();
    expect(d).not.toBeNull();
    expect(d!.x).toBeGreaterThanOrEqual(box!.x);
    expect(d!.x + d!.width).toBeLessThanOrEqual(box!.x + box!.width);
    expect(d!.y).toBeGreaterThanOrEqual(box!.y);
    expect(d!.y + d!.height).toBeLessThanOrEqual(box!.y + box!.height);
  }
});
