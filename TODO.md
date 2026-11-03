# TODO

仕様書は [CLAUDE.md](CLAUDE.md) の「仕様書の一覧」を参照する。MCP サーバの検討結果は [MCP_SERVERS.md](MCP_SERVERS.md)。

- デプロイの目標: 2026 年 12 月上旬
- 仕様書(要件・ゲームのルール・画面・テスト)とモックは作成済み(2026-11-03 にユーザが確定)

```mermaid
flowchart LR
    P0["0 事前準備"] --> P1["1 環境構築"]
    P1 --> P2["2 問題の生成"]
    P2 --> P3["3 ゲームの状態と保存"]
    P3 --> P4["4 画面"]
    P4 --> P5["5 E2E"]
    P5 --> P6["6 実装の網羅確認"]
    P6 --> P7["7 デプロイ"]
    P7 --> P8["8 Makefile"]
    P8 --> P9["9 GitHub 移行"]
```

## フェーズ 0: 事前準備

- [x] `phase-start-check` スキルで、開発ツールの更新のチェックと、待ちの TODO の条件の確認を行う(2026-11-03。更新のチェックは前回の 2026-10-24 から 2 週間たっていないので行わなかった。このプロジェクトが参照する待ちの TODO は無かった。Docker を使わないので `/sandbox` は有効にすると決め、ユーザが切り替える)
- [x] MCP サーバの採用・不採用を決める([MCP_SERVERS.md](MCP_SERVERS.md))(2026-11-03 にユーザが決めた)
  - [x] Next.js DevTools、Context7、Playwright、Google Developer Knowledge、Exa、Sequential Thinking、Mermaid(導入済み)→ すべて採用
  - [x] shadcn/ui(未導入)→ 採用
  - [x] GitHub MCP、DB の MCP など(不採用の案)→ 不採用
- [x] shadcn/ui MCP を local スコープで追加する(2026-11-03。`shadcn@4.22.1`(2026-10-18 公開)に固定。`claude mcp get shadcn` で接続を確かめた)
- [x] Reload Window をして、新しい会話で shadcn/ui MCP のツールを使えることを確かめる(`registries` に `@shadcn` を明示して検索する)(2026-11-03。新しい会話で `@shadcn` を明示して「dialog」を検索し、結果が返った。`components.json` がまだ無くても検索できた)
- [x] このプロジェクトで Vercel プラグインを無効にするかを決め、無効にするなら設定する(2026-11-03 にユーザが無効にすると決めた。`.claude/settings.local.json` の `enabledPlugins` で無効にした)
- [x] Reload Window をして、新しい会話で Vercel のツールとセッションの始めの Vercel の情報が読み込まれていないことを確かめる(2026-11-03。新しい会話のツール一覧に Vercel のツールが無く、セッションの始めにも Vercel の情報が無かった)

### 振り返り

- [x] フェーズ内で実施した作業において、今後の開発に活かせそうなルールがないか振り返って確認し、ルールとして採用するべき項目があれば、提案する(2026-11-03。技術ルール `shadcn-tailwind.md` に、4.22.1 では検索結果の「Add command」が正しく表示されたことを書き足した。ユーザが承認した)

## フェーズ 1: 環境構築

- [x] `phase-start-check` スキルで、開発ツールの更新のチェックと、待ちの TODO の条件の確認を行う(2026-11-03。更新のチェックは前回の 2026-10-24 から 2 週間たっていないので行わなかった。待ちの TODO の「ESLint 10 への更新」「TypeScript 7 への更新」は、どちらも条件を満たしていなかった(`eslint-config-next` 16.4.4、`typescript-eslint` 8.72.1 の `peerDependencies.typescript` は `>=4.8.4 <6.1.0`)。Docker を使わないので `/sandbox` は有効のまま)
  - [x] `/sandbox` で `~/.npm` に書けず npm が `EPERM` になるので、npm のコマンドには `npm_config_cache="$TMPDIR/npm-cache"` を付ける(2026-11-03 にユーザが決めた)
  - [x] 手元の bare リポジトリへの push は、`/sandbox` で止められる。2026-11-03 の push はユーザが自分のターミナルで行った
