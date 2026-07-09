<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
    <!-- サイドバー（ネイビー） -->
    <aside class="w-64 flex flex-col" style="background-color: #1B2A4A;">
      <!-- ロゴ（クリックでダッシュボードへ） -->
      <div class="h-16 flex items-center px-6 border-b border-white/10">
        <NuxtLink to="/dashboard" class="text-xl font-bold text-white hover:opacity-80 transition-opacity">
          🛒 AmaSuite
        </NuxtLink>
      </div>

      <!-- ナビゲーション -->
      <nav class="flex-1 px-4 py-6 space-y-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          :class="$route.path === item.to
            ? 'bg-primary-500 text-white'
            : 'text-white/70 hover:text-white hover:bg-white/10'"
        >
          <UIcon :name="item.icon" class="text-lg shrink-0" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- ユーザー情報（Firebaseのログインユーザーを表示） -->
      <div class="p-4 border-t border-white/10">
        <div class="flex items-center gap-3">
          <UAvatar size="sm" :alt="authStore.user?.displayName ?? 'User'" class="shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-white truncate">{{ authStore.user?.displayName ?? 'ユーザー' }}</p>
            <p class="text-xs text-white/50 truncate">{{ authStore.user?.email }}</p>
          </div>
          <UButton icon="i-lucide-log-out" color="neutral" variant="ghost" size="sm" class="text-white/50 hover:text-white" @click="logout" />
        </div>
      </div>
    </aside>

    <!-- メインコンテンツ -->
    <main class="flex-1 flex flex-col min-w-0 bg-gray-50">
      <header class="h-16 bg-white border-b border-gray-200 flex items-center px-10">
        <slot name="header">
          <h1 class="text-lg font-bold" style="color: #1B2A4A;">{{ pageTitle }}</h1>
        </slot>
      </header>
      <div class="flex-1 overflow-auto">
        <div style="max-width: 1280px; margin: 0 auto; padding: 2rem 2.5rem;">
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

const navItems = [
  { to: '/dashboard', icon: 'i-lucide-layout-dashboard', label: 'ダッシュボード' },
  { to: '/products', icon: 'i-lucide-package', label: '商品管理' },
  { to: '/inventory', icon: 'i-lucide-warehouse', label: '在庫管理' },
  { to: '/orders', icon: 'i-lucide-shopping-cart', label: '注文管理' },
  { to: '/settings', icon: 'i-lucide-settings', label: '設定' },
]

const pageTitles: Record<string, string> = {
  '/dashboard': 'ダッシュボード',
  '/products': '商品管理',
  '/inventory': '在庫管理',
  '/orders': '注文管理',
  '/settings': '設定',
}

const pageTitle = computed(() => pageTitles[route.path] ?? '')

// Firebaseのログインユーザー情報を持つストア
const authStore = useAuthStore()

async function logout() {
  await authStore.logout()  // Firebaseからログアウト
  navigateTo('/login')
}
</script>
