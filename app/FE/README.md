# ChatMVP FE (Nuxt 3)

## クイックスタート（.env.fe 作成と起動）

1) 前提

- Node.js >= 18.18 / pnpm
- バックエンド（BE）が `http://localhost:4000` で起動していること（または BE の URL を把握）

2) .env.fe を作成

```
cd app/FE
cp .env.example .env.fe
# 必要に応じて以下を調整
# NITRO_PORT=3000
# API_BASE_URL=http://localhost:4000  # BE の URL
```

3) Docker で起動

```
cd app/FE
docker compose up -d --build
# http://localhost:3000 （API_BASE_URL は be サービス/ローカル BE に合わせる）
# 停止: docker compose down
```

このディレクトリは、既存アプリを解析して再構築するフロントエンド（Nuxt 3）実装の置き場です。
バックエンドは Node.js/Express（ポート: 4000）を想定し、`API_BASE_URL` で接続します。

## コーディング規約

### アトミックデザイン

#### Atoms
単体では表示項目として機能しない最小単位（例: ラベル、アイコン、入力補助パーツ）。
パンくずリストのような「単体で表示項目として成り立つもの」はここに含めない。`Text.vue` のような過度に細かいものは作らない。

#### Molecules
単体で表示項目として機能する複合要素（例: 入力 + ラベル + ヘルプ）。

#### Organisms
Atoms と Molecules を統合した複合コンポーネント。
- バリデーションは可能な限りここに閉じ込める
- 状態管理やロジックはコンポーザブルに切り出す
- ラベルやメッセージは `static/` から読み込む

推奨ディレクトリ例:
```
components/
  atoms/
  molecules/
  organisms/
  templates/
```

#### Templates
Organisms のレイアウト。ページと 1 対 1。
基本は `ListTemplate.vue`, `CreateTemplate.vue`, `DetailTemplate.vue`, `EditTemplate.vue`, `DeleteTemplate.vue` を汎用化して使用。
別途必要な場合は機能ドメイン配下にテンプレートを追加（やることはスロット定義と配置調整のみ）。

#### Pages
テンプレートに Organisms を注入する層（テンプレートと 1 対 1）。
テンプレートのスロットは実装漏れを防ぐため全て記載する。
API 呼び出しは原則ここ（実際は store/composables を呼び出す）。
- コンポーザブルから API を直接呼んでよいのは、UI に即時フィードバックが必要なケース（例: メール重複チェック）に限る
- テキスト/アラートは `static/` から読み込む
- グローバルアラートはページで呼ぶ（コンポーザブルからは呼ばない）

#### Layouts
グローバルレイアウト、ローディング表示、グローバルアラートの設置場所。
GET 成功以外の API 通信の成否をグローバルアラートで表示する。

#### static
文字列外部化。機能ドメインとフォームで分離し、機能ドメインは「テキスト」「アラート」、フォームは「テキスト」「バリデーションテキスト」を用意する。
```
static/
  [ドメイン]/
    [機能]CreateAlert.ts
    [機能]CreateText.ts
    [機能]EditAlert.ts
    [機能]EditText.ts
    [機能]DeleteAlert.ts
    [機能]DeleteText.ts
    [機能]DetailAlert.ts
    [機能]DetailText.ts
    [機能]ListAlert.ts
    [機能]ListText.ts
  form/
    [ドメイン]/
      [フォーム名]Text.ts
      [フォーム名]Validation.ts
```

### composables
フォームのロジックと状態管理は `composables/form/[ドメイン]/` に分離し、汎用コンポーザブルは `composables/[ドメイン]/` もしくは直下に配置。
```
composables/
  form/
    [ドメイン]/
      use[フォーム名]Form.ts
      use[フォーム名]Validate.ts
  [ドメイン]/
    useXXXX.ts
  useXXXX.ts
```

### store の命名規則
```
store/
  stateXXXX.ts  // React系経験者にもグローバル状態と分かる命名
```
Nuxt 3 の Pinia を用いる場合は `stores/xxxx.ts` にも対応可だが、本プロジェクトでは上記命名を推奨。

## 推奨ディレクトリ構成（Nuxt 3, srcDir）
```
app/FE/
  src/
    components/
      templates/
      organisms/
      atoms/
      molecules/
    pages/
    layouts/
    composables/
    store/
    static/
    assets/
    plugins/
    middleware/
    types/
  nuxt.config.ts  # srcDir: 'src'
```

### 本リポジトリでの骨子（例）
- Template: `components/templates/ChatTemplate.vue`（レイアウト枠）
- Organism: `components/organisms/ChatPanel.vue`（一覧+入力+ボタン）
- Page: `pages/index.vue`（データ取得・送信/ストリーミング処理を注入）

## 環境変数
`.env`（開発例）
```
NITRO_PORT=3000
API_BASE_URL=http://localhost:4000
```

## 開発の流れ（想定）
1) 既存アプリを解析して情報設計/コンポーネント設計
2) Templates → Pages の順で骨組みを作成
3) Organisms/Molecules/Atoms を段階的に実装
4) 文言は `static/` に集約、フォームの状態/バリデーションは `composables/form/` に分離
5) API 呼び出しはページから（即時フィードバックのみコンポーザブル直呼び可）

### 実行（補足）

- デフォルトでは `http://localhost:3000` で起動します。別ポートを使う場合は環境変数か CLI で指定します。

```
# 例: ポート 3001 で起動
NITRO_PORT=3001 pnpm dev
```

- バックエンドのベースURLは環境変数から参照します。

```
# .env の例
NITRO_PORT=3000
API_BASE_URL=http://localhost:4000
```

- 起動後はトップページで入力→Send を押すと `/api/chat` に POST され、text/plain のチャンクがストリーミングで描画されます。

トラブルシュート
- ポート競合で 3000 が使えない場合は `NITRO_PORT` を変えて起動（例: `NITRO_PORT=3001 pnpm dev`）
- CORS エラーが出る場合は、BE 側の `CORS_ORIGIN` に FE の実ポートを設定
