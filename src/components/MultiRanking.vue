<script setup>
import { ref, onMounted, onUnmounted, onActivated, onDeactivated, watch } from 'vue'
import { getPriceRanking, getCapitalRanking, getNorthboundRanking } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const activeRank = ref('price')
const priceRanking = ref({ up: [], down: [] })
const capitalRanking = ref({ inflow: [], outflow: [] })
const northboundRanking = ref({ increase: [], decrease: [] })
const loading = ref(true)
const refreshing = ref(false)
const updateTime = ref('')

const loadRankingData = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const [price, capital, northbound] = await Promise.all([
      getPriceRanking(),
      getCapitalRanking().catch(() => ({ inflow: [], outflow: [] })),
      getNorthboundRanking().catch(() => ({ increase: [], decrease: [] })),
    ])
    priceRanking.value = price
    capitalRanking.value = capital
    northboundRanking.value = northbound
    updateTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    console.error('加载排行数据失败:', e)
  } finally {
    if (!silent) loading.value = false
  }
}

const refresh = async () => {
  refreshing.value = true
  loading.value = true
  try {
    if (activeRank.value === 'price') {
      priceRanking.value = await getPriceRanking()
    } else if (activeRank.value === 'capital') {
      capitalRanking.value = await getCapitalRanking()
    } else {
      northboundRanking.value = await getNorthboundRanking()
    }
  } catch (e) {
    console.error('刷新排行数据失败:', e)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const getChangeColor = (val) => {
  const n = parseFloat(val)
  return n > 0 ? '#F23030' : n < 0 ? '#00B42A' : '#8E8E93'
}

let refreshTimer = null
watch(() => props.refreshTrigger, () => loadRankingData(props.refreshSilent))
onMounted(() => {
  loadRankingData()
  refreshTimer = setInterval(loadRankingData, 60000)
})
onActivated(() => {
  if (!refreshTimer) refreshTimer = setInterval(loadRankingData, 60000)
})
onDeactivated(() => {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="multi-ranking">
    <div class="ranking-header">
      <h3 class="ranking-title">市场排行</h3>
      <div class="header-right">
        <button class="refresh-btn" :class="{ spinning: refreshing }" @click="refresh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
        <div class="ranking-tabs">
          <button :class="{ active: activeRank === 'price' }" @click="activeRank = 'price'">涨幅</button>
          <button :class="{ active: activeRank === 'capital' }" @click="activeRank = 'capital'">资金</button>
          <button :class="{ active: activeRank === 'northbound' }" @click="activeRank = 'northbound'">主力</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="mini-spinner"></div>
    </div>

    <div v-else class="ranking-dual">
      <!-- 左列：流入/涨幅 -->
      <div class="ranking-column">
        <div class="column-header up-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><polyline points="18 15 12 9 6 15"/></svg>
          <span>{{ activeRank === 'price' ? '涨幅榜' : activeRank === 'capital' ? '资金流入' : '主力流入' }}</span>
        </div>
        <div class="ranking-list">
          <div
            v-for="(stock, i) in (activeRank === 'price' ? priceRanking.up : activeRank === 'capital' ? capitalRanking.inflow : northboundRanking.increase)"
            :key="stock.code"
            class="rank-item"
          >
            <span class="rank-idx" :class="{ top3: i < 3 }">{{ i + 1 }}</span>
            <div class="rank-info">
              <span class="rank-name">{{ stock.name }}</span>
              <span class="rank-code">{{ stock.code }}</span>
            </div>
            <span class="rank-value" :style="{ color: getChangeColor(stock.changePercent) }">
              {{ activeRank === 'price' ? (parseFloat(stock.changePercent) > 0 ? '+' : '') + stock.changePercent + '%' : stock.volume }}
            </span>
          </div>
        </div>
      </div>

      <!-- 右列：流出/跌幅 -->
      <div class="ranking-column">
        <div class="column-header down-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><polyline points="6 9 12 15 18 9"/></svg>
          <span>{{ activeRank === 'price' ? '跌幅榜' : activeRank === 'capital' ? '资金流出' : '主力流出' }}</span>
        </div>
        <div class="ranking-list">
          <div
            v-for="(stock, i) in (activeRank === 'price' ? priceRanking.down : activeRank === 'capital' ? capitalRanking.outflow : northboundRanking.decrease)"
            :key="stock.code"
            class="rank-item"
          >
            <span class="rank-idx" :class="{ top3: i < 3 }">{{ i + 1 }}</span>
            <div class="rank-info">
              <span class="rank-name">{{ stock.name }}</span>
              <span class="rank-code">{{ stock.code }}</span>
            </div>
            <span class="rank-value" :style="{ color: getChangeColor(stock.changePercent) }">
              {{ activeRank === 'price' ? (parseFloat(stock.changePercent) > 0 ? '+' : '') + stock.changePercent + '%' : stock.volume }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="ranking-source">
      数据来源：akshare · 全市场实时排行 · {{ updateTime }}
    </div>
  </div>
</template>

<style scoped>
.multi-ranking {
  background: var(--color-surface); border-radius: 14px; padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(0,0,0,0.3);
}
.ranking-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.ranking-title {
  font-size: 16px; font-weight: 800; color: var(--color-text-primary); margin: 0;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px; height: 26px;
  border-radius: 6px;
  border: none;
  background: var(--color-surface-elevated);
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
}
.refresh-btn:active { transform: scale(0.92); }
.refresh-btn.spinning svg { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.ranking-tabs {
  display: flex; gap: 0; background: var(--color-surface-elevated); border-radius: 8px; padding: 2px;
}
.ranking-tabs button {
  padding: 4px 12px; border: none; border-radius: 6px;
  font-size: 11px; font-weight: 600; color: var(--color-text-tertiary);
  background: transparent; cursor: pointer; transition: all 0.2s;
}
.ranking-tabs button.active {
  background: var(--color-surface); color: var(--color-text-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.loading-state {
  display: flex; justify-content: center; padding: 24px;
}
.mini-spinner {
  width: 18px; height: 18px; border: 2px solid #30363d;
  border-top-color: #ef4444; border-radius: 50%; animation: spin 0.8s linear infinite;
}

.ranking-dual {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.ranking-column {
  min-width: 0;
}
.column-header {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 8px; border-radius: 8px; margin-bottom: 6px;
  font-size: 11px; font-weight: 700;
}
.up-header {
  background: rgba(239,68,68,0.06); color: #ef4444;
}
.down-header {
  background: rgba(34,197,94,0.06); color: #22c55e;
}

.ranking-list {
  display: flex; flex-direction: column; gap: 0;
  max-height: 320px; overflow-y: auto;
}
.rank-item {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 4px;
  border-bottom: 0.5px solid var(--color-separator);
  transition: background 0.12s;
}
.rank-item:last-child { border-bottom: none; }
.rank-item:active { background: var(--color-surface-elevated); }

.rank-idx {
  width: 18px; text-align: center; font-size: 10px; font-weight: 700;
  color: var(--color-text-quaternary); font-variant-numeric: tabular-nums; flex-shrink: 0;
}
.rank-idx.top3 { color: #ef4444; font-size: 12px; font-weight: 800; }
.rank-info {
  flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px;
}
.rank-name {
  font-size: 11px; font-weight: 600; color: var(--color-text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rank-code { font-size: 9px; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
.rank-value {
  font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
  flex-shrink: 0; text-align: right;
}

.ranking-source {
  font-size: 9px;
  color: var(--color-text-tertiary);
  text-align: center;
  padding: 6px 0 2px;
  margin-top: 6px;
  border-top: 0.5px solid var(--color-separator);
  font-variant-numeric: tabular-nums;
}
</style>
