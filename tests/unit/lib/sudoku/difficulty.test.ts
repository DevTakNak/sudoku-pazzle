import { describe, expect, it } from "vitest";

import {
  CLUE_RANGES,
  analyzePuzzle,
  judgeDifficulty,
  rateByTechniques,
  type Technique,
} from "@/lib/sudoku/difficulty";
import type { Difficulty } from "@/lib/sudoku/grid";
import { countSolutions } from "@/lib/sudoku/solver";

import {
  UNIQUE_PUZZLE,
  UNIQUE_SOLUTION,
  gridFrom,
} from "../../../helpers/grid";

// 手がかり(0 でないマス)の数
function countClues(grid: readonly number[]): number {
  return grid.filter((v) => v !== 0).length;
}

// ---------------------------------------------------------------------------
// T-007 の盤面。どれも解が 1 つで、手筋は src/lib/CLAUDE.md の G-11〜G-13 の手筋だけを使う。
//
// 盤面は、仕様書から別に書いた参照実装(テストの外)で作って確かめた。確かめたこと:
//   - 参照実装で解くと、期待する手筋の並びで最後まで解ける
//   - 手筋を 1 つずつ外すと、結果が変わる(解けなくなるか、使う手筋が変わる)
//     例: ロックされた候補の盤面は、「ポインティング」だけ、「クレーミング」だけで足りる
//   - 1 つの手筋の中の種類(naked と hidden など)は、片方だけで足りる盤面を選んだ
//   - 変化を 1 つずつ適用する書き方と、まとめて適用する書き方のどちらでも、手筋の並びが同じ
// ---------------------------------------------------------------------------

interface TechniqueCase {
  label: string;
  puzzle: string;
  techniques: Technique[];
  rating: Difficulty;
}

const TECHNIQUE_CASES: TechniqueCase[] = [
  {
    label: "シングル(naked single だけで足りる)",
    puzzle:
      "000000007060040000508000100000210406007000035000038090079400000004000083100900000",
    techniques: ["single"],
    rating: "easy",
  },
  {
    label: "シングル(hidden single だけで足りる)",
    puzzle:
      "000800360008500020070000001000700000600002050000050003400090000000003002500200408",
    techniques: ["single"],
    rating: "easy",
  },
  {
    label: "ロックされた候補(ポインティングが要る)",
    puzzle:
      "003000000006000800570100600200840000050010020000700060000200070000009005910006040",
    techniques: ["single", "lockedCandidates"],
    rating: "normal",
  },
  {
    label: "ロックされた候補(クレーミングが要る)",
    puzzle:
      "003806000002003600000020004080509000500000001000000002400905000650072083000000010",
    techniques: ["single", "lockedCandidates"],
    rating: "normal",
  },
  {
    label: "ペア(naked pair が要る)",
    puzzle:
      "008006005930070000100000800000051040400800270002400090800000300003000020019000000",
    techniques: ["single", "pair"],
    rating: "normal",
  },
  {
    label: "ペア(hidden pair が要る)",
    puzzle:
      "000800000210000300000103006450080600000000010800710000030002870040600002070000000",
    techniques: ["single", "pair"],
    rating: "normal",
  },
  {
    label: "トリプル(hidden triple が要る)",
    puzzle:
      "000610400005008203600007080304080005007020009010000000008700000030509000500000000",
    techniques: ["single", "triple"],
    rating: "hard",
  },
  {
    label: "トリプル(naked triple が要る。ロックされた候補とペアも使う)",
    puzzle:
      "000000031000081600300040000000020070003000200520910003004090000810000420200000050",
    techniques: ["single", "lockedCandidates", "pair", "triple"],
    rating: "hard",
  },
  {
    label: "X-Wing(行の方向)",
    puzzle:
      "003005000002900570600070040000008000278009000000060090100400068000000000090700204",
    techniques: ["single", "xWing"],
    rating: "hard",
  },
  {
    label: "X-Wing(列の方向)",
    puzzle:
      "000004006001000538090000000017000000300080000004500603000100020608240001000309007",
    techniques: ["single", "xWing"],
    rating: "hard",
  },
];

