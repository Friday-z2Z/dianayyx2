<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'

const canvasRef = ref(null)
const isActive = ref(false)
const props = defineProps({
  autoStart: {
    type: Boolean,
    default: false
  }
})

let animationId = null
let ctx = null
let particles = []

class Particle {
  constructor(x, y, color) {
    this.x = x
    this.y = y
    this.color = color
    const angle = Math.random() * Math.PI * 2
    const velocity = Math.random() * 6 + 2
    this.vx = Math.cos(angle) * velocity
    this.vy = Math.sin(angle) * velocity
    this.alpha = 1
    this.decay = Math.random() * 0.02 + 0.015
    this.gravity = 0.15
  }

  update() {
    this.vx *= 0.98
    this.vy *= 0.98
    this.vy += this.gravity
    this.x += this.vx
    this.y += this.vy
    this.alpha -= this.decay
  }

  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

const colors = [
  '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff',
  '#5f27cd', '#00d2d3', '#ff9f43', '#ee5a24', '#0abde3',
  '#ff6348', '#7bed9f', '#70a1ff', '#5352ed', '#ff4757'
]

const createFirework = (x, y) => {
  const particleCount = 40 + Math.floor(Math.random() * 30)
  const color = colors[Math.floor(Math.random() * colors.length)]
  
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle(x, y, color))
  }
}

const animate = () => {
  if (!ctx || !canvasRef.value) return
  
  // 使用 clearRect 清除画布，而不是半透明覆盖
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  
  particles = particles.filter(particle => {
    particle.update()
    particle.draw(ctx)
    return particle.alpha > 0
  })
  
  if (particles.length > 0 || isActive.value) {
    animationId = requestAnimationFrame(animate)
  }
}

const launchFirework = (x, y) => {
  if (!ctx) return
  
  isActive.value = true
  createFirework(x, y)
  
  // 如果没有动画在运行，启动动画循环
  if (!animationId) {
    animate()
  }
}

const launchRandomFirework = () => {
  if (!canvasRef.value) return
  
  const x = Math.random() * canvasRef.value.width * 0.8 + canvasRef.value.width * 0.1
  const y = Math.random() * canvasRef.value.height * 0.4 + canvasRef.value.height * 0.1
  launchFirework(x, y)
}

const startFireworkShow = () => {
  if (!canvasRef.value) {
    // 如果 canvas 还没准备好，等待一下再试
    setTimeout(startFireworkShow, 50)
    return
  }
  
  isActive.value = true
  
  // 连续发射多个烟花
  let count = 0
  const maxCount = 10
  
  const launch = () => {
    if (count < maxCount) {
      launchRandomFirework()
      count++
      setTimeout(launch, 200 + Math.random() * 300)
    }
  }
  
  launch()
}

const initCanvas = () => {
  if (!canvasRef.value) return
  
  const canvas = canvasRef.value
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  
  ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
  
  // 如果设置了自动启动，则开始烟花秀
  if (props.autoStart) {
    startFireworkShow()
  }
}

const handleResize = () => {
  if (!canvasRef.value) return
  canvasRef.value.width = window.innerWidth
  canvasRef.value.height = window.innerHeight
}

onMounted(() => {
  nextTick(() => {
    initCanvas()
  })
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
})

defineExpose({
  startFireworkShow,
  launchFirework,
  isActive
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="firework-canvas"
  ></canvas>
</template>

<style scoped>
.firework-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
}
</style>