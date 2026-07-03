<template>
  <div class="min-h-screen flex items-center justify-center" style="background: linear-gradient(135deg, #E8F4FD 0%, #D4EBF8 100%);">
    <UCard class="w-full max-w-md shadow-xl">
      <template #header>
        <div class="text-center py-2">
          <p class="text-2xl font-black mb-1" style="color: #1B2A4A;">🛒 AmaSuite</p>
          <p class="text-sm text-gray-600">アカウントを作成して始めましょう</p>
        </div>
      </template>

      <UAlert
        v-if="errorMessage"
        color="error"
        variant="subtle"
        :description="errorMessage"
        class="mb-4"
      />

      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="お名前" name="name">
          <UInput
            v-model="state.name"
            placeholder="山田 太郎"
            icon="i-lucide-user"
            class="w-full"
          />
        </UFormField>

        <UFormField label="メールアドレス" name="email">
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
            placeholder="8文字以上"
            icon="i-lucide-lock"
            class="w-full"
          />
        </UFormField>

        <UButton
          type="submit"
          label="無料で登録"
          class="w-full font-bold"
          color="primary"
          size="lg"
          :loading="loading"
        />
      </UForm>

      <template #footer>
        <p class="text-center text-sm text-gray-600">
          すでにアカウントをお持ちの方は
          <UButton to="/login" variant="link" label="ログイン" class="p-0" />
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import * as v from 'valibot'

definePageMeta({ layout: false })

const authStore = useAuthStore()

const schema = v.object({
  name: v.pipe(v.string(), v.minLength(1, 'お名前を入力してください')),
  email: v.pipe(v.string(), v.email('メールアドレスの形式が正しくありません')),
  password: v.pipe(v.string(), v.minLength(8, 'パスワードは8文字以上で入力してください')),
})

const state = reactive({ name: '', email: '', password: '' })
const loading = ref(false)
const errorMessage = ref('')

async function onSubmit() {
  loading.value = true
  errorMessage.value = ''

  try {
    // Firebase Authでアカウント作成（表示名もセットされる）
    await authStore.register(state.name, state.email, state.password)
    await navigateTo('/dashboard')
  }
  catch (err: unknown) {
    const firebaseError = err as { code?: string }
    errorMessage.value = toJapaneseError(firebaseError.code)
  }
  finally {
    loading.value = false
  }
}

function toJapaneseError(code?: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'このメールアドレスは既に登録されています'
    case 'auth/weak-password':
      return 'パスワードが弱すぎます。より複雑なパスワードにしてください'
    case 'auth/invalid-email':
      return 'メールアドレスの形式が正しくありません'
    case 'auth/network-request-failed':
      return 'ネットワークエラーが発生しました'
    default:
      return '登録に失敗しました'
  }
}
</script>
