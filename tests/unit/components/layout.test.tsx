// @vitest-environment jsdom
// 全画面の上に置く、保存できないときの知らせ(G-82、G-83)
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameProvider, useGameStore } from "@/components/game-provider";
import { StorageNotice } from "@/components/storage-notice";
import { GAME_KEY, STATS_KEY, loadGame } from "@/lib/storage/storage";

import { freshGame, richPlayingGame } from "../../helpers/game";

const NOTICE =
  "この端末では保存できません。ページを閉じると、ゲームと成績は残りません。";

// 保存が起きる操作(ゲームを始める)を押せるようにするための、テスト用のボタン
function StartButton() {
  const store = useGameStore();
  return (
    <button type="button" onClick={() => store.startGame(freshGame())}>
      始める
    </button>
  );
}

function Tree() {
  return (
    <GameProvider>
      <StorageNotice />
      <StartButton />
    </GameProvider>
  );
}

function denyLocalStorage() {
  return vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("denied", "SecurityError");
  });
}

function failSetItem() {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("quota exceeded", "QuotaExceededError");
  });
}

afterEach(() => {
  // 差し替えを戻してから、jsdom の localStorage を空にする
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("T-414: 保存できるとき", () => {
  it("T-414: localStorage が使え、保存も無いときは、知らせを出さない", () => {
    render(<Tree />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("T-414: 保存のゲームがあっても、壊れた値があっても、知らせを出さない", () => {
    window.localStorage.setItem(GAME_KEY, JSON.stringify(richPlayingGame()));
    window.localStorage.setItem(STATS_KEY, "not json");

    render(<Tree />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("T-414: 保存が起きる操作の後も、保存に成功すれば知らせを出さない", async () => {
    const user = userEvent.setup();
    render(<Tree />);

    await user.click(screen.getByRole("button", { name: "始める" }));

    expect(loadGame(window.localStorage)).toEqual(freshGame());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("T-414: localStorage の参照で例外が出るとき", () => {
  it("T-414: 描画した直後から、role=alert で保存できない知らせを出す", () => {
    denyLocalStorage();

    render(<Tree />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(NOTICE);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("T-414: 知らせを出していても、ゲームを始める操作は例外にならず、知らせは出たまま", async () => {
    denyLocalStorage();
    const user = userEvent.setup();
    render(<Tree />);

    await user.click(screen.getByRole("button", { name: "始める" }));

    expect(screen.getByRole("alert")).toHaveTextContent(NOTICE);
  });
});

describe("T-414: setItem で例外が出るとき", () => {
  it("T-414: 保存が起きる前は知らせを出さず、保存に失敗した後に出す", async () => {
    failSetItem();
    const user = userEvent.setup();
    render(<Tree />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "始める" }));

    expect(screen.getByRole("alert")).toHaveTextContent(NOTICE);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("T-414: 失敗の後も、そのページを開いている間は知らせを出し続ける", async () => {
    const setItem = failSetItem();
    const user = userEvent.setup();
    render(<Tree />);
    await user.click(screen.getByRole("button", { name: "始める" }));

    // 保存できるようになっても、1 度失敗したので知らせは消えない
    setItem.mockRestore();
    await user.click(screen.getByRole("button", { name: "始める" }));

    expect(screen.getByRole("alert")).toHaveTextContent(NOTICE);
  });
});

describe("T-414: 読み込む前(サーバーの描画)は知らせを出さない(G-83)", () => {
  it("T-414: localStorage の参照で例外が出る環境でも、サーバーの描画の HTML に知らせは無く、localStorage も参照しない", () => {
    const getter = denyLocalStorage();

    const html = renderToString(<Tree />);

    expect(html).not.toContain(NOTICE);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("始める");
    expect(getter).not.toHaveBeenCalled();
  });

  it("T-414: サーバーの描画の HTML を hydrate すると、不一致を起こさず、読み込んだ後に知らせが出る", async () => {
    const html = renderToString(<Tree />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    denyLocalStorage();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const onRecoverableError = vi.fn();
    expect(container.querySelector('[role="alert"]')).toBeNull();

    await act(async () => {
      hydrateRoot(container, <Tree />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(NOTICE);
    container.remove();
  });
});

// 2026-11-03 に、カバレッジの不足を埋めるために足した
describe("GameProvider の外", () => {
  it("useGameStore を GameProvider の外で使うと、例外で分かる", () => {
    // React が出す例外のログを抑える
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useGameStore())).toThrow(
      "useGameStore は GameProvider の中で使う",
    );
  });
});