- [x] 技術ルール(`~/Development/Rules/tech/` の `node.md`、`npm.md`、`typescript.md`、`nextjs.md`、`react.md`、`shadcn-tailwind.md`、`vitest.md`、`eslint-prettier.md`、`husky-lint-staged.md`)を読み込む(2026-11-03)
- [x] 専門エージェント `commit-message-writer` を作る(effort の推奨を示してユーザが決める。`~/Development/Rules/AGENTS.md`)(2026-11-03。ユーザが medium に決めた。personal-pesticide-management の定義を元にした)
- [x] 試行中の「依存ライブラリのアップデートと破壊的変更の調査」の専門エージェントを作るかをユーザに確認し、作ると決めたら作る(2026-11-03。ユーザが作ると決めた。`dependency-update-reviewer`、effort は high。使った結果は [AGENTS_TRIAL.md](AGENTS_TRIAL.md) に記録すると決めた)
- [x] 新しい会話で、`commit-message-writer` と `dependency-update-reviewer` を呼べることを確かめる(2026-11-03。`commit-message-writer` は、作った会話の中で呼べるようになり、このコミットの文案に使えた。`dependency-update-reviewer` は依存の確認のときに確かめる。`dependency-update-reviewer` も同じ会話で呼べ、依存の確認に使えた)

### 雛形

- [x] `git init` と、手元の bare リポジトリ(`~/Development/git-local/sudoku-pazzle.git`)を `origin` にする設定(2026-11-03 に済んだ。`origin/HEAD` も作成済み)
- [x] `.nvmrc` を `26` にする。`node -v` と比べる(`node.md`)(2026-11-03。シェルの `node -v` は v26.13.0(nvm の既定)で、`.nvmrc` と合っていた)
- [x] `create-next-app` を scratchpad で作って取り込む。`CLAUDE.md` は取り込まず、`AGENTS.md` はコミットする。`.gitignore` は中身を合わせる(`nextjs.md`)(2026-11-03。`create-next-app@16.4.2`(2 週間たった安定版の最新)で、TypeScript・Tailwind CSS・ESLint・App Router・`src/`、React Compiler と Cache Components は無効(ユーザが決めた)。16.4.2 は `CLAUDE.md` を作らなかった。`README.md` はフェーズ 8 で書くので取り込まなかった。`.gitignore` には `/build/`、`*.pem`、`npm-debug.log*` だけを足した)
  - [x] `/sandbox` の中で動かすと、雛形を作った後に設定の保存(`~/Library/Preferences`)で `Maximum call stack size exceeded` で落ちる(雛形はできている。落ちたのは設定の保存と推測)。技術ルール `nextjs.md` に書くかを、フェーズ 1 の振り返りで提案する(2026-11-03。振り返りで、サンドボックスに当てはまることなので `claude-code-sandbox.md` に書いた)
- [x] 入った依存の公開日を確かめ、2 週間たっていない版を下げる(`npm.md`。`dependency-update-reviewer` に調べさせ、`AGENTS_TRIAL.md` に記録する)(2026-11-03。ユーザが決めた: `tailwindcss` と `@tailwindcss/turbopack` を 4.3.4 から 4.3.3 に下げた(`^4.3.3`)。`react`・`react-dom` を 19.3.1、`@types/node` を 26.6.5 に上げた。`next`・`eslint-config-next` は 16.4.2 のまま)
  - [x] `npm audit` は moderate 16 件(本番の依存は 0 件)。根は ESLint 系の中の `minimatch`(GHSA-g3hv-75wg-m249、`< 11.0.1`)だけで、ESLint 10 や各プラグインの最新版もまだ 11 未満に依存するため、上流の修正待ちとして見送る(2026-11-03 にユーザが決めた。開発用の依存だけで本番に入らず、入力はリポジトリの中のパターンだけのため)。再確認はフェーズ 2 と 7 の項目
- [x] ESLint と TypeScript の版を決める。待ちの TODO の「ESLint 10 への更新」「TypeScript 7 への更新」を参照する(`~/Development/Rules/TODO-waiting.md`)(2026-11-03。ESLint は 9.39.5(9 系の最後。9 系は 2026-08-06 にサポート終了だが、10 は待ちの TODO の条件を満たしていない)。TypeScript は 6.0.3 にするとユーザが決めた。`tsconfig.json` は雛形のままで型チェックが通った)
- [x] `output: "standalone"` を設定する(2026-11-03。ビルドで `.next/standalone/server.js` ができることを確かめた)
- [x] `noindex` の meta を全ページに入れる(N-04)(2026-11-03。`src/app/layout.tsx` の `metadata.robots`。ビルドした `/` と `/_not-found` の HTML に入っていることを確かめた。あわせて `lang="ja"` とタイトルを直した)
- [x] 雛形の Google Fonts(Geist)を外し、端末の標準のフォントにする(2026-11-03 にユーザが決めた。`src/components/CLAUDE.md` の「共通」に書いた。`/sandbox` の中では Turbopack のフォントの取得がプロキシを通らず、ビルドが失敗したため)
- [x] インストール後スクリプトの承認を確かめる(`npm.md`)(2026-11-03。`package-lock.json` に `hasInstallScript` を持つものは 0 件で、承認するものは無かった)

