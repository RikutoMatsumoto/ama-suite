# AmaSuite（フロントエンド）

Amazonせどりの「価格履歴確認」「利益計算」「在庫・注文管理」をひとつにまとめたSaaSのフロントエンドです。プライスターとKeepaを掛け合わせたツールをイメージして、個人開発で一から設計・実装しています。

デモ：https://ama-suite-b4f52.web.app
（トップページの「デモを見る」から、デモアカウント入力済みの状態でお試しいただけます）

## 構成図

```
┌─────────────────┐        ┌──────────────────────────┐        ┌─────────────────────┐
│   ブラウザ        │        │  Nuxt 4 (このリポジトリ)    │        │   Stripe              │
│                  │◀──────▶│  - ページ / UI             │◀──────▶│  - Checkout（決済ページ）│
│                  │        │  - server/api/(Nitro)     │        │  - Webhook通知         │
└─────────────────┘        │    ・利益計算API           │        └─────────────────────┘
                            │    ・メモ保存API（認可付き） │
                            │    ・Stripe決済API         │        ┌─────────────────────┐
                            │    ・Webhook受信（署名検証） │        │   Firebase            │
                            │  - レートリミット           │◀──────▶│  - Authentication      │
                            └──────────┬───────────────┘        │  - Firestore           │
                                       │                         │  - Cloud Functions     │
                            ┌──────────▼───────────┐            │  - Hosting（デプロイ先） │
                            │  Ruby on Rails API     │            └─────────────────────┘
                            │  - JWT認証（参考実装）   │
                            │  - rack-attack         │
                            └───────────────────────┘
```

## 技術スタックと選定理由

| 技術 | 選定理由 |
|---|---|
| **Nuxt 4 / Vue 3 (Composition API)** | リベシティの技術スタック（Vue）への適応を目的に採用。TypeScriptとの相性、Nuxt UIによる開発速度を評価。 |
| **Firebase Authentication** | 自前でパスワードハッシュ化・JWT発行を実装する代わりに、認証基盤をマネージドサービスに委譲。実装コストとセキュリティリスクの両方を削減。 |
| **Nitro (`server/api/`)** | Nuxt標準搭載のバックエンド機能。フロントと同一プロジェクトでNode.js APIを実装でき、軽量な処理（利益計算・メモ・決済連携）をここに実装。 |
| **Firebase Cloud Functions** | ユーザー登録イベントで自動実行する処理（Firestoreへのウェルカムログ書き込み）を実装。 |
| **Stripe** | サブスクリプション決済。カード情報を自社サーバーに通さないCheckout方式を採用し、Webhookで契約状態をFirestoreに同期。 |
| **Ruby on Rails (API mode)** | JWT認証・bcrypt・rack-attackのリファレンス実装。将来的なAmazon SP-API連携など複雑なドメインロジックの実装先として維持。 |
| **Firebase Hosting** | NuxtのSSRアプリをそのままデプロイ可能（Web Frameworks統合）。 |

## セキュリティ実装

| 項目 | 実装内容 |
|---|---|
| **認可チェック** | メモ等のユーザーデータは、FirebaseのIDトークンをサーバー側で検証し、検証済みuidの配下（`users/{uid}/...`）にのみ読み書き。他ユーザーのデータには構造上アクセス不可（`server/utils/require-auth.ts`） |
| **Stripe Webhook署名検証** | `stripe.webhooks.constructEvent` による署名検証で、偽の決済完了通知を排除（`server/api/billing/webhook.post.ts`） |
| **金額のサーバー側管理** | プラン金額はフロントから受け取らずサーバー側定義。金額改ざんを防止（`server/api/billing/checkout.post.ts`） |
| **レートリミット** | 全APIに対しIP単位で1分60回の制限（`server/middleware/rate-limit.ts`）。Rails側にもrack-attackでログイン試行制限を実装 |
| **シークレット管理** | APIキー・署名シークレットは`.env`（Git管理外）＋runtimeConfigで管理。ブラウザには一切渡さない |
| **Firestoreルール** | クライアントからの直接アクセスは全面拒否。必ず認可チェック付きAPIを経由 |

## セットアップ

```bash
pnpm install
cp .env.example .env  # Firebase / Stripe の設定値を記入
pnpm dev
```

## 主な機能

- ダッシュボード（売上・利益・在庫のKPI表示）
- 商品管理（一覧・検索・追加）
- 商品詳細（利益計算・価格履歴・プライベートメモ）
- Firebase Authenticationによるログイン／新規登録
- Stripeによるサブスクリプション決済（テストモード）
