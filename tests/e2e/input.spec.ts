import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  Player,
  cellLabel,
  mistakesLocator,
  readPuzzleAndSolution,
  openDigits,
  startNewGame,
  wrongDigit,
} from "./support";

// 盤面を操作する方法。PC はキーボードだけ、スマホは画面のボタンだけで同じ操作をする
interface Input {
  select(index: number): Promise<void>;
  digit(digit: number): Promise<void>;
  erase(): Promise<void>;
  toggleNote(): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
}

function keyboardInput(
  page: Page,
  player: Player,
  selected: number | null = null,
): Input {
  let position = selected;
  const press = (key: string) => page.keyboard.press(key);
  return {
    // 矢印のキーでマスを動かす。未選択のときは、最初の矢印で左上を選ぶ
    async select(index) {
      if (position === null) {
        await press("ArrowUp");
        position = 0;
      }
      const down = Math.floor(index / 9) - Math.floor(position / 9);
      const right = (index % 9) - (position % 9);
      for (let i = 0; i < Math.abs(down); i++) {
        await press(down > 0 ? "ArrowDown" : "ArrowUp");
      }
      for (let i = 0; i < Math.abs(right); i++) {
        await press(right > 0 ? "ArrowRight" : "ArrowLeft");
      }
      position = index;
      await expect(player.cell(index)).toHaveAttribute("aria-selected", "true");
    },
    digit: (digit) => press(String(digit)),
    erase: () => press("Backspace"),
    toggleNote: () => press("m"),
    undo: () => press("Control+z"),
    redo: () => press("Control+Shift+z"),
  };
}

function buttonInput(player: Player): Input {
  return {
    async select(index) {
      await player.press(player.cell(index));
      await expect(player.cell(index)).toHaveAttribute("aria-selected", "true");
    },
    digit: (digit) => player.press(player.button(String(digit))),
    erase: () => player.press(player.button("消す")),
    toggleNote: () => player.press(player.button("メモ")),
    undo: () => player.press(player.button("元に戻す")),
    redo: () => player.press(player.button("やり直し")),
  };
}

// 数字、誤り、消す、メモ、元に戻す、やり直し、最後まで入れてクリア
async function playThrough(
  page: Page,
  player: Player,
  input: Input,
): Promise<void> {
  await page.goto("/");
  await startNewGame(page, "かんたん");
  const { cells, puzzle, solution } = await readPuzzleAndSolution(page);
  const blanks = cells.filter((c) => c.kind === "empty").map((c) => c.index);
  const clue = cells.find((c) => c.kind === "clue")!;
  const [a, b, c] = blanks as [number, number, number];
  const noteButton = page.getByRole("button", { name: "メモ", exact: true });

  // 正解の数字を入れる
  await input.select(a);
  await input.digit(solution[a]!);
  await expect(player.cell(a)).toHaveAttribute(
    "aria-label",
    cellLabel(a, `${solution[a]}`),
  );
  await expect(mistakesLocator(page, 0)).toBeVisible();

  // 誤りの数字を入れると、誤りと読み上げられて回数が増え、消すと空欄に戻る(回数は減らない)
  // 正解を入れた後の盤面で、入れ終わっていない数字を選ぶ
  const values = puzzle.map((v, i) => (i === a ? solution[i]! : v));
  const wrong = wrongDigit(b, solution, values);
  const [note1, note2] = openDigits(solution, values) as [number, number];
  await input.select(b);
  await input.digit(wrong);
  await expect(player.cell(b)).toHaveAttribute(
    "aria-label",
    cellLabel(b, `${wrong}、誤り`),
  );
  await expect(mistakesLocator(page, 1)).toBeVisible();
  await input.erase();
  await expect(player.cell(b)).toHaveAttribute(
    "aria-label",
    cellLabel(b, "空欄"),
  );
  await expect(mistakesLocator(page, 1)).toBeVisible();

  // 手がかりのマスには入れられない
  await input.select(clue.index);
  await input.digit(wrongDigit(clue.index, solution, values));
  await expect(player.cell(clue.index)).toHaveAttribute(
    "aria-label",
    cellLabel(clue.index, `${clue.value}、手がかり`),
  );
  await expect(mistakesLocator(page, 1)).toBeVisible();

  // メモの状態にして、メモを付け外しする。メモでは回数が増えない
  await expect(noteButton).toHaveAttribute("aria-pressed", "false");
  await input.toggleNote();
  await expect(noteButton).toHaveAttribute("aria-pressed", "true");
  await input.select(c);
  await input.digit(note1);
  await input.digit(note2);
  await expect(player.cell(c)).toHaveAttribute(
    "aria-label",
    cellLabel(c, `メモ ${note1} ${note2}`),
  );
  await input.digit(note1);
  await expect(player.cell(c)).toHaveAttribute(
    "aria-label",
    cellLabel(c, `メモ ${note2}`),
  );
  await expect(mistakesLocator(page, 1)).toBeVisible();

  // 元に戻す・やり直し
  await input.undo();
  await expect(player.cell(c)).toHaveAttribute(
    "aria-label",
    cellLabel(c, `メモ ${note1} ${note2}`),
  );
  await input.redo();
  await expect(player.cell(c)).toHaveAttribute(
    "aria-label",
    cellLabel(c, `メモ ${note2}`),
  );
  await expect(mistakesLocator(page, 1)).toBeVisible();

  // メモの状態を戻して、最後まで入れる
  await input.toggleNote();
  await expect(noteButton).toHaveAttribute("aria-pressed", "false");
  for (const index of blanks.slice(1)) {
    await input.select(index);
    await input.digit(solution[index]!);
  }
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("クリア!");
  await expect(dialog).toContainText(/間違い\s*1 回/);
}