### 道具

- [x] shadcn/ui を `init` し、足された依存の公開日を確かめる(`shadcn-tailwind.md`)(2026-11-03。`shadcn@4.22.1 init --defaults`。土台は Base UI、プリセットは base-nova(ユーザが決めた))
  - [x] `init` が Geist のフォントを `layout.tsx` に入れ直したので外し、端末の標準のフォントに戻した(画面仕様書の「共通」)
  - [x] 2 週間たっていない版で入った 3 つを下げた: `cn` 0.5.2 から 0.5.0、`lucide-react` 1.66.0 から 1.59.0(1.60.0 は公開から 13.9 日だった)、`shadcn` 4.23.0 から 4.22.1(MCP と同じ版)
  - [x] CSS の `@import` だけで読む `shadcn` と `tw-animate-css` を `devDependencies` に移した(`nextjs.md`。`.next/standalone/node_modules` に入っていないことを確かめた)
  - [x] `npm audit` は 21 件(low 2、moderate 19。本番の依存は 0 件)に増えた。増えた分は `shadcn` の中の `ts-morph` 経由の `minimatch`(上の見送りと同じ根)と、`@shadcn/registry` の中の `deepmerge`(low、GHSA-gcqx-w48m-w2h4。最新の 4.3.1 も対象で、直った版が無い)。どちらも開発用の依存なので、`minimatch` と同じく上流待ちとし、フェーズ 2 と 7 の項目で確かめる
- [x] Vitest、React Testing Library、カバレッジ(`json-summary` を含む)を入れる。`components/ui/` を計測から外す(2026-11-03。`vitest`・`@vitest/coverage-v8` 5.0.5(`latest` の 5.1.0 は 11-02 公開。4.1.12 は 4 系のバックポート)、`jsdom` 30.1.3、`@testing-library/*`。中の `vite` が 8.3.5(10-21 公開)で入るので、`vite` 8.3.4 を `--save-exact` で開発用の依存に入れた。設定は `vitest.config.mts` と `tests/setup.ts`。一時的なテストで、jsdom・React Testing Library・jest-dom・`@/`・shadcn/ui のボタンが動き、`coverage-summary.json` から `components/ui/` が外れることを確かめてから消した)
  - [x] `fsevents` のインストール後スクリプトを拒否した(2026-11-03 にユーザが決めた。同梱の部品を使うので動きは変わらない。`allowScripts` に記録し、入れ直しで警告が出ないことを確かめた)
- [x] ESLint と Prettier を設定する。Prettier の対象に仕様書の Markdown とモックを含めるか、`prettier-plugin-tailwindcss` を使うかをユーザに確認する(`eslint-prettier.md`)(2026-11-03。ユーザが決めた: `*.md` とモックは整形しない(`.prettierignore`)、`prettier-plugin-tailwindcss` 0.8.1 を使う。`prettier` 3.9.10 は `--save-exact`。`eslint-config-prettier` 10.1.8 を ESLint の設定の最後に置いた)
  - [x] 全体の整形(`npm run format`)だけのコミットを作り、ハッシュを `.git-blame-ignore-revs` に書く(`eslint-prettier.md`。雛形と shadcn/ui の生成物の 5 ファイル)(2026-11-03。コミット f4fd5b8。`git config blame.ignoreRevsFile` は `/sandbox` で `.git/config` に書けず、ユーザが自分のターミナルで設定した)
- [x] Husky と lint-staged を入れる(`husky-lint-staged.md`)(2026-11-03。`husky` 9.1.7、`lint-staged` 17.6.0。`.husky/pre-commit` は `npx lint-staged`。`husky init` は `/sandbox` で `core.hooksPath` を書けず、ユーザが自分のターミナルで `npx husky` を実行した)
- [x] `typecheck`、`test`、`format`、`format:check` の npm スクリプトを置く(2026-11-03。`test:coverage` も置いた)
- [x] lint、型チェック、テスト、ビルドが通ることを確かめてコミットする(2026-11-03。lint、型チェック、`format:check`、ビルド(`.next/standalone/server.js` ができる)が通った。テストのファイルはまだ無く `npm test` は「No test files found」で終了コード 1 になるが、`--passWithNoTests` は付けないとユーザが決めた(テストが拾われなくなったときに気づけるように)。テストの設定は一時的なテストで確かめた。pre-commit は、`any` を入れた使い捨てのファイルでコミットが止まることを確かめた)

