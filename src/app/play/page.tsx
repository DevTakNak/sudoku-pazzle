import type { Metadata } from "next";

import { GameScreen } from "@/components/game-screen";

export const metadata: Metadata = { title: "ゲーム - 数独パズル" };

export default function PlayPage() {
  return <GameScreen />;
}
