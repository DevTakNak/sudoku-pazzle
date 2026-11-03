// 難易度ごとの成績(G-71〜G-73)
import type { Difficulty } from "@/lib/sudoku/grid";

import { formatElapsed } from "./timer";
import type { DifficultyStats, GameResult, SavedStats } from "./types";

function emptyDifficultyStats(): DifficultyStats {
  return { cleared: 0, failed: 0, bestSeconds: null };
}

export function createEmptyStats(): SavedStats {
  return {
    easy: emptyDifficultyStats(),
    normal: emptyDifficultyStats(),
    hard: emptyDifficultyStats(),
  };
}

export function recordResult(
  stats: SavedStats,
  difficulty: Difficulty,
  result: GameResult,
  elapsedSeconds: number,
): SavedStats {
  const current = stats[difficulty];
  const next: DifficultyStats =
    result === "cleared"
      ? {
          ...current,
          cleared: current.cleared + 1,
          bestSeconds:
            current.bestSeconds === null || elapsedSeconds < current.bestSeconds
              ? elapsedSeconds
              : current.bestSeconds,
        }
      : { ...current, failed: current.failed + 1 };
  return { ...stats, [difficulty]: next };
}

export function formatClearRate(stats: DifficultyStats): string {
  const total = stats.cleared + stats.failed;
  if (total === 0) return "-";
  // 先に 100 を掛けて分子を整数のままにする。割ってから掛けると、
  // 23/40 が 57.49999… になり、四捨五入で 57 になってしまう
  return `${Math.round((stats.cleared * 100) / total)}%`;
}

export function formatBestTime(stats: DifficultyStats): string {
  return stats.bestSeconds === null ? "-" : formatElapsed(stats.bestSeconds);
}