// ---------------------------------------------------------------------------
// T-006 の盤面。手筋で決まる難易度(rating)と、手がかりの数(clues)が分かっている。
// 手がかりを足し引きした盤面でも、手筋の判定が変わらないことを参照実装で確かめた
// (T-006 のテストの中でも rateByTechniques で確かめる)。
// ---------------------------------------------------------------------------

interface ClueCase {
  label: string;
  puzzle: string;
  clues: number;
  rating: Difficulty;
  expected: Difficulty | null;
}

const CLUE_CASES: ClueCase[] = [
  {
    label: "かんたんの手筋で手がかり 45(上限)は easy",
    puzzle:
      "800032700573196240000570030217649050080020694609000007050264370004380012700910080",
    clues: 45,
    rating: "easy",
    expected: "easy",
  },
  {
    label: "かんたんの手筋で手がかり 46(上限の 1 つ外)は null",
    puzzle:
      "890002700503100040400570030217049053005720690009803107150200009004387512700915086",
    clues: 46,
    rating: "easy",
    expected: null,
  },
  {
    label: "かんたんの手筋で手がかり 38(下限)は easy",
    puzzle:
      "890030700503006040026570030017040050000021600000850007050200070964380012030910480",
    clues: 38,
    rating: "easy",
    expected: "easy",
  },
  {
    label: "かんたんの手筋で手がかり 37(下限の 1 つ外)は null",
    puzzle:
      "800430760003000040406570031017040050000720690009000107050200000904387012000910480",
    clues: 37,
    rating: "easy",
    expected: null,
  },
  {
    label: "ふつうの手筋で手がかり 38(上限の 1 つ外)は null",
    puzzle:
      "250983001040065020800000000692071500003200100018039207100000350004000900925310780",
    clues: 38,
    rating: "normal",
    expected: null,
  },
  {
    label: "ふつうの手筋で手がかり 37(上限)は normal",
    puzzle:
      "250983001040060020800700005692070500400200060508630200100000350004000900025306784",
    clues: 37,
    rating: "normal",
    expected: "normal",
  },
  {
    label: "ふつうの手筋で手がかり 30(下限)は normal",
    puzzle:
      "050903001049060020800700000692070500400200000018000000100000350004000900025306780",
    clues: 30,
    rating: "normal",
    expected: "normal",
  },
  {
    label: "ふつうの手筋で手がかり 29(下限の 1 つ外)は null",
    puzzle:
      "000903001049060020801700000690070500073200000008000000100000350004000900025306780",
    clues: 29,
    rating: "normal",
    expected: null,
  },
  {
    label: "むずかしいの手筋で手がかり 30(上限の 1 つ外)は null",
    puzzle:
      "260000400074000500003204009001760980600000302580000070002908605400100200000000090",
    clues: 30,
    rating: "hard",
    expected: null,
  },
  {
    label: "むずかしいの手筋で手がかり 29(上限)は hard",
    puzzle:
      "260000400070000500003204009020760980047000302500000070002908605400100200000000090",
    clues: 29,
    rating: "hard",
    expected: "hard",
  },
  {
    label: "むずかしいの手筋で手がかり 24(下限)は hard",
    puzzle:
      "000076009008001400000000030400007000200093050750000000000009016060030500003002090",
    clues: 24,
    rating: "hard",
    expected: "hard",
  },
  {
    label: "むずかしいの手筋で手がかり 23(下限の 1 つ外)は null",
    puzzle:
      "000200000087000405000079020430060000006008000000000013000904060028000000003600800",
    clues: 23,
    rating: "hard",
    expected: null,
  },
];

// ---------------------------------------------------------------------------
// T-008 の盤面。どれも解が 1 つだけだが、上の手筋だけでは解けない(推測が要る)。
// 参照実装で、手筋が進まなくなって止まることを確かめた。
// ---------------------------------------------------------------------------

interface GuessCase {
  label: string;
  puzzle: string;
  clues: number;
}

