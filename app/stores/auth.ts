// ============================================================
// 認証ストア（Firebase Auth版）
//
// 【今までとの違い】
// 旧: Rails にメール＋パスワードを送り、Rails製のJWTを受け取っていた
// 新: Firebase がログイン・トークン管理を全部やってくれる
//     Rails にはFirebaseの「IDトークン」を送って本人確認する
//
// 【メリット】
// ・パスワードを自分のDBに保存しなくてよい（漏洩リスク減）
// ・トークンの発行・更新・失効をFirebaseが自動管理
// ・Google ログイン等も数行で追加できる
// ============================================================

import { defineStore } from 'pinia'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth'

export const useAuthStore = defineStore('auth', () => {
  // -------------------------------------------------------
  // State
  // user: Firebaseのユーザーオブジェクト（未ログインなら null）
  // initialized: 起動直後の「ログイン状態確認中」かどうか
  // -------------------------------------------------------
  const user = ref<FirebaseUser | null>(null)
  const initialized = ref(false)

  const isLoggedIn = computed(() => !!user.value)

  // Firebase Auth本体を取得するヘルパー
  // （プラグインで provide したものを取り出す）
  function auth() {
    const { $firebaseAuth } = useNuxtApp()
    return $firebaseAuth
  }

  // -------------------------------------------------------
  // ログイン状態の監視を開始する（firebaseプラグインから1回呼ばれる）
  //
  // onAuthStateChanged は「ログイン状態が変わるたびに呼ばれる」
  // Firebase の仕組み。ページをリロードしても Firebase が
  // 自動でログイン状態を復元してくれる（旧localStorage処理は不要！）
  // -------------------------------------------------------
  function init(firebaseAuth: Auth) {
    onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      user.value = firebaseUser
      initialized.value = true
    })
  }

  // -------------------------------------------------------
  // ログイン
  // -------------------------------------------------------
  async function login(email: string, password: string) {
    const result = await signInWithEmailAndPassword(auth(), email, password)
    user.value = result.user
  }

  // -------------------------------------------------------
  // 新規登録（登録後、表示名もセットする）
  // -------------------------------------------------------
  async function register(name: string, email: string, password: string) {
    const result = await createUserWithEmailAndPassword(auth(), email, password)
    await updateProfile(result.user, { displayName: name })
    user.value = result.user
  }

  // -------------------------------------------------------
  // ログアウト
  // -------------------------------------------------------
  async function logout() {
    await signOut(auth())
    user.value = null
  }

  // -------------------------------------------------------
  // Rails APIを呼ぶ時に使うIDトークンを取得
  // このトークンをAuthorizationヘッダーに載せて送ると、
  // Rails側で「本当にログイン済みユーザーか」を検証できる
  // -------------------------------------------------------
  async function getIdToken() {
    return await user.value?.getIdToken()
  }

  return { user, initialized, isLoggedIn, init, login, register, logout, getIdToken }
})
