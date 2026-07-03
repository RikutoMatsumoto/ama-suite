// ============================================================
// Firebaseプラグイン
//
// 【プラグインとは？】
// Nuxtアプリの起動時に1回だけ実行されるファイル。
// app/plugins/ に置くと自動で読み込まれる。
//
// 【ファイル名の .client とは？】
// 「ブラウザでだけ実行する」という意味。
// Firebase Auth はブラウザ専用機能（localStorage等を使う）なので、
// サーバー側では動かさない。
// ============================================================

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  // Firebaseアプリを初期化（.envの値を使用）
  const firebaseApp = initializeApp(config.public.firebase)

  // 認証機能を取得
  const auth = getAuth(firebaseApp)

  // ログイン状態の監視をここで開始する
  // プラグインはミドルウェアより先に実行されるので、
  // ページ表示前のログインチェックに間に合う
  const authStore = useAuthStore()
  authStore.init(auth)

  // provide：アプリ全体で使えるようにする
  // どこからでも const { $firebaseAuth } = useNuxtApp() で取り出せる
  return {
    provide: {
      firebaseAuth: auth,
    },
  }
})
