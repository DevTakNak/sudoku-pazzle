import { defineConfig, devices } from "@playwright/test";

// 手で起動したサーバー(既定の 3000)と重ならないポート
const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "pc",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      // 幅 480px 未満(数字のボタンが 5 列と 4 列)で、タッチで操作するスマホ
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  // 本番と同じビルドで動かす(Vercel では next start 相当で動く)
  webServer: {
    command: `npm run build && npx next start -p ${PORT} -H 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
