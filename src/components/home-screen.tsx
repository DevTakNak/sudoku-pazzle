"use client";

// ホーム(画面仕様書の「ホーム(/)」)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { createGame } from "@/lib/game/state";
import { formatElapsed } from "@/lib/game/timer";
import { DIFFICULTIES } from "@/lib/sudoku/grid";
import type { Difficulty } from "@/lib/sudoku/grid";

import { useGameSnapshot, useGameStore } from "./game-provider";
import { DIFFICULTY_LABELS } from "./labels";
import { Loading } from "./loading";
import { MessageDialog } from "./message-dialog";
import { usePuzzleGenerator } from "./use-puzzle-generator";
import type { GeneratedPuzzle } from "./use-puzzle-generator";

export function HomeScreen() {
  const router = useRouter();
  const store = useGameStore();
  const { loaded, game } = useGameSnapshot();
  // 上書きの確認をしている難易度
  const [confirming, setConfirming] = useState<Difficulty | null>(null);
  // 最後に作り始めた難易度(「もう一度試す」で使う)
  const [lastDifficulty, setLastDifficulty] = useState<Difficulty>("easy");

  const onGenerated = useCallback(
    ({ difficulty, puzzle, solution }: GeneratedPuzzle) => {
      store.startGame(createGame(difficulty, puzzle, solution));
      router.push("/play");
    },
    [store, router],
  );
  const generator = usePuzzleGenerator(onGenerated);
  const generating = generator.status === "generating";

  if (!loaded) return <Loading />;

  // クリアや失敗で終わったゲームは「進行中」に含めない
  const ongoing = game !== null && game.status === "playing" ? game : null;

  function start(difficulty: Difficulty) {
    setConfirming(null);
    setLastDifficulty(difficulty);
    generator.generate(difficulty);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <h1 className="text-center text-3xl font-bold">数独パズル</h1>
      {ongoing && (
        <button
          type="button"
          disabled={generating}
          onClick={() => router.push("/play")}
          className="h-14 rounded-lg bg-blue-700 text-lg font-medium text-white disabled:opacity-40"
        >
          続きから({DIFFICULTY_LABELS[ongoing.difficulty]}・
          {formatElapsed(ongoing.elapsedSeconds)})
        </button>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold">新しいゲーム</h2>
        {DIFFICULTIES.map((difficulty) => (
          <button
            key={difficulty}
            type="button"
            disabled={generating}
            onClick={() =>
              ongoing ? setConfirming(difficulty) : start(difficulty)
            }
            className="h-14 rounded-lg border bg-white text-lg font-medium disabled:opacity-40"
          >
            {DIFFICULTY_LABELS[difficulty]}
          </button>
        ))}
      </section>
      {generating && (
        <p role="status" className="text-center text-sm text-gray-700">
          問題を作っています…
        </p>
      )}
      <Link
        href="/stats"
        className="flex h-11 items-center justify-center font-medium text-blue-700 underline"
      >
        成績
      </Link>
      {confirming !== null && (
        <MessageDialog
          title="新しいゲームを始めますか?"
          description="進行中のゲームは消え、成績にも記録されません。"
          onDismiss={() => setConfirming(null)}
          actions={[
            { label: "キャンセル", onClick: () => setConfirming(null) },
            {
              label: "始める",
              onClick: () => start(confirming),
              primary: true,
            },
          ]}
        />
      )}
      {generator.status === "failed" && (
        <MessageDialog
          title="問題を作れませんでした"
          description="もう一度お試しください。"
          onDismiss={generator.dismiss}
          actions={[
            { label: "閉じる", onClick: generator.dismiss },
            {
              label: "もう一度試す",
              onClick: () => start(lastDifficulty),
              primary: true,
            },
          ]}
        />
      )}
    </main>
  );
}
