// @vitest-environment jsdom
// 成績の画面(T-413)
import { screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GameProvider } from "@/components/game-provider";
import { StatsScreen } from "@/components/stats-screen";
import type { SavedStats } from "@/lib/game/types";
import { STATS_KEY } from "@/lib/storage/storage";

import { freshGame } from "../../helpers/game";
import { renderScreen, seedGame, seedStats } from "../../helpers/screen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  window.localStorage.clear();
  router.push.mockClear();
  router.replace.mockClear();
});

// 表の行の、行見出しを除いたセルの文字
function rowValues(rowHeader: string): string[] {
  const header = screen.getByRole("rowheader", { name: rowHeader });
  const row = header.closest("tr");
  if (row === null) throw new Error(`${rowHeader} の行が無い`);
  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent ?? "");
}

describe("T-413: 成績の画面の構造", () => {
  it("T-413: 見出し「成績」、ホームへのリンク、表の列見出し 5 つ、行見出し 3 つを出す", () => {
    renderScreen(<StatsScreen />);

    expect(
      screen.getByRole("heading", { level: 1, name: "成績" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ホーム" })).toHaveAttribute(
      "href",
      "/",
    );
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["難易度", "クリア", "失敗", "クリア率", "ベストタイム"]);
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((h) => h.textContent),
    ).toEqual(["かんたん", "ふつう", "むずかしい"]);
  });

  it("T-413: サーバーの描画では保存を読まず、「読み込み中…」を出す", () => {
    seedStats({
      easy: { cleared: 3, failed: 1, bestSeconds: 200 },
      normal: { cleared: 0, failed: 0, bestSeconds: null },
      hard: { cleared: 0, failed: 0, bestSeconds: null },
    });

    const html = renderToString(
      <GameProvider>
        <StatsScreen />
      </GameProvider>,
    );

    expect(html).toContain("読み込み中…");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("75%");
  });
});

describe("T-413: 成績の値", () => {
  it("T-413: 難易度ごとに違う値を、クリア・失敗・クリア率・ベストタイムの列に出す(取り違えない)", () => {
    seedStats({
      easy: { cleared: 3, failed: 1, bestSeconds: 200 },
      normal: { cleared: 5, failed: 2, bestSeconds: 400 },
      hard: { cleared: 7, failed: 4, bestSeconds: 800 },
    });

    renderScreen(<StatsScreen />);

    // クリア率: 3/4=75%、5/7=71.4…%→71%、7/11=63.6…%→64%
    expect(rowValues("かんたん")).toEqual(["3", "1", "75%", "03:20"]);
    expect(rowValues("ふつう")).toEqual(["5", "2", "71%", "06:40"]);
    expect(rowValues("むずかしい")).toEqual(["7", "4", "64%", "13:20"]);
  });

  it("T-413: まだ遊んでいないとき(保存した成績が無い)は、回数を 0、クリア率とベストタイムを - にする", () => {
    renderScreen(<StatsScreen />);

    for (const row of ["かんたん", "ふつう", "むずかしい"]) {
      expect(rowValues(row)).toEqual(["0", "0", "-", "-"]);
    }
  });

  it("T-413: 壊れた成績が保存されていても、画面は動き、0 回の表示になる", () => {
    window.localStorage.setItem(STATS_KEY, "{ not json");

    renderScreen(<StatsScreen />);

    expect(rowValues("かんたん")).toEqual(["0", "0", "-", "-"]);
  });

  it("T-413: クリア率の端の値(すべて失敗は 0%、すべてクリアは 100%)と、ベストタイムが無い・1 時間以上の表示", () => {
    seedStats({
      easy: { cleared: 0, failed: 2, bestSeconds: null },
      normal: { cleared: 4, failed: 0, bestSeconds: 3600 },
      hard: { cleared: 1, failed: 2, bestSeconds: 59 },
    });

    renderScreen(<StatsScreen />);

    expect(rowValues("かんたん")).toEqual(["0", "2", "0%", "-"]);
    expect(rowValues("ふつう")).toEqual(["4", "0", "100%", "1:00:00"]);
    expect(rowValues("むずかしい")).toEqual(["1", "2", "33%", "00:59"]);
  });

  it("T-413: クリア率の四捨五入(.5 は切り上げ)が表に出る(23/40 は 58%、1/8 は 13%、2/3 は 67%)", () => {
    seedStats({
      easy: { cleared: 23, failed: 17, bestSeconds: 100 },
      normal: { cleared: 1, failed: 7, bestSeconds: 100 },
      hard: { cleared: 2, failed: 1, bestSeconds: 100 },
    });

    renderScreen(<StatsScreen />);

    expect(rowValues("かんたん")[2]).toBe("58%");
    expect(rowValues("ふつう")[2]).toBe("13%");
    expect(rowValues("むずかしい")[2]).toBe("67%");
  });

  it("T-413: 失敗だけが記録されている難易度は、クリア率 0% でベストタイムは -(クリア 0・失敗 1)", () => {
    const stats: SavedStats = {
      easy: { cleared: 0, failed: 1, bestSeconds: null },
      normal: { cleared: 0, failed: 0, bestSeconds: null },
      hard: { cleared: 0, failed: 0, bestSeconds: null },
    };
    seedStats(stats);

    renderScreen(<StatsScreen />);

    expect(rowValues("かんたん")).toEqual(["0", "1", "0%", "-"]);
    expect(rowValues("ふつう")).toEqual(["0", "0", "-", "-"]);
  });

  it("T-413: 進行中のゲームが保存されていても、成績の表には影響しない", () => {
    seedGame(freshGame("hard"));

    renderScreen(<StatsScreen />);

    expect(rowValues("むずかしい")).toEqual(["0", "0", "-", "-"]);
  });
});
