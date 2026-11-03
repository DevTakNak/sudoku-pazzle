// 問題の生成(G-01〜G-03、G-17)。完成した盤面を作り、手筋で解けるかを確かめながらマスを抜く

import { CLUE_RANGES, analyzePuzzle, difficultyOf } from "./difficulty";
import { CELL_COUNT, DIFFICULTIES, PEERS } from "./grid";
import type { Difficulty, Grid } from "./grid";
import { createRandom, shuffle } from "./random";
import type { Random } from "./random";

export interface GenerateOptions {
  // この時間(ミリ秒)を過ぎたら失敗を返す
  timeLimitMs?: number;
  // 経過時間を測る時計(ミリ秒)
  now?: () => number;
}

export type GenerateResult =
  | { ok: true; difficulty: Difficulty; puzzle: Grid; solution: Grid }
  | { ok: false; reason: "timeout" };

export const DEFAULT_TIME_LIMIT_MS = 10_000;

// 目標の数まで抜いた後に試す、手がかりの入れ替えの回数の上限
const SWAP_LIMIT = 1000;

const level = (difficulty: Difficulty): number =>
  DIFFICULTIES.indexOf(difficulty);

class Timeout extends Error {}

// 数字の順を混ぜながら、空の盤面を埋めて完成した盤面を作る
function createSolution(random: Random, checkTime: () => void): Grid {
  const cells = new Array<number>(CELL_COUNT).fill(0);
  const fill = (index: number): boolean => {
    if (index === CELL_COUNT) return true;
    checkTime();
    for (const digit of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random)) {
      if (PEERS[index]!.some((p) => cells[p] === digit)) continue;
      cells[index] = digit;
      if (fill(index + 1)) return true;
    }
    cells[index] = 0;
    return false;
  };
  fill(0);
  return cells;
}

// 完成した盤面から、手がかりの数の目標(範囲の中から乱数で決める)までマスを抜く(G-17)。
// 抜くのは、手筋で解け、目当ての難易度より難しくならないマスだけ。手筋は正しい消去しかしないので、
// 手筋だけで解けてルールを満たす盤面は、解が 1 つだけになる(作った問題の解の数は T-001 で確かめる)。
// 目標まで抜けなかったときと、抜いた盤面が目当ての難易度にならなかったときは null
function dig(
  solution: Grid,
  difficulty: Difficulty,
  random: Random,
  checkTime: () => void,
): Grid | null {
  const { min, max } = CLUE_RANGES[difficulty];
  const target = min + Math.floor(random() * (max - min + 1));
  const puzzle = [...solution];
  let clues = CELL_COUNT;
  let current: Difficulty = "easy";
  for (const index of shuffle([...puzzle.keys()], random)) {
    if (clues === target) break;
    checkTime();
    const digit = puzzle[index]!;
    puzzle[index] = 0;
    const { solved, techniques } = analyzePuzzle(puzzle);
    const rating = difficultyOf(techniques);
    if (!solved || level(rating) > level(difficulty)) {
      puzzle[index] = digit;
      continue;
    }
    clues--;
    current = rating;
  }
  if (clues !== target) return null;

  // 目標の数のまま、手がかりを 1 つ抜いて別のマスを 1 つ足す入れ替えで、目当ての難易度に近づける。
  // 手筋で解け、目当ての難易度を超えず、今より易しくならない入れ替えだけを残す
  for (let swap = 0; swap < SWAP_LIMIT && current !== difficulty; swap++) {
    checkTime();
    const givens = [...puzzle.keys()].filter((i) => puzzle[i] !== 0);
    const empties = [...puzzle.keys()].filter((i) => puzzle[i] === 0);
    const removed = givens[Math.floor(random() * givens.length)]!;
    const added = empties[Math.floor(random() * empties.length)]!;
    puzzle[removed] = 0;
    puzzle[added] = solution[added]!;
    const { solved, techniques } = analyzePuzzle(puzzle);
    const rating = difficultyOf(techniques);
    if (
      !solved ||
      level(rating) > level(difficulty) ||
      level(rating) < level(current)
    ) {
      puzzle[removed] = solution[removed]!;
      puzzle[added] = 0;
      continue;
    }
    current = rating;
  }
  return current === difficulty ? puzzle : null;
}

export function generatePuzzle(
  difficulty: Difficulty,
  seed: number,
  {
    timeLimitMs = DEFAULT_TIME_LIMIT_MS,
    now = () => performance.now(),
  }: GenerateOptions = {},
): GenerateResult {
  const random = createRandom(seed);
  const deadline = now() + timeLimitMs;
  const checkTime = () => {
    if (now() >= deadline) throw new Timeout();
  };

  try {
    for (;;) {
      checkTime();
      const solution = createSolution(random, checkTime);
      const puzzle = dig(solution, difficulty, random, checkTime);
      if (puzzle !== null) return { ok: true, difficulty, puzzle, solution };
    }
  } catch (error) {
    if (error instanceof Timeout) return { ok: false, reason: "timeout" };
    throw error;
  }
}
