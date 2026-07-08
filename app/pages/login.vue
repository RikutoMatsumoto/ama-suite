<template>
  <div class="min-h-screen flex items-center justify-center" style="background: linear-gradient(135deg, #E8F4FD 0%, #D4EBF8 100%);">
    <UCard class="w-full max-w-md shadow-xl">
      <template #header>
        <div class="text-center py-2">
          <p class="text-2xl font-black mb-1" style="color: #1B2A4A;">🛒 AmaSuite</p>
          <p class="text-sm text-gray-600">Amazonセラーのためのオールインワンツール</p>
        </div>
      </template>

      <!-- デモモードの案内（/login?demo=1 で表示される） -->
      <UAlert
        v-if="isDemoMode"
        color="primary"
        variant="subtle"
        title="デモアカウントを入力済みです"
        description="このまま「ログイン」ボタンを押すと、デモ画面をお試しいただけます。"
        class="mb-4"
      />

      <!-- エラーメッセージ表示 -->
      <!-- v-if：errorMessage が空でない時だけ表示される -->
      <UAlert
        v-if="errorMessage"
        color="error"
        variant="subtle"
        :description="errorMessage"
        class="mb-4"
      />

      <!--
        UForm の動き：
        :state="state"    → フォームのデータをVueのreactiveオブジェクトと紐付け
        :schema="schema"  → 送信前にバリデーション（形式チェック）を実行
        @submit="onSubmit" → バリデーションOKの時だけonSubmitが呼ばれる
      -->
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="メールアドレス" name="email">
          <!--
            v-model="state.email"：
            入力するたびに state.email が自動で更新される（双方向バインディング）
          -->
          <UInput
            v-model="state.email"
            type="email"
            placeholder="example@email.com"
            icon="i-lucide-mail"
            class="w-full"
          />
        </UFormField>

        <UFormField label="パスワード" name="password">
          <UInput
            v-model="state.password"
            type="password"
            placeholder="パスワードを入力"
            icon="i-lucide-lock"
            class="w-full"
          />
        </UFormField>

        <!--
          :loading="loading"：
          loading.value が true の間はボタンがスピナー状態になる
          → ユーザーが二重送信できないようにするUX
        -->
        <UButton
          type="submit"
          label="ログイン"
          class="w-full font-bold"
          color="primary"
          size="lg"
          :loading="loading"
        />
      </UForm>

      <template #footer>
        <p class="text-center text-sm text-gray-600">
          アカウントをお持ちでない方は
          <UButton to="/register" variant="link" label="新規登録" class="p-0" />
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import * as v from 'valibot'

definePageMeta({ layout: false })

// -------------------------------------------------------
// Piniaストアを使う
// useAuthStore() を呼ぶだけで、どのコンポーネントからでも
// 同じログイン状態を読み書きできる
// -------------------------------------------------------
const authStore = useAuthStore()

// -------------------------------------------------------
// バリデーションスキーマ
// フォーム送信前に自動でチェックされる
// -------------------------------------------------------
const schema = v.object({
  email: v.pipe(v.string(), v.email('メールアドレスの形式が正しくありません')),
  password: v.pipe(v.string(), v.minLength(8, 'パスワードは8文字以上で入力してください')),
})

// -------------------------------------------------------
// reactive：フォームの入力値をまとめて管理するオブジェクト
// state.email / state.password で各値にアクセスできる
// -------------------------------------------------------
const state = reactive({ email: '', password: '' })

// -------------------------------------------------------
// デモモード：LPの「デモを見る」から来た場合（/login?demo=1）、
// デモアカウントを自動入力して、ログインボタンを押すだけにする
// -------------------------------------------------------
const route = useRoute()
const isDemoMode = computed(() => route.query.demo === '1')

if (isDemoMode.value) {
  state.email = 'demo@amasuite.jp'
  state.password = 'Demo12345'
}

// -------------------------------------------------------
// ref：単一の値を管理
// loading → ボタンのスピナー制御
// errorMessage → APIエラーの表示
// -------------------------------------------------------
const loading = ref(false)
const errorMessage = ref('')

// -------------------------------------------------------
// onSubmit：フォーム送信時の処理
// async/await で非同期処理を「上から順に実行」できる
// -------------------------------------------------------
async function onSubmit() {
  loading.value = true   // スピナー開始
  errorMessage.value = '' // 前のエラーをリセット

  try {
    // Firebase Authでログイン
    // （旧: Rails に $fetch でPOST → 新: Firebaseに任せる）
    // 通信・トークン管理は全部Firebase SDKがやってくれる
    await authStore.login(state.email, state.password)

    // ダッシュボードへ遷移
    await navigateTo('/dashboard')
  }
  catch (err: unknown) {
    // Firebaseのエラーコードを日本語メッセージに変換
    const firebaseError = err as { code?: string }
    errorMessage.value = toJapaneseError(firebaseError.code)
  }
  finally {
    // try/catchの結果に関わらず必ず実行される
    loading.value = false  // スピナー終了
  }
}

// -------------------------------------------------------
// Firebaseのエラーコード → 日本語メッセージ
// https://firebase.google.com/docs/auth/admin/errors
// -------------------------------------------------------
function toJapaneseError(code?: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'メールアドレスまたはパスワードが正しくありません'
    case 'auth/too-many-requests':
      return '試行回数が多すぎます。しばらく待ってから再度お試しください'
    case 'auth/network-request-failed':
      return 'ネットワークエラーが発生しました'
    default:
      return 'ログインに失敗しました'
  }
}
</script>
