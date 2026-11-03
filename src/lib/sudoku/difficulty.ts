// 手筋で解く処理と、難易度の判定(src/lib/CLAUDE.md の「難易度」G-11〜G-17)

import {
  ALL_DIGITS,
  BOXES,
  CELL_COUNT,
  COLS,
  DIFFICULTIES,
  PEERS,
  ROWS,
  UNITS,
  bit,
  bitCount,
  boxOf,
  colOf,
  hasConflict,
  isGridShape,
  rowOf,
} from "./grid";
import type { Difficulty } from "./grid";
import { countSolutions } from "./solver";

// 易しい順(G-15)。analyzePuzzle の techniques もこの順に並べる
const TECHNIQUES = [
  "single",
  "lockedCandidates",
  "pair",
  "triple",
  "xWing",
] as const;

export type Technique = (typeof TECHNIQUES)[number];

const TECHNIQUE_DIFFICULTY: Record<Technique, Difficulty> = {
  single: "easy",
  lockedCandidates: "normal",
  pair: "normal",
  triple: "hard",
  xWing: "hard",
};

export const CLUE_RANGES: Record<Difficulty, { min: number; max: number }> = {
  easy: { min: 38, max: 45 },
  normal: { min: 30, max: 37 },
  hard: { min: 24, max: 29 },
};

function digitsOf(mask: number): number[] {
  const digits: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) digits.push(d);
  return digits;
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  const result: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), size - 1))
      result.push([item, ...rest]);
  });
  return result;
}

// 盤面の値と、空欄ごとの候補(1〜9 のビット)
class Board {
  readonly values: number[];
  readonly candidates: number[];

  constructor(puzzle: readonly number[]) {
    this.values = new Array<number>(CELL_COUNT).fill(0);
    this.candidates = new Array<number>(CELL_COUNT).fill(ALL_DIGITS);
    puzzle.forEach((v, i) => {
      if (v !== 0) this.place(i, v);
    });
  }

  place(index: number, digit: number): void {
    this.values[index] = digit;
    this.candidates[index] = 0;
    for (const p of PEERS[index]!) this.candidates[p]! &= ~bit(digit);
  }

  // 候補から mask のビットを外す。外れたものがあれば true
  eliminate(index: number, mask: number): boolean {
    const before = this.candidates[index]!;
    this.candidates[index] = before & ~mask;
    return this.candidates[index] !== before;
  }

  isFilled(): boolean {
    return this.values.every((v) => v !== 0);
  }

  emptyCells(unit: readonly number[]): number[] {
    return unit.filter((i) => this.values[i] === 0);
  }
}

// naked single と hidden single で 1 マス埋める
function applySingle(board: Board): boolean {
  for (let i = 0; i < CELL_COUNT; i++) {
    const mask = board.candidates[i]!;
    if (board.values[i] === 0 && bitCount(mask) === 1) {
      board.place(i, digitsOf(mask)[0]!);
      return true;
    }
  }
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      let count = 0;
      let last = -1;
      for (const i of unit) {
        if (board.candidates[i]! & bit(d)) {
          count++;
          last = i;
        }
      }
      if (count === 1) {
        board.place(last, d);
        return true;
      }
    }
  }
  return false;
}

// 単位の中で、数字 d の候補があるマスがそろって同じ行・列・ブロックにあるか。2 マス以上あるときだけ返す
function alignment(
  board: Board,
  unit: readonly number[],
  d: number,
): { first: number; row: boolean; col: boolean; box: boolean } | null {
  let first = -1;
  let count = 0;
  let row = true;
  let col = true;
  let box = true;
  for (const i of unit) {
    if ((board.candidates[i]! & bit(d)) === 0) continue;
    count++;
    if (first === -1) {
      first = i;
      continue;
    }
    row &&= rowOf(i) === rowOf(first);
    col &&= colOf(i) === colOf(first);
    box &&= boxOf(i) === boxOf(first);
  }
  return count >= 2 ? { first, row, col, box } : null;
}

// ロックされた候補(pointing と claiming)
function applyLockedCandidates(board: Board): boolean {
  let changed = false;
  for (let d = 1; d <= 9; d++) {
    // pointing: ブロックの中の候補が 1 つの行か列にそろえば、その行・列のブロックの外から外す
    for (const box of BOXES) {
      const found = alignment(board, box, d);
      if (found === null) continue;
      const boxIndex = boxOf(found.first);
      const lines = [
        ...(found.row ? [ROWS[rowOf(found.first)]!] : []),
        ...(found.col ? [COLS[colOf(found.first)]!] : []),
      ];
      for (const line of lines) {
        for (const i of line) {
          if (boxOf(i) !== boxIndex)
            changed = board.eliminate(i, bit(d)) || changed;
        }
      }
    }
    // claiming: 行・列の中の候補が 1 つのブロックにそろえば、そのブロックの残りから外す
    for (const [lineOf, lines] of [
      [rowOf, ROWS],
      [colOf, COLS],
    ] as const) {
      for (const line of lines) {
        const found = alignment(board, line, d);
        if (found === null || !found.box) continue;
        const lineIndex = lineOf(found.first);
        for (const i of BOXES[boxOf(found.first)]!) {
          if (lineOf(i) !== lineIndex)
            changed = board.eliminate(i, bit(d)) || changed;
        }
      }
    }
    if (changed) return true;
  }
  return false;
}

