// 外から受け取った値(localStorage、Web Worker のメッセージ)を確かめる型ガード

// 配列でないオブジェクト
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// min 以上 max 以下の整数
export function isIntInRange(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}
