<template>
  <!--
    Chart.js（グラフ描画ライブラリ）のLine（折れ線）コンポーネント。
    :data にグラフのデータ、:options に見た目の設定を渡すだけで描画される。
  -->
  <Line :data="chartData" :options="chartOptions" />
</template>

<script setup lang="ts">
// ============================================================
// 売上推移グラフコンポーネント
//
// 【Chart.js とは】
// グラフ描画の定番ライブラリ。vue-chartjs はそれをVueの
// コンポーネントとして使えるようにするラッパー。
//
// 【registerについて】
// Chart.jsは使う部品（軸・線・ツールチップ等）を明示的に
// 登録する設計になっている（使わない部品を含めず軽くするため）
// ============================================================

import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale, // 横軸（日付などのカテゴリ）
  LinearScale, // 縦軸（数値）
  PointElement, // 折れ線の点
  LineElement, // 折れ線
  Tooltip, // ホバー時の吹き出し
  Legend, // 凡例（売上/利益のラベル）
  Filler, // 塗りつぶし
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

// 親コンポーネント（dashboard.vue）から受け取るデータ
const props = defineProps<{
  labels: string[]
  sales: number[]
  profit: number[]
}>()

// グラフのデータ定義（propsが変わったら自動で再描画されるようcomputedに）
const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      label: '売上',
      data: props.sales,
      borderColor: '#F7931E', // AmaSuiteのテーマオレンジ
      backgroundColor: 'rgba(247, 147, 30, 0.08)',
      fill: true, // 線の下を薄く塗る
      tension: 0.3, // 線を少し滑らかに
      pointRadius: 2,
    },
    {
      label: '利益',
      data: props.profit,
      borderColor: '#22C55E', // 利益はグリーン
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 2,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false, // 親要素の高さに合わせる
  plugins: {
    legend: { position: 'top' as const, labels: { usePointStyle: true } },
    tooltip: {
      callbacks: {
        // 吹き出しに ¥ 表示
        label: (ctx: { dataset: { label?: string }, parsed: { y: number } }) =>
          ` ${ctx.dataset.label}: ¥${ctx.parsed.y.toLocaleString()}`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        // 縦軸も ¥ 表示
        callback: (value: string | number) => `¥${Number(value).toLocaleString()}`,
      },
    },
    x: {
      ticks: { maxTicksLimit: 10 }, // 日付ラベルは間引いて表示
    },
  },
}
</script>