### 振り返り

- [x] フェーズ内で実施した作業において、今後の開発に活かせそうなルールがないか振り返って確認し、ルールとして採用するべき項目があれば、提案する(2026-11-03。7 件を提案し、ユーザが全部を採用した。`claude-code-sandbox.md` の「囲いと合わない作業」に 5 行(ビルドの待ち受け、npm のキャッシュ、`next/font/google`、`.git/config`、`create-next-app`)、`npm.md` に公開日が境目のときは時刻で比べること、`shadcn-tailwind.md` に `init` がフォントを入れ直すことを書いた。バックアップは `~/Development/Rules/Backup/` の `*.2026-11-03-1300.bak`)
  - 提案の候補(2026-11-03 に出てきたもの): `/sandbox` の中では、Next.js のビルドも Turbopack の CSS の loader がローカルのポートで待ち受けるため `allowLocalBinding` が要った(開発サーバーだけではない)。npm は `~/.npm` に書けず `EPERM`(「root-owned files」と出るが原因は囲い)になる。`next/font/google` の取得はプロキシを通らない。`.git/config` に書けず、`git config` と `husky` の設定はユーザに頼んだ

## フェーズ 2: 問題の生成

テスト仕様書の T-001〜T-009。仕様は `src/lib/CLAUDE.md` の G-01〜G-13。

- [ ] `phase-start-check` スキルで、開発ツールの更新のチェックと、待ちの TODO の条件の確認を行う
- [ ] 2026-11-03 の Next.js のセキュリティリリース(medium 7 件)の影響する版を確かめ、`next` 16.4.2 が対象なら、上げるかをユーザに確認する(フェーズ 1 で決めた)
- [ ] `npm audit` の `minimatch` と `deepmerge` の指摘(フェーズ 1 で見送った)と、ESLint 10 への更新の条件をもう一度確かめる
- [ ] 技術ルール(`typescript.md`、`vitest.md`)を読み込む
- [ ] 専門エージェント `unit-test-writer`、`code-reviewer`、`type-strictness-reviewer` を作る(effort の推奨を示してユーザが決める)

### 実装(テストを先に書く)

- [ ] 盤面の型と、行・列・ブロックの補助関数
- [ ] 解の数を数える処理(T-004、T-005)
- [ ] 乱数の元を受け取る乱数の関数(G-02)
- [ ] 手筋で解く処理と、難易度の判定(シングル、ロックされた候補、ペア、トリプル、X-Wing)(T-006〜T-008)
- [ ] 問題の生成と、時間内に作れないときの失敗(T-001〜T-003)
- [ ] 生成の時間を測り(T-009)、手がかりの数と手筋を調整する。変えたら `src/lib/CLAUDE.md` の表を直す
- [ ] Web Worker で生成を動かす入口

### 確認

- [ ] `code-reviewer` と `type-strictness-reviewer` で見て、指摘を確かめてから直す
- [ ] テストの結果とカバレッジ(`coverage-summary.json`)を報告する

### 振り返り

- [ ] フェーズ内で実施した作業において、今後の開発に活かせそうなルールがないか振り返って確認し、ルールとして採用するべき項目があれば、提案する

## フェーズ 3: ゲームの状態と保存

テスト仕様書の T-101〜T-303。仕様は `src/lib/CLAUDE.md` の G-21〜G-83。

- [ ] `phase-start-check` スキルで、開発ツールの更新のチェックと、待ちの TODO の条件の確認を行う
- [ ] 技術ルール(`typescript.md`、`vitest.md`)を読み込む

### 実装(テストを先に書く)

- [ ] 数字の入力と消す(T-101〜T-108)
- [ ] メモ(T-111、T-112)
- [ ] 元に戻す・やり直し(T-121〜T-125)
- [ ] クリア、失敗、やり直す(T-131〜T-134)
- [ ] タイマーの表示の形(T-201)
- [ ] 成績の記録とクリア率・ベストタイム(T-202〜T-204)
- [ ] localStorage の読み書きと形の検証(T-301〜T-303)

### 確認

- [ ] `code-reviewer` と `type-strictness-reviewer` で見て、指摘を確かめてから直す
- [ ] テストの結果とカバレッジを報告する

### 振り返り

