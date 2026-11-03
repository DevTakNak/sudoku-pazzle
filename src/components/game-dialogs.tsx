"use client";

// クリアと失敗のダイアログ(画面仕様書の「クリアのダイアログ」「失敗のダイアログ」)。
// 閉じるボタンは無く、Esc と外側でも閉じない
import { formatBestTime } from "@/lib/game/stats";
import { formatElapsed } from "@/lib/game/timer";
import type { DifficultyStats } from "@/lib/game/types";
import type { Difficulty } from "@/lib/sudoku/grid";

import { DIFFICULTY_LABELS } from "./labels";
import { MessageDialog } from "./message-dialog";

export function ClearedDialog({
  difficulty,
  elapsedSeconds,
  mistakes,
  stats,
  bestUpdated,
  onShowStats,
  onNewGame,
}: {
  difficulty: Difficulty;
  elapsedSeconds: number;
  mistakes: number;
  stats: DifficultyStats;
  bestUpdated: boolean;
  onShowStats: () => void;
  onNewGame: () => void;
}) {
  return (
    <MessageDialog
      title="クリア!"
      description={`${DIFFICULTY_LABELS[difficulty]}をクリアしました。`}
      actions={[
        { label: "成績を見る", onClick: onShowStats },
        { label: "新しいゲーム", onClick: onNewGame, primary: true },
      ]}
    >
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-gray-600">タイム</dt>
        <dd className="text-right tabular-nums">
          {formatElapsed(elapsedSeconds)}
        </dd>
        <dt className="text-gray-600">間違い</dt>
        <dd className="text-right">{mistakes} 回</dd>
        <dt className="text-gray-600">ベストタイム</dt>
        <dd className="text-right tabular-nums">{formatBestTime(stats)}</dd>
      </dl>
      {bestUpdated && (
        <p className="mt-3 text-sm font-bold text-blue-700">
          ベストタイムを更新しました!
        </p>
      )}
    </MessageDialog>
  );
}

export function FailedDialog({
  onNewGame,
  onRestart,
}: {
  onNewGame: () => void;
  onRestart: () => void;
}) {
  return (
    <MessageDialog
      title="失敗しました"
      description="間違いが 3 回になりました。"
      actions={[
        { label: "新しいゲーム", onClick: onNewGame },
        { label: "やり直す", onClick: onRestart, primary: true },
      ]}
    />
  );
}
