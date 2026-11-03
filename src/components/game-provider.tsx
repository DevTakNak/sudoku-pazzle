"use client";

// 画面の間で共有するゲームと成績の状態。ページを移っても残るので、
// 保存できないとき(G-82)もメモリの状態で遊び続けられる
import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";

import { createGameStore } from "./game-store";
import type { GameSnapshot, GameStore } from "./game-store";

const GameStoreContext = createContext<GameStore | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => createGameStore());
  return <GameStoreContext value={store}>{children}</GameStoreContext>;
}

export function useGameStore(): GameStore {
  const store = useContext(GameStoreContext);
  if (store === null) {
    throw new Error("useGameStore は GameProvider の中で使う");
  }
  return store;
}

// サーバーの描画と hydration の間は読み込み前の値になる(G-83)
export function useGameSnapshot(): GameSnapshot {
  const store = useGameStore();
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}
