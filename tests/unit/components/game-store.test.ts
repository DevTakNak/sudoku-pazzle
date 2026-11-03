// 画面の状態のストア(React を使わない)。偽の Storage で、読み込み、保存、成績の記録、タイマーを確かめる
import { describe, expect, it, vi } from "vitest";

import { createGameStore } from "@/components/game-store";
import type { GameStore } from "@/components/game-store";
import { createEmptyStats } from "@/lib/game/stats";
import type { GameState, SavedStats } from "@/lib/game/types";
import {
  GAME_KEY,
  STATS_KEY,
  loadGame,
  loadStats,
  parseGame,
} from "@/lib/storage/storage";
import type { Difficulty } from "@/lib/sudoku/grid";

import {
  BLANK_A,
  SOLUTION_A,
  clearedGame,
  failedGame,
  freshGame,
  richPlayingGame,
  withValues,
} from "../../helpers/game";
import { FakeStorage, storageWith } from "../../helpers/storage";

// ---- 補助 ----

function playingAt(difficulty: Difficulty, seconds: number): GameState {
  return { ...freshGame(difficulty), elapsedSeconds: seconds };
}

function clearedAt(difficulty: Difficulty, seconds: number): GameState {
  return { ...clearedGame(), difficulty, elapsedSeconds: seconds };
}

function failedAt(difficulty: Difficulty, seconds: number): GameState {
  return { ...failedGame(), difficulty, elapsedSeconds: seconds };
}

function statsOf(overrides: Partial<SavedStats>): SavedStats {
  return { ...createEmptyStats(), ...overrides };
}

// 読み込み済みのストア(getSnapshot を 1 度呼ぶ)
function openStore(storage: FakeStorage | null): GameStore {
  const store = createGameStore(() => storage);
  store.getSnapshot();
  return store;
}

// 保存のゲームを持つ読み込み済みのストアと、その Storage
function openWith(saved: { game?: GameState; stats?: SavedStats }): {
  store: GameStore;
  storage: FakeStorage;
} {
  const storage = storageWith(saved);
  return { store: openStore(storage), storage };
}

function currentGame(store: GameStore): GameState {
  const game = store.getSnapshot().game;
  if (game === null) throw new Error("ゲームが無い");
  return game;
}

describe("T-415: 前提", () => {
  it("T-415: テストで使うゲームは、保存を通して読み込める(読み込みの検証に通る)", () => {
    for (const game of [
      playingAt("easy", 125),
      clearedAt("normal", 300),
      failedAt("hard", 600),
      richPlayingGame(),
    ]) {
      expect(parseGame(JSON.parse(JSON.stringify(game)))).toEqual(game);
    }
  });
});

describe("T-415: サーバーの描画(G-83)", () => {
  it("T-415: getServerSnapshot は getStorage を呼ばず、読み込む前の値を返す", () => {
    const getStorage = vi.fn(() => storageWith({ game: richPlayingGame() }));
    const store = createGameStore(getStorage);

    expect(store.getServerSnapshot()).toEqual({
      loaded: false,
      game: null,
      stats: createEmptyStats(),
      paused: true,
      canSave: true,
      bestUpdated: false,
    });
    expect(getStorage).not.toHaveBeenCalled();
  });

  it("T-415: getServerSnapshot は呼ぶたびに同じオブジェクトを返す", () => {
    const store = createGameStore(() => null);
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
  });

  it("T-415: ブラウザで読み込んだ後も、getServerSnapshot は loaded false のまま(保存のゲームを返さない)", () => {
    const store = openStore(storageWith({ game: richPlayingGame() }));

    expect(store.getSnapshot().loaded).toBe(true);
    const server = store.getServerSnapshot();
    expect(server.loaded).toBe(false);
    expect(server.game).toBeNull();
  });

  it("T-415: createGameStore だけでは getStorage を呼ばない(getSnapshot で初めて読み込む)", () => {
    const getStorage = vi.fn(() => new FakeStorage());
    const store = createGameStore(getStorage);
    expect(getStorage).not.toHaveBeenCalled();

    store.getSnapshot();
    expect(getStorage).toHaveBeenCalledTimes(1);
  });

  it("T-415: 引数を省くと既定でブラウザの localStorage を取り出す(window が無い Node 環境では null になり、保存できない)", () => {
    expect(typeof window).toBe("undefined");
    const snapshot = createGameStore().getSnapshot();
    expect(snapshot.loaded).toBe(true);
    expect(snapshot.game).toBeNull();
    expect(snapshot.canSave).toBe(false);
  });
});

