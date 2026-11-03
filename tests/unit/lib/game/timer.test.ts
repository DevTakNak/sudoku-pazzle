import { describe, expect, it } from "vitest";

import { formatElapsed } from "@/lib/game/timer";

describe("formatElapsed", () => {
  it.each([
    [0, "00:00"],
    [1, "00:01"],
    [9, "00:09"],
    [10, "00:10"],
    [59, "00:59"],
    [60, "01:00"],
    [61, "01:01"],
    [599, "09:59"],
    [600, "10:00"],
    [3599, "59:59"],
    [3600, "1:00:00"],
    [3661, "1:01:01"],
    [36000, "10:00:00"],
  ])("T-201: %i 秒は %s と表示する", (seconds, expected) => {
    expect(formatElapsed(seconds)).toBe(expected);
  });

  it("T-201: 1 時間未満は mm:ss(分は 2 桁)、1 時間以上は h:mm:ss(時は桁を揃えない)", () => {
    expect(formatElapsed(3599)).toMatch(/^\d{2}:\d{2}$/);
    expect(formatElapsed(3600)).toMatch(/^\d:\d{2}:\d{2}$/);
    expect(formatElapsed(36000)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
