<template>
  <div class="min-h-screen bg-white">

    <!-- ======== HEADER ======== -->
    <header class="sticky top-0 z-50 shadow-sm" style="background-color: #1B2A4A;">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <span class="text-xl font-black text-white tracking-tight">🛒 AmaSuite</span>
        <nav class="hidden md:flex items-center gap-6 text-sm text-white/70">
          <a href="#features" class="hover:text-white transition-colors">機能</a>
          <a href="#pricing" class="hover:text-white transition-colors">料金</a>
          <a href="#faq" class="hover:text-white transition-colors">よくある質問</a>
        </nav>
        <div class="flex items-center gap-3">
          <UButton to="/login" label="ログイン" color="neutral" variant="ghost" size="sm" class="text-white/80 hover:text-white" />
          <UButton to="/register" label="無料で始める" size="sm" color="primary" class="font-bold" />
        </div>
      </div>
    </header>

    <!-- ======== HERO ======== -->
    <section class="relative overflow-hidden py-20 md:py-32" style="background: linear-gradient(135deg, #E8F4FD 0%, #D4EBF8 50%, #C8E6F5 100%);">
      <!-- 背景の装飾円 -->
      <div class="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20" style="background: radial-gradient(circle, #F7931E, transparent); transform: translate(30%, -30%);"></div>
      <div class="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10" style="background: radial-gradient(circle, #1B2A4A, transparent); transform: translate(-30%, 30%);"></div>

      <div class="relative max-w-6xl mx-auto px-6">
        <div class="max-w-3xl mx-auto text-center">
          <div class="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium mb-8 shadow-sm" style="color: #F7931E;">
            <UIcon name="i-lucide-sparkles" />
            プライスター＋Keepaを1つのツールに
          </div>

          <h1 class="text-5xl md:text-6xl font-black leading-snug mb-6" style="color: #1B2A4A; text-shadow: 0 2px 8px rgba(27,42,74,0.08);">
            Amazonせどりを、<br />
            <span style="color: #F7931E; text-shadow: 0 2px 12px rgba(247,147,30,0.2);">もっとスマートに。</span>
          </h1>

          <p class="text-xl md:text-2xl text-gray-700 mb-10" style="line-height: 1.9;">
            価格履歴の確認から利益計算・在庫管理まで全部ひとつで。<br class="hidden md:block" />
            月額<span class="font-bold" style="color: #F7931E;">5,000円</span>で、2つのツールより<span class="font-bold">月2,700円お得。</span>
          </p>

          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <UButton
              to="/register"
              label="14日間無料で試す →"
              size="xl"
              color="primary"
              class="font-black w-full sm:w-auto px-10 shadow-lg"
            />
            <!-- デモ導線：ログイン画面にデモアカウントを自動入力した状態で開く -->
            <UButton
              to="/login?demo=1"
              label="デモを見る"
              size="xl"
              color="neutral"
              variant="outline"
              class="w-full sm:w-auto"
            />
          </div>

          <!-- 実績バッジ -->
          <div class="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            <div class="flex items-center gap-1.5">
              <UIcon name="i-lucide-shield-check" class="text-green-500" />
              クレジットカード不要で無料開始
            </div>
            <div class="flex items-center gap-1.5">
              <UIcon name="i-lucide-smartphone" class="text-blue-500" />
              スマホアプリで外出先もリサーチ
            </div>
            <div class="flex items-center gap-1.5">
              <UIcon name="i-lucide-lock" class="text-orange-500" />
              メモは完全非公開
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ======== 比較セクション ======== -->
    <section class="py-16 bg-white">
      <div class="max-w-4xl mx-auto px-6">
        <h2 class="text-3xl font-black text-center mb-10" style="color: #1B2A4A;">今まで2つのツールを使っていた人へ</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <!-- 従来 -->
          <div class="bg-gray-50 rounded-2xl p-6 text-center border border-gray-200">
            <p class="text-sm text-gray-600 mb-3 font-medium">😓 今まで</p>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between py-1.5 border-b border-gray-200">
                <span>プライスター</span><span class="font-bold text-gray-700">¥5,500〜/月</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-gray-200">
                <span>Keepa</span><span class="font-bold text-gray-700">¥2,200/月</span>
              </div>
              <div class="flex justify-between py-2 mt-1">
                <span class="font-bold">合計</span><span class="font-black text-red-500 text-lg">¥7,700/月〜</span>
              </div>
            </div>
          </div>

          <!-- 矢印 -->
          <div class="flex justify-center">
            <div class="flex flex-col items-center gap-2">
              <div class="w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style="background-color: #F7931E;">
                <UIcon name="i-lucide-arrow-right" class="text-white text-xl" />
              </div>
              <span class="text-xs font-bold" style="color: #F7931E;">まとめてお得に</span>
            </div>
          </div>

          <!-- AmaSuite -->
          <div class="rounded-2xl p-6 text-center shadow-lg border-2" style="border-color: #F7931E; background: linear-gradient(135deg, #FFF8F0, #FFF3E6);">
            <p class="text-sm font-medium mb-3" style="color: #F7931E;">🎉 AmaSuiteなら</p>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between py-1.5 border-b border-orange-100">
                <span>全機能まとめて</span><span class="font-bold text-gray-700">ひとつに</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-orange-100">
                <span>スマホアプリ</span><span class="font-bold text-gray-700">無料付属</span>
              </div>
              <div class="flex justify-between py-2 mt-1">
                <span class="font-bold">合計</span>
                <span class="font-black text-2xl" style="color: #F7931E;">¥5,000/月</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ======== 機能セクション ======== -->
    <section id="features" class="py-20" style="background-color: #F8FAFC;">
      <div class="max-w-6xl mx-auto px-6">
        <div class="text-center mb-14">
          <h2 class="text-4xl font-black mb-4" style="color: #1B2A4A;">AmaSuiteでできること</h2>
          <p class="text-lg text-gray-600">せどりに必要な機能をすべてひとつに</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="feature in features" :key="feature.title" class="bg-white rounded-2xl p-7 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" :style="`background-color: ${feature.bgColor}`">
              <UIcon :name="feature.icon" class="text-3xl" :style="`color: ${feature.color}`" />
            </div>
            <h3 class="font-black text-xl mb-3" style="color: #1B2A4A;">{{ feature.title }}</h3>
            <p class="text-base text-gray-600" style="line-height: 1.85;">{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ======== 料金セクション ======== -->
    <section id="pricing" class="py-20 bg-white">
      <div class="max-w-5xl mx-auto px-6">
        <div class="text-center mb-14">
          <h2 class="text-4xl font-black mb-4" style="color: #1B2A4A;">シンプルな料金プラン</h2>
          <p class="text-lg text-gray-600">クレジットカードのみ対応 · いつでも解約可能 · 14日間無料</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            v-for="plan in plans"
            :key="plan.name"
            class="rounded-2xl p-8 border-2 transition-all"
            :class="plan.featured ? 'shadow-2xl scale-105' : 'shadow-sm border-gray-200'"
            :style="plan.featured ? 'border-color: #F7931E; background: linear-gradient(160deg, #FFF8F0 0%, white 60%);' : ''"
          >
            <div v-if="plan.featured" class="inline-block text-xs font-black px-3 py-1 rounded-full mb-4 text-white" style="background-color: #F7931E;">
              ⭐ おすすめ
            </div>
            <h3 class="text-2xl font-black mb-2" style="color: #1B2A4A;">{{ plan.name }}</h3>
            <p class="text-base text-gray-600 mb-4">{{ plan.description }}</p>
            <div class="mb-6">
              <span class="text-4xl font-black" style="color: #1B2A4A;">{{ plan.price }}</span>
              <span class="text-gray-600 text-sm ml-1">/ 月（税込）</span>
            </div>
            <ul class="space-y-3 mb-8">
              <li v-for="f in plan.features" :key="f" class="flex items-start gap-2.5 text-base">
                <UIcon name="i-lucide-check-circle-2" class="text-xl shrink-0 mt-0.5" style="color: #F7931E;" />
                <span class="text-gray-700">{{ f }}</span>
              </li>
            </ul>
            <UButton
              :label="plan.featured ? '今すぐ始める →' : 'このプランを選ぶ'"
              class="w-full font-bold"
              :color="plan.featured ? 'primary' : 'neutral'"
              :variant="plan.featured ? 'solid' : 'outline'"
              size="lg"
              :loading="subscribingPlan === plan.id"
              @click="subscribe(plan.id)"
            />
          </div>
        </div>
        <p class="text-center text-sm text-gray-400 mt-8">
          ※ プライスター（¥5,500〜）＋ Keepa（¥2,200）＝ 合計¥7,700 と比較してお得
        </p>
      </div>
    </section>

    <!-- ======== FAQ ======== -->
    <section id="faq" class="py-20" style="background-color: #F8FAFC;">
      <div class="max-w-3xl mx-auto px-6">
        <h2 class="text-4xl font-black text-center mb-12" style="color: #1B2A4A;">よくある質問</h2>
        <div class="space-y-4">
          <div v-for="faq in faqs" :key="faq.q" class="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
            <p class="font-black text-lg mb-3" style="color: #1B2A4A;">Q. {{ faq.q }}</p>
            <p class="text-base text-gray-600" style="line-height: 1.9;">{{ faq.a }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ======== CTA ======== -->
    <section class="py-20" style="background-color: #1B2A4A;">
      <div class="max-w-3xl mx-auto px-6 text-center">
        <h2 class="text-4xl font-black text-white mb-5">まずは14日間、無料で試してみよう</h2>
        <p class="text-white/80 text-lg mb-10">クレジットカード不要。14日後に自動解約されます。</p>
        <UButton
          to="/register"
          label="無料でアカウントを作る →"
          size="xl"
          color="primary"
          class="font-black px-12 shadow-xl"
        />
      </div>
    </section>

    <!-- ======== FOOTER ======== -->
    <footer class="py-10 border-t border-gray-100">
      <div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <span class="font-black text-lg" style="color: #1B2A4A;">🛒 AmaSuite</span>
        <p class="text-sm text-gray-400">© 2026 AmaSuite. All rights reserved.</p>
        <div class="flex gap-4 text-sm text-gray-400">
          <a href="#" class="hover:text-gray-700">利用規約</a>
          <a href="#" class="hover:text-gray-700">プライバシーポリシー</a>
          <a href="#" class="hover:text-gray-700">お問い合わせ</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const features = [
  {
    icon: 'i-lucide-line-chart',
    title: '価格履歴グラフ',
    description: 'Keepaのデータで90日・180日・1年の価格推移をグラフで確認。仕入れのベストタイミングを逃さない。',
    bgColor: '#FFF0E0',
    color: '#F7931E',
  },
  {
    icon: 'i-lucide-calculator',
    title: '利益計算ツール',
    description: '仕入れ値を入力するだけでFBA手数料・Amazon手数料を自動計算。リアルタイムで利益率を表示。',
    bgColor: '#E8F4FD',
    color: '#3B82F6',
  },
  {
    icon: 'i-lucide-warehouse',
    title: '在庫管理',
    description: '商品ごとの在庫数・補充アラートを一元管理。在庫切れで機会損失を防ぐ。',
    bgColor: '#F0FDF4',
    color: '#22C55E',
  },
  {
    icon: 'i-lucide-notebook-pen',
    title: '商品メモ（完全非公開）',
    description: '仕入れ先・気づき・備考をメモとして保存。あなただけが見られるプライベートな記録。',
    bgColor: '#FDF0FF',
    color: '#A855F7',
  },
  {
    icon: 'i-lucide-smartphone',
    title: 'スマホアプリ対応',
    description: 'Flutter製のアプリでお店にいながらバーコードスキャン→即利益計算。外出先でもリサーチ可能。',
    bgColor: '#FFF0E0',
    color: '#F7931E',
  },
  {
    icon: 'i-lucide-bell',
    title: '価格アラート',
    description: '登録商品の価格が設定値を下回ったらプッシュ通知。見逃しゼロで仕入れチャンスを確保。',
    bgColor: '#E8F4FD',
    color: '#EF4444',
  },
]

const plans = [
  {
    id: 'starter',
    name: 'スターター',
    price: '¥3,000',
    description: '副業でせどりを始めたい方に',
    featured: false,
    features: [
      '商品登録 50件まで',
      '価格履歴グラフ（90日）',
      '利益計算ツール',
      'スマホアプリ',
    ],
  },
  {
    id: 'standard',
    name: 'スタンダード',
    price: '¥5,000',
    description: '本格的にせどりで稼ぎたい方に',
    featured: true,
    features: [
      '商品登録 無制限',
      '価格履歴グラフ（1年）',
      '利益計算ツール',
      'スマホアプリ',
      '在庫管理・補充アラート',
      '価格アラート（無制限）',
      '商品メモ（完全非公開）',
    ],
  },
  {
    id: 'pro',
    name: 'プロ',
    price: '¥9,800',
    description: '複数店舗・大規模運営向け',
    featured: false,
    features: [
      'スタンダードの全機能',
      'CSV一括インポート',
      'API連携',
      '優先サポート',
    ],
  },
]

// -------------------------------------------------------
// プラン契約：Stripe Checkout（決済ページ）へ遷移する
// 未ログインなら新規登録ページへ誘導
// -------------------------------------------------------
const authStore = useAuthStore()
const subscribingPlan = ref<string | null>(null)

async function subscribe(planId: string) {
  // 未ログインならまずアカウント作成へ
  if (!authStore.isLoggedIn) {
    return navigateTo('/register')
  }

  subscribingPlan.value = planId
  try {
    const token = await authStore.getIdToken()
    // サーバーにCheckout Session（Stripeの決済ページ）を作ってもらう
    const res = await $fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { plan: planId },
    })
    // Stripeの決済ページへ移動（外部URLなので location を直接書き換え）
    if (res.url) {
      window.location.href = res.url
    }
  }
  finally {
    subscribingPlan.value = null
  }
}

const faqs = [
  {
    q: '無料期間中にクレジットカードは必要ですか？',
    a: '14日間の無料期間中はカード登録不要です。継続利用を希望される場合のみ、期間終了前にご登録ください。',
  },
  {
    q: 'プライスターからの乗り換えはできますか？',
    a: 'はい。プライスターの主要機能と同等の機能を搭載しています。商品データのCSVインポートにも対応予定です。',
  },
  {
    q: 'メモは本当に他の人に見られませんか？',
    a: 'はい。メモデータはあなたのアカウントにのみ紐づいており、他のユーザーや運営からも閲覧できない設計です。',
  },
  {
    q: 'スマホアプリはiOSとAndroid両方対応していますか？',
    a: 'はい。Flutter製のアプリのため、iOS・Android両方に対応しています。',
  },
]
</script>
