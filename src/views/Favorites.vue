<script setup>
import { ref, inject, onMounted } from 'vue'

const goBack = inject('goBack')
const showContent = ref(false)

// 预置收藏网站
const DEFAULT_FAVORITES = [
  {
    id: 'chrqj',
    name: '在线影院',
    url: 'https://m.chrqj.com/',
    desc: '电影 · 电视剧 · 综艺 · 动漫',
  },
]

const STORAGE_KEY = 'diana_favorites'
const HISTORY_KEY = 'diana_browse_history'

const favorites = ref([])

// ===== 收藏数据 =====
const loadFavorites = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      favorites.value = JSON.parse(saved)
    } else {
      favorites.value = [...DEFAULT_FAVORITES]
      saveFavorites()
    }
  } catch {
    favorites.value = [...DEFAULT_FAVORITES]
  }
}

const saveFavorites = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites.value))
  } catch {}
}

// ===== 工具函数 =====
const getDomain = (url) => {
  try {
    const u = new URL(url)
    return u.hostname
  } catch {
    return url
  }
}

// 获取网站 favicon — 直接使用网站自身 favicon
const getFavicon = (url) => {
  const domain = getDomain(url)
  return `https://${domain}/favicon.ico`
}

// ===== 浏览历史记录 =====
const recordHistory = (item) => {
  try {
    const saved = localStorage.getItem(HISTORY_KEY)
    let history = saved ? JSON.parse(saved) : []
    // 去重：移除已有同 URL 记录
    history = history.filter(h => h.url !== item.url)
    // 添加到最前
    history.unshift({
      id: item.id,
      name: item.name,
      url: item.url,
      desc: item.desc || '',
      visitedAt: Date.now(),
    })
    // 最多保留 50 条
    history = history.slice(0, 50)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {}
}

// ===== 打开网站 =====
const openSite = (item) => {
  recordHistory(item)
  window.open(item.url, '_blank', 'noopener,noreferrer')
}

// ===== Toast 提示 =====
const toastMessage = ref('')
const showToast = (msg) => {
  toastMessage.value = msg
  setTimeout(() => { toastMessage.value = '' }, 2500)
}

// 复制链接
const copyLink = async (item) => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(item.url)
      showToast('链接已复制，去微信粘贴发送')
    } else {
      const input = document.createElement('input')
      input.value = item.url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      showToast('链接已复制，去微信粘贴发送')
    }
  } catch {
    showToast('复制失败，请长按网址复制')
  }
}

// ===== 添加收藏 =====
const showAddDialog = ref(false)
const newUrl = ref('')
const newName = ref('')

const handleAdd = () => {
  let url = newUrl.value.trim()
  if (!url) return

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }

  try {
    new URL(url)
  } catch {
    return
  }

  const name = newName.value.trim() || getDomain(url)
  favorites.value.unshift({
    id: 'fav_' + Date.now(),
    name,
    url,
    desc: getDomain(url),
  })
  saveFavorites()
  newUrl.value = ''
  newName.value = ''
  showAddDialog.value = false
}

onMounted(() => {
  loadFavorites()
  setTimeout(() => { showContent.value = true }, 50)
})
</script>

<template>
  <div class="favorites-page">
    <!-- Toast -->
    <Teleport to="body">
      <transition name="toast-fade">
        <div v-if="toastMessage" class="toast-tip">{{ toastMessage }}</div>
      </transition>
    </Teleport>

    <!-- 添加收藏弹窗 -->
    <Teleport to="body">
      <transition name="dialog-fade">
        <div v-if="showAddDialog" class="dialog-overlay" @click.self="showAddDialog = false">
          <div class="dialog-card">
            <h3 class="dialog-title">添加网站收藏</h3>
            <div class="dialog-body">
              <div class="input-group">
                <label class="input-label">网址</label>
                <input
                  v-model="newUrl"
                  type="text"
                  class="dialog-input"
                  placeholder="example.com"
                  @keydown.enter="handleAdd"
                />
              </div>
              <div class="input-group">
                <label class="input-label">名称（可选）</label>
                <input
                  v-model="newName"
                  type="text"
                  class="dialog-input"
                  placeholder="网站名称"
                  @keydown.enter="handleAdd"
                />
              </div>
            </div>
            <div class="dialog-actions">
              <button class="dialog-btn cancel" @click="showAddDialog = false">取消</button>
              <button class="dialog-btn confirm" @click="handleAdd">添加</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <div class="scroll-content" :class="{ visible: showContent }">
      <!-- Navigation bar -->
      <header class="nav-bar">
        <button class="back-btn" @click="goBack()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 class="nav-title">我的收藏</h1>
        <button class="add-btn" @click="showAddDialog = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </header>

      <!-- 收藏列表 -->
      <section class="favorites-section">
        <h3 class="section-label">收藏的网站 · {{ favorites.length }}</h3>

        <div v-if="favorites.length === 0" class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <p class="empty-text">还没有收藏的网站</p>
          <button class="empty-add-btn" @click="showAddDialog = true">添加第一个网站</button>
        </div>

        <div v-else class="favorites-list">
          <div
            v-for="item in favorites"
            :key="item.id"
            class="fav-card"
            @click="openSite(item)"
          >
            <div class="fav-icon">
              <img :src="getFavicon(item.url)" :alt="item.name" @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='flex'" />
              <div class="fav-icon-fallback" style="display:none">{{ item.name.charAt(0) }}</div>
            </div>
            <div class="fav-info">
              <span class="fav-name">{{ item.name }}</span>
              <span class="fav-url">{{ getDomain(item.url) }}</span>
              <span v-if="item.desc" class="fav-desc">{{ item.desc }}</span>
            </div>
            <div class="fav-actions">
              <button class="fav-copy-btn" @click.stop="copyLink(item)" title="复制链接">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
              <button class="fav-open-btn" @click.stop="openSite(item)" title="打开网站">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 底部间距 -->
      <div class="bottom-spacer"></div>
    </div>
  </div>
