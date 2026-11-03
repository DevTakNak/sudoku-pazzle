// 画面のコンポーネントのテストに使う補助関数。
// 保存の値を入れる、Provider つきで描画する、Web Worker の偽物、盤面の読み取り。
// 本番のコードに引きずられないよう、期待する値の計算は本番のコードを使わずに書く
import { act, render, screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { vi } from "vitest";

import {
  GameProvider,
  useGameSnapshot,
  useGameStore,
} from "@/components/game-provider";
import type { GameState, SavedStats } from "@/lib/game/types";
import type {
  GenerateRequest,
  GenerateResponse,
} from "@/lib/sudoku/generator-messages";
import { GAME_KEY, STATS_KEY } from "@/lib/storage/storage";
import type { Difficulty, Grid } from "@/lib/sudoku/grid";

import { UNIQUE_PUZZLE, UNIQUE_SOLUTION } from "./grid";

export type User = ReturnType<typeof userEvent.setup>;

// ---- 保存の値 ----

export function seedGame(game: GameState): void {
  window.localStorage.setItem(GAME_KEY, JSON.stringify(game));
}

export function seedStats(stats: SavedStats): void {
  window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

// localStorage に保存されている値(JSON を読み戻したもの)。無ければ null
export function savedGame(): GameState | null {
  const text = window.localStorage.getItem(GAME_KEY);
  return text === null ? null : (JSON.parse(text) as GameState);
}

export function savedStats(): SavedStats | null {
  const text = window.localStorage.getItem(STATS_KEY);
  return text === null ? null : (JSON.parse(text) as SavedStats);
}

// ---- 描画 ----

// 画面の外から、ストアの「一時停止」を読むための目印(見えない)
function PausedProbe() {
  const { paused } = useGameSnapshot();
  return (
    <span hidden data-testid="paused-probe">
      {paused ? "paused" : "running"}
    </span>
  );
}

function Tree({ screenElement }: { screenElement: ReactNode }) {
  return (
    <GameProvider>
      <PausedProbe />
      {screenElement}
    </GameProvider>
  );
}

export interface ScreenRender extends RenderResult {
  // 画面だけを外す(Provider とストアは残す)。画面を離れたときの動きを確かめる
  removeScreen: () => void;
  // 同じ Provider とストアのまま、画面を描画し直す(ほかの画面へ移って戻ったときの動きを確かめる)
  showScreen: (ui: ReactNode) => void;
}

// <GameProvider><画面 /></GameProvider> で描画する
export function renderScreen(ui: ReactNode): ScreenRender {
  const result = render(<Tree screenElement={ui} />);
  return {
    ...result,
    removeScreen: () => result.rerender(<Tree screenElement={null} />),
    showScreen: (next) => result.rerender(<Tree screenElement={next} />),
  };
}

// 押すと、ストアにゲームを始めさせるボタン(生成して始めたときの動きを、画面だけで確かめるため)
export function StartGameControl({ game }: { game: GameState }) {
  const store = useGameStore();
  return (
    <button type="button" onClick={() => store.startGame(game)}>
      テスト用ゲーム開始
    </button>
  );
}

// ストアの「一時停止」の値
export function isStorePaused(): boolean {
  return screen.getByTestId("paused-probe").textContent === "paused";
}

// ---- Web Worker の偽物(jsdom に Worker は無い) ----

export class FakeWorker extends EventTarget {
  readonly url: string;
  readonly options: WorkerOptions | undefined;
  readonly messages: GenerateRequest[] = [];
  terminateCount = 0;

  constructor(url: string | URL = "", options?: WorkerOptions) {
    super();
    this.url = String(url);
    this.options = options;
  }

  get terminated(): boolean {
    return this.terminateCount > 0;
  }

  postMessage(data: GenerateRequest): void {
    this.messages.push(data);
  }

  terminate(): void {
    this.terminateCount += 1;
  }

  // 任意の応答を、画面の側に届ける
  respond(data: GenerateResponse): void {
    act(() => {
      this.dispatchEvent(new MessageEvent("message", { data }));
    });
  }

  // 最後に送られた要求の番号に合わせて、成功の応答を返す
  respondOk(
    difficulty: Difficulty,
    puzzle: Grid = UNIQUE_PUZZLE,
    solution: Grid = UNIQUE_SOLUTION,
  ): void {
    const requestId = this.lastRequestId();
    act(() => {
      this.dispatchEvent(
        new MessageEvent("message", {
          data: { requestId, ok: true, difficulty, puzzle, solution },
        }),
      );
    });
  }

  // 最後に送られた要求の番号に合わせて、失敗の応答を返す
  respondFailure(reason: "timeout" | "invalid-request" | "error"): void {
    const requestId = this.lastRequestId();
    act(() => {
      this.dispatchEvent(
        new MessageEvent("message", {
          data: { requestId, ok: false, reason },
        }),
      );
    });
  }

  // 応答ではなく、Worker 自体のエラー
  emitError(): void {
    act(() => {
      this.dispatchEvent(new Event("error"));
    });
  }

  lastRequestId(): number {
    const last = this.messages.at(-1);
    if (last === undefined) throw new Error("要求がまだ送られていない");
    return last.requestId;
  }
}

// グローバルの Worker を偽物に差し替える。作られた Worker を順に入れた配列を返す。
// 片付け(vi.unstubAllGlobals)はテスト側の afterEach で行う
export function installFakeWorker(): FakeWorker[] {
  const instances: FakeWorker[] = [];
  class InstalledWorker extends FakeWorker {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options);
      instances.push(this);
    }
  }
  vi.stubGlobal("Worker", InstalledWorker);
  return instances;
}

