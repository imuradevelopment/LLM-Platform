### Chat MVP Monorepo 概要

`app/` 配下にフロントエンド（Nuxt 3）とバックエンド（Express）を持つモノレポです。Postgres を使ったチャットアプリ（LLM/Gemini or Azure OpenAI）をローカルでセルフホスト実行できます。

### ディレクトリ構成

- `app/FE`: Nuxt 3（UI、JWT ログイン、モデル選択、ストリーミング受信）
- `app/BE`: Express API（/api/auth, /api/chat, /api/llm、LLM呼び出し、RAG、Postgres 永続化）
- `app/BE/db`: DBML スキーマとマイグレーション
- ルート `docker-compose.yml`: BE/DB/pgAdmin/FE を一括起動

1) 起動/停止（ルートで実行）

1. BE の環境ファイルを配置  
app/BE/.env.be  

2. FE の環境ファイルを配置  
app/FE/.env.fe  

3. Docker実行
```bash
docker compose up -d
# 停止
docker compose down
```

2) アクセス

- FE: `http://localhost:3000`
- BE: `http://localhost:4000`
- pgAdmin: `http://localhost:5050`（Email: `admin@example.com` / Password: `postgres` 既定）

※なんかうまくいかない時コンテナ、イメージ、ボリューム全部ふっ飛ばして以下実行
```bash
sudo rm -rf ./app/BE/.pnpm-store ./app/BE/node_modules ./app/FE/.nuxt ./app/FE/.pnpm-store ./app/FE/node_modules ./app/BE/db/migrations/000_init.sql ./app/BE/dist
```
