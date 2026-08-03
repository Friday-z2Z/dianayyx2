<script setup>
import { ref, inject, onMounted, onActivated } from 'vue'

const goBack = inject('goBack')
const showContent = ref(false)
const history = ref([])

const HISTORY_KEY = 'diana_browse_history'

const loadHistory = () => {
  try {
    const saved = localStorage.getItem(HISTORY_KEY)
    history.value = saved ? JSON.parse(saved) : []
  } catch {
    history.value = []
  }
}

const getDomain = (url) => {
  try {
    const u = new URL(url)
    return u.hostname
  } catch {
    return url
  }
}

const getFavicon = (url) => {
  const domain = getDomain(url)
  return `https://${domain}/favicon.ico`
}

const formatTime = (ts) => {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const openSite = (item) => {
  // 更新访问时间
  try {
    const saved = localStorage.getItem(HISTORY_KEY)
    let list = saved ? JSON.parse(saved) : []
    list = list.filter(h => h.url !== item.url)
    item.visitedAt = Date.now()
    list.unshift(item)
    list = list.slice(0, 50)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
  } catch {}
  window.open(item.url, '_blank', 'noopener,noreferrer')
}

const clearHistory = () => {
  history.value = []
  localStorage.removeItem(HISTORY_KEY)
}

onMounted(() => {
  loadHistory()
  setTimeout(() => { showContent.value = true }, 50)
})

onActivated(() => {
  loadHistory()
})
</script>

<template>
  <div class="history-page">
    <div class="scroll-content" :class="{ visible: showContent }">
      <!-- Navigation bar -->
      <header class="nav-bar">
        <button class="back-btn" @click="goBack()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 class="nav-title">浏览历史</h1>
        <button v-if="history.length > 0" class="clear-btn" @click="clearHistory">清空</button>
        <div v-else class="nav-spacer"></div>
      </header>

      <!-- 历史列表 -->
      <section class="history-section">
        <h3 class="section-label" v-if="history.length > 0">最近浏览 · {{ history.length }}</h3>

        <div v-if="history.length === 0" class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <p class="empty-text">还没有浏览记录</p>
          <p class="empty-sub">在「我的收藏」中打开网站即可记录</p>
        </div>

        <div v-else class="history-list">
          <div
            v-for="item in history"
            :key="item.url"
            class="history-card"
            @click="openSite(item)"
          >
            <div class="history-icon">
              <img :src="getFavicon(item.url)" :alt="item.name" @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='flex'" />
              <div class="history-icon-fallback" style="display:none">{{ item.name.charAt(0) }}</div>
            </div>
            <div class="history-info">
              <span class="history-name">{{ item.name }}</span>
              <span class="history-time">{{ formatTime(item.visitedAt) }}</span>
            </div>
            <svg class="history-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      </section>

      <!-- 底部间距 -->
      <div class="bottom-spacer"></div>
    </div>
  </div>
</template>

<style scoped>
.history-page {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--color-bg);
}

.scroll-content {
  opacity: 0;
  transform: translateY(12px);
  transition: all 0.5s var(--ease-out-expo);
}
.scroll-content.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ===== Nav Bar ===== */
.nav-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(13, 17, 23, 0.92);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-bottom: 1px solid var(--color-separator);
}

.back-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  border: none;
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: transform var(--duration-fast) var(--ease-spring);
}
.back-btn:active { transform: scale(0.88); }
.back-btn svg { width: 18px; height: 18px; }

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

.clear-btn {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-red);
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 12px;
  transition: opacity var(--duration-fast);
}
.clear-btn:active { opacity: 0.6; }
.nav-spacer { width: 36px; }

/* ===== History Section ===== */
.history-section {
  padding: 20px 16px 0;
}

.section-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin: 0 0 12px 4px;
  letter-spacing: 0.01em;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface-solid);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  cursor: pointer;
  transition: background var(--duration-fast), transform var(--duration-fast) var(--ease-spring);
  animation: card-slide-in 0.3s var(--ease-out-expo) both;
}
.history-card:active {
  background: var(--color-surface-hover);
  transform: scale(0.98);
}

@keyframes card-slide-in {
  from { opacity: 0; transform: translateX(16px); }
  to { opacity: 1; transform: translateX(0); }
}

.history-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--color-separator);
}
.history-icon img {
  width: 20px;
  height: 20px;
  border-radius: 3px;
}
.history-icon-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-accent);
}

.history-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.history-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.history-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.history-chevron {
  width: 14px;
  height: 14px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

/* ===== Empty State ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 8px;
}
.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--color-text-quaternary);
  opacity: 0.5;
}
.empty-text {
  font-size: 14px;
  color: var(--color-text-tertiary);
}
.empty-sub {
  font-size: 12px;
  color: var(--color-text-quaternary);
}

/* ===== Bottom Spacer ===== */
.bottom-spacer {
  height: calc(var(--tab-bar-height) + var(--safe-bottom) + 40px);
}
</style>
