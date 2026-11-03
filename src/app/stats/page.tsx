import type { Metadata } from "next";

import { StatsScreen } from "@/components/stats-screen";

export const metadata: Metadata = { title: "成績 - 数独パズル" };

export default function StatsPage() {
  return <StatsScreen />;
}
