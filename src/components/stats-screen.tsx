"use client";

// 成績(画面仕様書の「成績(/stats)」、R-11)
import Link from "next/link";

import { formatBestTime, formatClearRate } from "@/lib/game/stats";
import { DIFFICULTIES } from "@/lib/sudoku/grid";

import { useGameSnapshot } from "./game-provider";
import { DIFFICULTY_LABELS } from "./labels";
import { Loading } from "./loading";

const cell = "px-1 py-3 text-right sm:px-3";

export function StatsScreen() {
  const { loaded, stats } = useGameSnapshot();
  if (!loaded) return <Loading />;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <Link
        href="/"
        className="flex h-11 w-fit items-center font-medium text-blue-700 underline"
      >
        ホーム
      </Link>
      <h1 className="mt-2 text-2xl font-bold">成績</h1>
      <table className="mt-4 w-full table-fixed border-collapse rounded-lg bg-white text-xs sm:text-sm">
        <thead>
          <tr className="border-b text-gray-600">
            <th
              scope="col"
              className="w-[28%] px-1 py-3 text-left font-medium sm:px-3"
            >
              難易度
            </th>
            <th scope="col" className={`${cell} font-medium`}>
              クリア
            </th>
            <th scope="col" className={`${cell} font-medium`}>
              失敗
            </th>
            <th scope="col" className={`${cell} font-medium`}>
              クリア率
            </th>
            <th scope="col" className={`w-[22%] ${cell} font-medium`}>
              ベストタイム
            </th>
          </tr>
        </thead>
        <tbody>
          {DIFFICULTIES.map((difficulty) => {
            const s = stats[difficulty];
            return (
              <tr key={difficulty} className="border-b last:border-b-0">
                <th
                  scope="row"
                  className="px-1 py-3 text-left font-medium sm:px-3"
                >
                  {DIFFICULTY_LABELS[difficulty]}
                </th>
                <td className={cell}>{s.cleared}</td>
                <td className={cell}>{s.failed}</td>
                <td className={cell}>{formatClearRate(s)}</td>
                <td className={`${cell} tabular-nums`}>{formatBestTime(s)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
