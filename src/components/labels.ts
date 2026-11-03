// 画面に出す難易度の名前
import type { Difficulty } from "@/lib/sudoku/grid";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "かんたん",
  normal: "ふつう",
  hard: "むずかしい",
};
