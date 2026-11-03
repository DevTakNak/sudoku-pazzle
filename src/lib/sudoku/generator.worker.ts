// 問題の生成を画面と別のスレッドで動かす入口(G-01、G-04、N-02)。
// 画面からは new Worker(new URL("./generator.worker.ts", import.meta.url)) で起動する

import { handleGenerateMessage } from "./generator-messages";
import type { GenerateResponse } from "./generator-messages";

// tsconfig の lib は dom なので self は Window の型になる。送る値の型を確かめるため、postMessage を絞って使う
const post: (response: GenerateResponse) => void = (response) =>
  self.postMessage(response);

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  post(handleGenerateMessage(event.data));
});
