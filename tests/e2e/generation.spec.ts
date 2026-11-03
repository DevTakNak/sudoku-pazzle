import { expect, test } from "@playwright/test";

import { Player, readPuzzleAndSolution, startNewGame } from "./support";

// ページの中で 10 ミリ秒ごとに動く見張り。問題を作っている間(「問題を作っています…」が出ている間)の
// 様子を覚える。メインスレッドが止まると、見張りの間隔が空き、見張りの数も減る
interface Probe {
  last: number;
  ticksWhileGenerating: number;
  maxGapWhileGenerating: number;
  disabledButtonsWhileGenerating: number;
  enabledButtonsWhileGenerating: number;
}

interface ProbeWindow {
  __probe?: Probe;
}

test("T-506: むずかしいの問題を作っている間も、画面が止まらずボタンが押せない表示になり、コンソールにエラーが出ない", async ({
  page,
  hasTouch,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  // 問題を作る処理が Web Worker で動く(生成が速くて見張りの間隔に表れない回も、Worker の起動で確かめる)
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));

  await page.addInitScript(() => {
    const probe: Probe = {
      last: performance.now(),
      ticksWhileGenerating: 0,
      maxGapWhileGenerating: 0,
      disabledButtonsWhileGenerating: 0,
      enabledButtonsWhileGenerating: 0,
    };
    (window as unknown as ProbeWindow).__probe = probe;
    setInterval(() => {
      const now = performance.now();
      const gap = now - probe.last;
      probe.last = now;
      if (!document.body.innerText.includes("問題を作っています…")) return;
      probe.ticksWhileGenerating += 1;
      probe.maxGapWhileGenerating = Math.max(probe.maxGapWhileGenerating, gap);
      const levelButtons = [...document.querySelectorAll("main button")].filter(
        (b) =>
          ["かんたん", "ふつう", "むずかしい"].includes(b.textContent ?? ""),
      );
      probe.disabledButtonsWhileGenerating = Math.max(
        probe.disabledButtonsWhileGenerating,
        levelButtons.filter((b) => (b as HTMLButtonElement).disabled).length,
      );
      probe.enabledButtonsWhileGenerating = Math.max(
        probe.enabledButtonsWhileGenerating,
        levelButtons.filter((b) => !(b as HTMLButtonElement).disabled).length,
      );
    }, 10);
  });

  const player = new Player(page, hasTouch);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "むずかしい", exact: true }),
  ).toBeEnabled();

  // 問題を作る(画面は再読み込みしないので、見張りは続く)
  await startNewGame(page, "むずかしい", 30_000);

  const probe = await page.evaluate(
    () => (window as unknown as ProbeWindow).__probe!,
  );
  // 作っている間に「問題を作っています…」が出て、3 つの難易度のボタンがすべて押せない表示だった
  expect(probe.ticksWhileGenerating).toBeGreaterThan(0);
  expect(probe.disabledButtonsWhileGenerating).toBe(3);
  expect(probe.enabledButtonsWhileGenerating).toBe(0);
  // メインスレッドが止まらない(見張りの間隔が、10 ミリ秒の間隔に比べて大きく空かない。
  // 画面の中で問題を作ると、作る時間の分だけ間隔が空く)
  expect(probe.maxGapWhileGenerating).toBeLessThan(300);
  expect(workers).toHaveLength(1);

  // 作った問題で遊べる
  const { cells, solution } = await readPuzzleAndSolution(page);
  const target = cells.find((c) => c.kind === "empty")!.index;
  await player.enterByButtons(target, solution[target]!);
  await expect(player.cell(target)).toHaveAttribute(
    "aria-label",
    `${Math.floor(target / 9) + 1} 行 ${(target % 9) + 1} 列、${solution[target]}`,
  );
  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: "成績", exact: true }).click();
  await expect(page).toHaveURL(/\/stats$/);

  expect(errors).toEqual([]);
});
