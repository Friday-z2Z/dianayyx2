<script setup>
import { ref, inject, onMounted } from 'vue'

const navigateTo = inject('navigateTo')
const showContent = ref(false)

const userInfo = ref({
  name: 'Diana',
  level: 'Pro',
  id: 'ID: 8829-1024'
})

const menuGroups = ref([
  {
    title: '服务',
    items: [
      { icon: 'magic', title: '魔法棒', subtitle: '智能创作助手', badge: 'NEW', badgeType: 'accent', highlight: true, action: 'magic-wand' },
      { icon: 'star', title: '我的收藏', badge: '12', badgeType: 'count' },
      { icon: 'history', title: '浏览历史' },
      { icon: 'download', title: '我的下载' }
    ]
  },
  {
    title: '通用',
    items: [
      { icon: 'settings', title: '设置' },
      { icon: 'shield', title: '隐私与安全' },
      { icon: 'help', title: '帮助与反馈' }
    ]
  },
  {
    title: '',
    items: [
      { icon: 'about', title: '关于我们' }
    ]
  }
])

const handleItemClick = (item) => {
  if (item.action === 'magic-wand') {
    navigateTo('magic-wand')
  }
}

// Icon color mapping (iOS style)
const iconColorMap = {
  magic: '#007AFF',
  star: '#FF9500',
  history: '#34C759',
  download: '#5AC8FA',
  settings: '#8E8E93',
  shield: '#AF52DE',
  help: '#FF2D55',
  about: '#8E8E93'
}

const iconBgMap = {
  magic: '#007AFF',
  star: '#FF9500',
  history: '#34C759',
  download: '#5AC8FA',
  settings: '#8E8E93',
  shield: '#AF52DE',
  help: '#FF2D55',
  about: '#8E8E93'
}

onMounted(() => {
  setTimeout(() => { showContent.value = true }, 50)
})
</script>

<template>
  <div class="profile-page">
    <div class="scroll-content" :class="{ visible: showContent }">
      <!-- Large Title -->
      <header class="page-header">
        <h1 class="large-title">我的</h1>
      </header>

      <!-- User Card -->
      <section class="user-card-section">
        <div class="user-card">
          <div class="avatar-area">
            <div class="avatar">
              <span class="avatar-letter">{{ userInfo.name.charAt(0) }}</span>
            </div>
          </div>
          <div class="user-info">
            <div class="user-name-row">
              <h2 class="user-name">{{ userInfo.name }}</h2>
              <span class="pro-badge">{{ userInfo.level }}</span>
            </div>
            <p class="user-id">{{ userInfo.id }}</p>
          </div>
          <button class="edit-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      </section>

      <!-- Menu Groups -->
      <section 
        v-for="(group, gIdx) in menuGroups" 
        :key="gIdx" 
        class="menu-section"
        :style="{ '--delay': (gIdx * 0.08 + 0.1) + 's' }"
      >
        <h3 v-if="group.title" class="section-label">{{ group.title }}</h3>
        <div class="menu-group-card">
          <div 
            v-for="(item, iIdx) in group.items" 
            :key="iIdx"
            class="menu-row"
            :class="{ highlight: item.highlight }"
            @click="handleItemClick(item)"
          >
            <div class="menu-icon" :style="{ background: iconBgMap[item.icon] }">
              <!-- Magic wand -->
              <svg v-if="item.icon === 'magic'" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8">
                <path d="M15 4V2m0 2v2m0-2h-2m2 0h2M8.5 10.5L4 15l2 2 4.5-4.5M20 8l-4 4m0 0l-2-2m2 2l2 2"/>
              </svg>
              <!-- Star -->
              <svg v-else-if="item.icon === 'star'" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <!-- History -->
              <svg v-else-if="item.icon === 'history'" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <!-- Download -->
              <svg v-else-if="item.icon === 'download'" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <!-- Settings -->
              <svg v-else-if="item.icon === 'settings'" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <!-- Shield -->
              <svg v-else-if="item.icon === 'shield'" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <!-- Help -->
              <svg v-else-if="item.icon === 'help'" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <!-- About -->
              <svg v-else-if="item.icon === 'about'" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>
            <div class="menu-text">
              <span class="menu-title">{{ item.title }}</span>
              <span v-if="item.subtitle" class="menu-subtitle">{{ item.subtitle }}</span>
            </div>
            <div class="menu-trailing">
              <span v-if="item.badge && item.badgeType === 'accent'" class="badge-new">{{ item.badge }}</span>
              <span v-else-if="item.badge && item.badgeType === 'count'" class="badge-count">{{ item.badge }}</span>
              <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>
        </div>
      </section>

      <!-- Logout -->
      <section class="logout-section" :style="{ '--delay': '0.4s' }">
        <button class="logout-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          退出登录
        </button>
        <p class="version-text">Version 2.0.1</p>
      </section>

      <!-- Bottom spacer -->
      <div class="tab-spacer"></div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--color-bg);
}

