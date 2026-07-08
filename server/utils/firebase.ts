// ============================================================
// サーバー側のFirebase接続（firebase-admin）
//
// 【クライアント側（app/plugins/firebase.client.ts）との違い】
// クライアント側: 「ログインする人」としてFirebaseを使う
// サーバー側    : 「管理者」としてFirebaseを使う
//                 → トークンの検証や、セキュリティルールを越えた
//                   DB操作ができる（その分、必ず自前で認可チェックする）
//
// 【server/utils/ とは？】
// Nitroの決まりで、ここに置いた関数は server/api/ の中から
// importなしでそのまま呼び出せる。
// ============================================================

import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// 初期化は1回だけでよい（2回呼ぶとエラーになるため getApps() でガード）
function adminApp() {
  if (getApps().length === 0) {
    // 接続先プロジェクトIDは nuxt.config.ts の runtimeConfig から取得
    // （.env の NUXT_PUBLIC_FIREBASE_PROJECT_ID が入る）
    const config = useRuntimeConfig()

    initializeApp({
      // applicationDefault()：
      // 環境に応じた認証情報を自動で探す仕組み
      // ・本番（Firebase Hosting / Cloud Run）→ 自動で権限が付与されている
      // ・ローカル開発 → gcloud auth application-default login で設定した認証情報
      credential: applicationDefault(),
      projectId: config.public.firebase.projectId,
    })
  }
  return getApps()[0]!
}

// IDトークンを検証する部門
export function adminAuth() {
  return getAuth(adminApp())
}

// Firestoreを読み書きする部門
export function adminFirestore() {
  return getFirestore(adminApp())
}
