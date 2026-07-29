<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { getNorthboundCapital, getFinancingData } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const activeTab = ref('northbound')
const northboundData = ref({ sh: [], sz: [], total: [], updateTime: '' })
const northboundNote = ref('')
const financingData = ref({ balance: 0, buy: 0, repay: 0, net: 0, timeSharing: [] })
const loading = ref(true)
const refreshing = ref(false)
let chartInstance = null

const formatFlow = (value) => {
  const abs = Math.abs(value)
  const sign = value >= 0 ? '+' : '-'
  if (abs >= 10000) return sign + (abs / 10000).toFixed(2) + '亿'
  return sign + abs.toFixed(0) + '万'
}

const formatMoney = (value) => {
  if (Math.abs(value) >= 10000) return (value / 10000).toFixed(2) + '亿'
  return value.toFixed(0) + '万'
}

const getFlowClass = (value) => value > 0 ? 'up' : value < 0 ? 'down' : ''

const loadData = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    if (activeTab.value === 'northbound') {
      const data = await getNorthboundCapital()
      northboundData.value = data
      northboundNote.value = data.note || ''
    } else {
      financingData.value = await getFinancingData()
    }
    await nextTick()
    setTimeout(() => initChart(), 80)
  } catch (e) {
    console.error('加载资金数据失败:', e)
  } finally {
    if (!silent) loading.value = false
  }
}

const initChart = () => {
  const el = document.getElementById('fund-flow-chart')
  if (!el) return
  if (chartInstance) chartInstance.dispose()
  chartInstance = echarts.init(el)

  let series = []
  let xData = []
  let tooltipFormatter

  if (activeTab.value === 'northbound') {
    const data = northboundData.value
    xData = data.total.map(p => p.time)
    series = [
      {
        name: '沪股通', type: 'line', data: data.sh.map(p => p.value), symbol: 'none',
        lineStyle: { width: 1.2, color: '#007AFF' }
      },
      {
        name: '深股通', type: 'line', data: data.sz.map(p => p.value), symbol: 'none',
        lineStyle: { width: 1.2, color: '#AF52DE' }
      },
      {
        name: '合计', type: 'line', data: data.total.map(p => p.value), symbol: 'none',
        lineStyle: { width: 1.8, color: '#F23030' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(242,48,48,0.12)' },
            { offset: 1, color: 'rgba(242,48,48,0.01)' }
          ])
        }
      }
    ]
    tooltipFormatter = (params) => {
      let html = `<div style="font-size:11px;line-height:1.6"><b>${params[0].name}</b>`
      params.forEach(p => {
        const c = p.value >= 0 ? '#F23030' : '#00B42A'
        html += `<br/>${p.seriesName}: <span style="color:${c};font-weight:600">${formatFlow(p.value)}</span>`
      })
      return html + '</div>'
    }
  } else {
    const data = financingData.value
    xData = data.timeSharing.map((_, i) => {
      const m = i * 5 + 30
      const h = 9 + Math.floor(m / 60)
      const mm = m % 60
      if (h >= 11 && h < 13) return ''
      return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    }).filter(t => t)
    series = [{
      name: '融资净买入', type: 'line', data: data.timeSharing, symbol: 'none',
      lineStyle: { width: 1.8, color: '#FF9500' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(255,149,0,0.12)' },
          { offset: 1, color: 'rgba(255,149,0,0.01)' }
        ])
      }
    }]
    tooltipFormatter = (params) => {
      return `<div style="font-size:11px"><b>${params[0].name}</b><br/>净买入: <span style="color:#FF9500;font-weight:600">${formatFlow(params[0].value)}</span></div>`
    }
  }

  chartInstance.setOption({
    backgroundColor: 'transparent',
    grid: { left: 45, right: 10, top: 10, bottom: 20 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(20,20,20,0.92)',
      borderColor: 'transparent',
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: tooltipFormatter
    },
    xAxis: {
      type: 'category', data: xData, boundaryGap: false,
      axisLine: { lineStyle: { color: 'rgba(60,60,67,0.12)' } },
      axisLabel: { color: '#8E8E93', fontSize: 9, interval: Math.floor(xData.length / 3) },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value', axisLine: { show: false },
      axisLabel: {
        color: '#8E8E93', fontSize: 9,
        formatter: (v) => Math.abs(v) >= 10000 ? (v / 10000).toFixed(0) + '亿' : v.toFixed(0) + '万'
      },
      splitLine: { lineStyle: { color: 'rgba(60,60,67,0.06)' } },
      splitNumber: 3
    },
    series
  })
}

const refresh = async () => {
  refreshing.value = true
  await loadData()
  refreshing.value = false
}

watch(activeTab, () => loadData())
watch(() => props.refreshTrigger, () => loadData(props.refreshSilent))

onMounted(() => {
  loadData()
  window.addEventListener('resize', () => chartInstance?.resize())
})

onUnmounted(() => {
  chartInstance?.dispose()
})
</script>

