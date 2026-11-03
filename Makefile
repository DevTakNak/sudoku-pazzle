.PHONY: init dev build test test-e2e deploy deploy-prod

# 依存を入れる(package-lock.json のとおり)。E2E 用の Chromium も入れる
init:
	npm ci
	npx playwright install chromium

# 開発サーバーを起動する(http://localhost:3000)
dev:
	npm run dev

# 本番用にビルドする
build:
	npm run build

# lint・型チェック・整形の確認・単体テスト
test:
	npm run lint
	npm run typecheck
	npm run format:check
	npm test

# E2E(本番のビルドで起動して、PC とスマホの 2 つで動かす)
test-e2e:
	npm run test:e2e

# Vercel のプレビューにデプロイする
deploy:
	npx vercel deploy

# Vercel の本番にデプロイする
deploy-prod:
	npx vercel deploy --prod
