"use client";

// ゲーム(画面仕様書の「ゲーム(/play)」)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { completedDigits } from "@/lib/game/digits";
import { redo, undo } from "@/lib/game/history";
import { eraseCell, inputDigit } from "@/lib/game/input";
import { toggleNote } from "@/lib/game/notes";
import { formatElapsed } from "@/lib/game/timer";
import { MAX_MISTAKES } from "@/lib/game/types";
import type { GameState } from "@/lib/game/types";
import { colOf, rowOf } from "@/lib/sudoku/grid";
import { cn } from "@/lib/utils";

import { Board, DIGITS } from "./board";
import { ClearedDialog, FailedDialog } from "./game-dialogs";
import { useGameSnapshot, useGameStore } from "./game-provider";
import { DIFFICULTY_LABELS } from "./labels";
import { Loading } from "./loading";

const ARROW_MOVES: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

// 矢印で動かした先のマス。端で止まり、未選択なら左上
function moveSelection(selected: number | null, key: string): number {
  const move = ARROW_MOVES[key]!;
  if (selected === null) return 0;
  const row = Math.min(8, Math.max(0, rowOf(selected) + move[0]));
  const col = Math.min(8, Math.max(0, colOf(selected) + move[1]));
  return row * 9 + col;
}

export function GameScreen() {
  const router = useRouter();
  const store = useGameStore();
  const { loaded, game, stats, paused, bestUpdated } = useGameSnapshot();
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);

  const playing = game !== null && game.status === "playing";
  const running = loaded && playing && !paused;

  // 保存したゲームが無ければホームへ
  useEffect(() => {
    if (loaded && game === null) router.replace("/");
  }, [loaded, game, router]);

  // タイマー(G-61、G-62)
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => store.tick(), 1000);
    return () => clearInterval(id);
  }, [running, store]);

  // 画面を離れたときは一時停止(G-62)。StrictMode(開発のときだけ)は、効果をすぐ片付けて
  // 付け直すので、片付けで止めた分は付け直しで戻す(付け直しでは同じ ref が残る)
  const pausedOnLeaveRef = useRef(false);
  useEffect(() => {
    if (pausedOnLeaveRef.current) {
      pausedOnLeaveRef.current = false;
      store.setPaused(false);
    }
    return () => {
      if (store.getSnapshot().paused) return;
      pausedOnLeaveRef.current = true;
      store.setPaused(true);
    };
  }, [store]);

  // タブが隠れたとき、隠れている間に開いたときは一時停止(G-62)
  useEffect(() => {
    const pauseIfHidden = () => {
      if (document.visibilityState === "hidden") store.setPaused(true);
    };
    pauseIfHidden();
    document.addEventListener("visibilitychange", pauseIfHidden);
    return () =>
      document.removeEventListener("visibilitychange", pauseIfHidden);
  }, [store]);

  function enterDigit(digit: number) {
    if (selected === null) return;
    store.updateGame((g) => {
      // 入れ終わった数字は、メモの状態でも何もしない(G-27)
      if (completedDigits(g).has(digit)) return g;
      return noteMode
        ? toggleNote(g, selected, digit)
        : inputDigit(g, selected, digit);
    });
  }

  function erase() {
    if (selected === null) return;
    store.updateGame((g) => eraseCell(g, selected));
  }

  // 一時停止中とゲームの終了後は、盤面の操作のキーを受け付けない(G-53、G-63)
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!running) return;
    const key = event.key;
    // Alt 付きと、Ctrl・Cmd 付きの元に戻す・やり直し以外のキーは扱わない
    if (event.altKey) return;
    if (event.ctrlKey || event.metaKey) {
      const lower = key.toLowerCase();
      if (lower === "z") {
        event.preventDefault();
        store.updateGame(event.shiftKey ? redo : undo);
      } else if (lower === "y" && event.ctrlKey) {
        event.preventDefault();
        store.updateGame(redo);
      }
      return;
    }
    if (key in ARROW_MOVES) {
      event.preventDefault();
      setSelected((s) => moveSelection(s, key));
    } else if (/^[1-9]$/.test(key)) {
      enterDigit(Number(key));
    } else if (key === "Backspace" || key === "Delete") {
      event.preventDefault();
      erase();
    } else if (key === "m" || key === "M") {
      setNoteMode((m) => !m);
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  if (!loaded || game === null) return <Loading />;

  const controlsDisabled = !running;
  const canUndo = running && game.undoStack.length > 0;
  const canRedo = running && game.redoStack.length > 0;
  const showPaused = playing && paused;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link
          href="/"
          className="flex h-11 min-w-11 items-center justify-center font-medium text-blue-700 underline"
        >
          ホーム
        </Link>
        <span className="font-medium">
          {DIFFICULTY_LABELS[game.difficulty]}
        </span>
        <span aria-live="polite">
          間違い {game.mistakes}/{MAX_MISTAKES}
        </span>
        <span className="tabular-nums">
          {formatElapsed(game.elapsedSeconds)}
        </span>
        <button
          type="button"
          disabled={!playing}
          onClick={() => store.setPaused(!paused)}
          className="h-11 rounded-lg border bg-white px-3 font-medium disabled:opacity-40"
        >
          {showPaused ? "再開" : "一時停止"}
        </button>
      </header>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="relative">
          <Board
            game={game}
            selected={showPaused ? null : selected}
            hidden={showPaused}
            onSelect={(index) => {
              if (running) setSelected(index);
            }}
          />
          {showPaused && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80">
              <p className="text-lg font-bold">一時停止中</p>
              <button
                type="button"
                onClick={() => store.setPaused(false)}
                className="h-11 rounded-lg bg-blue-700 px-6 font-medium text-white"
              >
                再開
              </button>
            </div>
          )}
        </div>
        <Controls
          disabled={controlsDisabled}
          canUndo={canUndo}
          canRedo={canRedo}
          noteMode={noteMode}
          onUndo={() => store.updateGame(undo)}
          onRedo={() => store.updateGame(redo)}
          onErase={erase}
          onToggleNoteMode={() => setNoteMode((m) => !m)}
          onDigit={enterDigit}
          completed={completedDigits(game)}
        />
      </div>
      <EndDialog
        game={game}
        stats={stats[game.difficulty]}
        bestUpdated={bestUpdated}
        onShowStats={() => router.push("/stats")}
        onNewGame={() => router.push("/")}
        // 選んだマスは残す(ダイアログを閉じるとフォーカスが元のマスに戻り、そのマスを選ぶため)
        onRestart={() => store.restart()}
      />
    </main>
  );
}

