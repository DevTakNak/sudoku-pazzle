"use client";

import { useGameSnapshot } from "./game-provider";

// 保存できないときの知らせ(G-82)。読み込む前の値は canSave が true なので、読み込む前は出ない
export function StorageNotice() {
  const { canSave } = useGameSnapshot();
  if (canSave) return null;
  return (
    <p
      role="alert"
      className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
    >
      この端末では保存できません。ページを閉じると、ゲームと成績は残りません。
    </p>
  );
}