// 0〜n-1 から size 個を選ぶ組み合わせ(添字の並び)。探索のたびに作らないように覚えておく
const indexCombinations = new Map<string, number[][]>();
function indexCombos(n: number, size: number): number[][] {
  const key = `${n}:${size}`;
  const cached = indexCombinations.get(key);
  if (cached !== undefined) return cached;
  const result = combinations(
    Array.from({ length: n }, (_, i) => i),
    size,
  );
  indexCombinations.set(key, result);
  return result;
}

// naked subset と hidden subset(size が 2 ならペア、3 ならトリプル)
function applySubsets(board: Board, size: number): boolean {
  for (const unit of UNITS) {
    const empty = board.emptyCells(unit);
    if (empty.length <= size) continue;

    // naked: size 個のマスの候補を合わせると size 個の数字になる
    for (const combo of indexCombos(empty.length, size)) {
      let mask = 0;
      for (const k of combo) mask |= board.candidates[empty[k]!]!;
      if (bitCount(mask) !== size) continue;
      let changed = false;
      empty.forEach((i, k) => {
        if (!combo.includes(k)) changed = board.eliminate(i, mask) || changed;
      });
      if (changed) return true;
    }

    // hidden: size 個の数字の候補が、合わせて size 個のマスにしか無い。
    // 数字ごとに、候補のあるマスを empty の中の位置のビットで持つ
    const open: number[] = [];
    const positions: number[] = [];
    for (let d = 1; d <= 9; d++) {
      let where = 0;
      empty.forEach((i, k) => {
        if (board.candidates[i]! & bit(d)) where |= 1 << k;
      });
      if (where !== 0) {
        open.push(d);
        positions.push(where);
      }
    }
    for (const combo of indexCombos(open.length, size)) {
      let where = 0;
      let keep = 0;
      for (const k of combo) {
        where |= positions[k]!;
        keep |= bit(open[k]!);
      }
      if (bitCount(where) !== size) continue;
      let changed = false;
      empty.forEach((i, k) => {
        if (where & (1 << k)) changed = board.eliminate(i, ~keep) || changed;
      });
      if (changed) return true;
    }
  }
  return false;
}

// X-Wing(行どうしと列どうしの両方向)
function applyXWing(board: Board): boolean {
  for (const [baseLines, crossLines, crossOf, baseOf] of [
    [ROWS, COLS, colOf, rowOf],
    [COLS, ROWS, rowOf, colOf],
  ] as const) {
    for (let d = 1; d <= 9; d++) {
      // 基準の線ごとに、数字 d の候補がある交わる線の番号をビットで持つ
      const where = baseLines.map((line) => {
        let mask = 0;
        for (const i of line) {
          if (board.candidates[i]! & bit(d)) mask |= 1 << crossOf(i);
        }
        return mask;
      });
      for (let a = 0; a < 9; a++) {
        if (bitCount(where[a]!) !== 2) continue;
        for (let b = a + 1; b < 9; b++) {
          if (where[b] !== where[a]) continue;
          let changed = false;
          for (let cross = 0; cross < 9; cross++) {
            if ((where[a]! & (1 << cross)) === 0) continue;
            for (const i of crossLines[cross]!) {
              const base = baseOf(i);
              if (base !== a && base !== b)
                changed = board.eliminate(i, bit(d)) || changed;
            }
          }
          if (changed) return true;
        }
      }
    }
  }
  return false;
}

const APPLY: Record<Technique, (board: Board) => boolean> = {
  single: applySingle,
  lockedCandidates: applyLockedCandidates,
  pair: (board) => applySubsets(board, 2),
  triple: (board) => applySubsets(board, 3),
  xWing: applyXWing,
};

// 手筋だけで解く。易しい手筋から順に試し、進んだらまたシングルから試す
export function analyzePuzzle(puzzle: readonly number[]): {
  solved: boolean;
  techniques: Technique[];
} {
  if (!isGridShape(puzzle)) return { solved: false, techniques: [] };
  const board = new Board(puzzle);
  const used = new Set<Technique>();
  while (!board.isFilled()) {
    const technique = TECHNIQUES.find((t) => APPLY[t](board));
    if (technique === undefined) break;
    used.add(technique);
  }
  return {
    // 埋まっても、数独のルールを満たさなければ解けなかったものとする(G-15)
    solved: board.isFilled() && !hasConflict(board.values),
    techniques: TECHNIQUES.filter((t) => used.has(t)),
  };
}

// 使った手筋のうち、一番難しいものの難易度(G-15)。手筋を使っていなければ easy
export function difficultyOf(techniques: readonly Technique[]): Difficulty {
  return techniques
    .map((t) => TECHNIQUE_DIFFICULTY[t])
    .reduce<Difficulty>(
      (hardest, d) =>
        DIFFICULTIES.indexOf(d) > DIFFICULTIES.indexOf(hardest) ? d : hardest,
      "easy",
    );
}

// 手筋だけで決めた難易度。推測が要る、解が 1 つでない、形が違う盤面は null
export function rateByTechniques(puzzle: readonly number[]): Difficulty | null {
  if (countSolutions(puzzle) !== 1) return null;
  const { solved, techniques } = analyzePuzzle(puzzle);
  if (!solved) return null;
  return difficultyOf(techniques);
}

export function countClues(puzzle: readonly number[]): number {
  return puzzle.filter((v) => v !== 0).length;
}

// 手筋の難易度に、手がかりの数がその難易度の範囲に入るときだけ、その難易度を返す
export function judgeDifficulty(puzzle: readonly number[]): Difficulty | null {
  const difficulty = rateByTechniques(puzzle);
  if (difficulty === null) return null;
  const clues = countClues(puzzle);
  const { min, max } = CLUE_RANGES[difficulty];
  return clues >= min && clues <= max ? difficulty : null;
}
