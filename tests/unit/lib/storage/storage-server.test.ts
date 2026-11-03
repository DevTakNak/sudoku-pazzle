// @vitest-environment node
// サーバーの描画と同じく window が定義されていない環境で、ブラウザの Storage を取り出す(G-83)
import { describe, expect, it } from "vitest";

import { getBrowserStorage } from "@/lib/storage/storage";

describe("T-303: window が定義されていない環境", () => {
  it("T-303: 前提: window が定義されていない", () => {
    expect(typeof window).toBe("undefined");
  });

  it("T-303: getBrowserStorage は例外を出さず null を返す", () => {
    expect(() => getBrowserStorage()).not.toThrow();
    expect(getBrowserStorage()).toBeNull();
  });
});