- [ ] フェーズ内で実施した作業において、今後の開発に活かせそうなルールがないか振り返って確認し、ルールとして採用するべき項目があれば、提案する

## フェーズ 4: 画面

テスト仕様書の T-401〜T-414。仕様は `src/components/CLAUDE.md` とモック。

- [ ] `phase-start-check` スキルで、開発ツールの更新のチェックと、待ちの TODO の条件の確認を行う
- [ ] 技術ルール(`nextjs.md`、`react.md`、`shadcn-tailwind.md`、`vitest.md`、`playwright.md` の「Playwright MCP」)を読み込む
- [ ] 試行中の「エラーログの分析と原因の追究」の専門エージェントを作るかをユーザに確認し、作ると決めたら作る

### 実装(テストを先に書く)

- [ ] 雛形のままの `src/app/page.tsx` と `public/` の SVG を消し、`globals.css` と画面からダークモードの指定(`prefers-color-scheme: dark`、`dark:` のクラス)を外す(ダークモードは MVP に入れない。2026-11-03 にフェーズ 1 のコミットの文案で指摘された)
- [ ] ゲームの状態を持つ部品と、localStorage との同期(hydration の不一致を起こさない。G-83)
- [ ] 保存できないときの知らせ(T-414)
- [ ] ホーム: 続きから、難易度、上書きの確認、生成中、失敗(T-401〜T-403)
- [ ] 盤面: 表示の区別と読み上げの名前(T-404、T-405)
- [ ] キーボードと、操作・数字のボタン(T-406、T-407、T-410)
- [ ] タイマーと一時停止、タブが隠れたときの一時停止(T-408、T-409)
- [ ] クリアと失敗のダイアログ(T-411、T-412)
- [ ] 成績の画面(T-413)

### 確認

- [ ] 各画面をモックと見比べ、幅 320px と PC の幅で確かめる。ブラウザのコンソールにエラーが無いことを確かめる
- [ ] 問題の生成の時間を、スマホの実機か、スマホ相当の CPU の制限で測る(N-02 の 3 秒以内)
- [ ] `code-reviewer` で見て、指摘を確かめてから直す
- [ ] テストの結果とカバレッジ(コンポーネントとフックごと)を報告する

### 振り返り

- [ ] フェーズ内で実施した作業において、今後の開発に活かせそうなルールがないか振り返って確認し、ルールとして採用するべき項目があれば、提案する

## フェーズ 5: E2E

テスト仕様書の T-501〜T-508。

- [ ] `phase-start-check` スキルで、開発ツールの更新のチェックと、待ちの TODO の条件の確認を行う
- [ ] 技術ルール(`playwright.md`)を読み込む
- [ ] 専門エージェント `e2e-test-writer` を作る(effort の推奨を示してユーザが決める)
- [ ] Playwright Test を入れ、standalone のビルドで起動する設定にする。PC とスマホの幅のプロジェクトを作る
- [ ] T-501〜T-508 を書き、`--repeat-each 3` で安定することを確かめる
- [ ] 本番のコードを壊して、狙ったテストが落ちることを確かめる

### 振り返り

- [ ] フェーズ内で実施した作業において、今後の開発に活かせそうなルールがないか振り返って確認し、ルールとして採用するべき項目があれば、提案する

## フェーズ 6: 実装の網羅確認

このフェーズを始める指示には「ultrathink」を含める。

- [ ] `phase-start-check` スキルで、開発ツールの更新のチェックと、待ちの TODO の条件の確認を行う
- [ ] 試行中の「リファクタリング」の専門エージェントを作るかをユーザに確認し、作ると決めたら作る
- [ ] Sequential Thinking MCP を使い、実装したコードを網羅的に確認する(仕様書と実装の突き合わせ、コーディング規約、チェック済みの TODO がコードとテストで満たされているか、テストの品質、lint・型チェック・テスト・画面での動作)
- [ ] 残タスクがあれば、一覧をユーザに出力する(内容、見つけた観点、本来実施すべきだったフェーズ)
- [ ] 残タスクを、本来実施すべきだったフェーズに追記する(網羅確認で追加したことを書き添える)
- [ ] 追記した残タスクをいつ実施するかをユーザに確認する

### 振り返り

- [ ] フェーズ内で実施した作業において、今後の開発に活かせそうなルールがないか振り返って確認し、ルールとして採用するべき項目があれば、提案する

## フェーズ 7: デプロイ

デプロイはユーザの指示を受けてから行う。

