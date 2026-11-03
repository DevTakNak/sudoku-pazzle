import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // テストの結果(ESLint は .gitignore を読まないため)
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
  ]),
  // 書式のルールを切り、書式は Prettier に任せる(配列の最後に置く。技術ルールの eslint-prettier.md)
  prettier,
]);

export default eslintConfig;
