<script setup>
import { ref, inject, onMounted } from 'vue'
import { showDialog, showConfirmDialog, showToast } from 'vant'
import 'vant/lib/index.css'
import FireworkEffect from '../components/FireworkEffect.vue'
import TextFireworkEffect from '../components/TextFireworkEffect.vue'
import LoveEffect from '../components/LoveEffect.vue'

const goBack = inject('goBack')

const fireworkRef = ref(null)
const textFireworkRef = ref(null)
const loveRef = ref(null)
const showFirework = ref(false)
const showTextFirework = ref(false)
const showWeekends = ref(false)
const showLove = ref(false)
const showContent = ref(false)

const effects = ref([
  {
    id: 'firework',
    title: '绚丽烟花',
    desc: '点击屏幕绽放美丽烟花',
    icon: 'firework',
    color: '#007AFF',
    gradient: 'linear-gradient(135deg, #007AFF, #5856D6)'
  },
  {
    id: 'blessing',
    title: '祝福卡片',
    desc: '文字烟花表达心意',
    icon: 'blessing',
    color: '#FF2D55',
    gradient: 'linear-gradient(135deg, #FF2D55, #FF6B8A)'
  },
  {
    id: 'weekends',
    title: '周末约吗',
    desc: '一起出去玩吧',
    icon: 'weekends',
    color: '#FF9500',
    gradient: 'linear-gradient(135deg, #FF9500, #FFCC02)'
  },
  {
    id: 'love',
    title: '爱你',
    desc: '浪漫爱心动画',
    icon: 'love',
    color: '#FF3B30',
    gradient: 'linear-gradient(135deg, #FF3B30, #FF6B6B)'
  }
])

const textArr = [
  '你怎么能拒绝呀，心好痛',
  '真的不想一起出去嘛？',
  '你是不是点错了呀？',
  '再好好想想~',
  '真的要这么残忍吗？',
  '应该还会有更好的选择吧，emmmmm',
  '一起出去很愉快的呀',
  '不公平，绝对不公平！',
  '你超级漂亮可爱的呀',
  '我想一定是有什么隐情',
  '是我做的不够好吗？',
  '我错了，还是选同意吧，呜呜呜'
]

const handleEffectClick = (effect) => {
  if (effect.id === 'firework') {
    showFirework.value = true
  } else if (effect.id === 'blessing') {
    showTextFirework.value = true
  } else if (effect.id === 'weekends') {
    showWeekends.value = true
  } else if (effect.id === 'love') {
    showLove.value = true
  }
}

const closeFirework = () => { showFirework.value = false }
const closeTextFirework = () => { showTextFirework.value = false }
const closeWeekends = () => { showWeekends.value = false }
const closeLove = () => { showLove.value = false }

const handleRefuse = () => {
  const index = Math.floor(Math.random() * textArr.length)
  showConfirmDialog({
    title: '提示',
    message: textArr[index],
    showCancelButton: true,
    confirmButtonText: '不去',
    cancelButtonText: '我点错了'
  }).then(() => {
    setTimeout(handleRefuse, 300)
  }).catch(() => {})
}

const handleConfirm = () => {
  showDialog({
    title: '太棒了！',
    message: '那就愉快的决定啦！',
    showCancelButton: false,
    confirmButtonText: '好的'
  }).then(() => {
    closeWeekends()
  })
}

const handleFireworkLayerClick = (event) => {
  if (fireworkRef.value) {
    fireworkRef.value.launchFirework(event.clientX, event.clientY)
  }
}

const handleGoBack = () => {
  goBack()
}

onMounted(() => {
  setTimeout(() => { showContent.value = true }, 50)
})
</script>