test.describe("T-504: キーボードだけ(PC)", () => {
  test.skip(({ isMobile }) => isMobile, "キーボードだけの操作は PC だけ");

  test("T-504: 矢印、数字、Backspace、M、Ctrl+Z だけで入力し、最後まで遊べる", async ({
    page,
    hasTouch,
  }) => {
    const player = new Player(page, hasTouch);
    await playThrough(page, player, keyboardInput(page, player));
  });

  test("T-504: 矢印は端で止まり、Delete で消せて、Ctrl+Y と Ctrl+Shift+Z でやり直せる", async ({
    page,
    hasTouch,
  }) => {
    const player = new Player(page, hasTouch);
    await page.goto("/");
    await startNewGame(page, "かんたん");
    const { cells, solution } = await readPuzzleAndSolution(page);
    const target = cells.find((c) => c.kind === "empty")!.index;
    const digit = solution[target]!;

    // 未選択のとき、矢印で左上を選ぶ。左上から上・左へは動かない
    await page.keyboard.press("ArrowLeft");
    await expect(player.cell(0)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowLeft");
    await expect(player.cell(0)).toHaveAttribute("aria-selected", "true");
    // 右下から下・右へは動かない
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowDown");
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
    await expect(player.cell(80)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await expect(player.cell(80)).toHaveAttribute("aria-selected", "true");
    await expect(player.cell(0)).toHaveAttribute("aria-selected", "false");

    // 入力、Delete で消す、Ctrl+Z で戻す、Ctrl+Y でやり直す、Ctrl+Z の後に Ctrl+Shift+Z でやり直す
    const input = keyboardInput(page, player, 80);
    await input.select(target);
    await page.keyboard.press(String(digit));
    const filled = cellLabel(target, `${digit}`);
    const empty = cellLabel(target, "空欄");
    await expect(player.cell(target)).toHaveAttribute("aria-label", filled);
    await page.keyboard.press("Delete");
    // 正解のマスは消せない
    await expect(player.cell(target)).toHaveAttribute("aria-label", filled);
    await page.keyboard.press("Control+z");
    await expect(player.cell(target)).toHaveAttribute("aria-label", empty);
    await page.keyboard.press("Control+y");
    await expect(player.cell(target)).toHaveAttribute("aria-label", filled);
    await page.keyboard.press("Control+z");
    await expect(player.cell(target)).toHaveAttribute("aria-label", empty);
    await page.keyboard.press("Control+Shift+z");
    await expect(player.cell(target)).toHaveAttribute("aria-label", filled);
  });
});

test.describe("T-504: 画面のボタンだけ(スマホ)", () => {
  test.skip(({ isMobile }) => !isMobile, "ボタンだけの操作はスマホだけ");

  test("T-504: マスと数字・消す・メモ・元に戻す・やり直しのボタンをタップするだけで入力し、最後まで遊べる", async ({
    page,
    hasTouch,
  }) => {
    expect(hasTouch).toBe(true);
    const player = new Player(page, hasTouch);
    await playThrough(page, player, buttonInput(player));
  });
});
