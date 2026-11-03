// toBeInTheDocument などの DOM 用マッチャーを expect に追加する
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 各テストの後に描画した DOM を片付ける(Node 環境のテストでは何もしない)
afterEach(() => {
  cleanup();
});
