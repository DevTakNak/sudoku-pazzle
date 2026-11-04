"use client";

// 盤面(画面仕様書の「盤面」、R-06、R-07、N-03)
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import type { GameState } from "@/lib/game/types";
import { boxOf, CELL_COUNT, colOf, PEERS, rowOf } from "@/lib/sudoku/grid";

type CellKind = "clue" | "correct" | "wrong" | "empty";
type CellHighlight = "selected" | "error" | "same-digit" | "related" | "none";

// 1〜9(メモの並びと、ゲーム画面の数字のボタンで使う)
export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function kindOf(game: GameState, index: number): CellKind {
  const value = game.values[index]!;
  if (game.puzzle[index] !== 0) return "clue";
  if (value === 0) return "empty";
  return value === game.solution[index] ? "correct" : "wrong";
}

function isRelated(a: number, b: number): boolean {
  return (
    rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b)
  );
}

// 誤りのマスと、誤りのマスと同じ行・列・ブロックで同じ数字のマス
function errorCells(game: GameState): Set<number> {
  const cells = new Set<number>();
  for (let i = 0; i < CELL_COUNT; i++) {
    if (kindOf(game, i) !== "wrong") continue;
    cells.add(i);
    for (const peer of PEERS[i]!) {
      if (game.values[peer] === game.values[i]) cells.add(peer);
    }
  }
  return cells;
}

// 選んだマスの数字。未選択か空欄なら 0
function selectedDigit(game: GameState, selected: number | null): number {
  return selected === null ? 0 : game.values[selected]!;
}

function highlightOf(
  game: GameState,
  index: number,
  selected: number | null,
  errors: Set<number>,
): CellHighlight {
  if (index === selected) return "selected";
  if (errors.has(index)) return "error";
  if (selected === null) return "none";
  const selectedValue = selectedDigit(game, selected);
  if (selectedValue !== 0 && game.values[index] === selectedValue) {
    return "same-digit";
  }
  return isRelated(index, selected) ? "related" : "none";
}

function labelOf(game: GameState, index: number, hidden: boolean): string {
  const position = `${rowOf(index) + 1} 行 ${colOf(index) + 1} 列`;
  if (hidden) return position;
  const value = game.values[index]!;
  switch (kindOf(game, index)) {
    case "clue":
      return `${position}、${value}、手がかり`;
    case "correct":
      return `${position}、${value}`;
    case "wrong":
      return `${position}、${value}、誤り`;
    case "empty": {
      const notes = game.notes[index]!;
      return notes.length === 0
        ? `${position}、空欄`
        : `${position}、メモ ${notes.join(" ")}`;
    }
  }
}

export function Board({
  game,
  selected,
  hidden,
  onSelect,
}: {
  game: GameState;
  selected: number | null;
  hidden: boolean;
  onSelect: (index: number) => void;
}) {
  const errors = hidden ? new Set<number>() : errorCells(game);
  // メモの中で強調する数字(空欄や未選択なら 0 で、どのメモとも合わない)
  const noteDigit = selectedDigit(game, selected);
  const gridRef = useRef<HTMLDivElement>(null);

  // 盤面にフォーカスがあるときは、選んだマスにフォーカスを移す(読み上げで今のマスが分かるように)
  useEffect(() => {
    const grid = gridRef.current;
    if (grid === null || selected === null) return;
    if (!grid.contains(document.activeElement)) return;
    grid.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.focus();
  }, [selected]);

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label="数独の盤面"
      className="grid aspect-square w-full grid-rows-9 border-2 border-gray-800 bg-white select-none"
    >
      {Array.from({ length: 9 }, (_, row) => (
        <div key={row} role="row" className="grid min-h-0 grid-cols-9">
          {Array.from({ length: 9 }, (_, col) => {
            const index = row * 9 + col;
            const kind = kindOf(game, index);
            const value = game.values[index]!;
            return (
              <div
                key={index}
                role="gridcell"
                aria-label={labelOf(game, index, hidden)}
                aria-selected={index === selected}
                data-index={index}
                // Tab で盤面に入るのは 1 マスだけ(選んだマス。未選択なら左上)。隠している間は入らない
                tabIndex={!hidden && index === (selected ?? 0) ? 0 : -1}
                data-kind={hidden ? undefined : kind}
                data-highlight={
                  hidden ? "none" : highlightOf(game, index, selected, errors)
                }
                onClick={() => onSelect(index)}
                // Tab で入ったマスも選ぶ(選んだマスの枠がフォーカスの印になる)
                onFocus={() => onSelect(index)}
                className={cn(
                  "flex min-w-0 cursor-pointer items-center justify-center bg-white focus:outline-none",
                  col < 8 &&
                    (col % 3 === 2
                      ? "border-r-2 border-r-gray-800"
                      : "border-r border-r-gray-300"),
                  row < 8 &&
                    (row % 3 === 2
                      ? "border-b-2 border-b-gray-800"
                      : "border-b border-b-gray-300"),
                  "data-[highlight=related]:bg-gray-100",
                  "data-[highlight=same-digit]:bg-blue-100",
                  "data-[highlight=error]:bg-red-100",
                  // 枠は ring で描く(フォーカスで outline を消しても残るように)
                  "data-[highlight=selected]:bg-blue-200 data-[highlight=selected]:ring-2 data-[highlight=selected]:ring-blue-700 data-[highlight=selected]:ring-inset",
                )}
              >
                {hidden ? null : value !== 0 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "text-lg sm:text-2xl",
                      kind === "clue" && "font-bold text-gray-900",
                      kind === "correct" && "font-medium text-blue-700",
                      kind === "wrong" &&
                        "font-medium text-red-700 underline underline-offset-2",
                    )}
                  >
                    {value}
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid h-full w-full grid-cols-3 p-px text-[8px] leading-none text-gray-600 sm:text-[10px] md:text-sm"
                  >
                    {DIGITS.map((d) => {
                      const noted = game.notes[index]!.includes(d);
                      const same = noted && d === noteDigit;
                      return (
                        <span
                          key={d}
                          data-note-highlight={same ? "true" : undefined}
                          className={cn(
                            "flex items-center justify-center",
                            // 色だけに頼らず、太字と丸の背景でも区別する(N-03)
                            same &&
                              "rounded-full bg-blue-200 font-bold text-blue-800",
                          )}
                        >
                          {noted ? d : ""}
                        </span>
                      );
                    })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
