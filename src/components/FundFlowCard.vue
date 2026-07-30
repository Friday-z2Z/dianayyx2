<script setup>
import { ref, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { getCapitalRanking, getFinancingData } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const activeTab = ref('mainforce')
const fundRanking = ref({ inflow: [], outflow: [] })
const financingData = ref({ balance: 0, buy: 0, repay: 0, net: 0, timeSharing: [] })
const loading = ref(true)
const refreshing = ref(false)
let chartInstance = null

// 格式化资金流向（元 → 亿/万），统一单位，支持正负数
const formatFlow = (value) => {
  if (value == null || isNaN(value)) return '--'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e8) return sign + (abs / 1e8).toFixed(2) + '亿'
  if (abs >= 1e4) return sign + (abs / 1e4).toFixed(0) + '万'
  return sign + abs.toFixed(0)
}

// 格式化金额（元 → 亿/万），不带正负号
const formatMoney = (value) => {
  if (value == null || isNaN(value)) return '--'
  const abs = Math.abs(value)
  if (abs >= 1e8) return (value / 1e8).toFixed(2) + '亿'
  if (abs >= 1e4) return (value / 1e4).toFixed(0) + '万'
  return value.toFixed(0)
}

const getFlowClass = (value) => value > 0 ? 'up' : value < 0 ? 'down' : ''

const loadData = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    if (activeTab.value === 'mainforce') {
      const data = await getCapitalRanking()
      fundRanking.value = data
    } else {
      financingData.value = await getFinancingData()
    }
  } catch (e) {
    console.error('加载资金数据失败:', e)
  } finally {
    if (!silent) loading.value = false
  }
  // 确保 loading=false 后 DOM 已更新，图表容器可见再初始化
  await nextTick()
  requestAnimationFrame(() => {
    setTimeout(() => initChart(), 50)
  })
}

const initChart = () => {
  const el = document.getElementById('fund-flow-chart')
  if (!el || el.clientWidth === 0 || el.clientHeight === 0) return
  if (chartInstance) chartInstance.dispose()
  chartInstance = echarts.init(el)

  if (activeTab.value === 'mainforce') {
    const data = fundRanking.value
    // 取前8流入和前8流出
    const topInflow = (data.inflow || []).slice(0, 8)
    const topOutflow = (data.outflow || []).slice(0, 8)

    // 合并：流出在底部（负值），流入在顶部（正值）
    // 从下到上：小流出 → 大流出 → 小流入 → 大流入（金字塔形）
    // 所有值转为万元，统一单位，便于图表渲染
    const allItems = [
      ...topOutflow.slice().reverse().map(s => ({
        name: s.name,
        value: (s.mainNetInflow || 0) / 1e4,
      })),
      ...topInflow.slice().reverse().map(s => ({
        name: s.name,
        value: (s.mainNetInflow || 0) / 1e4,
      })),
    ]

    chartInstance.setOption({
      backgroundColor: 'transparent',
      grid: { left: 60, right: 55, top: 5, bottom: 5 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20,20,20,0.92)',
        borderColor: 'transparent',
        textStyle: { color: '#fff', fontSize: 11 },
        formatter: (params) => {
          const p = params[0]
          const item = allItems[p.dataIndex]
          const rawValue = item.value * 1e4
          return `<div style="font-size:11px"><b>${item.name}</b><br/>主力净流入: <span style="color:${item.value >= 0 ? '#F23030' : '#00B42A'};font-weight:600">${formatFlow(rawValue)}</span></div>`
        }
      },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: {
          color: '#8E8E93', fontSize: 9,
          formatter: (v) => {
            const abs = Math.abs(v)
            if (abs >= 10000) return (v / 10000).toFixed(1) + '亿'
            return v.toFixed(0) + '万'
          }
        },
        splitLine: { lineStyle: { color: 'rgba(60,60,67,0.06)' } },
        splitNumber: 4
      },
      yAxis: {
        type: 'category',
        data: allItems.map(s => s.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#8E8E93', fontSize: 9, width: 55, overflow: 'truncate' }
      },
      series: [{
        type: 'bar',
        data: allItems.map(s => ({
          // 统一朝右：使用绝对值
          value: Math.abs(s.value),
          itemStyle: {
            // 正值(流入)红色，负值(流出)绿色 —— A股惯例
            color: s.value >= 0
              ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: 'rgba(242,48,48,0.25)' },
                  { offset: 1, color: 'rgba(242,48,48,0.9)' }
                ])
              : new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: 'rgba(0,180,42,0.25)' },
                  { offset: 1, color: 'rgba(0,180,42,0.9)' }
                ])
          },
          label: {
            show: true,
            position: 'right',
            formatter: () => formatFlow(s.value * 1e4),
            fontSize: 8,
            color: s.value >= 0 ? '#F23030' : '#00B42A'
          }
        })),
        barWidth: '60%',
      }]
    })
  } else {
    // 融资融券图表：双轴（余额柱+净买入线）
    const data = financingData.value
    const ts = data.timeSharing || []
    if (ts.length === 0) {
      chartInstance.setOption({
        backgroundColor: 'transparent',
        title: { text: '暂无融资数据', left: 'center', top: 'center', textStyle: { color: '#8E8E93', fontSize: 12 } }
      })
      return
    }
    const xData = ts.map(t => t.date)
    const balanceData = ts.map(t => t.balance / 1e4)
    const netData = ts.map(t => t.net / 1e4)

    chartInstance.setOption({
      backgroundColor: 'transparent',
      grid: { left: 50, right: 50, top: 32, bottom: 22 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20,20,20,0.92)',
        borderColor: 'transparent',
        textStyle: { color: '#fff', fontSize: 11 },
        formatter: (params) => {
          let html = `<div style="font-size:11px"><b>${params[0].axisValue}</b>`
          params.forEach(p => {
            const rawVal = p.value * 1e4
            const color = p.seriesName === '融资余额' ? '#5856D6' : (p.value >= 0 ? '#F23030' : '#00B42A')
            html += `<br/>${p.seriesName}: <span style="color:${color};font-weight:600">${formatFlow(rawVal)}</span>`
          })
          html += '</div>'
          return html
        }
      },
      legend: {
        data: ['融资余额', '净买入'],
        top: 0, left: 'center',
        textStyle: { color: '#8E8E93', fontSize: 9 },
        itemWidth: 10, itemHeight: 6,
        itemGap: 12
      },
      xAxis: {
        type: 'category', data: xData, boundaryGap: true,
        axisLine: { lineStyle: { color: 'rgba(60,60,67,0.12)' } },
        axisLabel: { color: '#8E8E93', fontSize: 9, interval: Math.floor(xData.length / 4) },
        splitLine: { show: false }
      },
      yAxis: [
        {
          type: 'value',
          axisLine: { show: false },
          axisLabel: {
            color: '#8E8E93', fontSize: 9,
            formatter: (v) => Math.abs(v) >= 10000 ? (v / 10000).toFixed(1) + '亿' : v.toFixed(0) + '万'
          },
          splitLine: { lineStyle: { color: 'rgba(60,60,67,0.06)' } },
          splitNumber: 3
        },
        {
          type: 'value',
          axisLine: { show: false },
          axisLabel: {
            color: '#8E8E93', fontSize: 9,
            formatter: (v) => Math.abs(v) >= 10000 ? (v / 10000).toFixed(1) + '亿' : v.toFixed(0) + '万'
          },
          splitLine: { show: false },
          splitNumber: 3
        }
      ],
      series: [
        {
          name: '融资余额', type: 'bar', data: balanceData, yAxisIndex: 0,
          barWidth: '50%',
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(88,86,214,0.8)' },
              { offset: 1, color: 'rgba(88,86,214,0.2)' }
            ])
          }
        },
        {
          name: '净买入', type: 'line', data: netData, yAxisIndex: 1,
          symbol: 'circle', symbolSize: 4,
          lineStyle: { width: 1.8, color: '#FF9500' },
          itemStyle: { color: '#FF9500' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(255,149,0,0.12)' },
              { offset: 1, color: 'rgba(255,149,0,0.01)' }
            ])
          }
        }
      ]
    })
  }
}

