# 数独パズル

ブラウザで遊ぶ数独の Web アプリ。問題はブラウザの中で自動で作り、進行状況と成績はブラウザ(`localStorage`)に保存する。ログインとサーバー側の保存は無い。

- 本番: https://sudoku-pazzle.vercel.app(Vercel の Hobby プラン)
- 仕様書: [CLAUDE.md](CLAUDE.md)(要件)と、そこから参照する仕様書の一覧

## 必要なもの

- Node.js 26(`.nvmrc`)
- デプロイするときは、Vercel のアカウント(CLI は開発用の依存に入っている)

## 使い方

```sh
make init         # 依存と、E2E 用の Chromium を入れる
make dev          # 開発サーバー(http://localhost:3000)
make build        # 本番用のビルド
make test         # lint、型チェック、Prettier の確認、単体テスト
make test-e2e     # E2E(Playwright Test)
make deploy       # Vercel のプレビューにデプロイ
make deploy-prod  # Vercel の本番にデプロイ
```

デプロイの前に、`npx vercel login` でログインし、`npx vercel link` でプロジェクトをつなぐ。各ターゲットの中身は [CLAUDE.md](CLAUDE.md) の「Makefile」に書いた。

## 本番に出す流れ(GitHub Actions)

1. PR をマージして、バージョンのタグ(`v1.2.3`)を付ける
2. `preview` のワークフローを、タグを指定して実行し、ジョブのまとめに出るプレビューの URL を、Vercel にログインしたブラウザで開いて確かめる
3. 承認者が `deploy` のワークフローを同じタグで実行し、`production` の承認をして本番に出す

詳しくは [CLAUDE.md](CLAUDE.md) の「本番の構成」に書いた。
