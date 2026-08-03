<script setup>
import { ref, provide, shallowRef, watch } from 'vue'
import TabBar from './TabBar.vue'
import Home from '../views/Home.vue'
import Profile from '../views/Profile.vue'
import MagicWand from '../views/MagicWand.vue'
import Favorites from '../views/Favorites.vue'
import BrowseHistory from '../views/BrowseHistory.vue'

const activeTab = ref('home')
const currentPage = ref('main') // 'main', 'magic-wand', 'favorites', 'browse-history'
const slideDirection = ref('')

// 使用 shallowRef 避免对组件对象进行深度响应式转换
const currentTabComponent = shallowRef(Home)

watch(activeTab, (newTab) => {
  currentTabComponent.value = newTab === 'home' ? Home : Profile
}, { immediate: true })

const handleTabChange = (tabId) => {
  if (tabId === activeTab.value) return
  slideDirection.value = tabId === 'home' ? 'slide-right' : 'slide-left'
  activeTab.value = tabId
}

const navigateTo = (page) => {
  slideDirection.value = 'slide-left'
  currentPage.value = page
}

provide('navigateTo', navigateTo)
provide('goBack', () => {
  slideDirection.value = 'slide-right'
  currentPage.value = 'main'
})
</script>

<template>
  <div class="layout">
    <main class="main-content">
      <transition :name="slideDirection" mode="out-in">
        <div v-if="currentPage === 'main'" key="main" class="page-wrapper">
          <div class="tab-content">
            <transition name="tab-switch" mode="out-in">
              <KeepAlive>
                <component :is="currentTabComponent" :key="activeTab" />
              </KeepAlive>
            </transition>
          </div>
          <TabBar :active-tab="activeTab" @change="handleTabChange" />
        </div>
        <MagicWand v-else-if="currentPage === 'magic-wand'" key="magic-wand" />
        <Favorites v-else-if="currentPage === 'favorites'" key="favorites" />
        <BrowseHistory v-else-if="currentPage === 'browse-history'" key="browse-history" />
      </transition>
    </main>
  </div>
</template>

<style scoped>
.layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.main-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.page-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* Page slide transitions */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all var(--duration-normal) var(--ease-out-expo);
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-40px);
}
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

/* Tab switch transition */
.tab-switch-enter-active,
.tab-switch-leave-active {
  transition: all var(--duration-fast) var(--ease-smooth);
}

.tab-switch-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.tab-switch-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
