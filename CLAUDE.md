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
| デプロイ先 | Vercel の Hobby プラン(下の「デプロイ先を Vercel にした理由」) |

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
| N-02 | 問題を作る処理は Web Worker で動かし、作っている間も画面を止めない。スマホでも 3 秒以内を目標にする(2026-11-03 に CPU を制限して測り、4 倍遅いときはすべて、6 倍遅いときは 97% が 3 秒以内だった) |
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
| Web アプリ | Next.js(App Router) |
| UI | shadcn/ui + Tailwind CSS |
| テスト | Vitest + React Testing Library、E2E は Playwright Test |
| lint・整形 | ESLint + Prettier、コミット前は Husky + lint-staged |
| デプロイ | Vercel の Hobby プランに、Vercel CLI でデプロイする |
| CI/CD | MVP の後に GitHub の Issue と PR、GitHub Actions |

DB、Prisma、認証、API スキーマ(OpenAPI)は使わない。API ルートも作らない。

### デプロイ先を Vercel にした理由

標準の技術スタックのデプロイ先は Cloud Run だが、このプロジェクトは Vercel にした(2026-11-03 にユーザが決めた。最初は Cloud Run にしていた)。

- API も DB も無く、Cloud Run の自由度(コンテナで何でも動かせること)を使う場面が無い。
- Dockerfile、Artifact Registry、予算の通知、インスタンス数の上限などの管理が要らない。
- Hobby プランは、無料枠を超えても課金されずに止まる。カードの登録も要らない。
- 日本から使うので、CDN で静的なページを近くから返せる。Cloud Run の `us-central1` では毎回米国まで往復し、最小インスタンスが 0 だとコールドスタートもある。
- Hobby プランの条件(個人・非商用)に合う。広告や課金を入れるなら、デプロイ先を見直す(`vercel.md`)。

### 本番の構成

- Vercel の GitHub 連携(push で自動デプロイ)は設定しない。デプロイは、指示を受けてから Vercel CLI で行う。
- テスト、テストの設定、`.env*` などは `.vercelignore` でデプロイから外す。
- 無料枠と利用条件は、デプロイの準備で公式の情報を確かめ直す(`vercel.md`)。

## ディレクトリ構成

```text
sudoku-pazzle/
├── CLAUDE.md                 要件の仕様書(このファイル)
├── README.md                 アプリの概要と、Makefile の使い方
├── AGENTS.md                 create-next-app が作るファイル(`next dev` が CLAUDE.md を書き換えないように残す)
├── TODO.md
├── AGENTS_TRIAL.md           試行中の専門エージェントの記録
├── .vercelignore             Vercel に上げるファイル(ビルドに要るものだけを許可する)
├── Makefile                  よく使うコマンド(下の「Makefile」)
├── .nvmrc
├── package.json              npm のスクリプトと lint-staged の設定
├── components.json           shadcn/ui の設定
├── eslint.config.mjs         ESLint の設定
├── vitest.config.mts         Vitest の設定(カバレッジを含む)
├── playwright.config.ts      Playwright Test の設定(本番のビルドで起動)
├── .husky/                   コミット前の確認(lint-staged)
├── src/
│   ├── app/                  ルーティング(/、/play、/stats)
│   ├── components/
│   │   ├── CLAUDE.md         画面仕様書
│   │   ├── mocks/            画面のモック(HTML)
│   │   ├── ui/               shadcn/ui が生成するコンポーネント
│   │   ├── game-store.ts     画面の状態のストア(ゲームと成績、localStorage との同期)
│   │   ├── game-provider.tsx ストアを画面に渡す Provider
│   │   ├── use-puzzle-generator.ts  Web Worker で問題を作るフック
│   │   ├── message-dialog.tsx       ダイアログの共通部品
│   │   ├── labels.ts         画面の文言(難易度の名前など)
│   │   └── ...               画面のコンポーネント(ホーム、ゲーム、盤面、成績など)
│   └── lib/
│       ├── CLAUDE.md         ゲームのルールと保存形式の仕様書
│       ├── utils.ts          shadcn/ui が生成する補助関数(`cn`)
│       ├── sudoku/           問題の生成、解く処理、難易度の判定、Web Worker
│       ├── game/             ゲームの状態の変化(入力、間違い、元に戻すなど)
│       └── storage/          localStorage の読み書き
└── tests/
    ├── CLAUDE.md             テスト仕様書
    ├── helpers/              テストの補助関数
    ├── unit/                 Vitest
    └── e2e/                  Playwright Test
```

## 環境変数

アプリ独自の環境変数と秘密の値は無い。`.env` のファイルも使わない。Vercel で動かすので、待ち受けるポートとアドレスも設定しない。

## Makefile

よく使うコマンドを、`Makefile` のターゲットにまとめた(2026-11-04 にユーザが決めた)。DB を使わないので、`seed` は作らない。

| ターゲット | 中身 | 使う場面 |
| --- | --- | --- |
| `make init` | `npm ci` と `npx playwright install chromium` | 取得した直後、依存を入れ直すとき |
| `make dev` | `npm run dev`(ポート 3000。使われていれば `PORT=3001 make dev` のように変える) | 開発サーバーで画面を見るとき |
| `make build` | `npm run build` | 本番用のビルドを確かめるとき |
| `make test` | lint、型チェック、Prettier の確認、単体テスト(カバレッジは `npm run test:coverage`) | コミットの前など、ふだんの確認 |
| `make test-e2e` | E2E(本番のビルドをポート 3100 で起動し、PC とスマホの 2 つで動かす) | 画面に関わる変更の後 |
| `make deploy` | `npx vercel deploy`(プレビュー) | 本番の前に、プレビューで確かめるとき |
| `make deploy-prod` | `npx vercel deploy --prod`(本番) | プレビューで確かめた後。デプロイはユーザの指示を受けてから行う |

- Claude Code の `/sandbox` が有効だと、`make dev`(Turbopack のファイルの監視)、`make test-e2e`(Chromium)、`make init` の Chromium の取得は動かない(技術ルールの `claude-code-sandbox.md`)。
- `make deploy` と `make deploy-prod` は、Vercel CLI でログインし、`vercel link` でプロジェクトをつないだ状態で使う(`.vercel/` は git に入れない)。

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
- Vercel プラグイン: デプロイ先を Vercel にしたので、有効にする(2026-11-03 にユーザが決めた。それまでは `.claude/settings.local.json` で無効にしていた)

## 適用する技術ルール

`~/Development/Rules/tech/` の次のファイル。

- `node.md`、`npm.md`、`typescript.md`
- `nextjs.md`、`react.md`、`web-browser.md`、`shadcn-tailwind.md`
- `vitest.md`、`playwright.md`
- `eslint-prettier.md`、`husky-lint-staged.md`
- `vercel.md`
- `github-flow.md`、`github-actions.md`(MVP の後)
