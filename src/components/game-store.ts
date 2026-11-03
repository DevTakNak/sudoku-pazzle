// 画面が使うゲームと成績の状態。localStorage との同期と、成績を 1 度だけ記録する決まり(G-54)を持つ。
// React からは useSyncExternalStore で読む(サーバーの描画では読み込まない。G-83)
import { restartGame } from "@/lib/game/state";
import { createEmptyStats, recordResult } from "@/lib/game/stats";
import type { GameState, SavedStats } from "@/lib/game/types";
import {
  getBrowserStorage,
  loadGame,
  loadStats,
  saveGame,
  saveStats,
} from "@/lib/storage/storage";

export interface GameSnapshot {
  loaded: boolean; // ブラウザで読み込んだら true
  game: GameState | null;
  stats: SavedStats;
  paused: boolean; // 保存しない。読み込んだ直後は一時停止(G-64)
  canSave: boolean; // 保存できない(G-82)と分かったら false
  bestUpdated: boolean; // この画面の間にクリアでベストタイムを更新した
}

export interface GameStore {
  getSnapshot(): GameSnapshot;
  getServerSnapshot(): GameSnapshot;
  subscribe(listener: () => void): () => void;
  startGame(game: GameState): void;
  updateGame(update: (game: GameState) => GameState): void;
  tick(): void;
  setPaused(paused: boolean): void;
  restart(): void;
}

const SERVER_SNAPSHOT: GameSnapshot = {
  loaded: false,
  game: null,
  stats: createEmptyStats(),
  paused: true,
  canSave: true,
  bestUpdated: false,
};

export function createGameStore(
  getStorage: () => Storage | null = getBrowserStorage,
): GameStore {
  let storage: Storage | null = null;
  let snapshot: GameSnapshot | null = null;
  const listeners = new Set<() => void>();

  function current(): GameSnapshot {
    if (snapshot === null) {
      storage = getStorage();
      snapshot = {
        loaded: true,
        game: storage === null ? null : loadGame(storage),
        stats: storage === null ? createEmptyStats() : loadStats(storage),
        paused: true,
        canSave: storage !== null,
        bestUpdated: false,
      };
    }
    return snapshot;
  }

  function set(next: GameSnapshot): void {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  // ゲームを先に、成績を後に保存する(G-54。成績だけ失敗したら、その 1 回が数え漏れる)。
  // ゲームの保存に失敗したら成績は保存しない(残った「プレイ中」のゲームで二重に数えないため)
  function persist(game: GameState, stats: SavedStats | null): boolean {
    if (storage === null) return false;
    const gameSaved = saveGame(storage, game);
    const statsSaved =
      stats === null || (gameSaved && saveStats(storage, stats));
    return gameSaved && statsSaved;
  }

  function replaceGame(game: GameState): void {
    const now = current();
    const saved = persist(game, null);
    set({
      ...now,
      game,
      paused: false,
      bestUpdated: false,
      canSave: now.canSave && saved,
    });
  }

  function updateGame(update: (game: GameState) => GameState): void {
    const now = current();
    if (now.game === null) return;
    const prev = now.game;
    const next = update(prev);
    if (next === prev) return;

    // 「プレイ中 → クリアか失敗」に変わったときだけ記録する(G-54)
    let stats: SavedStats | null = null;
    let bestUpdated = now.bestUpdated;
    if (prev.status === "playing" && next.status !== "playing") {
      const before = now.stats[next.difficulty].bestSeconds;
      stats = recordResult(
        now.stats,
        next.difficulty,
        next.status,
        next.elapsedSeconds,
      );
      bestUpdated =
        next.status === "cleared" &&
        (before === null || next.elapsedSeconds < before);
    }
    const saved = persist(next, stats);
    set({
      ...now,
      game: next,
      stats: stats ?? now.stats,
      bestUpdated,
      canSave: now.canSave && saved,
    });
  }

  return {
    getSnapshot: current,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    startGame: replaceGame,
    updateGame,
    tick() {
      if (current().paused) return;
      // 秒は 1 ずつの整数にする(小数は次の読み込みの検証で捨てられる。G-81)
      updateGame((game) =>
        game.status === "playing"
          ? { ...game, elapsedSeconds: game.elapsedSeconds + 1 }
          : game,
      );
    },
    setPaused(paused) {
      const now = current();
      if (now.paused === paused) return;
      set({ ...now, paused });
    },
    restart() {
      const game = current().game;
      if (game === null) return;
      replaceGame(restartGame(game));
    },
  };
}
