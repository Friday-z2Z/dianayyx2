<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import * as echarts from 'echarts'
import { getMarketSentiment } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const sentiment = ref({})
const loading = ref(true)
const updateTime = ref('')
let chartInstance = null

const totalCount = computed(() => {
  return (sentiment.value.upCount || 0) + (sentiment.value.downCount || 0) + (sentiment.value.flatCount || 0)
})

const bombRate = computed(() => {
  const total = (sentiment.value.limitUpCount || 0) + (sentiment.value.bombCount || 0)
  return total > 0 ? ((sentiment.value.bombCount / total) * 100).toFixed(1) : '0.0'
})

const loadSentimentData = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    sentiment.value = await getMarketSentiment()
    updateTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    await initChart()
  } catch (e) {
    console.error('加载市场情绪数据失败:', e)
  } finally {
    if (!silent) loading.value = false
  }
}

const initChart = async () => {
  await new Promise(r => setTimeout(r, 50))
  if (!sentiment.value.timeSharing) return
  const el = document.getElementById('sentiment-chart')
  if (!el) return
  if (chartInstance) chartInstance.dispose()
  chartInstance = echarts.init(el)

  const { time, up, down } = sentiment.value.timeSharing
  chartInstance.setOption({
    backgroundColor: 'transparent',
    grid: { left: 45, right: 10, top: 12, bottom: 20 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(20,20,20,0.92)',
      borderColor: 'transparent',
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (params) => {
        return `${params[0].name}<br/>上涨: <span style="color:#F23030;font-weight:700">${params[0].value}</span>家<br/>下跌: <span style="color:#00B42A;font-weight:700">${params[1].value}</span>家`
      }
    },
    xAxis: {
      type: 'category', data: time, boundaryGap: false,
      axisLine: { lineStyle: { color: 'rgba(60,60,67,0.12)' } },
      axisLabel: { color: '#8E8E93', fontSize: 9, interval: Math.floor(time.length / 4) },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value', axisLine: { show: false },
      axisLabel: { color: '#8E8E93', fontSize: 9 },
      splitLine: { lineStyle: { color: 'rgba(60,60,67,0.06)' } },
      splitNumber: 3
    },
    series: [
      {
        name: '上涨', type: 'line', data: up, symbol: 'none',
        lineStyle: { width: 1.5, color: '#F23030' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(242,48,48,0.18)' },
            { offset: 1, color: 'rgba(242,48,48,0.01)' }
          ])
        }
      },
      {
        name: '下跌', type: 'line', data: down, symbol: 'none',
        lineStyle: { width: 1.5, color: '#00B42A' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0,180,42,0.15)' },
            { offset: 1, color: 'rgba(0,180,42,0.01)' }
          ])
        }
      }
    ]
  })
}

watch(() => props.refreshTrigger, () => loadSentimentData(props.refreshSilent))

onMounted(() => {
  loadSentimentData()
  window.addEventListener('resize', () => chartInstance?.resize())
})

onUnmounted(() => {
  chartInstance?.dispose()
})
</script>

