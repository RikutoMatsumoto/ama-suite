# AmaSuite API設計書

Nuxt(Nitro) `server/api/` に実装しているAPIの設計ドキュメント。

## 1. 全体方針

- **認証**: Firebase Authentication のIDトークンを `Authorization: Bearer <token>` ヘッダーで受け取り、サーバー側で `firebase-admin` により検証する
- **認可**: 検証済みuidを基点に、Firestoreの `users/{uid}/...` 配下のみを読み書きする（他ユーザーのデータには構造上アクセス不可）
- **データストア**: Cloud Firestore（クライアントからの直接アクセスはセキュリティルールで全面拒否。必ずAPI経由）
- **金額などの計算**: 改ざん防止のため、利益計算・プラン金額はサーバー側で確定させる（クライアントから受け取らない）
- **レートリミット**: 全 `/api/` に対しIP単位で60回/分（`server/middleware/rate-limit.ts`）

## 2. エンドポイント一覧

| メソッド | パス | 認証 | 概要 |
|---|---|---|---|
| POST | `/api/profit-calculator` | 不要 | 利益計算（販売価格・仕入れ値から手数料・利益を算出） |
| GET | `/api/dashboard/summary` | 必要 | ダッシュボードKPI（売上・利益・商品数・在庫切れ数） |
| GET | `/api/products` | 必要 | 商品一覧取得 |
| POST | `/api/products` | 必要 | 商品登録（ASIN重複は409） |
| PATCH | `/api/products/:asin` | 必要 | 商品の部分更新（在庫数） |
| DELETE | `/api/products/:asin` | 必要 | 商品削除（紐づくメモも削除） |
| GET | `/api/products/:asin/memo` | 必要 | 商品メモ取得 |
| POST | `/api/products/:asin/memo` | 必要 | 商品メモ保存 |
| GET | `/api/orders` | 必要 | 注文履歴取得（新しい順・最大50件） |
| POST | `/api/orders` | 必要 | 注文記録（利益計算・在庫自動減算） |
| POST | `/api/billing/checkout` | 必要 | Stripe Checkout Session作成（決済ページURL発行） |
| POST | `/api/billing/webhook` | 署名検証 | Stripe Webhook受信（契約状態をFirestoreへ同期） |
| GET | `/api/billing/subscription` | 必要 | 契約状態の取得 |

## 3. 認証・認可フロー

```
ブラウザ                        Nitro API                    Firebase
   │  Authorization: Bearer <IDトークン>
   ├───────────────────────────▶│
   │                            │  verifyIdToken(token)
   │                            ├───────────────────────────▶│
   │                            │◀── uid（検証済みの本人ID）──┤
   │                            │
   │                            │  users/{uid}/... のみ読み書き
   │◀── 結果 ───────────────────┤
```

- トークン無し・改ざん・期限切れ → **401**
- 共通処理は `server/utils/require-auth.ts` に集約（各APIは先頭で `const uid = await requireAuth(event)` を呼ぶだけ）

## 4. 主要エンドポイント詳細

### POST /api/products（商品登録）

リクエスト:
```json
{ "asin": "B08N5WRWNW", "productName": "ワイヤレスイヤホン", "currentPrice": 4980, "costPrice": 2100 }
```

バリデーション:
- ASIN: 10桁の英数字（`/^[A-Z0-9]{10}$/`）
- currentPrice: 正の数値 / costPrice: 0以上の数値

レスポンス（200）:
```json
{ "asin": "B08N5WRWNW", "productName": "...", "currentPrice": 4980, "costPrice": 2100, "profit": 1984, "createdAt": "..." }
```

- 利益はサーバー側で算出: `profit = price - cost - round(price×0.10) - round(price×0.08)`
- ASINをドキュメントIDにし、`create()` を使用 → 既存ASINなら **409**（黙って上書きしない）

### POST /api/orders（注文記録）

リクエスト:
```json
{ "asin": "B08N5WRWNW", "quantity": 2, "salePrice": 5500 }
```

処理:
1. 自分の商品として登録済みかチェック（未登録は404）
2. 利益を計算（1個あたり利益 × 個数）
3. `users/{uid}/orders` に保存（IDは自動採番）
4. 在庫を売れた分だけ減算（0未満にはしない）

### POST /api/billing/webhook（Stripe Webhook）

- `stripe.webhooks.constructEvent(rawBody, signature, secret)` で**署名検証**
- 署名なし・不正署名 → **400**（偽の決済完了通知を排除）
- `checkout.session.completed` → `users/{uid}/billing/subscription` に契約状態を保存
- `customer.subscription.deleted` → 契約状態を `canceled` に更新
- ユーザー紐付けは Checkout Session 作成時に `client_reference_id: uid` を埋め込むことで実現

## 5. Firestoreデータ構造

```
users/{uid}/
├── products/{asin}
│     productName, currentPrice, costPrice, profit, stock, createdAt
├── memos/{asin}
│     supplier, note, updatedAt
├── orders/{autoId}
│     asin, productName, quantity, salePrice, total, profit, createdAt
└── billing/subscription
      status, plan, stripeCustomerId, stripeSubscriptionId, updatedAt

welcomeLogs/{uid}        ← Cloud Functions（ユーザー登録トリガー）が書き込み
```

設計意図:
- **ユーザーのデータは必ず `users/{uid}` 配下**に置く。APIは検証済みuidでしかこのパスに触れないため、認可漏れが構造的に起きない
- ASINをドキュメントIDにすることで、商品とメモの1対1対応・重複防止が自然に実現できる

## 6. エラーレスポンス規約

| ステータス | 意味 | 例 |
|---|---|---|
| 400 | リクエスト不正 | バリデーションエラー、Webhook署名検証失敗 |
| 401 | 未認証 | トークン無し・無効 |
| 404 | 対象なし | 未登録商品への注文・更新 |
| 409 | 競合 | ASIN重複登録 |
| 429 | レート制限 | 60回/分超過 |

エラーボディは `statusMessage` に日本語メッセージを格納し、フロントはこれをそのままユーザーに表示する。

## 7. 今後の拡張予定

- Amazon SP-API連携（商品情報・在庫・注文の自動取得 → 手入力APIを置き換え）
- Keepa API連携（価格履歴グラフ）
- 契約プランに応じた機能制限（`billing/subscription` を参照したミドルウェア）
