<script setup>
import { ref, onMounted, watch } from 'vue'
import { getIPOCalendar, getLockupCalendar, getEarningsCalendar } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const activeTab = ref('ipo')
const ipoData = ref([])
const lockupData = ref([])
const earningsData = ref([])
const loading = ref(true)

const loadCalendarData = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const [ipo, lockup, earnings] = await Promise.all([
      getIPOCalendar(),
      getLockupCalendar(),
      getEarningsCalendar()
    ])
    ipoData.value = ipo
    lockupData.value = lockup
    earningsData.value = earnings
  } catch (e) {
    console.error('加载日历数据失败:', e)
  } finally {
    if (!silent) loading.value = false
  }
}

const getEarningsClass = (percent) => {
  if (percent > 0) return 'up'
  if (percent < 0) return 'down'
  return ''
}

const getTypeTag = (type) => {
  const map = { '年报': 'Y', '半年报': 'H', '季报': 'Q' }
  return map[type] || type
}

const getTypeColor = (type) => {
  const map = { '年报': '#F23030', '半年报': '#FF9500', '季报': '#007AFF' }
  return map[type] || '#8E8E93'
}

watch(() => props.refreshTrigger, () => loadCalendarData(props.refreshSilent))

onMounted(() => {
  loadCalendarData()
})
</script>

<template>
  <div class="market-calendar">
    <div class="calendar-header">
      <h3 class="calendar-title">市场日历</h3>
      <span class="calendar-hint">近期重要事件</span>
    </div>

    <div class="calendar-tabs">
      <button :class="{ active: activeTab === 'ipo' }" @click="activeTab = 'ipo'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 2v20M2 12h20"/></svg>
        <span>新股</span>
        <span class="tab-badge" v-if="ipoData.length">{{ ipoData.length }}</span>
      </button>
      <button :class="{ active: activeTab === 'lockup' }" @click="activeTab = 'lockup'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        <span>解禁</span>
        <span class="tab-badge" v-if="lockupData.length">{{ lockupData.length }}</span>
      </button>
      <button :class="{ active: activeTab === 'earnings' }" @click="activeTab = 'earnings'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>财报</span>
        <span class="tab-badge" v-if="earningsData.length">{{ earningsData.length }}</span>
      </button>
    </div>

    <div class="calendar-content">
      <div v-if="loading" class="loading-state">
        <div class="mini-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- IPO 列表 -->
      <div v-else-if="activeTab === 'ipo'" class="event-list">
        <div class="event-item" v-for="item in ipoData" :key="item.code">
          <div class="event-left">
            <div class="event-name-row">
              <span class="event-name">{{ item.name }}</span>
              <span class="event-code">{{ item.code }}</span>
            </div>
            <div class="event-meta">
              <span class="meta-tag" v-if="item.industry">{{ item.industry }}</span>
              <span class="meta-item" v-if="item.price">发行价 {{ item.price }}元</span>
              <span class="meta-item" v-if="item.pe">PE {{ item.pe }}x</span>
            </div>
          </div>
          <div class="event-right">
            <div class="date-block">
              <span class="date-label">申购</span>
              <span class="date-value">{{ item.applyDate }}</span>
            </div>
            <div class="date-block" v-if="item.listDate">
              <span class="date-label">上市</span>
              <span class="date-value">{{ item.listDate }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 解禁列表 -->
      <div v-else-if="activeTab === 'lockup'" class="event-list">
        <div class="event-item" v-for="item in lockupData" :key="item.code">
          <div class="event-left">
            <div class="event-name-row">
              <span class="event-name">{{ item.name }}</span>
              <span class="event-code">{{ item.code }}</span>
            </div>
            <div class="event-meta">
              <span class="meta-tag lockup-type">{{ item.type }}</span>
              <span class="meta-item">{{ item.volume }}万股</span>
              <span class="meta-item">{{ item.marketValue }}亿</span>
            </div>
          </div>
          <div class="event-right">
            <div class="date-block">
              <span class="date-label">解禁日</span>
              <span class="date-value">{{ item.date }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 财报列表 -->
      <div v-else-if="activeTab === 'earnings'" class="event-list">
        <div class="event-item" v-for="item in earningsData" :key="item.code">
          <div class="event-left">
            <div class="event-name-row">
              <span class="event-name">{{ item.name }}</span>
              <span class="event-code">{{ item.code }}</span>
              <span class="type-badge" :style="{ background: getTypeColor(item.type) + '18', color: getTypeColor(item.type) }">
                {{ getTypeTag(item.type) }}
              </span>
            </div>
            <div class="event-meta">
              <span class="meta-item">{{ item.type }}</span>
            </div>
          </div>
          <div class="event-right">
            <div class="date-block">
              <span class="date-label">披露</span>
              <span class="date-value">{{ item.date }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.market-calendar {
  background: var(--color-surface); border-radius: 14px; padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(0,0,0,0.3);
}
.calendar-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.calendar-title {
  font-size: 16px; font-weight: 800; color: var(--color-text-primary); margin: 0;
}
.calendar-hint { font-size: 10px; color: var(--color-text-tertiary); }

.calendar-tabs {
  display: flex; gap: 6px; margin-bottom: 10px;
}
.calendar-tabs button {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 8px 6px; background: var(--color-surface-elevated); border: 1.5px solid transparent;
  border-radius: 10px; font-size: 12px; font-weight: 600;
  color: var(--color-text-tertiary); cursor: pointer; transition: all 0.2s;
}
.calendar-tabs button svg { opacity: 0.6; }
.calendar-tabs button.active {
  color: #2563eb; border-color: rgba(37,99,235,0.2);
  background: rgba(37,99,235,0.06);
}
.calendar-tabs button.active svg { opacity: 1; }
.tab-badge {
  font-size: 9px; font-weight: 700; padding: 1px 5px;
  border-radius: 6px; background: rgba(37,99,235,0.12); color: #2563eb;
}

.loading-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 24px; gap: 8px; color: var(--color-text-tertiary); font-size: 12px;
}
.mini-spinner {
  width: 18px; height: 18px; border: 2px solid #30363d;
  border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Event List */
.event-list {
  display: flex; flex-direction: column; gap: 0;
}
.event-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0;
  border-bottom: 0.5px solid var(--color-separator);
  gap: 10px;
}
.event-item:last-child { border-bottom: none; }
.event-left { flex: 1; min-width: 0; }
.event-name-row {
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
}
.event-name { font-size: 13px; font-weight: 700; color: var(--color-text-primary); }
.event-code { font-size: 10px; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
.event-meta {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.meta-tag {
  font-size: 9px; font-weight: 600; padding: 1px 5px;
  border-radius: 4px; background: rgba(37,99,235,0.08); color: #2563eb;
}
.meta-tag.lockup-type { background: rgba(255,149,0,0.08); color: #FF9500; }
.meta-item { font-size: 10px; color: var(--color-text-tertiary); }

.event-right {
  display: flex; gap: 8px; flex-shrink: 0;
}
.date-block {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 4px 8px; background: var(--color-surface-elevated); border-radius: 6px;
}
.date-label { font-size: 8px; color: var(--color-text-tertiary); font-weight: 600; }
.date-value { font-size: 11px; font-weight: 700; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }

.type-badge {
  font-size: 9px; font-weight: 700; padding: 1px 5px;
  border-radius: 4px;
}
</style>
