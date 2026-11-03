import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "数独パズル",
  description: "ブラウザで遊ぶ数独",
  // 広く知らせない前提のため、検索エンジンに載せない(N-04)
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
