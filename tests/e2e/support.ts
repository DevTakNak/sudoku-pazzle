// E2E の補助関数。画面に出た盤面(マスの読み上げの名前)を読み、解く処理で解を求めて操作する。
// 本番のコード(src/)は読み込まない(保存のキーも、仕様書 src/lib/CLAUDE.md の値を書き写す)
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

// 保存のキー(src/lib/CLAUDE.md の「保存(localStorage)」)
export const GAME_KEY = "sudoku:v1:game";
export const STATS_KEY = "sudoku:v1:stats";

export const SAVE_NOTICE =
  "この端末では保存できません。ページを閉じると、ゲームと成績は残りません。";

export type DifficultyLabel = "かんたん" | "ふつう" | "むずかしい";

// ---- 盤面を読む ----

export interface CellInfo {
  index: number;
  kind: "clue" | "correct" | "wrong" | "empty";
  value: number; // 空欄は 0
  notes: number[];
}

function position(index: number): string {
  return `${Math.floor(index / 9) + 1} 行 ${(index % 9) + 1} 列`;
}

// 読み上げの名前(画面仕様書の「盤面」)を読む。
// 「2 行 3 列、空欄」「…、5、手がかり」「…、5」「…、5、誤り」「…、メモ 1 2 5」
export function parseLabel(index: number, label: string): CellInfo {
  const prefix = `${position(index)}、`;
  if (!label.startsWith(prefix)) {
    throw new Error(`マス ${index} の名前が想定と違う: ${label}`);
  }
  const rest = label.slice(prefix.length);
  if (rest === "空欄") return { index, kind: "empty", value: 0, notes: [] };
  const memo = /^メモ ([1-9](?: [1-9])*)$/.exec(rest);
  if (memo) {
    return {
      index,
      kind: "empty",
      value: 0,
      notes: memo[1]!.split(" ").map(Number),
    };
  }
  const digit = /^([1-9])(、手がかり|、誤り)?$/.exec(rest);
  if (!digit) throw new Error(`マス ${index} の名前が読めない: ${label}`);
  const kind =
    digit[2] === "、手がかり"
      ? "clue"
      : digit[2] === "、誤り"
        ? "wrong"
        : "correct";
  return { index, kind, value: Number(digit[1]), notes: [] };
}

export function cellLabel(index: number, suffix: string): string {
  return `${position(index)}、${suffix}`;
}

// ダイアログが開いていると盤面は aria-hidden になるので、隠れた要素も読む
export async function readLabels(page: Page): Promise<string[]> {
  const labels = await page
    .getByRole("gridcell", { includeHidden: true })
    .evaluateAll((cells) => cells.map((c) => c.getAttribute("aria-label")));
  expect(labels).toHaveLength(81);
  return labels.map((l, i) => {
    if (l === null) throw new Error(`マス ${i} に名前が無い`);
    return l;
  });
}

export async function readCells(page: Page): Promise<CellInfo[]> {
  const labels = await readLabels(page);
  return labels.map((label, i) => parseLabel(i, label));
}

// 手がかりだけの盤面(入力した数字は含めない)
export function puzzleOf(cells: readonly CellInfo[]): number[] {
  return cells.map((c) => (c.kind === "clue" ? c.value : 0));
}

export function clueCount(cells: readonly CellInfo[]): number {
  return cells.filter((c) => c.kind === "clue").length;
}

// ---- 解く(本番の解く処理とは別に書く。画面の盤面から解を求めるため) ----

export function solve(puzzle: readonly number[]): {
  count: number;
  solution: number[] | null;
} {
  const cells = [...puzzle];
  let count = 0;
  let solution: number[] | null = null;

  const used = (i: number): Set<number> => {
    const row = Math.floor(i / 9);
    const col = i % 9;
    const s = new Set<number>();
    for (let k = 0; k < 81; k++) {
      const r = Math.floor(k / 9);
      const c = k % 9;
      const sameBox =
        Math.floor(r / 3) === Math.floor(row / 3) &&
        Math.floor(c / 3) === Math.floor(col / 3);
      if (k !== i && (r === row || c === col || sameBox) && cells[k] !== 0) {
        s.add(cells[k]!);
      }
    }
    return s;
  };

  const search = (): void => {
    let best = -1;
    let bestCandidates: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (cells[i] !== 0) continue;
      const u = used(i);
      const candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !u.has(d));
      if (best === -1 || candidates.length < bestCandidates.length) {
        best = i;
        bestCandidates = candidates;
        if (candidates.length <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      solution ??= [...cells];
      return;
    }
    for (const d of bestCandidates) {
      cells[best] = d;
      search();
      if (count >= 2) break;
    }
    cells[best] = 0;
  };

  search();
  return { count, solution };
}

