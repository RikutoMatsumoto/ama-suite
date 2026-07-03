// ============================================================
// ナビゲーションガード（全ページ共通）
//
// 【ミドルウェアとは？】
// ページを移動する「直前」に毎回実行されるチェック処理。
// ファイル名に .global を付けると全ページで自動実行される。
//
// 【やっていること】
// ログインが必要なページに未ログインでアクセスしたら
// /login に強制リダイレクトする
// ============================================================

// ログイン不要で見られるページ
const publicPages = ['/', '/login', '/register']

export default defineNuxtRouteMiddleware(async (to) => {
  // サーバー側では判定しない（Firebaseはブラウザ専用のため）
  if (import.meta.server) return

  // 公開ページなら素通り
  if (publicPages.includes(to.path)) return

  const authStore = useAuthStore()

  // Firebaseの起動直後は「ログイン確認中」なので、確認が終わるまで待つ
  // （これがないと、リロード時に一瞬「未ログイン」と誤判定されてしまう）
  if (!authStore.initialized) {
    await new Promise<void>((resolve) => {
      const stop = watch(
        () => authStore.initialized,
        (ready) => {
          if (ready) {
            stop()
            resolve()
          }
        },
        { immediate: true }
      )
    })
  }

  // 未ログインならログインページへ
  if (!authStore.isLoggedIn) {
    return navigateTo('/login')
  }
})
