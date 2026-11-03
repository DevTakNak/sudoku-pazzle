import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json の paths(@/*)を Vite 標準の機能で解決する
  resolve: {
    tsconfigPaths: true,
  },
  // JSX は Vite 8 標準の oxc で変換する(React 19 の自動ランタイム)
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    // 既定は Node 環境。コンポーネントとフックのテストは
    // ファイル先頭の `// @vitest-environment jsdom` で jsdom に切り替える
    environment: "node",
    // E2E(tests/e2e/)は Playwright Test で動かすので含めない
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // shadcn/ui が生成したコンポーネントは自前のコードではないため除く(技術ルールの shadcn-tailwind.md)
      exclude: ["src/components/ui/**"],
      // text の表は 100% のファイルを省くため、ファイルごとの数値は json-summary(coverage/coverage-summary.json)で見る
      reporter: ["text", "html", "json-summary"],
    },
  },
});