<template>
  <div class="fund-flow-card">
    <div class="card-header">
      <h3 class="card-title">资金流向</h3>
      <div class="header-right">
        <button class="refresh-btn" :class="{ spinning: refreshing }" @click="refresh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
        <div class="tab-switcher">
          <button :class="{ active: activeTab === 'northbound' }" @click="activeTab = 'northbound'">北向</button>
          <button :class="{ active: activeTab === 'financing' }" @click="activeTab = 'financing'">融资</button>
        </div>
      </div>
    </div>

    <div class="chart-wrap">
      <div id="fund-flow-chart" style="height: 150px; width: 100%;"></div>
    </div>

    <!-- 北向汇总 -->
    <div class="fund-summary" v-if="activeTab === 'northbound'">
      <div class="summary-item">
        <span class="item-label">沪股通</span>
        <span class="item-value" :class="getFlowClass(northboundData.sh[northboundData.sh.length - 1]?.value)">
          {{ northboundData.sh.length ? formatFlow(northboundData.sh[northboundData.sh.length - 1].value) : '--' }}
        </span>
      </div>
      <div class="summary-item">
        <span class="item-label">深股通</span>
        <span class="item-value" :class="getFlowClass(northboundData.sz[northboundData.sz.length - 1]?.value)">
          {{ northboundData.sz.length ? formatFlow(northboundData.sz[northboundData.sz.length - 1].value) : '--' }}
        </span>
      </div>
      <div class="summary-item total">
        <span class="item-label">合计</span>
        <span class="item-value" :class="getFlowClass(northboundData.total[northboundData.total.length - 1]?.value)">
          {{ northboundData.total.length ? formatFlow(northboundData.total[northboundData.total.length - 1].value) : '--' }}
        </span>
      </div>
    </div>

    <!-- 北向数据说明 -->
    <div class="fund-note" v-if="activeTab === 'northbound' && northboundNote">
      {{ northboundNote }}
    </div>

    <!-- 融资汇总 -->
    <div class="fund-summary" v-else>
      <div class="summary-item">
        <span class="item-label">融资余额</span>
        <span class="item-value">{{ formatMoney(financingData.balance) }}</span>
      </div>
      <div class="summary-item">
        <span class="item-label">融资买入</span>
        <span class="item-value up">{{ formatMoney(financingData.buy) }}</span>
      </div>
      <div class="summary-item">
        <span class="item-label">净买入</span>
        <span class="item-value" :class="getFlowClass(financingData.net)">
          {{ formatFlow(financingData.net) }}
        </span>
      </div>
    </div>

    <div class="fund-source">
      数据来源：akshare · {{ activeTab === 'northbound' ? '沪深港通资金流向' : '融资融券交易数据' }}
    </div>
  </div>
</template>

<style scoped>
.fund-flow-card {
  background: var(--color-surface); border-radius: 14px; padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(0,0,0,0.3);
}
.card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.card-title {
  font-size: 16px; font-weight: 800; color: var(--color-text-primary); margin: 0;
  letter-spacing: -0.02em;
}
.header-right {
  display: flex; align-items: center; gap: 8px;
}
.refresh-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  border-radius: 6px; border: none;
  background: var(--color-surface-elevated);
  color: var(--color-text-tertiary);
  cursor: pointer; transition: all 0.2s;
}
.refresh-btn:active { transform: scale(0.92); }
.refresh-btn.spinning svg { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.tab-switcher {
  display: flex; gap: 0; background: var(--color-surface-elevated); border-radius: 8px; padding: 2px;
}
.tab-switcher button {
  padding: 4px 12px; border: none; border-radius: 6px;
  font-size: 11px; font-weight: 600; color: var(--color-text-tertiary);
  background: transparent; cursor: pointer; transition: all 0.2s;
}
.tab-switcher button.active {
  background: var(--color-surface); color: var(--color-text-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.chart-wrap { margin-bottom: 6px; }

.fund-summary {
  display: flex; gap: 0; padding-top: 8px;
  border-top: 0.5px solid var(--color-separator);
}
.summary-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 4px 0;
}
.summary-item + .summary-item { border-left: 0.5px solid var(--color-separator); }
.item-label { font-size: 9px; color: var(--color-text-tertiary); font-weight: 600; }
.item-value { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-text-primary); }
.item-value.up { color: #ef4444; }
.item-value.down { color: #22c55e; }
.summary-item.total .item-value { color: #ef4444; }

.fund-note {
  font-size: 10px;
  color: var(--color-text-tertiary);
  padding: 6px 8px;
  margin-top: 4px;
  background: var(--color-surface-hover);
  border-radius: var(--radius-sm);
  line-height: 1.4;
  text-align: center;
}

.fund-source {
  font-size: 9px;
  color: var(--color-text-tertiary);
  text-align: center;
  padding: 6px 0 2px;
  margin-top: 6px;
  border-top: 0.5px solid var(--color-separator);
  font-variant-numeric: tabular-nums;
}
</style>