const GUESS_CASES: GuessCase[] = [
  {
    // 初めから、どの手筋も進まない(Arto Inkala が 2012 年に出した盤面)
    label: "最初からどの手筋も進まない盤面(手がかり 21)",
    puzzle:
      "800000000003600000070090200050007000000045700000100030001000068008500010090000400",
    clues: 21,
  },
  {
    // シングル、ロックされた候補、ペアまで進んで止まる。手がかりの数はむずかしいの範囲(24〜29)に入る
    label: "ペアまで進んで止まる盤面(手がかり 26。むずかしいの範囲に入る)",
    puzzle:
      "802000070350008900004920005000530009200080060009000400607000040000270300000003000",
    clues: 26,
  },
  {
    label: "シングルの後に止まる盤面(手がかり 24)",
    puzzle:
      "400071000000000580600000030002006005000000700000098143006050000910800300500000002",
    clues: 24,
  },
];

describe("CLUE_RANGES", () => {
  it("T-006: 手がかりの数の範囲は、かんたん 38〜45、ふつう 30〜37、むずかしい 24〜29", () => {
    expect(CLUE_RANGES).toEqual({
      easy: { min: 38, max: 45 },
      normal: { min: 30, max: 37 },
      hard: { min: 24, max: 29 },
    });
  });
});

describe("judgeDifficulty", () => {
  describe("T-006: 手がかりの数の範囲", () => {
    it.each(CLUE_CASES)(
      "T-006: $label",
      ({ puzzle, clues, rating, expected }) => {
        const grid = gridFrom(puzzle);
        // 前提: 盤面の手がかりの数と、手筋による難易度
        expect(countClues(grid)).toBe(clues);
        expect(rateByTechniques(grid)).toBe(rating);

        expect(judgeDifficulty(grid)).toBe(expected);
      },
    );

    it.each(CLUE_CASES)(
      "T-006: 前提: $label の盤面は解が 1 つだけ",
      ({ puzzle }) => {
        expect(countSolutions(gridFrom(puzzle))).toBe(1);
      },
    );

    it("T-006: むずかしいの手筋で手がかり 24 と 25 の盤面は hard を返す(範囲の中)", () => {
      const hiddenTriple = gridFrom(TECHNIQUE_CASES[6]!.puzzle); // 手がかり 24
      const xWingCol = gridFrom(TECHNIQUE_CASES[9]!.puzzle); // 手がかり 25
      expect(countClues(hiddenTriple)).toBe(24);
      expect(countClues(xWingCol)).toBe(25);
      expect(judgeDifficulty(hiddenTriple)).toBe("hard");
      expect(judgeDifficulty(xWingCol)).toBe("hard");
    });

    it("T-006: かんたんの手筋で手がかり 24 の盤面は、かんたんの範囲(38〜45)の外なので null を返す", () => {
      const grid = gridFrom(TECHNIQUE_CASES[0]!.puzzle);
      expect(countClues(grid)).toBe(24);
      expect(rateByTechniques(grid)).toBe("easy");
      expect(judgeDifficulty(grid)).toBeNull();
    });

    it("T-006: ふつうの手筋で手がかり 24 の盤面は、ふつうの範囲(30〜37)の外なので null を返す", () => {
      const grid = gridFrom(TECHNIQUE_CASES[4]!.puzzle);
      expect(countClues(grid)).toBe(24);
      expect(rateByTechniques(grid)).toBe("normal");
      expect(judgeDifficulty(grid)).toBeNull();
    });

    it("T-006: 手筋ではかんたんでも、手がかりが 30 の盤面(ふつうの範囲)は null を返す", () => {
      expect(countClues(UNIQUE_PUZZLE)).toBe(30);
      expect(rateByTechniques(UNIQUE_PUZZLE)).toBe("easy");
      expect(judgeDifficulty(UNIQUE_PUZZLE)).toBeNull();
    });

    it("T-006: すべて埋まった正しい盤面は、手筋ではかんたん、手がかり 81 は範囲の外なので null(2026-11-03 にユーザが決めた)", () => {
      expect(analyzePuzzle(UNIQUE_SOLUTION)).toEqual({
        solved: true,
        techniques: [],
      });
      expect(rateByTechniques(UNIQUE_SOLUTION)).toBe("easy");
      expect(judgeDifficulty(UNIQUE_SOLUTION)).toBeNull();
    });

    it("T-006: 推測が要る盤面は、手がかりがむずかしいの範囲(26)に入っていても null を返す", () => {
      const grid = gridFrom(GUESS_CASES[1]!.puzzle);
      expect(countClues(grid)).toBe(26);
      expect(countSolutions(grid)).toBe(1);
      expect(judgeDifficulty(grid)).toBeNull();
    });

    it("T-006: 解が 2 つの盤面は、手がかりがかんたんの範囲(45)に入っていても null を返す", () => {
      // 手がかり 46 のかんたんの盤面から 23 マス目の手がかり(7)を抜いた盤面
      const grid = gridFrom(
        "890002700503100040400500030217049053005720690009803107150200009004387512700915086",
      );
      expect(countClues(grid)).toBe(45);
      expect(countSolutions(grid)).toBe(2);
      expect(judgeDifficulty(grid)).toBeNull();
    });

    it("T-006: 解が無い盤面は、手がかりがかんたんの範囲(45)に入っていても null を返す", () => {
      // 手がかり 45 のかんたんの盤面の 1 マス目を 8 から 4 に変えた盤面(同じ行・列・ブロックに 4 は無いが、解けない)
      const grid = gridFrom(
        "400032700573196240000570030217649050080020694609000007050264370004380012700910080",
      );
      expect(countClues(grid)).toBe(45);
      expect(countSolutions(grid)).toBe(0);
      expect(judgeDifficulty(grid)).toBeNull();
    });
  });

  describe("T-008: 判定できない盤面", () => {
    it("T-008: 81 要素でない盤面は null を返す", () => {
      expect(judgeDifficulty([])).toBeNull();
      expect(judgeDifficulty(UNIQUE_PUZZLE.slice(0, 80))).toBeNull();
      expect(judgeDifficulty([...UNIQUE_PUZZLE, 0])).toBeNull();
    });
  });

  it("T-006: judgeDifficulty は渡した盤面を書き換えない", () => {
    const grid = gridFrom(CLUE_CASES[0]!.puzzle);
    const frozen = Object.freeze([...grid]);
    judgeDifficulty(frozen);
    expect(frozen).toEqual(grid);
  });
});

