<template>
  <Line :data="chartData" :options="chartOptions" :plugins="[crosshairPlugin]" />
</template>

<script setup lang="ts">
// ============================================================
// 価格履歴グラフ（Keepa風・複数系列版）
//
// 表示する線（Keepa本家の配色に寄せている）：
// ・新品価格（青）              … メインの線。左軸（円）
// ・Amazon本体価格（橙）        … 本体が売っていない期間は線が途切れる
// ・カート価格 BuyBox（ピンク） … カートが無い期間は線が途切れる
// ・売れ筋ランキング（緑破線）   … 右軸。上に行くほど売れている（軸を反転）
// ※ カテゴリ別ランキングは CategoryRankChart（別グラフ）に分離
//
// 【縦ライン合わせ】下に並ぶ別グラフとクロスヘアの位置を揃えるため、
// 軸の幅を固定している（AXIS_*）。軸幅が自動だと目盛りの文字数で
// プロットエリアの左右位置がグラフごとにズレてしまう。
// ============================================================

import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

import { crosshairPlugin, AXIS_LEFT_WIDTH, AXIS_RIGHT_WIDTH } from '~/utils/chartCrosshair'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const props = defineProps<{
  labels: string[]
  newPrice: (number | null)[]
  amazon?: (number | null)[]
  buyBox?: (number | null)[]
  rank?: (number | null)[]
  // 下に別グラフが続く時にtrue：日付ラベルを消してグラフ同士を詰める
  // （日付は一番下のグラフだけに表示。Keepaと同じ見せ方）
  hideDates?: boolean
}>()

// 各系列にデータが1つでもあるか（無ければ線ごと非表示にする）
const hasRank = computed(() => props.rank?.some(v => v !== null) ?? false)
const hasAmazon = computed(() => props.amazon?.some(v => v !== null) ?? false)
const hasBuyBox = computed(() => props.buyBox?.some(v => v !== null) ?? false)

const chartData = computed(() => {
  const datasets: object[] = [
    {
      label: '新品価格',
      data: props.newPrice,
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59, 130, 246, 0.06)',
      fill: true,
      tension: 0.2,
      pointRadius: 0,
      borderWidth: 2,
      yAxisID: 'y',
    },
  ]

  if (hasAmazon.value) {
    datasets.push({
      label: 'Amazon本体',
      data: props.amazon,
      borderColor: '#F7931E',
      backgroundColor: 'transparent',
      tension: 0.2,
      pointRadius: 0,
      borderWidth: 2,
      spanGaps: false, // 本体が売っていない期間は線を途切れさせる（Keepaと同じ表現）
      yAxisID: 'y',
    })
  }

  if (hasBuyBox.value) {
    datasets.push({
      label: 'カート価格',
      data: props.buyBox,
      borderColor: '#EC4899', // ピンク（Keepaのカート価格と同系色）
      backgroundColor: 'transparent',
      tension: 0.2,
      pointRadius: 0,
      borderWidth: 2,
      spanGaps: false, // カートボックスが無い期間は線を途切れさせる
      yAxisID: 'y',
    })
  }

  if (hasRank.value) {
    datasets.push({
      label: 'ランキング(総合)',
      data: props.rank,
      borderColor: '#16A34A',
      backgroundColor: 'transparent',
      tension: 0.2,
      pointRadius: 0,
      borderWidth: 1.5,
      borderDash: [4, 3], // 破線にして価格の線と区別
      yAxisID: 'y1',
    })
  }

  return { labels: props.labels, datasets }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  // Keepa風の操作感：マウス位置の縦ライン上にある全系列をまとめて表示
  // （intersect: false = 線の真上にカーソルを乗せなくても反応する）
  interaction: { mode: 'index' as const, intersect: false },
  // 右軸が無い場合も、右軸ぶんの余白を確保して他グラフと横位置を揃える
  layout: { padding: { right: hasRank.value ? 0 : AXIS_RIGHT_WIDTH } },
  plugins: {
    // 出品者数グラフとクロスヘアを連動させる（同じグループ名を指定）
    crosshair: { group: 'product-history' },
    legend: { position: 'top' as const, labels: { usePointStyle: true } },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string, yAxisID?: string }, parsed: { y: number } }) => {
          if (ctx.dataset.yAxisID === 'y1') {
            return ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}位`
          }
          return ` ${ctx.dataset.label}: ¥${ctx.parsed.y.toLocaleString()}`
        },
      },
    },
  },
  scales: {
    y: {
      position: 'left' as const,
      afterFit: (scale: { width: number }) => { scale.width = AXIS_LEFT_WIDTH },
      ticks: {
        callback: (value: string | number) => `¥${Number(value).toLocaleString()}`,
      },
    },
    // 右軸：ランキング。reverse=true で「上に行くほど順位が良い」表現に
    y1: {
      display: hasRank.value,
      position: 'right' as const,
      reverse: true,
      afterFit: (scale: { width: number }) => { scale.width = AXIS_RIGHT_WIDTH },
      grid: { drawOnChartArea: false }, // 右軸のグリッド線は描かない（ゴチャつき防止）
      ticks: {
        callback: (value: string | number) => `${Number(value).toLocaleString()}位`,
      },
    },
    x: {
      ticks: { maxTicksLimit: 8, display: !props.hideDates },
    },
  },
}))
</script>