.scroll-content {
  opacity: 0;
  transform: translateY(12px);
  transition: all 0.6s var(--ease-out-expo);
}
.scroll-content.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Header */
.page-header {
  padding: 60px 20px 0;
}

.large-title {
  font-size: 34px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin: 0;
}

/* User Card */
.user-card-section {
  padding: 16px 20px 0;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--color-surface-solid);
  border-radius: var(--radius-lg);
  padding: 18px 16px;
  box-shadow: var(--shadow-md);
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, #007AFF, #5856D6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-letter {
  font-size: 24px;
  font-weight: 600;
  color: white;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.user-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  margin: 0;
}

.pro-badge {
  font-size: 11px;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #FF9500, #FF6B00);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  letter-spacing: 0.02em;
}

.user-id {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

.edit-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: var(--color-accent-light);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform var(--duration-fast) var(--ease-spring);
}

.edit-btn:active {
  transform: scale(0.88);
}

.edit-btn svg {
  width: 16px;
  height: 16px;
  color: var(--color-accent);
}

/* Menu Sections */
.menu-section {
  padding: 0 20px;
  margin-top: 24px;
  animation: ios-slide-up 0.5s var(--ease-out-expo) var(--delay) both;
}

.section-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin: 0 0 8px 4px;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}

.menu-group-card {
  background: var(--color-surface-solid);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.menu-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background var(--duration-fast);
  position: relative;
}

.menu-row:not(:last-child)::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 56px;
  right: 0;
  height: 0.5px;
  background: var(--color-separator);
}

.menu-row:active {
  background: var(--color-separator);
}

.menu-row.highlight {
  background: var(--color-accent-light);
}

.menu-row.highlight:not(:last-child)::after {
  left: 56px;
}

.menu-icon {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 12px;
}

.menu-icon svg {
  width: 16px;
  height: 16px;
}

.menu-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.menu-title {
  font-size: 16px;
  font-weight: 400;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.menu-subtitle {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.3;
}

.menu-trailing {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 8px;
}

.badge-new {
  font-size: 11px;
  font-weight: 700;
  color: white;
  background: var(--color-accent);
  padding: 2px 7px;
  border-radius: var(--radius-full);
}

.badge-count {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.chevron {
  width: 13px;
  height: 13px;
  color: var(--color-text-tertiary);
}

/* Logout */
.logout-section {
  padding: 0 20px;
  margin-top: 32px;
  text-align: center;
  animation: ios-slide-up 0.5s var(--ease-out-expo) var(--delay) both;
}

.logout-btn {
  width: 100%;
  padding: 15px;
  background: var(--color-surface-solid);
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-red);
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-fast) var(--ease-spring), opacity var(--duration-fast);
}

.logout-btn:active {
  transform: scale(0.98);
  opacity: 0.7;
}

.logout-btn svg {
  width: 18px;
  height: 18px;
}

.version-text {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 16px;
  text-align: center;
}

/* Bottom spacer */
.tab-spacer {
  height: calc(var(--tab-bar-height) + var(--safe-bottom) + 24px);
}
</style>
