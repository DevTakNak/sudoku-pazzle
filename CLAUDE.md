# 数独パズル

ブラウザで遊ぶ数独の Web アプリ。問題はブラウザの中で自動で作り、進行状況と成績はブラウザに保存する。ログインとサーバー側の保存は無い。

## 決めたこと(2026-11-03 にユーザが決めた)

| 項目 | 内容 |
| --- | --- |
| アプリ名 | 数独パズル(フォルダ名の `sudoku-pazzle` はそのまま) |
| 動かす環境 | Web アプリ(PC とスマホのブラウザ) |
| 使う人 | 自分や身近な人だけ。URL を知っている人が使う。認証はかけない |
| デプロイの目標 | 2026 年 12 月上旬(1 か月以内) |
| 課金の方針 | 開発も運用も無料枠を前提にする。欲しい機能が無料枠で実現できないときは、そのときに課金を検討する |
| データの保存 | ブラウザの中だけ(`localStorage`)。DB は使わない |
| 技術 | 標準の技術スタック(下の「技術」) |
| デプロイ先 | Google Cloud Run の `us-central1`(送信データの無料枠が北米内だけのため) |

## 要件

### 機能

| ID | 要件 |
| --- | --- |
| R-01 | 9×9 の標準の数独を遊べる |
| R-02 | 問題をブラウザの中で自動で作る。解は必ず 1 つだけにする |
| R-03 | 難易度は 3 段階(かんたん・ふつう・むずかしい) |
| R-04 | 候補の数字をマスにメモできる |
| R-05 | 入力を元に戻す・やり直すことができる |
| R-06 | 選んだマスと同じ数字、同じ行・列・ブロックを強調する |
| R-07 | 誤りの数字を、すべての難易度で表示する |
| R-08 | 1 回のゲームで空欄に 3 回間違った数字を入れると、そのゲームは失敗になる。間違いの回数は画面に表示する |
| R-09 | 失敗したら、同じ問題をやり直すか、新しいゲームを始めるかを選ばせる |
| R-10 | プレイ中はタイマーを表示し、一時停止できる |
| R-11 | 難易度ごとの成績(クリア数・失敗数・クリア率・ベストタイム)を記録して表示する |
| R-12 | 進行中のゲームをブラウザに保存し、再読み込みや再訪問の後に続きから遊べる |

ルールの細かい決まりと保存の形式は [src/lib/CLAUDE.md](src/lib/CLAUDE.md)、画面の決まりは [src/components/CLAUDE.md](src/components/CLAUDE.md) に書く。

### 非機能

| ID | 要件 |
| --- | --- |
| N-01 | PC ではキーボードで、スマホでは画面のボタンで最後まで遊べる。幅 320px でも横にはみ出さない |
| N-02 | 問題を作る処理は Web Worker で動かし、作っている間も画面を止めない。スマホでも 3 秒以内を目標にする(実機や実測での調整は TODO) |
| N-03 | 色だけに頼らず、誤りを区別できる。盤面はキーボードと読み上げで操作できる |
| N-04 | 検索エンジンに載せない(`noindex`)。広く知らせない前提のため |
| N-05 | 画面の表示は日本語だけ |

### MVP に入れないもの

ヒント、今日の問題、アカウントと端末間の同期、成績のリセット、メモの自動更新、ダークモード、多言語、オフライン動作(PWA)。

## 技術

| 領域 | 技術 |
| --- | --- |
| 言語 | TypeScript(`strict`) |
| ランタイム | Node.js 26(2026-10-28 に LTS。サポート終了は 2029-04-30。公式のリリース予定で 2026-11-03 に確かめた) |
| Web アプリ | Next.js(App Router、`output: "standalone"`) |
| UI | shadcn/ui + Tailwind CSS |
| テスト | Vitest + React Testing Library、E2E は Playwright Test |
| lint・整形 | ESLint + Prettier、コミット前は Husky + lint-staged |
| デプロイ | Docker イメージを Artifact Registry に push し、Cloud Run で動かす |
| CI/CD | MVP の後に GitHub の Issue と PR、GitHub Actions |

DB、Prisma、認証、API スキーマ(OpenAPI)は使わない。API ルートも作らない。

### 本番の構成

- Cloud Run の最小インスタンスは 0。最大はリビジョンとサービス全体の両方に小さな値を指定する。
- Artifact Registry はクリーンアップポリシーで最新の数版だけを残す。
- 予算の通知を設定する。無料枠の条件は、デプロイの準備で公式の情報を確かめ直す。

## ディレクトリ構成

```text
sudoku-pazzle/
├── CLAUDE.md                 要件の仕様書(このファイル)
├── AGENTS.md                 create-next-app が作るファイル(`next dev` が CLAUDE.md を書き換えないように残す)
├── TODO.md
├── Dockerfile
├── .dockerignore
├── Makefile
├── .nvmrc
├── src/
│   ├── app/                  ルーティング(/、/play、/stats)
│   ├── components/
│   │   ├── CLAUDE.md         画面仕様書
│   │   ├── mocks/            画面のモック(HTML)
│   │   ├── ui/               shadcn/ui が生成するコンポーネント
│   │   └── ...               画面のコンポーネント
│   └── lib/
│       ├── CLAUDE.md         ゲームのルールと保存形式の仕様書
│       ├── sudoku/           問題の生成、解く処理、難易度の判定、Web Worker
│       ├── game/             ゲームの状態の変化(入力、間違い、元に戻すなど)
│       └── storage/          localStorage の読み書き
└── tests/
    ├── CLAUDE.md             テスト仕様書
    ├── unit/                 Vitest
    └── e2e/                  Playwright Test
```

## 環境変数

アプリ独自の環境変数と秘密の値は無い。`.env` のファイルも使わない。

| 変数名 | 必須 | 説明 |
| --- | --- | --- |
| `PORT` | 本番で必須 | 待ち受けるポート。Cloud Run が設定する |
| `HOSTNAME` | 本番で必須 | 待ち受けるアドレス。standalone の出力がすべての接続を受けるように、Dockerfile で `0.0.0.0` にする |

## 仕様書の一覧

| 種類 | パス |
| --- | --- |
| 要件 | `CLAUDE.md`(このファイル) |
| ゲームのルールと保存形式 | `src/lib/CLAUDE.md` |
| 画面仕様書とモック | `src/components/CLAUDE.md`、`src/components/mocks/` |
| テスト仕様書 | `tests/CLAUDE.md` |

API 仕様書と ER 図は、API と DB を使わないので作らない。

## このプロジェクトの MCP サーバと設定

検討結果は [MCP_SERVERS.md](MCP_SERVERS.md)。

- shadcn/ui MCP(local スコープ、`shadcn@4.22.1` に固定): UI 部品を探すときに使う。検索では `registries` に `@shadcn` を明示する。追加のコマンドは `get_add_command_for_items` で取り、`@latest` をプロジェクトで使う版に置き換えて実行する(`shadcn-tailwind.md`)
- Vercel プラグイン: デプロイ先が Cloud Run で使わないので、`.claude/settings.local.json` で無効にしている

## 適用する技術ルール

`~/Development/Rules/tech/` の次のファイル。

- `node.md`、`npm.md`、`typescript.md`
- `nextjs.md`、`react.md`、`shadcn-tailwind.md`
- `vitest.md`、`playwright.md`
- `eslint-prettier.md`、`husky-lint-staged.md`
- `docker.md`、`cloud-run.md`
- `github-flow.md`、`github-actions.md`(MVP の後)