- [ ] `phase-start-check` スキルで、開発ツールの更新のチェックと、待ちの TODO の条件の確認を行う
- [ ] 技術ルール(`docker.md`、`cloud-run.md`)を読み込む

### 準備

- [ ] Cloud Run と Artifact Registry の無料枠を、公式の情報で確かめ直す。2026-11-03 の時点で、製品ページと Firebase App Hosting のページで Cloud Run の CPU とメモリの無料枠の数値が違っていた。料金ページの本文は取得できなかった。送信データの無料枠(北米内で月 1 GiB)はドキュメントで確かめた
- [ ] Google Cloud のプロジェクトと gcloud の名前付きの構成を作り、支払いアカウントを紐付ける。構成の名前とプロジェクト ID を `CLAUDE.md` に書く(`cloud-run.md`)
- [ ] 最初から有効な API に料金がかからないかを確かめ、止めるかを決める
- [ ] `npm audit`(全体と `--omit=dev`)と `next` のセキュリティの指摘をもう一度確かめる(フェーズ 1 で `minimatch` を見送り、フェーズ 2 で Next.js の 11 月の指摘を確かめる。その後に出たものも見る)
- [ ] Node.js 26 の公開から 2 週間たった版をイメージに使う。26.13.0 は 2026-10-28 公開なので、2026-11-11 以降なら条件を満たす
- [ ] `/security-review` の対象になる変更があるかを確かめ、あれば実行して記録する

### イメージとデプロイ

- [ ] Dockerfile と `.dockerignore` を作る(`HOSTNAME=0.0.0.0`。テスト、`.env*`、`.playwright-mcp/` などを入れない)
- [ ] 手元でイメージを動かして確かめる
- [ ] Artifact Registry のリポジトリを作り、クリーンアップポリシーで最新の数版だけを残す
- [ ] 実行用のサービスアカウントを作る
- [ ] Cloud Run にデプロイする(`us-central1`、最小 0、最大はリビジョンとサービス全体の両方)
- [ ] 予算の通知を設定する
- [ ] `describe` で設定を読み出して確かめる
- [ ] 本番の画面で確かめる項目の一覧を作り、ユーザに自分のブラウザで確かめてもらう

### 振り返り

- [ ] フェーズ内で実施した作業において、今後の開発に活かせそうなルールがないか振り返って確認し、ルールとして採用するべき項目があれば、提案する

## フェーズ 8: Makefile

- [ ] `phase-start-check` スキルで、開発ツールの更新のチェックと、待ちの TODO の条件の確認を行う
- [ ] `seed` のターゲットを省くかをユーザに確認する(DB を使わないため)
- [ ] 各ターゲット(`init`、`dev`、`build`、`deploy`、`test`)の中身を決め、作る前にユーザに確認する
- [ ] Makefile を作り、各ターゲットが動くことを確かめる。`deploy` は `make -n deploy` で確かめる
- [ ] 仕様書と README に Makefile の使い方を書く

### 振り返り

- [ ] フェーズ内で実施した作業において、今後の開発に活かせそうなルールがないか振り返って確認し、ルールとして採用するべき項目があれば、提案する

## フェーズ 9: GitHub 移行

`github-pr-cycle` スキルの「MVP 後の開発サイクル(GitHub)」に移る。

- [ ] `phase-start-check` スキルで、開発ツールの更新のチェックと、待ちの TODO の条件の確認を行う
- [ ] 技術ルール(`github-flow.md`、`github-actions.md`)を読み込む
- [ ] GitHub のリポジトリを公開にするか非公開にするかをユーザに確認する(無料プランの非公開ではブランチの保護と Environments の承認を使えない)
- [ ] リポジトリを作り、`git remote set-url origin` で向き先を変える
- [ ] リポジトリの設定(squash マージだけを許可、マージしたブランチの自動削除)
- [ ] PR で動くテストのワークフローと、承認者だけがタグを指定してデプロイできるワークフロー(Workload Identity Federation)
- [ ] PR のテンプレートと `CHANGELOG.md`
- [ ] TODO.md の未完了の項目を Issue に移し、TODO.md にはその後の扱い(Issue で管理すること)を書く

### 振り返り

- [ ] フェーズ内で実施した作業において、今後の開発に活かせそうなルールがないか振り返って確認し、ルールとして採用するべき項目があれば、提案する

## MVP の後にやりたいこと

- [ ] ヒント、今日の問題、成績のリセット、メモの自動更新、ダークモード、オフライン動作(PWA)を入れるかを決める(`CLAUDE.md` の「MVP に入れないもの」)
