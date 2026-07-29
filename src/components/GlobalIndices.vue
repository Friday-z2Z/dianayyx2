<script setup>
import { ref, onMounted, onUnmounted, onActivated, onDeactivated, watch } from 'vue'
import { getGlobalIndices, getExchangeRates } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const indices = ref([])
const exchangeRates = ref([])
const updateTime = ref('')
let updateInterval = null

const getChangeColor = (value) => {
  const n = parseFloat(value)
  return n > 0 ? '#F23030' : n < 0 ? '#00B42A' : '#8E8E93'
}

const getChangeBg = (value) => {
  const n = parseFloat(value)
  if (n > 0) return 'rgba(242,48,48,0.06)'
  if (n < 0) return 'rgba(0,180,42,0.06)'
  return 'transparent'
}

const loadGlobalData = async (silent = false) => {
  try {
    const [indicesData, ratesData] = await Promise.all([
      getGlobalIndices(),
      getExchangeRates()
    ])
    indices.value = indicesData
    exchangeRates.value = ratesData
    updateTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    console.error('加载全球市场数据失败:', e)
  }
}

watch(() => props.refreshTrigger, () => loadGlobalData(props.refreshSilent))

onMounted(() => {
  loadGlobalData()
  updateInterval = setInterval(loadGlobalData, 5 * 60 * 1000)
})

onActivated(() => {
  if (!updateInterval) updateInterval = setInterval(loadGlobalData, 5 * 60 * 1000)
})
onDeactivated(() => {
  if (updateInterval) { clearInterval(updateInterval); updateInterval = null }
})

onUnmounted(() => {
  if (updateInterval) clearInterval(updateInterval)
})
</script>

<template>
  <div class="global-indices">
    <div class="indices-header">
      <h3 class="indices-title">全球市场</h3>
      <span class="update-time" v-if="updateTime">{{ updateTime }}</span>
    </div>

    <div class="indices-grid">
      <div v-for="index in indices" :key="index.code" class="index-item" :style="{ background: getChangeBg(index.changePercent) }">
        <div class="index-top">
          <span class="index-name">{{ index.name }}</span>
          <span class="index-code">{{ index.code }}</span>
        </div>
        <div class="index-bottom">
          <span class="index-value">{{ index.value }}</span>
          <span class="index-change" :style="{ color: getChangeColor(index.changePercent) }">
            {{ parseFloat(index.changePercent) > 0 ? '+' : '' }}{{ index.changePercent }}%
          </span>
        </div>
      </div>
    </div>

    <!-- 汇率 -->
    <div class="exchange-section">
      <h4 class="exchange-title">汇率</h4>
      <div class="exchange-list">
        <div v-for="rate in exchangeRates" :key="rate.code" class="exchange-item">
          <span class="exchange-name">{{ rate.name }}</span>
          <span class="exchange-rate">{{ rate.rate }}</span>
          <span class="exchange-change" :style="{ color: getChangeColor(rate.change) }">
            {{ parseFloat(rate.change) > 0 ? '+' : '' }}{{ rate.change }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.global-indices {
  background: var(--color-surface); border-radius: 14px; padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(0,0,0,0.3);
}
.indices-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.indices-title {
  font-size: 16px; font-weight: 800; color: var(--color-text-primary); margin: 0;
}
.update-time { font-size: 10px; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }

.indices-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
  margin-bottom: 12px;
}
.index-item {
  padding: 10px; border-radius: 10px;
  border: 0.5px solid rgba(255,255,255,0.06);
  transition: transform 0.15s;
}
.index-item:active { transform: scale(0.97); }

.index-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 4px;
}
.index-name { font-size: 11px; font-weight: 700; color: var(--color-text-primary); }
.index-code { font-size: 8px; color: var(--color-text-tertiary); font-weight: 600; }

.index-bottom {
  display: flex; align-items: baseline; justify-content: space-between; gap: 4px;
}
.index-value {
  font-size: 13px; font-weight: 800; color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}
.index-change {
  font-size: 11px; font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.exchange-section {
  padding-top: 10px; border-top: 0.5px solid var(--color-separator);
}
.exchange-title {
  font-size: 13px; font-weight: 700; color: var(--color-text-primary);
  margin: 0 0 8px;
}
.exchange-list {
  display: flex; flex-direction: column; gap: 0;
}
.exchange-item {
  display: flex; align-items: center; padding: 6px 0;
  border-bottom: 0.5px solid var(--color-separator);
}
.exchange-item:last-child { border-bottom: none; }
.exchange-name {
  flex: 1; font-size: 12px; font-weight: 600; color: var(--color-text-primary);
}
.exchange-rate {
  font-size: 12px; font-weight: 700; color: var(--color-text-primary);
  font-variant-numeric: tabular-nums; margin-right: 10px;
}
.exchange-change {
  font-size: 11px; font-weight: 700;
  font-variant-numeric: tabular-nums; min-width: 50px; text-align: right;
}
</style>
