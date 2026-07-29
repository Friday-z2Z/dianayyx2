<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { getMarketAnalysis } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const loading = ref(true)
const error = ref(null)
const data = ref(null)
const updateTime = ref('')

/**
 * 根据涨跌家数、涨停数与指数表现生成一句话市场总结
 */
function buildSummary(d) {
  const up = d.upCount || 0
  const down = d.downCount || 0
  const flat = d.flatCount || 0
  const lu = d.limitUpCount || 0
  const ld = d.limitDownCount || 0
  const shChg = parseFloat(d.shIndex?.change || 0)
  const szChg = parseFloat(d.szIndex?.change || 0)
  const cyChg = parseFloat(d.cyIndex?.change || 0)
  const total = up + down + flat || 1
  const upRatio = up / total

  // 整体定调
  let tone
  if (upRatio > 0.7) tone = '今日市场普涨走强'
  else if (upRatio > 0.55) tone = '今日市场震荡偏强'
  else if (upRatio > 0.45) tone = '今日市场窄幅震荡'
  else if (upRatio > 0.3) tone = '今日市场震荡偏弱'
  else tone = '今日市场普跌承压'

  // 主线：取最强指数推断
  const chgs = [
    { key: 'cy', val: cyChg, text: '科技成长与AI算力链表现活跃' },
    { key: 'sh', val: shChg, text: '权重蓝筹企稳护盘' },
    { key: 'sz', val: szChg, text: '深市成长股相对抗跌' },
  ]
  const lead = chgs.reduce((a, b) => (b.val > a.val ? b : a))
  const mainline = lead.val > 0 ? lead.text : '板块整体分化明显'

  // 涨跌停 / 赚钱效应
  let limitNote
  if (lu >= 30) limitNote = `涨停${lu}家封板情绪高涨`
  else if (lu >= 15) limitNote = `涨停${lu}家赚钱效应尚可`
  else if (lu >= 5) limitNote = `涨停${lu}家资金接力谨慎`
  else limitNote = `涨停仅${lu}家观望情绪浓厚`
  if (ld >= 10) limitNote += `，跌停${ld}家需警惕高位风险`

  // 风险 / 机会提示
  let risk
  if (upRatio > 0.65) risk = '注意高位标的获利回吐风险'
  else if (upRatio < 0.35) risk = '控制仓位等待企稳信号'
  else risk = '关注结构性机会与量能配合'

  return `${tone}，${mainline}，${limitNote}，${risk}`
}

const summary = computed(() => {
  if (!data.value) return ''
  const d = data.value
  const parts = [buildSummary(d)]
  // 添加数据出处
  parts.push(`（上证${d.shIndex?.change || '0.00'}% / 深证${d.szIndex?.change || '0.00'}% / 创业板${d.cyIndex?.change || '0.00'}%，${d.upCount || 0}涨${d.downCount || 0}跌）`)
  return parts.join('')
})

const loadData = async (silent = false) => {
  if (!silent) loading.value = true
  if (!silent) error.value = null
  try {
    data.value = await getMarketAnalysis()
    updateTime.value = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (e) {
    console.error('加载市场总结数据失败:', e)
    error.value = e?.message || '数据加载失败'
  } finally {
    if (!silent) loading.value = false
  }
}

const retry = () => loadData()

watch(() => props.refreshTrigger, () => loadData(props.refreshSilent))

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="market-summary">
    <!-- 加载态 -->
    <div v-if="loading" class="ms-state">
      <div class="ms-spinner"></div>
      <span class="ms-state-text">AI 正在复盘市场…</span>
    </div>

    <!-- 错误态 -->
    <div v-else-if="error" class="ms-state ms-state-error">
      <span class="ms-state-text">{{ error }}</span>
      <button class="ms-retry" @click="retry">重试</button>
    </div>

    <!-- 正常态 -->
    <template v-else>
      <div class="ms-header">
        <span class="ms-dot" aria-hidden="true"></span>
        <span class="ms-tag">AI复盘</span>
      </div>

      <p class="ms-text">{{ summary }}</p>

      <div class="ms-footer">
        <span class="ms-time">数据更新于 {{ updateTime }}</span>
        <span class="ms-source">数据来源：akshare · 东方财富</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.market-summary {
  position: relative;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-separator);
  padding: 14px 14px 12px;
  overflow: hidden;
}

/* ===== 状态态（加载 / 错误） ===== */
.ms-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 64px;
}
.ms-state-error {
  flex-wrap: wrap;
}
.ms-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-separator-opaque, #30363d);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: ms-spin 0.8s linear infinite;
}
@keyframes ms-spin {
  to {
    transform: rotate(360deg);
  }
}
.ms-state-text {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.ms-retry {
  border: none;
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-smooth);
}
.ms-retry:active {
  transform: scale(0.96);
}

/* ===== 头部 ===== */
.ms-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.ms-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18),
    0 0 10px var(--color-accent-glow);
  animation: ms-pulse 2s ease-in-out infinite;
}
@keyframes ms-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18),
      0 0 8px var(--color-accent-glow);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1),
      0 0 16px var(--color-accent-glow);
  }
}
.ms-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--color-accent);
  background: var(--color-accent-light);
  padding: 3px 9px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(37, 99, 235, 0.25);
}

/* ===== 主文本 ===== */
.ms-text {
  font-size: 14px;
  line-height: 1.65;
  color: var(--color-text-secondary);
  letter-spacing: 0.01em;
  margin: 0;
}

/* ===== 底部 ===== */
.ms-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--color-separator);
}
.ms-time {
  font-size: 10px;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.ms-source {
  font-size: 10px;
  color: var(--color-text-quaternary, #6e7681);
}
</style>