function EndDialog({
  game,
  stats,
  bestUpdated,
  onShowStats,
  onNewGame,
  onRestart,
}: {
  game: GameState;
  stats: Parameters<typeof ClearedDialog>[0]["stats"];
  bestUpdated: boolean;
  onShowStats: () => void;
  onNewGame: () => void;
  onRestart: () => void;
}) {
  if (game.status === "cleared") {
    return (
      <ClearedDialog
        difficulty={game.difficulty}
        elapsedSeconds={game.elapsedSeconds}
        mistakes={game.mistakes}
        stats={stats}
        bestUpdated={bestUpdated}
        onShowStats={onShowStats}
        onNewGame={onNewGame}
      />
    );
  }
  if (game.status === "failed") {
    return <FailedDialog onNewGame={onNewGame} onRestart={onRestart} />;
  }
  return null;
}

function Controls({
  disabled,
  canUndo,
  canRedo,
  noteMode,
  onUndo,
  onRedo,
  onErase,
  onToggleNoteMode,
  onDigit,
  completed,
}: {
  disabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  noteMode: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onErase: () => void;
  onToggleNoteMode: () => void;
  onDigit: (digit: number) => void;
  completed: Set<number>;
}) {
  const action =
    "h-12 min-w-0 rounded-lg border bg-white px-1 text-sm font-medium disabled:opacity-40";
  return (
    <div>
      <div className="grid grid-cols-4 gap-2 md:grid-cols-2">
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className={action}
        >
          元に戻す
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          className={action}
        >
          やり直し
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onErase}
          className={action}
        >
          消す
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={noteMode}
          onClick={onToggleNoteMode}
          className={`${action} aria-pressed:border-blue-700 aria-pressed:bg-blue-700 aria-pressed:text-white`}
        >
          メモ
        </button>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2 min-[480px]:grid-cols-9 md:grid-cols-3">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled || completed.has(digit)}
            onClick={() => onDigit(digit)}
            className={cn(
              "h-12 rounded-lg border bg-white text-xl font-medium md:h-16",
              // 入れ終わった数字は、不透明な灰色にする(どの数字か読めるように)。
              // 一時停止中などのほかの押せない状態だけ薄くする
              completed.has(digit)
                ? cn(
                    "border-gray-200 bg-gray-200 text-gray-400",
                    disabled && "opacity-40",
                  )
                : "disabled:opacity-40",
            )}
          >
            {digit}
          </button>
        ))}
      </div>
    </div>
  );
}