// ---- 画面の操作 ----

// 盤面を読んで解を求める。解が 1 つだけであることも確かめる(R-02)
export async function readPuzzleAndSolution(page: Page): Promise<{
  cells: CellInfo[];
  puzzle: number[];
  solution: number[];
}> {
  const cells = await readCells(page);
  const puzzle = puzzleOf(cells);
  const solved = solve(puzzle);
  expect(solved.count).toBe(1);
  return { cells, puzzle, solution: solved.solution! };
}

// タイマー(ゲームの画面の、「mm:ss」か「h:mm:ss」だけの文字)
export function timerLocator(page: Page): Locator {
  return page.getByRole("main").getByText(/^(\d+:)?\d{2}:\d{2}$/);
}

export function toSeconds(text: string): number {
  return text.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

export async function timerSeconds(page: Page): Promise<number> {
  return toSeconds((await timerLocator(page).innerText()).trim());
}

export function mistakesLocator(page: Page, count: number): Locator {
  return page.getByText(`間違い ${count}/3`, { exact: true });
}

// ホームで難易度を選び、問題ができて /play に移り、盤面が出るまで待つ
export async function startNewGame(
  page: Page,
  difficulty: DifficultyLabel,
  timeoutMs = 20_000,
): Promise<void> {
  await page.getByRole("button", { name: difficulty, exact: true }).click();
  await expect(page).toHaveURL(/\/play$/, { timeout: timeoutMs });
  await expect(
    page.getByRole("grid", { name: "数独の盤面", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(81);
}

// 画面の操作の道具。スマホ(タッチ)ではタップ、PC ではクリックで押す
export class Player {
  constructor(
    readonly page: Page,
    private readonly touch: boolean,
  ) {}

  cell(index: number): Locator {
    return this.page.getByRole("gridcell").nth(index);
  }

  button(name: string): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  async press(target: Locator): Promise<void> {
    if (this.touch) await target.tap();
    else await target.click();
  }

  // マスを選び、数字のボタンで入力する
  async enterByButtons(index: number, digit: number): Promise<void> {
    await this.press(this.cell(index));
    await this.press(this.button(String(digit)));
  }

  // 空欄のマスに、解のとおりの数字を入れる(最後の 1 マスを残せるように、入れない数を指定できる)
  async fillCorrect(
    cells: readonly CellInfo[],
    solution: readonly number[],
    skipLast = 0,
  ): Promise<number[]> {
    const blanks = cells.filter((c) => c.kind === "empty").map((c) => c.index);
    const targets = blanks.slice(0, blanks.length - skipLast);
    for (const index of targets) {
      await this.enterByButtons(index, solution[index]!);
    }
    return blanks.slice(blanks.length - skipLast);
  }

  // 解と違う数字(解の次の数字)を入れる
  async enterWrong(index: number, solution: readonly number[]): Promise<void> {
    await this.enterByButtons(index, (solution[index]! % 9) + 1);
  }
}

// ---- 保存を用意する ----

// ページを開く前に localStorage に値を入れる。再読み込みでは入れ直さない
// (sessionStorage に印を付けるので、画面の操作で変わった保存を上書きしない)
export async function seedStorage(
  page: Page,
  items: Record<string, string>,
): Promise<void> {
  await page.addInitScript((entries: Record<string, string>) => {
    if (window.sessionStorage.getItem("e2e-seeded") !== null) return;
    window.sessionStorage.setItem("e2e-seeded", "1");
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(key, value);
    }
  }, items);
}

// 成績の表の 1 行(列は クリア / 失敗 / クリア率 / ベストタイム)を確かめる
export async function expectStatsRow(
  page: Page,
  difficulty: DifficultyLabel,
  expected: [string, string, string, string | RegExp],
): Promise<void> {
  const row = page.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: difficulty, exact: true }),
  });
  await expect(row.getByRole("cell")).toHaveText(expected);
}

// 横にはみ出していない(ページの幅が画面の幅に収まる)
export async function expectNoHorizontalOverflow(
  page: Page,
  width: number,
): Promise<void> {
  const sizes = await page.evaluate(() => ({
    inner: window.innerWidth,
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(sizes.inner).toBe(width);
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
}