describe("analyzePuzzle と rateByTechniques", () => {
  describe("T-007: 手筋ごとの盤面", () => {
    it.each(TECHNIQUE_CASES)(
      "T-007: $label の盤面は、手筋 $techniques で解けて $rating になる",
      ({ puzzle, techniques, rating }) => {
        const grid = gridFrom(puzzle);

        expect(analyzePuzzle(grid)).toEqual({ solved: true, techniques });
        expect(rateByTechniques(grid)).toBe(rating);
      },
    );

    it.each(TECHNIQUE_CASES)(
      "T-007: 前提: $label の盤面は解が 1 つだけ",
      ({ puzzle }) => {
        expect(countSolutions(gridFrom(puzzle))).toBe(1);
      },
    );

    it("T-007: すべて埋まっていても、同じ列に同じ数字がある盤面は solved: false になる(G-15)", () => {
      // UNIQUE_SOLUTION の 1 行目の 1・2 マス目を入れ替えた盤面
      const grid = gridFrom(
        "354678912672195348198342567859761423426853791713924856961537284287419635345286179",
      );
      expect(analyzePuzzle(grid).solved).toBe(false);
      expect(analyzePuzzle(new Array<number>(81).fill(1)).solved).toBe(false);
    });

    it("T-007: 空欄を埋めると重なりが残る盤面は solved: false になる(G-15)", () => {
      // 上の盤面の最後のマス(9)を空けた盤面。シングルで 9 が入るが、ほかのマスの重なりは残る
      const grid = gridFrom(
        "354678912672195348198342567859761423426853791713924856961537284287419635345286170",
      );
      expect(analyzePuzzle(grid).solved).toBe(false);
    });

    it("T-007: 81 要素でない盤面は、手筋を使わずに solved: false になる", () => {
      expect(analyzePuzzle(UNIQUE_PUZZLE.slice(0, 80))).toEqual({
        solved: false,
        techniques: [],
      });
    });

    it("T-007: 渡した盤面を書き換えない", () => {
      for (const { puzzle } of TECHNIQUE_CASES) {
        const grid = gridFrom(puzzle);
        // 凍結した配列に書き込むと例外になるので、書き換えを検出できる
        const frozen = Object.freeze([...grid]);
        analyzePuzzle(frozen);
        rateByTechniques(frozen);
        expect(frozen).toEqual(grid);
      }
    });
  });

  describe("T-008: 推測が必要な盤面を、どの難易度にもしない", () => {
    it.each(GUESS_CASES)(
      "T-008: $label は rateByTechniques が null を返す",
      ({ puzzle, clues }) => {
        const grid = gridFrom(puzzle);
        expect(countClues(grid)).toBe(clues);
        expect(rateByTechniques(grid)).toBeNull();
      },
    );

    it.each(GUESS_CASES)(
      "T-008: 前提: $label は解が 1 つだけ",
      ({ puzzle }) => {
        expect(countSolutions(gridFrom(puzzle))).toBe(1);
      },
    );

    it.each(GUESS_CASES)(
      "T-008: $label は analyzePuzzle が solved: false を返す",
      ({ puzzle }) => {
        expect(analyzePuzzle(gridFrom(puzzle)).solved).toBe(false);
      },
    );

    it("T-008: 最初からどの手筋も進まない盤面は、使った手筋が空になる", () => {
      expect(analyzePuzzle(gridFrom(GUESS_CASES[0]!.puzzle))).toEqual({
        solved: false,
        techniques: [],
      });
    });

    it("T-008: ペアまで進んで止まる盤面は、シングルとロックされた候補とペアを使って解けない", () => {
      const result = analyzePuzzle(gridFrom(GUESS_CASES[1]!.puzzle));
      expect(result.solved).toBe(false);
      expect(result.techniques).toEqual(["single", "lockedCandidates", "pair"]);
    });

    it("T-008: シングルの後に止まる盤面は、シングルだけを使って解けない", () => {
      expect(analyzePuzzle(gridFrom(GUESS_CASES[2]!.puzzle))).toEqual({
        solved: false,
        techniques: ["single"],
      });
    });

    it("T-008: 推測が要る盤面を渡しても、渡した盤面を書き換えない", () => {
      for (const { puzzle } of GUESS_CASES) {
        const grid = gridFrom(puzzle);
        const frozen = Object.freeze([...grid]);
        analyzePuzzle(frozen);
        rateByTechniques(frozen);
        judgeDifficulty(frozen);
        expect(frozen).toEqual(grid);
      }
    });
  });

  describe("T-008: 解が 1 つでない盤面と形が違う盤面", () => {
    it("T-008: 解が 2 つの盤面は null を返し、solved は false になる", () => {
      // UNIQUE_SOLUTION の 4 行目と 5 行目の 6・9 列目を空けた盤面(solver.test.ts と同じ)
      const twoSolutions = gridFrom(
        "534678912672195348198342567859760420426850790713924856961537284287419635345286179",
      );
      expect(countSolutions(twoSolutions)).toBe(2);
      expect(rateByTechniques(twoSolutions)).toBeNull();
      expect(analyzePuzzle(twoSolutions).solved).toBe(false);
    });

    it("T-008: かんたんの手筋に見える盤面でも、解が 2 つなら null を返す", () => {
      // 手がかり 46 のかんたんの盤面から、23 マス目の手がかりを抜いた盤面(手がかり 45)
      const grid = gridFrom(
        "890002700503100040400500030217049053005720690009803107150200009004387512700915086",
      );
      expect(countSolutions(grid)).toBe(2);
      expect(rateByTechniques(grid)).toBeNull();
    });

    it("T-008: 空の盤面は null を返す", () => {
      expect(rateByTechniques(new Array<number>(81).fill(0))).toBeNull();
      expect(judgeDifficulty(new Array<number>(81).fill(0))).toBeNull();
    });

    it("T-008: 行・列・ブロックの重なりは無いが解が無い盤面は null を返す", () => {
      // UNIQUE_PUZZLE の 3 マス目に、行・列・ブロックと重ならない 1 を入れた盤面(solver.test.ts と同じ)
      const noSolution = gridFrom(
        "531070000600195000098000060800060003400803001700020006060000280000419005000080079",
      );
      expect(countSolutions(noSolution)).toBe(0);
      expect(rateByTechniques(noSolution)).toBeNull();
      expect(judgeDifficulty(noSolution)).toBeNull();
      expect(analyzePuzzle(noSolution).solved).toBe(false);
    });

    it("T-008: 手がかりの途中で行き詰まる(解が無い)盤面は null を返す", () => {
      // 手がかり 45 のかんたんの盤面の 1 マス目を 8 から 4 に変えた盤面。シングルが進んだ後に行き詰まる
      const grid = gridFrom(
        "400032700573196240000570030217649050080020694609000007050264370004380012700910080",
      );
      expect(countSolutions(grid)).toBe(0);
      expect(rateByTechniques(grid)).toBeNull();
      expect(analyzePuzzle(grid).solved).toBe(false);
    });

    it("T-008: 同じ行に同じ数字がある盤面は null を返す", () => {
      const grid = [...UNIQUE_PUZZLE];
      grid[2] = 5; // 1 行目に 5 が 2 つ(1 マス目と 3 マス目)になる
      expect(rateByTechniques(grid)).toBeNull();
      expect(judgeDifficulty(grid)).toBeNull();
    });

    it("T-008: 81 マスすべてに数字があるが、同じ列に同じ数字がある盤面は null を返す", () => {
      // UNIQUE_SOLUTION の 1 行目の 1・2 マス目(5 と 3)を入れ替えた盤面。1 列目と 2 列目に同じ数字が 2 つずつできる
      const grid = gridFrom(
        "354678912672195348198342567859761423426853791713924856961537284287419635345286179",
      );
      expect(countClues(grid)).toBe(81);
      expect(countSolutions(grid)).toBe(0);
      expect(rateByTechniques(grid)).toBeNull();
      expect(judgeDifficulty(grid)).toBeNull();
    });

    it("T-008: 空欄が 1 つだけで、ほかのマスに重なりがある盤面は null を返す", () => {
      // 上の盤面の最後のマス(9)を空けた盤面。空欄は 9 を入れれば埋まるが、重なりは残る
      const grid = gridFrom(
        "354678912672195348198342567859761423426853791713924856961537284287419635345286170",
      );
      expect(countClues(grid)).toBe(80);
      expect(countSolutions(grid)).toBe(0);
      expect(rateByTechniques(grid)).toBeNull();
      expect(judgeDifficulty(grid)).toBeNull();
    });

    it("T-008: 81 要素より 1 つ少ない盤面は null を返す", () => {
      const grid = gridFrom(TECHNIQUE_CASES[0]!.puzzle).slice(0, 80);
      expect(rateByTechniques(grid)).toBeNull();
    });

    it("T-008: 81 要素より 1 つ多い盤面は null を返す", () => {
      const grid = [...gridFrom(TECHNIQUE_CASES[0]!.puzzle), 0];
      expect(rateByTechniques(grid)).toBeNull();
    });

    it("T-008: 要素が無い盤面は null を返す", () => {
      expect(rateByTechniques([])).toBeNull();
    });

    it("T-008: 9 より大きい数字がある盤面は null を返す", () => {
      const grid = gridFrom(TECHNIQUE_CASES[0]!.puzzle);
      grid[0] = 10;
      expect(rateByTechniques(grid)).toBeNull();
      expect(judgeDifficulty(grid)).toBeNull();
    });

    it("T-008: 負の数や小数がある盤面は null を返す", () => {
      const negative = gridFrom(TECHNIQUE_CASES[0]!.puzzle);
      negative[0] = -1;
      expect(rateByTechniques(negative)).toBeNull();

      const fraction = gridFrom(TECHNIQUE_CASES[0]!.puzzle);
      fraction[0] = 1.5;
      expect(rateByTechniques(fraction)).toBeNull();
    });
  });
});
