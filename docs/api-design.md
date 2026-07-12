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
| GET | `/api/dashboard/sales-chart` | 必要 | 売上推移グラフ用の日別集計（直近30日） |
| GET | `/api/products` | 必要 | 商品一覧取得 |
| POST | `/api/products` | 必要 | 商品登録（ASIN重複は409・プラン上限チェック） |
| GET | `/api/products/:asin` | 必要 | 商品1件取得（詳細ページのヘッダー用） |
| PATCH | `/api/products/:asin` | 必要 | 商品の部分更新（在庫数・仕入れ値。利益はサーバー側で再計算） |
| DELETE | `/api/products/:asin` | 必要 | 商品削除（紐づくメモも削除） |
| GET | `/api/products/:asin/memo` | 必要 | 商品メモ取得 |
| POST | `/api/products/:asin/memo` | 必要 | 商品メモ保存 |
| GET | `/api/products/:asin/price-history` | 必要 | Keepa価格・ランキング履歴（8系列。プランで期間制限） |
| GET | `/api/orders` | 必要 | 注文履歴取得（新しい順・最大50件） |
| POST | `/api/orders` | 必要 | 注文記録（利益計算・在庫自動減算） |
| POST | `/api/billing/checkout` | 必要 | Stripe Checkout Session作成（決済ページURL発行） |
| POST | `/api/billing/webhook` | 署名検証 | Stripe Webhook受信（契約状態をFirestoreへ同期） |
| GET | `/api/billing/subscription` | 必要 | 契約状態＋プラン制限の取得（トライアル判定込み） |
| GET | `/api/spapi/status` | 必要 | SP-API接続状態（参加マーケットプレイス確認） |
| GET | `/api/spapi/orders` | オーナーのみ | Amazon実注文（直近30日・15分キャッシュ） |
| GET | `/api/spapi/inventory` | オーナーのみ | FBA実在庫（在庫内訳付き・15分キャッシュ) |
| POST | `/api/spapi/import-products` | オーナーのみ | FBA在庫から商品管理へ一括取り込み（価格はPricing APIで取得） |

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
│     productName, currentPrice, costPrice, profit, stock, source, createdAt
├── memos/{asin}
│     supplier, note, updatedAt
├── orders/{autoId}
│     asin, productName, quantity, salePrice, total, profit, createdAt
├── billing/subscription
│     status, plan, stripeCustomerId, stripeSubscriptionId, updatedAt
└── spapiCache/{orders30|inventory|finances30}
      SP-API取得結果の15分キャッシュ（レートリミット対策）

keepaCache/{asin}        ← Keepa価格履歴の24時間キャッシュ（全ユーザー共有）
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

## 7. 外部API連携：Keepa（実装済み）

`GET /api/products/:asin/price-history` はKeepa APIと連携している。

- 取得優先順位: **①Firestoreキャッシュ（24h）→ ②Keepa API → ③モックデータ**
- キャッシュにより同一商品の再表示ではトークンを消費しない
- Keepa障害・未知のASINでもエラー画面を出さずモックへフォールバック（`source`フィールドでフロントがバッジ表示を切替）
- 外部APIキーは`runtimeConfig`（環境変数）で管理

## 8. 外部API連携：Amazon SP-API（実装済み）

自分のセラーアカウントの実データ（注文・FBA在庫・入金明細）を取得する。

### 認証（OAuth2 / LWA）
```
リフレッシュトークン（.env・長命） ──交換──▶ アクセストークン（1時間有効）
                                              └─ メモリキャッシュ（失効5分前まで再利用）
```
- `server/utils/sp-api.ts` の `callSpApi()` に共通化。2023年10月以降SigV4は不要でLWAのみ

### オーナー認可（重要な設計判断）
- SP-APIの認証情報はサーバー全体で1セット＝**オーナーのセラーアカウントの鍵**
- 無条件に使うと全ログインユーザー（デモ含む）から実注文・実売上が見えてしまう
- `.env` の `NUXT_SPAPI_OWNER_EMAIL` と認証済みユーザーのメールが一致する場合のみ許可
  （`requireSpApiOwner()`）。他ユーザーは **403** → フロントはセクションごと非表示

### レートリミット対策
- SP-APIはエンドポイントごとに制限が厳しい（注文≒1回/分、入金明細0.5回/秒 等）
- ①Firestoreに **15分キャッシュ**（`users/{uid}/spapiCache/*`、`?refresh=1`で強制更新）
- ②ページネーションの間にウェイト挿入
- ③取得範囲の絞り込み：FBA在庫は全SKUだと2,141件=43ページ →
  `startDateTime`（直近1年で変動のあったSKU）で**6ページに削減**（在庫ありSKUの捕捉率100%を実測確認）

### ダッシュボードの実データ切替
- summary / sales-chart はオーナーなら実データで集計し `source: 'amazon'` を返す
  （他ユーザーは従来の手動記録で `source: 'manual'`。フロントはバッジ表示を切替）
- **実利益** = 入金明細の実手数料引き後の金額 − 仕入れ値×数量（返金はマイナス反映）
  - 入金明細はSKUしか持たないため、FBA在庫のSKU→ASIN対応表で商品の仕入れ値と紐付け

## 9. プラン別機能制限（実装済み）

- `server/utils/plan.ts` の `resolvePlan(uid)` が唯一の判定箇所：
  ①有効なStripe契約 → そのプラン ②未契約はAuthのアカウント作成日から14日間トライアル
  （スタンダード相当）③期限切れはスターター相当
- 制限はサーバー側で強制（スターター: 商品登録50件まで=403 / グラフ90日まで=日数キャップ）
- フロントは `usePlan()` コンポーザブルで取得し、ロック表示・件数カウンター等の「案内」のみ担当

## 10. 今後の拡張予定

- 価格アラート（Cloud Scheduler + Cloud Functions で定期チェック→通知）
- KPIの前月比較（先月データとの差分表示）
- 注文単位の利益表示（入金明細データは取得済み）