const refresh = async () => {
  refreshing.value = true
  await loadData()
  refreshing.value = false
}

const handleResize = () => chartInstance?.resize()

watch(activeTab, () => loadData())
watch(() => props.refreshTrigger, () => loadData(props.refreshSilent))

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
})

onActivated(() => {
  // KeepAlive 激活时重绘图表
  nextTick(() => setTimeout(() => initChart(), 50))
})

onDeactivated(() => {
  // KeepAlive 停用时释放图表
  chartInstance?.dispose()
  chartInstance = null
})

onUnmounted(() => {
  chartInstance?.dispose()
  window.removeEventListener('resize', handleResize)
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
          <button :class="{ active: activeTab === 'mainforce' }" @click="activeTab = 'mainforce'">主力</button>
          <button :class="{ active: activeTab === 'financing' }" @click="activeTab = 'financing'">融资</button>
        </div>
      </div>
    </div>

    <div class="chart-wrap">
      <div v-if="loading" class="loading-state">
        <div class="mini-spinner"></div>
        <span>加载中...</span>
      </div>
      <div v-else id="fund-flow-chart" style="height: 260px; width: 100%;"></div>
    </div>

    <!-- 主力资金汇总 -->
    <div class="fund-summary" v-if="activeTab === 'mainforce' && !loading">
      <div class="summary-item">
        <span class="item-label">净流入第一</span>
        <span class="item-value up">{{ fundRanking.inflow.length ? formatFlow(fundRanking.inflow[0].mainNetInflow) : '--' }}</span>
      </div>
      <div class="summary-item">
        <span class="item-label">净流出第一</span>
        <span class="item-value down">{{ fundRanking.outflow.length ? formatFlow(fundRanking.outflow[0].mainNetInflow) : '--' }}</span>
      </div>
    </div>

    <!-- 融资汇总 -->
    <div class="fund-summary" v-else-if="!loading">
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
      数据来源：东方财富 · {{ activeTab === 'mainforce' ? '今日主力资金流向排行' : '融资融券交易数据' }}
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

.loading-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 260px; gap: 8px; color: var(--color-text-tertiary); font-size: 12px;
}
.mini-spinner {
  width: 18px; height: 18px; border: 2px solid #30363d;
  border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite;
}

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
