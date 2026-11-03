// 偽の Storage(メモリだけで動く)と、保存の値を作る補助関数。
// setItem が呼ばれたキーを順に覚え、キーごとに例外を出させることもできる
import type { GameState, SavedStats } from "@/lib/game/types";
import { GAME_KEY, STATS_KEY } from "@/lib/storage/storage";

export class FakeStorage implements Storage {
  [name: string]: unknown;

  private readonly data = new Map<string, string>();

  // setItem が呼ばれたキー(例外になった呼び出しも含む)。呼ばれた順
  readonly setItemCalls: string[] = [];
  // getItem が呼ばれた回数
  getItemCount = 0;
  // true を返したキーの setItem は、容量の超過の例外を出す
  failWhen: (key: string) => boolean = () => false;

  constructor(initial: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initial)) {
      this.data.set(key, value);
    }
  }

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    this.getItemCount += 1;
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.setItemCalls.push(key);
    if (this.failWhen(key)) {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    }
    this.data.set(key, value);
  }

  // 保存されている文字列をそのまま読む(getItem の回数に数えない)
  raw(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  // 呼び出しの記録だけを空にする(保存の中身は残す)
  resetCalls(): void {
    this.setItemCalls.length = 0;
    this.getItemCount = 0;
  }
}

// 保存の値を入れた偽の Storage。省いた項目は入れない
export function storageWith(saved: {
  game?: GameState;
  stats?: SavedStats;
}): FakeStorage {
  const initial: Record<string, string> = {};
  if (saved.game !== undefined) initial[GAME_KEY] = JSON.stringify(saved.game);
  if (saved.stats !== undefined) {
    initial[STATS_KEY] = JSON.stringify(saved.stats);
  }
  return new FakeStorage(initial);
}
