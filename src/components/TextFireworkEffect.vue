<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  autoStart: {
    type: Boolean,
    default: false
  }
})

const containerRef = ref(null)
const canvasRef = ref(null)
let ctx = null
let particles = []
let animationId = null
let textPixels = []

const canvasWidth = window.innerWidth
const canvasHeight = window.innerHeight
const fontSize = Math.min(Math.ceil(canvasWidth / 5), 80)
const lineHeight = fontSize * 1.4
const totalTextHeight = lineHeight * 2
const yOffset = (canvasHeight - totalTextHeight) / 2

// 创建爱心粒子的路径
const createHeartPath = (size) => {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ff4757'
  ctx.beginPath()
  const topCurveHeight = size * 0.3
  ctx.moveTo(size / 2, size * 0.25)
  ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, size * 0.25)
  ctx.bezierCurveTo(0, size * 0.6, size / 2, size * 0.8, size / 2, size)
  ctx.bezierCurveTo(size / 2, size * 0.8, size, size * 0.6, size, size * 0.25)
  ctx.bezierCurveTo(size, 0, size / 2, 0, size / 2, size * 0.25)
  ctx.fill()

  return canvas
}

class Particle {
  constructor(targetX, targetY, heartCanvas) {
    this.targetX = targetX
    this.targetY = targetY
    this.x = Math.random() * canvasWidth
    this.y = canvasHeight + Math.random() * 100
    this.size = 6 + Math.random() * 6
    this.speed = 0.02 + Math.random() * 0.04
    this.heartCanvas = heartCanvas
    this.arrived = false
    this.pulsePhase = Math.random() * Math.PI * 2
  }

  update() {
    if (!this.arrived) {
      // 向目标位置移动
      this.x += (this.targetX - this.x) * this.speed
      this.y += (this.targetY - this.y) * this.speed

      // 检查是否到达目标位置
      const dist = Math.abs(this.x - this.targetX) + Math.abs(this.y - this.targetY)
      if (dist < 5) {
        this.arrived = true
        this.x = this.targetX
        this.y = this.targetY
      }
    } else {
      // 到达后添加呼吸动画效果
      this.pulsePhase += 0.05
    }
  }

  draw(ctx) {
    ctx.globalAlpha = 1
    
    // 计算呼吸效果的大小
    let drawSize = this.size
    if (this.arrived) {
      const pulse = Math.sin(this.pulsePhase) * 0.15 + 1
      drawSize = this.size * pulse
    }
    
    ctx.drawImage(
      this.heartCanvas, 
      this.x - drawSize / 2, 
      this.y - drawSize / 2, 
      drawSize, 
      drawSize
    )
  }

  isDead() {
    // 粒子不会死亡，一直保留形成文字
    return false
  }
}

const initTextPixels = () => {
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')

  // 写字
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`

  // 第一行 - 垂直居中偏上
  ctx.fillText('源源', canvasWidth / 2, yOffset + lineHeight * 0.5)
  // 第二行 - 垂直居中偏下
  ctx.fillText('你最漂亮', canvasWidth / 2, yOffset + lineHeight * 1.5)

  // 获取像素数据
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
  const data = imageData.data
  const gap = 5

  textPixels = []
  for (let y = 0; y < canvasHeight; y += gap) {
    for (let x = 0; x < canvasWidth; x += gap) {
      const index = (y * canvasWidth + x) * 4
      const a = data[index + 3]

      if (a > 100) {
        textPixels.push({ x, y })
      }
    }
  }

  // 打乱顺序
  for (let i = textPixels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[textPixels[i], textPixels[j]] = [textPixels[j], textPixels[i]]
  }
}

const startTextFireworks = () => {
  if (!containerRef.value) return

  // 创建画布
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  canvas.style.position = 'absolute'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  containerRef.value.appendChild(canvas)

  ctx = canvas.getContext('2d')

  // 获取文字像素
  initTextPixels()

  // 创建爱心图案
  const heartCanvas = createHeartPath(20)

  // 创建粒子（增加数量以提高清晰度）
  const maxParticles = Math.min(textPixels.length, 500)
  for (let i = 0; i < maxParticles; i++) {
    setTimeout(() => {
      const pixel = textPixels[i]
      if (pixel) {
        particles.push(new Particle(pixel.x, pixel.y, heartCanvas))
      }
    }, i * 8)
  }

  // 开始动画
  animate()
}

const animate = () => {
  if (!ctx) return

  // 清除画布（使用半透明实现拖尾效果）
  ctx.fillStyle = 'rgba(26, 26, 46, 0.15)'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // 更新和绘制粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update()
    particles[i].draw(ctx)

    if (particles[i].isDead()) {
      particles.splice(i, 1)
    }
  }

  animationId = requestAnimationFrame(animate)
}

const clearStage = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  if (containerRef.value) {
    containerRef.value.innerHTML = ''
  }
  ctx = null
  particles = []
  textPixels = []
}

onMounted(() => {
  nextTick(() => {
    if (props.autoStart) {
      startTextFireworks()
    }
  })
})

onUnmounted(() => {
  clearStage()
})

defineExpose({
  startTextFireworks,
  clearStage
})
</script>

<template>
  <div ref="containerRef" class="text-firework-container"></div>
</template>

<style scoped>
.text-firework-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  pointer-events: none;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
}
</style>