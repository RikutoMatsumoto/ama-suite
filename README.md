# AmaSuite（フロントエンド）

Amazonせどりの「価格履歴確認」「利益計算」「在庫・注文管理」をひとつにまとめたSaaSのフロントエンドです。プライスターとKeepaを掛け合わせたツールをイメージして、個人開発で一から設計・実装しています。

デモ：https://ama-suite-b4f52.web.app

## 構成図

```
┌─────────────────┐        ┌──────────────────────┐        ┌─────────────────────┐
│   ブラウザ        │        │  Nuxt 4 (このリポジトリ)│        │   Ruby on Rails API   │
│                  │◀──────▶│  - ページ / UI         │◀──────▶│  - ユーザーDB          │
│                  │        │  - server/api/(Nitro) │        │  - JWT認証            │
└─────────────────┘        │    ・利益計算API       │        └─────────────────────┘
                            │    ・ダッシュボードAPI  │
                            │    ・メモ保存API       │        ┌─────────────────────┐
                            └──────────┬───────────┘        │   Firebase            │
                                       │                     │  - Authentication      │
                                       └────────────────────▶│  - Firestore           │
                                                              │  - Cloud Functions     │
                                                              │  - Hosting（デプロイ先）│
                                                              └─────────────────────┘
```

## 技術スタックと選定理由

| 技術 | 選定理由 |
|---|---|
| **Nuxt 4 / Vue 3 (Composition API)** | リベシティの技術スタック（Vue）への適応を目的に採用。TypeScriptとの相性、Nuxt UIによる開発速度を評価。 |
| **Firebase Authentication** | 自前でパスワードハッシュ化・JWT発行を実装する代わりに、認証基盤をマネージドサービスに委譲。実装コストとセキュリティリスクの両方を削減。 |
| **Nitro (`server/api/`)** | Nuxt標準搭載のバックエンド機能。フロントと同一プロジェクトでNode.js APIを実装でき、Rails側に置く必要のない軽量な処理（利益計算など）をここに切り出した。 |
| **Firebase Cloud Functions** | ユーザー登録などのイベントに応じて自動実行する処理（Firestoreへのウェルカムログ書き込み）を実装。将来的なメール送信やWebhook処理の土台。 |
| **Ruby on Rails (API mode)** | 複雑なドメインロジック・DB操作を任せるバックエンドとして採用。将来的なAmazon SP-API連携やStripe決済処理を担う想定。 |
| **Firebase Hosting** | NuxtのSSRアプリをそのままデプロイ可能（Web Frameworks統合）。デモURLの即時発行が可能。 |

## セキュリティ上の考慮事項

- APIキー・Firebase設定は環境変数管理（`.env`はリポジトリに含めない）
- パスワードは自前で保存せず、Firebase Authenticationに委譲
- 商品メモなどのユーザー固有データは、将来的に`user_id`による認可チェックを実装予定
- Rails側はStripe Webhook署名検証、レートリミット（rack-attack）を実装方針としてCLAUDE.mdにルール化

## セットアップ

```bash
pnpm install
cp .env.example .env  # Firebase設定値を記入
pnpm dev
```

## 主な機能

- ダッシュボード（売上・利益・在庫のKPI表示）
- 商品管理（一覧・検索・追加）
- 商品詳細（利益計算・価格履歴・プライベートメモ）
- Firebase Authenticationによるログイン／新規登録
