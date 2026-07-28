<script setup>
defineProps({
  activeTab: {
    type: String,
    default: 'home'
  }
})

const emit = defineEmits(['change'])

const tabs = [
  { id: 'home', label: '首页', icon: 'home' },
  { id: 'profile', label: '我的', icon: 'user' }
]

const handleTabClick = (tabId) => {
  emit('change', tabId)
}
</script>

<template>
  <nav class="tab-bar">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ active: activeTab === tab.id }"
      @click="handleTabClick(tab.id)"
    >
      <div class="tab-icon">
        <svg v-if="tab.icon === 'home'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <svg v-else-if="tab.icon === 'user'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
      <span class="tab-label">{{ tab.label }}</span>
    </div>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 60px;
  background: var(--bg);
  border-top: 1px solid var(--border);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  cursor: pointer;
  transition: all 0.3s ease;
  color: var(--text);
}

.tab-item.active {
  color: var(--accent);
}

.tab-icon {
  width: 24px;
  height: 24px;
  margin-bottom: 4px;
}

.tab-icon svg {
  width: 100%;
  height: 100%;
}

.tab-label {
  font-size: 12px;
  line-height: 1;
}

@media (prefers-color-scheme: dark) {
  .tab-bar {
    background: var(--bg);
    border-top-color: var(--border);
  }
}
</style>