<template>
  <div class="market-dashboard">
    <div class="dashboard-header">
      <h3 class="dashboard-title">全市场情绪</h3>
      <span class="update-time" v-if="updateTime">{{ updateTime }} 更新</span>
    </div>

    <!-- 涨跌统计条 -->
    <div class="sentiment-bar">
      <div class="bar-segment up" :style="{ width: (sentiment.upCount / totalCount * 100) + '%' }">
        <span class="bar-label">{{ sentiment.upCount }}涨</span>
      </div>
      <div class="bar-segment flat" :style="{ width: (sentiment.flatCount / totalCount * 100) + '%' }">
        <span class="bar-label" v-if="sentiment.flatCount > 100">{{ sentiment.flatCount }}平</span>
      </div>
      <div class="bar-segment down" :style="{ width: (sentiment.downCount / totalCount * 100) + '%' }">
        <span class="bar-label">{{ sentiment.downCount }}跌</span>
      </div>
    </div>

    <!-- 分时走势图 -->
    <div class="chart-container">
      <div v-if="loading" class="chart-loading">
        <div class="mini-spinner"></div>
      </div>
      <div id="sentiment-chart" style="height: 160px; width: 100%;"></div>
    </div>

    <!-- 封板炸板统计 -->
    <div class="limit-stats">
      <div class="limit-item">
        <span class="limit-icon up-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
        </span>
        <div class="limit-info">
          <span class="limit-label">涨停</span>
          <span class="limit-value up">{{ sentiment.limitUpCount || 0 }}</span>
        </div>
      </div>
      <div class="limit-item">
        <span class="limit-icon down-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
        <div class="limit-info">
          <span class="limit-label">跌停</span>
          <span class="limit-value down">{{ sentiment.limitDownCount || 0 }}</span>
        </div>
      </div>
      <div class="limit-item">
        <span class="limit-icon bomb-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </span>
        <div class="limit-info">
          <span class="limit-label">炸板</span>
          <span class="limit-value bomb">{{ sentiment.bombCount || 0 }}</span>
        </div>
      </div>
      <div class="limit-item">
        <span class="limit-icon rate-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M9 12l2 2 4-4"/></svg>
        </span>
        <div class="limit-info">
          <span class="limit-label">封板率</span>
          <span class="limit-value rate">{{ (100 - parseFloat(bombRate)).toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <div class="dashboard-source">数据来源：akshare · 全市场涨跌家数分时 + 涨跌停/炸板实时统计</div>
  </div>
</template>

<style scoped>
.market-dashboard {
  background: var(--color-surface);
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(0,0,0,0.3);
}
.dashboard-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.dashboard-title {
  font-size: 16px; font-weight: 800; color: var(--color-text-primary); margin: 0;
  letter-spacing: -0.02em;
}
.update-time {
  font-size: 10px; color: var(--color-text-tertiary); font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* 涨跌统计条 */
.sentiment-bar {
  display: flex; height: 28px; border-radius: 8px; overflow: hidden;
  margin-bottom: 10px; position: relative;
}
.bar-segment {
  display: flex; align-items: center; justify-content: center;
  transition: width 0.5s ease;
  min-width: 30px;
}
.bar-segment.up { background: linear-gradient(135deg, #ef4444, #FF5E4D); }
.bar-segment.flat { background: #30363d; }
.bar-segment.down { background: linear-gradient(135deg, #22c55e, #7BC8A4); }
.bar-label {
  font-size: 10px; font-weight: 700; color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.15);
  white-space: nowrap;
}
.bar-segment.flat .bar-label { color: var(--color-text-tertiary); text-shadow: none; }

/* Chart */
.chart-container {
  position: relative; margin-bottom: 8px;
}
.chart-loading {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  z-index: 2; background: rgba(22,27,34,0.8); border-radius: 8px;
}
.mini-spinner {
  width: 20px; height: 20px; border: 2px solid #30363d;
  border-top-color: #ef4444; border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 封板炸板 */
.limit-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  padding-top: 10px; border-top: 0.5px solid var(--color-separator);
}
.limit-item {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px; background: var(--color-surface-elevated); border-radius: 8px;
}
.limit-icon {
  width: 22px; height: 22px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.limit-icon svg { width: 12px; height: 12px; }
.up-icon { background: rgba(239,68,68,0.1); color: #ef4444; }
.down-icon { background: rgba(34,197,94,0.1); color: #22c55e; }
.bomb-icon { background: rgba(255,149,0,0.1); color: #FF9500; }
.rate-icon { background: rgba(37,99,235,0.1); color: #2563eb; }
.limit-info {
  display: flex; flex-direction: column; gap: 1px; min-width: 0;
}
.limit-label { font-size: 9px; color: var(--color-text-tertiary); font-weight: 600; }
.limit-value {
  font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.limit-value.up { color: #ef4444; }
.limit-value.down { color: #22c55e; }
.limit-value.bomb { color: #FF9500; }
.limit-value.rate { color: #2563eb; }

.dashboard-source {
  font-size: 9px;
  color: var(--color-text-tertiary);
  text-align: center;
  padding: 6px 0 2px;
  margin-top: 6px;
  border-top: 0.5px solid var(--color-separator);
  font-variant-numeric: tabular-nums;
}
</style>