<template>
  <div class="magic-wand-page">
    <!-- Firework overlay -->
    <div v-if="showFirework" class="overlay-layer" @click="handleFireworkLayerClick">
      <FireworkEffect ref="fireworkRef" :auto-start="true" />
      <div class="overlay-hint" @click.stop>
        <span>点击屏幕任意位置继续放烟花</span>
        <button class="overlay-close" @click="closeFirework">退出</button>
      </div>
    </div>

    <!-- Text firework overlay -->
    <div v-if="showTextFirework" class="overlay-layer overlay-dark" @click="closeTextFirework">
      <TextFireworkEffect ref="textFireworkRef" :auto-start="true" />
      <div class="overlay-hint" @click.stop>
        <span>文字烟花 - 点击屏幕退出</span>
        <button class="overlay-close" @click="closeTextFirework">退出</button>
      </div>
    </div>

    <!-- Weekends overlay -->
    <div v-if="showWeekends" class="overlay-layer weekends-layer">
      <div class="weekends-content">
        <h1 class="weekends-title">周末一起出去呀</h1>
        <div class="weekends-buttons">
          <button class="weekends-btn refuse" @click="handleRefuse">拒绝</button>
          <button class="weekends-btn confirm" @click="handleConfirm">同意</button>
        </div>
      </div>
      <button class="overlay-close weekends-close" @click="closeWeekends">退出</button>
    </div>

    <!-- Love overlay -->
    <div v-if="showLove" class="overlay-layer overlay-love" @click="closeLove">
      <LoveEffect ref="loveRef" :auto-start="true" />
      <div class="overlay-hint" @click.stop>
        <span>爱你 - 点击屏幕退出</span>
        <button class="overlay-close" @click="closeLove">退出</button>
      </div>
    </div>

    <!-- Main content -->
    <div class="scroll-content" :class="{ visible: showContent }">
      <!-- Navigation bar -->
      <header class="nav-bar">
        <button class="back-btn" @click="handleGoBack">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 class="nav-title">魔法棒</h1>
        <div class="nav-spacer"></div>
      </header>

      <!-- Hero card -->
      <section class="hero-section">
        <div class="hero-card">
          <div class="hero-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" class="wand-svg">
              <path d="M15 4V2m0 2v2m0-2h-2m2 0h2M8.5 10.5L4 15l2 2 4.5-4.5M20 8l-4 4m0 0l-2-2m2 2l2 2"/>
            </svg>
          </div>
          <div class="hero-text">
            <h2 class="hero-title">智能创作助手</h2>
            <p class="hero-desc">选择下方特效，开启魔法之旅</p>
          </div>
        </div>
      </section>

      <!-- Effects grid -->
      <section class="effects-section">
        <h3 class="section-label">选择特效</h3>
        <div class="effects-grid">
          <div 
            v-for="(effect, index) in effects" 
            :key="effect.id"
            class="effect-card"
            :style="{ '--delay': (index * 0.08 + 0.15) + 's', '--effect-color': effect.color, '--effect-gradient': effect.gradient }"
            @click="handleEffectClick(effect)"
          >
            <div class="effect-icon-area">
              <div class="effect-icon-bg" :style="{ background: effect.gradient }">
                <svg v-if="effect.icon === 'firework'" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
                  <path d="M12 2L12 6M12 18L12 22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12L6 12M18 12L22 12M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else-if="effect.icon === 'blessing'" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <svg v-else-if="effect.icon === 'weekends'" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                <svg v-else-if="effect.icon === 'love'" viewBox="0 0 24 24" fill="white" stroke="none">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </div>
            </div>
            <div class="effect-info">
              <h4 class="effect-name">{{ effect.title }}</h4>
              <p class="effect-desc">{{ effect.desc }}</p>
            </div>
            <div class="effect-action">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.magic-wand-page {
  height: 100vh;
  background: var(--color-bg);
  position: relative;
  overflow: hidden;
}

.scroll-content {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  opacity: 0;
  transform: translateY(12px);
  transition: all 0.6s var(--ease-out-expo);
}
.scroll-content.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Overlay layers */
.overlay-layer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.85);
  cursor: pointer;
}

.overlay-dark {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.overlay-love {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
}

.overlay-hint {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: white;
  font-size: 14px;
  animation: ios-slide-up 0.5s var(--ease-out-expo);
  white-space: nowrap;
}

.overlay-close {
  padding: 10px 24px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  border: 0.5px solid rgba(255, 255, 255, 0.25);
  border-radius: var(--radius-full);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.overlay-close:active {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(0.95);
}

/* Navigation bar */
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 50px 16px 12px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-bg);
}

.back-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: var(--color-surface-solid);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-fast) var(--ease-spring);
}

.back-btn:active {
  transform: scale(0.88);
}

.back-btn svg {
  width: 18px;
  height: 18px;
  color: var(--color-accent);
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.nav-spacer {
  width: 36px;
}

/* Hero card */
.hero-section {
  padding: 8px 20px 0;
}

.hero-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--color-surface-solid);
  border-radius: var(--radius-xl);
  padding: 22px 20px;
  box-shadow: var(--shadow-lg);
}

.hero-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #007AFF, #5856D6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wand-svg {
  width: 28px;
  height: 28px;
  animation: wand-wave 2.5s ease-in-out infinite;
}

@keyframes wand-wave {
  0%, 100% { transform: rotate(-6deg); }
  50% { transform: rotate(6deg); }
}

.hero-text {
  flex: 1;
}

.hero-title {
  font-size: 19px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  margin: 0 0 4px;
}

.hero-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.4;
}

/* Effects section */
.effects-section {
  padding: 28px 20px 40px;
}

.section-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin: 0 0 14px 4px;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}

.effects-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.effect-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--color-surface-solid);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-spring), box-shadow var(--duration-fast);
  animation: ios-slide-up 0.5s var(--ease-out-expo) var(--delay) both;
}

.effect-card:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-md);
}

.effect-icon-area {
  flex-shrink: 0;
}

.effect-icon-bg {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--duration-fast) var(--ease-spring);
}

.effect-icon-bg svg {
  width: 24px;
  height: 24px;
}

.effect-card:active .effect-icon-bg {
  transform: scale(0.92);
}

.effect-info {
  flex: 1;
  min-width: 0;
}

.effect-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
  margin: 0 0 3px;
}

.effect-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.3;
}

.effect-action {
  flex-shrink: 0;
}

.effect-action svg {
  width: 16px;
  height: 16px;
  color: var(--color-text-tertiary);
}

/* Weekends overlay */
.weekends-layer {
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.weekends-content {
  text-align: center;
}

.weekends-title {
  font-size: 28px;
  font-weight: 700;
  color: #5d4037;
  margin-bottom: 60px;
  text-shadow: 2px 2px 4px rgba(255, 255, 255, 0.5);
}

.weekends-buttons {
  display: flex;
  gap: 20px;
  justify-content: center;
}

.weekends-btn {
  padding: 16px 40px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.weekends-btn.refuse {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
  color: white;
}

.weekends-btn.confirm {
  background: linear-gradient(135deg, #51cf66 0%, #40c057 100%);
  color: white;
}

.weekends-btn:active {
  transform: scale(0.95);
}

.weekends-close {
  position: absolute;
  bottom: 60px;
  background: rgba(93, 64, 55, 0.2) !important;
  border: 0.5px solid rgba(93, 64, 55, 0.3) !important;
  color: #5d4037 !important;
}
</style>
