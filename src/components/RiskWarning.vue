<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { getMarketSentiment } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const sentiment = ref(null)
const loading = ref(true)
const error = ref(null)

const loadData = async (silent = false) => {
  if (!silent) loading.value = true
  if (!silent) error.value = null
  try {
    sentiment.value = await getMarketSentiment()
  } catch (e) {
    console.error('加载市场情绪数据失败:', e)
    error.value = '数据加载失败，请稍后重试'
  } finally {
    if (!silent) loading.value = false
  }
}

// 炸板率：炸板数 / (涨停数 + 炸板数)
const bombRate = computed(() => {
  if (!sentiment.value) return 0
  const { limitUpCount = 0, bombCount = 0 } = sentiment.value
  const total = limitUpCount + bombCount
  return total > 0 ? (bombCount / total) * 100 : 0
})

// 根据市场数据动态生成风险提示
const riskWarnings = computed(() => {
  if (!sentiment.value) return []
  const {
    limitUpCount = 0,
    upCount = 0,
    downCount = 0,
    bombCount = 0,
  } = sentiment.value
  const warnings = []

  // 涨停数 > 30
  if (limitUpCount > 30) {
    warnings.push('涨停家数较多，注意高位股分歧风险')
  }
  // 下跌家数 > 上涨家数 * 1.5
  if (upCount > 0 && downCount > upCount * 1.5) {
    warnings.push('跌多涨少，市场情绪偏弱，控制仓位')
  }
  // 炸板率 > 30%
  if (bombRate.value > 30) {
    warnings.push(`炸板率较高(${bombRate.value.toFixed(0)}%)，追涨停风险加大`)
  }
  // 默认提示
  if (warnings.length === 0) {
    warnings.push('市场情绪正常，关注主线板块持续性')
  }
  return warnings
})

// 风险等级（用于图标颜色提示）
const riskLevel = computed(() => {
  if (!sentiment.value) return 'normal'
  const { limitUpCount = 0, upCount = 0, downCount = 0 } = sentiment.value
  let score = 0
  if (limitUpCount > 30) score++
  if (upCount > 0 && downCount > upCount * 1.5) score++
  if (bombRate.value > 30) score++
  if (score >= 2) return 'high'
  if (score === 1) return 'medium'
  return 'normal'
})

watch(() => props.refreshTrigger, () => loadData(props.refreshSilent))

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="risk-warning">
    <!-- 加载状态 -->
    <div v-if="loading" class="state-box">
      <div class="mini-spinner"></div>
      <span class="state-text">加载风险数据...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="state-box">
      <span class="state-text error-text">{{ error }}</span>
      <button class="retry-btn" @click="loadData">重试</button>
    </div>

    <!-- 风险内容 -->
    <div v-else class="risk-content">
      <!-- 左侧警示图标 -->
      <div class="risk-icon" :class="riskLevel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="28" height="28">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>

      <!-- 右侧风险提示文本区域 -->
      <div class="risk-text-area">
        <div class="title-row">
          <h3 class="risk-title">风险边界</h3>
          <span class="level-tag" :class="riskLevel">
            {{ riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '中风险' : '正常' }}
          </span>
        </div>
        <div class="warning-list">
          <p v-for="(w, i) in riskWarnings" :key="i" class="warning-item">
            <span class="warning-bullet"></span>
            <span class="warning-text">{{ w }}</span>
          </p>
        </div>
        <p class="disclaimer">数据来源：akshare 全市场行情 · 涨跌停/炸板统计 · 以上分析仅供参考，不构成投资建议</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.risk-warning {
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: var(--radius-md);
  padding: 14px;
  overflow: hidden;
}

/* 状态盒子（加载/错误） */
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0;
}
.state-text {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.error-text {
  color: var(--color-red);
}
.retry-btn {
  padding: 4px 14px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  background: rgba(239, 68, 68, 0.08);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-smooth);
}
.retry-btn:active {
  background: rgba(239, 68, 68, 0.15);
}
.mini-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(239, 68, 68, 0.2);
  border-top-color: var(--color-orange);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 风险内容布局 */
.risk-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

/* 左侧警示图标 */
.risk-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: rgba(249, 115, 22, 0.12);
  color: var(--color-orange);
  flex-shrink: 0;
  transition: all var(--duration-normal) var(--ease-smooth);
}
.risk-icon.high {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-red);
  animation: pulse-icon 1.8s ease-in-out infinite;
}
.risk-icon.medium {
  background: rgba(249, 115, 22, 0.15);
  color: var(--color-orange);
}
.risk-icon.normal {
  background: rgba(139, 148, 158, 0.12);
  color: var(--color-text-tertiary);
}
@keyframes pulse-icon {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}

/* 右侧文本区域 */
.risk-text-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.risk-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-red);
  margin: 0;
  letter-spacing: -0.01em;
}
.level-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.level-tag.high {
  background: rgba(239, 68, 68, 0.2);
  color: var(--color-red);
}
.level-tag.medium {
  background: rgba(249, 115, 22, 0.18);
  color: var(--color-orange);
}
.level-tag.normal {
  background: rgba(34, 197, 94, 0.15);
  color: var(--color-green);
}

/* 风险提示列表 */
.warning-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
}
.warning-bullet {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-orange);
  flex-shrink: 0;
  margin-top: 7px;
}
.warning-text {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

/* 底部免责声明 */
.disclaimer {
  margin: 4px 0 0;
  padding-top: 6px;
  border-top: 1px solid rgba(239, 68, 68, 0.1);
  font-size: 10px;
  color: var(--color-text-tertiary);
  line-height: 1.4;
}

/* 移动端适配 */
@media (max-width: 430px) {
  .risk-warning {
    padding: 12px;
  }
  .risk-icon {
    width: 36px;
    height: 36px;
  }
  .risk-icon svg {
    width: 24px;
    height: 24px;
  }
  .risk-title {
    font-size: 14px;
  }
  .warning-text {
    font-size: 11.5px;
  }
}
</style>