describe("T-415: 読み込み(G-64、G-81、G-82)", () => {
  it("T-415: 保存したゲームと成績を読み込み、paused true・canSave true・bestUpdated false で始まる", () => {
    const game = richPlayingGame();
    const stats = statsOf({
      normal: { cleared: 2, failed: 1, bestSeconds: 250 },
    });
    const { store, storage } = openWith({ game, stats });

    expect(store.getSnapshot()).toEqual({
      loaded: true,
      game,
      stats,
      paused: true,
      canSave: true,
      bestUpdated: false,
    });
    // 読み込むだけでは書き込まない
    expect(storage.setItemCalls).toEqual([]);
  });

  it("T-415: 保存が無いと、ゲームなし・空の成績で、loaded true・paused true・canSave true", () => {
    const store = openStore(new FakeStorage());
    expect(store.getSnapshot()).toEqual({
      loaded: true,
      game: null,
      stats: createEmptyStats(),
      paused: true,
      canSave: true,
      bestUpdated: false,
    });
  });

  it("T-415: 2 回目以降の getSnapshot は、読み込み直さず、同じオブジェクトを返す", () => {
    const storage = storageWith({ game: richPlayingGame() });
    const getStorage = vi.fn(() => storage);
    const store = createGameStore(getStorage);

    const first = store.getSnapshot();
    const readsAfterFirst = storage.getItemCount;
    expect(readsAfterFirst).toBeGreaterThan(0);
    const second = store.getSnapshot();

    expect(second).toBe(first);
    expect(getStorage).toHaveBeenCalledTimes(1);
    expect(storage.getItemCount).toBe(readsAfterFirst);
  });

  it("T-415: Storage が取り出せない(null)と、ゲームなし・空の成績で、canSave false", () => {
    const store = openStore(null);
    expect(store.getSnapshot()).toEqual({
      loaded: true,
      game: null,
      stats: createEmptyStats(),
      paused: true,
      canSave: false,
      bestUpdated: false,
    });
  });

  it.each([
    ["JSON でない", "{broken"],
    ["配列", "[1,2,3]"],
    ["形が違う(回数が 4)", JSON.stringify({ ...freshGame(), mistakes: 4 })],
    ["null", "null"],
  ])(
    "T-415: 壊れたゲームの値(%s)が保存されていても、ゲームなしで動き、成績は読み込む",
    (_name, text) => {
      const stats = statsOf({
        easy: { cleared: 1, failed: 0, bestSeconds: 99 },
      });
      const storage = storageWith({ stats });
      storage.setItem(GAME_KEY, text);
      storage.resetCalls();
      const store = openStore(storage);

      const snapshot = store.getSnapshot();
      expect(snapshot.loaded).toBe(true);
      expect(snapshot.game).toBeNull();
      expect(snapshot.stats).toEqual(stats);
      expect(snapshot.canSave).toBe(true);
    },
  );

  it.each([
    ["JSON でない", "not json"],
    ["配列", "[]"],
    [
      "クリアが 1 以上なのにベストタイムが無い",
      JSON.stringify(
        statsOf({ easy: { cleared: 1, failed: 0, bestSeconds: null } }),
      ),
    ],
  ])(
    "T-415: 壊れた成績の値(%s)が保存されていても、空の成績で動き、ゲームは読み込む",
    (_name, text) => {
      const game = richPlayingGame();
      const storage = storageWith({ game });
      storage.setItem(STATS_KEY, text);
      const store = openStore(storage);

      const snapshot = store.getSnapshot();
      expect(snapshot.game).toEqual(game);
      expect(snapshot.stats).toEqual(createEmptyStats());
      expect(snapshot.canSave).toBe(true);
    },
  );

  it("T-415: 読み込んだクリア済みのゲームでは、成績を記録せず、何も保存しない", () => {
    const stats = statsOf({
      easy: { cleared: 1, failed: 0, bestSeconds: 300 },
    });
    const { store, storage } = openWith({
      game: clearedAt("easy", 300),
      stats,
    });

    expect(store.getSnapshot().stats).toEqual(stats);
    expect(storage.setItemCalls).toEqual([]);
    expect(store.getSnapshot().bestUpdated).toBe(false);
  });

  it("T-415: 読み込んだ失敗のゲームでも、成績を記録せず、何も保存しない", () => {
    const { store, storage } = openWith({ game: failedAt("hard", 600) });

    expect(store.getSnapshot().stats).toEqual(createEmptyStats());
    expect(storage.setItemCalls).toEqual([]);
  });

  it("T-415: 保存したゲームを、別のストアで読み込み直すと、保存した時間から一時停止で再開する(G-64)", () => {
    const storage = new FakeStorage();
    const first = openStore(storage);
    first.startGame(playingAt("normal", 125));
    first.tick();
    first.tick();

    const second = openStore(storage);
    const snapshot = second.getSnapshot();
    expect(snapshot.game?.elapsedSeconds).toBe(127);
    expect(snapshot.game?.difficulty).toBe("normal");
    expect(snapshot.paused).toBe(true);
  });
});

