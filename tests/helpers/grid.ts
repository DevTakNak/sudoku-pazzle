// 盤面を 81 文字の文字列から作る。空欄は 0 か "."
export function gridFrom(text: string): number[] {
  const cleaned = text.replace(/\s/g, "");
  if (!/^[0-9.]{81}$/.test(cleaned)) {
    throw new Error(`81 文字の盤面ではない: ${cleaned.length} 文字`);
  }
  return [...cleaned].map((c) => (c === "." ? 0 : Number(c)));
}

// 盤面を 81 文字の文字列にする(失敗したときの差を読みやすくするため)
export function gridToString(grid: readonly number[]): string {
  return grid.join("");
}

// 行・列・ブロックのすべてに 1〜9 が 1 つずつ入っているか。
// 本番のコードとは別に書き、テストの判定が本番のコードに引きずられないようにする
export function isSolvedGrid(grid: readonly number[]): boolean {
  if (grid.length !== 81) return false;
  const units: number[][] = [];
  for (let k = 0; k < 9; k++) {
    const row: number[] = [];
    const col: number[] = [];
    const box: number[] = [];
    for (let j = 0; j < 9; j++) {
      row.push(k * 9 + j);
      col.push(j * 9 + k);
      box.push(
        (Math.floor(k / 3) * 3 + Math.floor(j / 3)) * 9 + (k % 3) * 3 + (j % 3),
      );
    }
    units.push(row, col, box);
  }
  return units.every((unit) => {
    const values = unit.map((i) => grid[i]).sort();
    return values.join("") === "123456789";
  });
}

// よく知られた、解が 1 つだけの問題と、その解
export const UNIQUE_PUZZLE = gridFrom(
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
);
export const UNIQUE_SOLUTION = gridFrom(
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
);
