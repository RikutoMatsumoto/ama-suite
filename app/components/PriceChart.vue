<template>
  <Line :data="chartData" :options="chartOptions" />
</template>

<script setup lang="ts">
// ============================================================
// 価格履歴グラフ（Keepa風・複数系列版）
//
// 表示する線（Keepa本家の配色に寄せている）：
// ・新品価格（青）        … メインの線。左軸（円）
// ・Amazon本体価格（橙）  … 本体が売っていない期間は線が途切れる
// ・売れ筋ランキング（緑） … 右軸。上に行くほど売れている（軸を反転）
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const props = defineProps<{
  labels: string[]
  newPrice: (number | null)[]
  amazon?: (number | null)[]
  rank?: (number | null)[]
}>()

// ランキングデータが1つでもあるか（無ければ右軸ごと非表示にする）
const hasRank = computed(() => props.rank?.some(v => v !== null) ?? false)
const hasAmazon = computed(() => props.amazon?.some(v => v !== null) ?? false)

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

  if (hasRank.value) {
    datasets.push({
      label: 'ランキング',
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
  plugins: {
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
      ticks: {
        callback: (value: string | number) => `¥${Number(value).toLocaleString()}`,
      },
    },
    // 右軸：ランキング。reverse=true で「上に行くほど順位が良い」表現に
    y1: {
      display: hasRank.value,
      position: 'right' as const,
      reverse: true,
      grid: { drawOnChartArea: false }, // 右軸のグリッド線は描かない（ゴチャつき防止）
      ticks: {
        callback: (value: string | number) => `${Number(value).toLocaleString()}位`,
      },
    },
    x: {
      ticks: { maxTicksLimit: 8 },
    },
  },
}))
</script>