describe("T-415: subscribe", () => {
  it("T-415: 登録した全部の listener に通知し、解除した listener には通知しない", () => {
    const store = openStore(new FakeStorage());
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    const unsubscribeB = store.subscribe(b);

    store.startGame(freshGame());
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubscribeB();
    store.setPaused(true);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("T-415: 変化の後の getSnapshot は新しいオブジェクトで、前のオブジェクトは変わらない", () => {
    const store = openStore(new FakeStorage());
    const before = store.getSnapshot();

    store.startGame(freshGame());
    const after = store.getSnapshot();

    expect(after).not.toBe(before);
    expect(before.game).toBeNull();
    expect(after.game).not.toBeNull();
  });
});

describe("T-415: startGame", () => {
  it("T-415: ゲームを置き換えて保存し、paused false・bestUpdated false で、1 度だけ通知する", () => {
    const storage = new FakeStorage();
    const store = openStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    const game = playingAt("hard", 0);

    store.startGame(game);

    const snapshot = store.getSnapshot();
    expect(snapshot.game).toEqual(game);
    expect(snapshot.paused).toBe(false);
    expect(snapshot.bestUpdated).toBe(false);
    expect(snapshot.canSave).toBe(true);
    expect(loadGame(storage)).toEqual(game);
    expect(storage.setItemCalls).toEqual([GAME_KEY]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("T-415: 進行中のゲームを新しいゲームで置き換えても、成績に数えず、成績を保存しない(G-56)", () => {
    const stats = statsOf({
      normal: { cleared: 1, failed: 1, bestSeconds: 200 },
    });
    const { store, storage } = openWith({
      game: playingAt("normal", 100),
      stats,
    });

    store.startGame(playingAt("hard", 0));

    expect(store.getSnapshot().stats).toEqual(stats);
    expect(storage.setItemCalls).toEqual([GAME_KEY]);
    expect(loadStats(storage)).toEqual(stats);
  });

  it("T-415: 読み込んだ直後(paused true)でも、startGame で動いている状態(paused false)になる", () => {
    const { store } = openWith({ game: playingAt("easy", 10) });
    expect(store.getSnapshot().paused).toBe(true);

    store.startGame(playingAt("easy", 0));
    expect(store.getSnapshot().paused).toBe(false);
  });

  it("T-415: クリアでベストタイムを更新した後の startGame で、bestUpdated が false に戻る", () => {
    const { store } = openWith({ game: playingAt("easy", 100) });
    store.updateGame(() => clearedAt("easy", 90));
    expect(store.getSnapshot().bestUpdated).toBe(true);

    store.startGame(playingAt("easy", 0));
    expect(store.getSnapshot().bestUpdated).toBe(false);
  });
});

describe("T-415: restart(G-55)", () => {
  it("T-415: 失敗したゲームを、同じ問題の初めの状態に戻して保存し、paused false・bestUpdated false にする", () => {
    const failed = failedAt("hard", 600);
    const { store, storage } = openWith({ game: failed });
    store.setPaused(true);
    const listener = vi.fn();
    store.subscribe(listener);

    store.restart();

    const expected = freshGame("hard", failed.puzzle, failed.solution);
    const snapshot = store.getSnapshot();
    expect(snapshot.game).toEqual(expected);
    expect(snapshot.paused).toBe(false);
    expect(snapshot.bestUpdated).toBe(false);
    expect(loadGame(storage)).toEqual(expected);
    // やり直しは別のゲームとして数えるが、成績はまだ記録しない
    expect(storage.setItemCalls).toEqual([GAME_KEY]);
    expect(snapshot.stats).toEqual(createEmptyStats());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("T-415: クリアでベストタイムを更新した後の restart で、bestUpdated が false に戻る", () => {
    const { store } = openWith({ game: playingAt("easy", 100) });
    store.updateGame(() => clearedAt("easy", 90));
    expect(store.getSnapshot().bestUpdated).toBe(true);

    store.restart();
    expect(store.getSnapshot().bestUpdated).toBe(false);
  });

  it("T-415: やり直した後に失敗した場合は、別のゲームとして成績にもう 1 度記録する", () => {
    const { store, storage } = openWith({ game: playingAt("hard", 500) });
    store.updateGame(() => failedAt("hard", 600));
    store.restart();
    store.updateGame(() => failedAt("hard", 40));

    expect(store.getSnapshot().stats.hard).toEqual({
      cleared: 0,
      failed: 2,
      bestSeconds: null,
    });
    expect(loadStats(storage).hard.failed).toBe(2);
  });

  it("T-415: ゲームが無いときの restart は、何も保存せず、通知しない(推測: 設計に明記なし)", () => {
    const storage = new FakeStorage();
    const store = openStore(storage);
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);

    store.restart();

    expect(store.getSnapshot()).toBe(before);
    expect(storage.setItemCalls).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("T-415: updateGame の保存と通知", () => {
  it("T-415: update には今のゲームそのものを渡す", () => {
    const { store } = openWith({ game: richPlayingGame() });
    const current = currentGame(store);
    let received: GameState | null = null;

    store.updateGame((game) => {
      received = game;
      return game;
    });

    expect(received).toBe(current);
  });

  it("T-415: ゲームが無いときは update を呼ばず、保存も通知もしない", () => {
    const storage = new FakeStorage();
    const store = openStore(storage);
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    const update = vi.fn((game: GameState) => game);

    store.updateGame(update);

    expect(update).not.toHaveBeenCalled();
    expect(storage.setItemCalls).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(before);
  });

  it("T-415: update が同じオブジェクトを返すと、保存も通知もしない(スナップショットも同じ)", () => {
    const { store, storage } = openWith({ game: richPlayingGame() });
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);

    store.updateGame((game) => game);

    expect(storage.setItemCalls).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(before);
  });

  it("T-415: プレイ中のまま変わると、ゲームだけを保存し、成績は保存せず、1 度だけ通知する", () => {
    const { store, storage } = openWith({ game: freshGame("easy") });
    const listener = vi.fn();
    store.subscribe(listener);
    const next = withValues(currentGame(store), { [BLANK_A]: SOLUTION_A });

    store.updateGame(() => next);

    expect(store.getSnapshot().game).toBe(next);
    expect(storage.setItemCalls).toEqual([GAME_KEY]);
    expect(loadGame(storage)).toEqual(next);
    expect(store.getSnapshot().stats).toEqual(createEmptyStats());
    expect(store.getSnapshot().bestUpdated).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("T-415: updateGame では paused を変えない(一時停止中のままプレイ中として更新できる)", () => {
    const { store } = openWith({ game: freshGame("easy") });
    expect(store.getSnapshot().paused).toBe(true);

    store.updateGame((game) => withValues(game, { [BLANK_A]: SOLUTION_A }));
    expect(store.getSnapshot().paused).toBe(true);

    store.setPaused(false);
    store.updateGame((game) => withValues(game, { [BLANK_A]: 0 }));
    expect(store.getSnapshot().paused).toBe(false);
  });
});

describe("T-415: 成績の記録(G-54、G-73)", () => {
  it.each<Difficulty>(["easy", "normal", "hard"])(
    "T-415: %s のゲームのクリアで、その難易度のクリア数が 1 増え、ベストタイムが入り、bestUpdated true",
    (difficulty) => {
      const { store, storage } = openWith({
        game: playingAt(difficulty, 100),
      });
      const listener = vi.fn();
      store.subscribe(listener);

      // 前のゲームの時間(100)とは違う 300 秒でクリアする
      store.updateGame(() => clearedAt(difficulty, 300));

      const expected = createEmptyStats();
      expected[difficulty] = { cleared: 1, failed: 0, bestSeconds: 300 };
      const snapshot = store.getSnapshot();
      expect(snapshot.stats).toEqual(expected);
      expect(snapshot.bestUpdated).toBe(true);
      expect(snapshot.game?.status).toBe("cleared");
      expect(loadStats(storage)).toEqual(expected);
      expect(loadGame(storage)?.status).toBe("cleared");
      expect(listener).toHaveBeenCalledTimes(1);
    },
  );

  it.each<Difficulty>(["easy", "normal", "hard"])(
    "T-415: %s のゲームの失敗で、その難易度の失敗数が 1 増え、ベストタイムは変わらず、bestUpdated false",
    (difficulty) => {
      const { store, storage } = openWith({
        game: playingAt(difficulty, 100),
        stats: statsOf({
          [difficulty]: { cleared: 1, failed: 0, bestSeconds: 500 },
        }),
      });

      store.updateGame(() => failedAt(difficulty, 120));

      const expected = createEmptyStats();
      expected[difficulty] = { cleared: 1, failed: 1, bestSeconds: 500 };
      const snapshot = store.getSnapshot();
      expect(snapshot.stats).toEqual(expected);
      expect(snapshot.bestUpdated).toBe(false);
      expect(loadStats(storage)).toEqual(expected);
    },
  );

  it("T-415: 保存の順は、ゲームを先、成績を後", () => {
    const { store, storage } = openWith({ game: playingAt("easy", 10) });

    store.updateGame(() => clearedAt("easy", 20));

    expect(storage.setItemCalls).toEqual([GAME_KEY, STATS_KEY]);
  });

  it("T-415: 失敗でも保存の順は、ゲームを先、成績を後", () => {
    const { store, storage } = openWith({ game: playingAt("hard", 10) });

    store.updateGame(() => failedAt("hard", 20));

    expect(storage.setItemCalls).toEqual([GAME_KEY, STATS_KEY]);
  });

  // [前のベスト, 今回の秒, 記録後のベスト, bestUpdated]
  it.each([
    [400, 300, 300, true],
    [301, 300, 300, true],
    [300, 300, 300, false],
    [299, 300, 299, false],
    [100, 300, 100, false],
  ])(
    "T-415: 前のベストが %i 秒で %i 秒でクリアすると、ベストは %i 秒、bestUpdated は %s",
    (previous, seconds, expectedBest, expectedUpdated) => {
      const { store, storage } = openWith({
        game: playingAt("normal", 50),
        stats: statsOf({
          normal: { cleared: 2, failed: 1, bestSeconds: previous },
        }),
      });

      store.updateGame(() => clearedAt("normal", seconds));

      expect(store.getSnapshot().stats.normal).toEqual({
        cleared: 3,
        failed: 1,
        bestSeconds: expectedBest,
      });
      expect(store.getSnapshot().bestUpdated).toBe(expectedUpdated);
      expect(loadStats(storage).normal.bestSeconds).toBe(expectedBest);
    },
  );

  it("T-415: 同じ秒でクリアしても、クリア数は 1 増える(ベストの更新だけが無い)", () => {
    const { store } = openWith({
      game: playingAt("easy", 50),
      stats: statsOf({ easy: { cleared: 1, failed: 0, bestSeconds: 77 } }),
    });

    store.updateGame(() => clearedAt("easy", 77));

    expect(store.getSnapshot().stats.easy.cleared).toBe(2);
    expect(store.getSnapshot().bestUpdated).toBe(false);
  });

  it("T-415: 記録の後に updateGame を呼んでも、成績を重ねて記録せず、成績を保存しない", () => {
    const { store, storage } = openWith({ game: playingAt("easy", 10) });
    store.updateGame(() => clearedAt("easy", 20));
    const recorded = store.getSnapshot().stats;
    storage.resetCalls();

    store.updateGame((game) => ({ ...game, elapsedSeconds: 21 }));

    expect(store.getSnapshot().stats).toEqual(recorded);
    expect(store.getSnapshot().stats.easy.cleared).toBe(1);
    expect(storage.setItemCalls).toEqual([GAME_KEY]);
    // この画面の間に更新したことは、後の更新で消えない(推測: 設計に明記なし)
    expect(store.getSnapshot().bestUpdated).toBe(true);
  });

  it("T-415: 失敗の後に updateGame を呼んでも、失敗数は 1 のまま", () => {
    const { store, storage } = openWith({ game: playingAt("hard", 10) });
    store.updateGame(() => failedAt("hard", 20));
    storage.resetCalls();

    store.updateGame((game) => ({ ...game, elapsedSeconds: 21 }));

    expect(store.getSnapshot().stats.hard.failed).toBe(1);
    expect(storage.setItemCalls).toEqual([GAME_KEY]);
  });

  it("T-415: 読み込んだクリア済みのゲームの updateGame では、成績を記録しない(前の状態が playing でない)", () => {
    const stats = statsOf({
      easy: { cleared: 1, failed: 0, bestSeconds: 300 },
    });
    const { store, storage } = openWith({
      game: clearedAt("easy", 300),
      stats,
    });

    store.updateGame((game) => ({ ...game, elapsedSeconds: 299 }));

    expect(store.getSnapshot().stats).toEqual(stats);
    expect(store.getSnapshot().bestUpdated).toBe(false);
    expect(storage.setItemCalls).toEqual([GAME_KEY]);
  });

  it("T-415: クリアから失敗に変わっても(前の状態が playing でない)、成績を記録しない", () => {
    const { store, storage } = openWith({ game: clearedAt("easy", 300) });

    store.updateGame((game) => ({ ...game, status: "failed", mistakes: 3 }));

    expect(store.getSnapshot().stats).toEqual(createEmptyStats());
    expect(storage.setItemCalls).toEqual([GAME_KEY]);
  });

  it("T-415: 失敗からクリアに変わっても(前の状態が playing でない)、成績を記録しない", () => {
    const { store, storage } = openWith({ game: failedAt("hard", 300) });

    store.updateGame((game) => ({ ...game, status: "cleared" }));

    expect(store.getSnapshot().stats).toEqual(createEmptyStats());
    expect(storage.setItemCalls).toEqual([GAME_KEY]);
  });

  it("T-415: クリアして保存した後に、同じ保存を読み込んだ別のストアで操作しても、重ねて記録しない(G-54)", () => {
    const storage = storageWith({ game: playingAt("normal", 10) });
    const first = openStore(storage);
    first.updateGame(() => clearedAt("normal", 90));

    const second = openStore(storage);
    expect(second.getSnapshot().stats.normal.cleared).toBe(1);
    second.updateGame((game) => ({ ...game, elapsedSeconds: 91 }));
    second.setPaused(false);
    second.tick();

    expect(second.getSnapshot().stats.normal).toEqual({
      cleared: 1,
      failed: 0,
      bestSeconds: 90,
    });
    expect(loadStats(storage).normal.cleared).toBe(1);
  });
});

describe("T-415: tick(G-61、G-62)", () => {
  it("T-415: 読み込んだ直後(一時停止中)は進まず、保存も通知もしない", () => {
    const { store, storage } = openWith({ game: playingAt("easy", 125) });
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);

    store.tick();

    expect(store.getSnapshot()).toBe(before);
    expect(store.getSnapshot().game?.elapsedSeconds).toBe(125);
    expect(storage.setItemCalls).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("T-415: 一時停止を解くと 1 ずつ進み、そのたびに保存と通知をする", () => {
    const { store, storage } = openWith({ game: playingAt("easy", 125) });
    const listener = vi.fn();
    store.subscribe(listener);
    store.setPaused(false);
    listener.mockClear();

    store.tick();
    expect(store.getSnapshot().game?.elapsedSeconds).toBe(126);
    store.tick();
    store.tick();

    expect(store.getSnapshot().game?.elapsedSeconds).toBe(128);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(storage.setItemCalls).toEqual([GAME_KEY, GAME_KEY, GAME_KEY]);
  });

  it("T-415: 秒は整数のまま増え、保存した値を loadGame で読み直せる(小数だと成績が全部捨てられる)", () => {
    const { store, storage } = openWith({ game: playingAt("easy", 125) });
    store.setPaused(false);

    for (let i = 0; i < 5; i++) store.tick();

    const seconds = store.getSnapshot().game?.elapsedSeconds;
    expect(seconds).toBe(130);
    expect(Number.isInteger(seconds)).toBe(true);
    const reloaded = loadGame(storage);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.elapsedSeconds).toBe(130);
  });

  it("T-415: startGame で始めたゲームは、すぐ進む(paused false)", () => {
    const store = openStore(new FakeStorage());
    store.startGame(playingAt("easy", 0));

    store.tick();

    expect(store.getSnapshot().game?.elapsedSeconds).toBe(1);
  });

  it("T-415: setPaused(true) の後は進まない。もう一度 false にすると進む", () => {
    const store = openStore(new FakeStorage());
    store.startGame(playingAt("easy", 0));
    store.tick();

    store.setPaused(true);
    store.tick();
    store.tick();
    expect(store.getSnapshot().game?.elapsedSeconds).toBe(1);

    store.setPaused(false);
    store.tick();
    expect(store.getSnapshot().game?.elapsedSeconds).toBe(2);
  });

  it("T-415: 時間以外(盤面や回数)は tick で変わらない", () => {
    const game = richPlayingGame();
    const { store } = openWith({ game });
    store.setPaused(false);

    store.tick();

    expect(store.getSnapshot().game).toEqual({
      ...game,
      elapsedSeconds: game.elapsedSeconds + 1,
    });
  });

  it("T-415: 読み込んだクリア済みのゲームは、一時停止を解いても進まない", () => {
    const { store, storage } = openWith({ game: clearedAt("easy", 300) });
    store.setPaused(false);
    const before = store.getSnapshot();

    store.tick();

    expect(store.getSnapshot()).toBe(before);
    expect(store.getSnapshot().game?.elapsedSeconds).toBe(300);
    expect(storage.setItemCalls).toEqual([]);
  });

  it("T-415: 読み込んだ失敗のゲームは、一時停止を解いても進まない", () => {
    const { store, storage } = openWith({ game: failedAt("hard", 600) });
    store.setPaused(false);

    store.tick();

    expect(store.getSnapshot().game?.elapsedSeconds).toBe(600);
    expect(storage.setItemCalls).toEqual([]);
  });

  it("T-415: 動いている途中でクリアになると、その後の tick は進まない", () => {
    const store = openStore(new FakeStorage());
    store.startGame(playingAt("easy", 0));
    store.tick();
    store.updateGame(() => clearedAt("easy", 1));
    expect(store.getSnapshot().paused).toBe(false);

    store.tick();

    expect(store.getSnapshot().game?.elapsedSeconds).toBe(1);
  });

  it("T-415: 動いている途中で失敗になると、その後の tick は進まない", () => {
    const store = openStore(new FakeStorage());
    store.startGame(playingAt("hard", 0));
    store.updateGame(() => failedAt("hard", 5));

    store.tick();

    expect(store.getSnapshot().game?.elapsedSeconds).toBe(5);
  });

  it("T-415: ゲームが無いときは何もしない(保存も通知もしない)", () => {
    const storage = new FakeStorage();
    const store = openStore(storage);
    store.setPaused(false);
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);

    store.tick();

    expect(store.getSnapshot()).toBe(before);
    expect(storage.setItemCalls).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("T-415: setPaused(G-62、G-63)", () => {
  it("T-415: 同じ値なら、通知せず、スナップショットも変わらない(読み込んだ直後の true)", () => {
    const { store, storage } = openWith({ game: freshGame() });
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setPaused(true);

    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(before);
    expect(storage.setItemCalls).toEqual([]);
  });

  it("T-415: false にすると 1 度通知し、保存はしない。もう一度 false では通知しない", () => {
    const { store, storage } = openWith({ game: freshGame() });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setPaused(false);
    expect(store.getSnapshot().paused).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    store.setPaused(false);
    expect(listener).toHaveBeenCalledTimes(1);

    store.setPaused(true);
    expect(store.getSnapshot().paused).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(storage.setItemCalls).toEqual([]);
  });
});

describe("T-415: 保存できないとき(G-82)", () => {
  it("T-415: Storage が null でも、startGame・updateGame・tick・restart がメモリの状態で進み、canSave は false", () => {
    const store = openStore(null);

    store.startGame(playingAt("easy", 0));
    expect(store.getSnapshot().game?.elapsedSeconds).toBe(0);
    store.tick();
    expect(store.getSnapshot().game?.elapsedSeconds).toBe(1);
    store.updateGame((game) => withValues(game, { [BLANK_A]: SOLUTION_A }));
    expect(store.getSnapshot().game?.values[BLANK_A]).toBe(SOLUTION_A);
    store.updateGame(() => clearedAt("easy", 9));
    expect(store.getSnapshot().stats.easy).toEqual({
      cleared: 1,
      failed: 0,
      bestSeconds: 9,
    });
    store.restart();
    expect(store.getSnapshot().game?.status).toBe("playing");
    expect(store.getSnapshot().canSave).toBe(false);
  });

  it("T-415: 読み込んだだけでは、保存できない Storage でも canSave は true(まだ保存していない)", () => {
    const storage = storageWith({ game: freshGame() });
    storage.failWhen = () => true;

    expect(openStore(storage).getSnapshot().canSave).toBe(true);
  });

  it("T-415: setItem が例外を出しても、例外は外に出ず、メモリの状態は進み、canSave が false になる(startGame)", () => {
    const storage = new FakeStorage();
    storage.failWhen = () => true;
    const store = openStore(storage);
    const game = playingAt("easy", 0);

    expect(() => store.startGame(game)).not.toThrow();

    expect(store.getSnapshot().game).toEqual(game);
    expect(store.getSnapshot().canSave).toBe(false);
  });

  it("T-415: tick の保存が失敗しても、メモリの時間は進み、canSave が false になる", () => {
    const storage = new FakeStorage();
    const store = openStore(storage);
    store.startGame(playingAt("easy", 10));
    expect(store.getSnapshot().canSave).toBe(true);
    storage.failWhen = () => true;

    expect(() => store.tick()).not.toThrow();

    expect(store.getSnapshot().game?.elapsedSeconds).toBe(11);
    expect(store.getSnapshot().canSave).toBe(false);
  });

  it("T-415: updateGame の保存が失敗しても、メモリのゲームは更新され、canSave が false になる", () => {
    const { store, storage } = openWith({ game: freshGame() });
    storage.failWhen = () => true;

    store.updateGame((game) => withValues(game, { [BLANK_A]: SOLUTION_A }));

    expect(store.getSnapshot().game?.values[BLANK_A]).toBe(SOLUTION_A);
    expect(store.getSnapshot().canSave).toBe(false);
  });

  it("T-415: restart の保存が失敗しても、メモリのゲームは初めに戻り、canSave が false になる", () => {
    const { store, storage } = openWith({ game: failedAt("hard", 600) });
    storage.failWhen = () => true;

    store.restart();

    expect(store.getSnapshot().game?.status).toBe("playing");
    expect(store.getSnapshot().game?.mistakes).toBe(0);
    expect(store.getSnapshot().canSave).toBe(false);
  });

  it("T-415: 成績の保存だけが失敗するときも canSave は false。ゲームは保存され、成績はメモリで記録される(その 1 回は次の読み込みで数え漏れる)", () => {
    const { store, storage } = openWith({ game: playingAt("normal", 10) });
    storage.failWhen = (key) => key === STATS_KEY;

    expect(() => store.updateGame(() => clearedAt("normal", 90))).not.toThrow();

    const snapshot = store.getSnapshot();
    expect(snapshot.canSave).toBe(false);
    expect(snapshot.stats.normal).toEqual({
      cleared: 1,
      failed: 0,
      bestSeconds: 90,
    });
    expect(snapshot.bestUpdated).toBe(true);
    expect(loadGame(storage)?.status).toBe("cleared");
    expect(loadStats(storage)).toEqual(createEmptyStats());
    expect(storage.setItemCalls[0]).toBe(GAME_KEY);

    // 読み込み直しても、クリア済みのゲームから二重には数えない
    const reopened = openStore(storage);
    expect(reopened.getSnapshot().stats).toEqual(createEmptyStats());
    reopened.updateGame((game) => ({ ...game, elapsedSeconds: 91 }));
    expect(reopened.getSnapshot().stats).toEqual(createEmptyStats());
  });

  it("T-415: ゲームの保存だけが失敗するときも canSave は false で、成績はメモリで記録される", () => {
    const { store, storage } = openWith({ game: playingAt("hard", 10) });
    storage.failWhen = (key) => key === GAME_KEY;

    store.updateGame(() => failedAt("hard", 30));

    const snapshot = store.getSnapshot();
    expect(snapshot.canSave).toBe(false);
    expect(snapshot.game?.status).toBe("failed");
    expect(snapshot.stats.hard.failed).toBe(1);
  });

  it("T-415: ゲームの保存が失敗したときは、成績を保存しない(読み込み直して遊び切っても、二重に数えない)", () => {
    const stats = statsOf({
      hard: { cleared: 0, failed: 2, bestSeconds: null },
    });
    const { store, storage } = openWith({
      game: playingAt("hard", 10),
      stats,
    });
    storage.failWhen = (key) => key === GAME_KEY;

    store.updateGame(() => failedAt("hard", 30));

    expect(storage.setItemCalls).not.toContain(STATS_KEY);
    expect(loadStats(storage)).toEqual(stats);

    // 保存に残った「プレイ中」のゲームを読み込み直して失敗すると、1 回だけ数える
    storage.failWhen = () => false;
    const reopened = openStore(storage);
    expect(reopened.getSnapshot().game?.status).toBe("playing");
    reopened.updateGame(() => failedAt("hard", 40));
    expect(loadStats(storage)?.hard.failed).toBe(3);
  });

  // 失敗の後に、保存が成功する操作をしても canSave は戻らない
  it.each<[string, (store: GameStore) => void]>([
    ["tick", (store) => store.tick()],
    ["startGame", (store) => store.startGame(playingAt("easy", 0))],
    [
      "updateGame",
      (store) =>
        store.updateGame((game) => withValues(game, { [BLANK_A]: SOLUTION_A })),
    ],
    ["restart", (store) => store.restart()],
  ])(
    "T-415: いったん保存に失敗したら、その後の %s の保存が成功しても canSave は false のまま",
    (_name, operation) => {
      const storage = new FakeStorage();
      const store = openStore(storage);
      store.startGame(playingAt("easy", 0));
      storage.failWhen = () => true;
      store.tick();
      expect(store.getSnapshot().canSave).toBe(false);

      storage.failWhen = () => false;
      storage.resetCalls();
      operation(store);

      // 成功した保存は書き込まれているが、canSave は戻らない
      expect(storage.setItemCalls).toEqual([GAME_KEY]);
      expect(store.getSnapshot().canSave).toBe(false);
    },
  );

  it("T-415: 保存が成功し続ける間は canSave が true のまま", () => {
    const store = openStore(new FakeStorage());
    store.startGame(playingAt("easy", 0));
    store.tick();
    store.updateGame(() => clearedAt("easy", 5));
    store.restart();

    expect(store.getSnapshot().canSave).toBe(true);
  });
});