// ---- 盤面の読み取り ----

// ダイアログが開いていると、ほかの要素に aria-hidden が付くことがあるため、
// 盤面の読み取りは hidden: true で行う
export function allCells(): HTMLElement[] {
  return screen.getAllByRole("gridcell", { hidden: true });
}

export function cellAt(index: number): HTMLElement {
  const cell = allCells()[index];
  if (cell === undefined) throw new Error(`マス ${index} が無い`);
  return cell;
}

// 選んでいるマスの番号(無ければ null)
export function selectedIndex(): number | null {
  const indices = allCells()
    .map((cell, i) => (cell.getAttribute("aria-selected") === "true" ? i : -1))
    .filter((i) => i >= 0);
  if (indices.length > 1) {
    throw new Error(`選んだマスが複数ある: ${indices.join(",")}`);
  }
  return indices[0] ?? null;
}

// 全マスの data-highlight(81 要素)
export function highlights(): (string | null)[] {
  return allCells().map((cell) => cell.getAttribute("data-highlight"));
}

// 全マスの data-kind(81 要素)
export function kinds(): (string | null)[] {
  return allCells().map((cell) => cell.getAttribute("data-kind"));
}

export type Highlight = "selected" | "error" | "same-digit" | "related";

// 強調ごとのマスの番号から、81 要素の期待値を作る(書いていないマスは none)
export function expectedHighlights(
  byKind: Partial<Record<Highlight, readonly number[]>>,
): string[] {
  const result = Array.from({ length: 81 }, () => "none");
  for (const [kind, indices] of Object.entries(byKind)) {
    for (const i of indices) {
      if (result[i] !== "none") {
        throw new Error(`マス ${i} が 2 つの強調に入っている`);
      }
      result[i] = kind;
    }
  }
  return result;
}

// 同じ行・列・ブロックにあるほかの 20 マス(本番のコードとは別に、行・列の計算で書く)
export function peersOf(index: number): number[] {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const peers: number[] = [];
  for (let i = 0; i < 81; i++) {
    if (i === index) continue;
    const r = Math.floor(i / 9);
    const c = i % 9;
    const sameBox =
      Math.floor(r / 3) === Math.floor(row / 3) &&
      Math.floor(c / 3) === Math.floor(col / 3);
    if (r === row || c === col || sameBox) peers.push(i);
  }
  return peers;
}

// ---- ゲーム画面の操作 ----

// 読み込んだ直後は一時停止なので、再開する(ヘッダーの「再開」を押す)
export async function resume(user: User): Promise<void> {
  const buttons = screen.getAllByRole("button", { name: "再開" });
  await user.click(buttons[0]!);
}

export async function selectCell(user: User, index: number): Promise<void> {
  await user.click(cellAt(index));
}

export function button(name: string): HTMLElement {
  return screen.getByRole("button", { name, hidden: true });
}

// 「間違い 1/3」の表示
export function mistakesText(): string | null {
  return screen.getByText(/^間違い \d\/3$/).textContent;
}

// ヘッダーのタイマーの表示(mm:ss か h:mm:ss)。ダイアログの内容と重ならないときに使う
export function timerText(): string | null {
  return screen.getByText(/^(\d+:)?\d{2}:\d{2}$/).textContent;
}

// 盤面の見た目の署名(81 マスの data-kind と表示の文字)。前後で変わっていないことの確認に使う
export function boardSignature(): string[] {
  return allCells().map(
    (cell) => `${cell.getAttribute("data-kind")}|${cell.textContent}`,
  );
}

// ---- 偽物のタイマー ----

// タイマーに関わるものと Date だけを偽物にする(React のスケジューラは本物のまま)。
// React Testing Library は、user-event の操作のあとにタイマーを進める処理を jest の有無で
// 決めている。Vitest には jest が無く、偽物のタイマーで操作が止まってしまうため、
// 同じ形の jest を用意する
export function installFakeClock(): void {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  vi.stubGlobal("jest", {
    advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
  });
}

export function uninstallFakeClock(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
}