</template>

<style scoped>
.favorites-page {
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

.back-btn, .add-btn {
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
.back-btn:active, .add-btn:active {
  transform: scale(0.88);
}
.back-btn svg, .add-btn svg {
  width: 18px;
  height: 18px;
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

/* ===== Favorites Section ===== */
.favorites-section {
  padding: 20px 16px 0;
}

.section-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin: 0 0 12px 4px;
  letter-spacing: 0.01em;
}

/* ===== Favorite Card ===== */
.favorites-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fav-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface-solid);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  cursor: pointer;
  transition: background var(--duration-fast), transform var(--duration-fast) var(--ease-spring);
  position: relative;
  overflow: hidden;
  animation: card-slide-in 0.4s var(--ease-out-expo) both;
}

.fav-card:active {
  background: var(--color-surface-hover);
  transform: scale(0.98);
}

.fav-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--color-accent);
  opacity: 0;
  transition: opacity var(--duration-fast);
}
.fav-card:active::before {
  opacity: 1;
}

@keyframes card-slide-in {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

.fav-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--color-separator);
}
.fav-icon img {
  width: 24px;
  height: 24px;
  border-radius: 4px;
}
.fav-icon-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-accent);
}

.fav-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fav-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fav-url {
  font-size: 12px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fav-desc {
  font-size: 11px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fav-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.fav-copy-btn, .fav-open-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--duration-fast);
}
.fav-copy-btn svg, .fav-open-btn svg {
  width: 15px;
  height: 15px;
}
.fav-copy-btn {
  color: var(--color-text-secondary);
}
.fav-copy-btn:active {
  transform: scale(0.88);
  background: var(--color-surface-hover);
}
.fav-open-btn {
  color: var(--color-accent);
}
.fav-open-btn:active {
  transform: scale(0.88);
  background: var(--color-accent-light);
}

/* ===== Empty State ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 12px;
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
.empty-add-btn {
  padding: 10px 24px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-accent);
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-spring);
  margin-top: 8px;
}
.empty-add-btn:active {
  transform: scale(0.95);
}

/* ===== Add Dialog ===== */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.dialog-card {
  width: 100%;
  max-width: 320px;
  background: var(--color-surface-solid);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}
.dialog-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
  padding: 20px 20px 12px;
}
.dialog-body {
  padding: 8px 20px 20px;
}
.input-group {
  margin-bottom: 14px;
}
.input-group:last-child {
  margin-bottom: 0;
}
.input-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}
.dialog-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-separator-opaque);
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-size: 15px;
  outline: none;
  transition: border-color var(--duration-fast);
}
.dialog-input:focus {
  border-color: var(--color-accent);
}
.dialog-input::placeholder {
  color: var(--color-text-quaternary);
}
.dialog-actions {
  display: flex;
  border-top: 1px solid var(--color-separator);
}
.dialog-btn {
  flex: 1;
  padding: 14px;
  border: none;
  background: none;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--duration-fast);
}
.dialog-btn.cancel {
  color: var(--color-text-secondary);
  border-right: 1px solid var(--color-separator);
}
.dialog-btn.cancel:active {
  background: var(--color-surface-hover);
}
.dialog-btn.confirm {
  color: var(--color-accent);
  font-weight: 600;
}
.dialog-btn.confirm:active {
  background: var(--color-accent-light);
}

/* Dialog transition */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-smooth);
}
.dialog-fade-enter-active .dialog-card,
.dialog-fade-leave-active .dialog-card {
  transition: transform var(--duration-normal) var(--ease-spring), opacity var(--duration-normal);
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
.dialog-fade-enter-from .dialog-card,
.dialog-fade-leave-to .dialog-card {
  transform: scale(0.9);
  opacity: 0;
}

/* ===== Toast ===== */
.toast-tip {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10001;
  background: rgba(20, 20, 20, 0.92);
  color: #fff;
  font-size: 14px;
  padding: 12px 20px;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  max-width: 260px;
  text-align: center;
  line-height: 1.4;
}
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.9);
}

/* ===== Bottom Spacer ===== */
.bottom-spacer {
  height: calc(var(--tab-bar-height) + var(--safe-bottom) + 40px);
}
</style>