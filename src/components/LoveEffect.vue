<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  autoStart: {
    type: Boolean,
    default: false
  }
})

const pinkboardRef = ref(null)
const canvasRef = ref(null)
let animationIds = []

const initLovePage = () => {
  const colors = [
    '#eec996', '#8fb7d3', '#b7d4c6', '#c3bedd', '#f1d5e4',
    '#cae1d3', '#f3c89d', '#d0b0c3', '#819d53', '#c99294',
    '#cec884', '#ff8e70', '#e0a111', '#fffdf6', '#cbd7ac',
    '#e8c6c0', '#dc9898', '#ecc8ba'
  ]

  // 第一个画布 - 飘浮文字
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  let ww = window.innerWidth
  let wh = window.innerHeight
  canvas.width = ww
  canvas.height = wh
  const hearts = []

  class Heart {
    constructor() {
      this.x = Math.random() * ww
      this.y = Math.random() * wh
      this.opacity = Math.random() * 0.5 + 0.5
      this.vel = {
        x: (Math.random() - 0.5) * 4,
        y: (Math.random() - 0.5) * 4
      }
      this.targetScale = Math.random() * 0.15 + 0.02
      this.scale = this.targetScale * Math.random()
      this.width = 473.8 * this.scale
      this.height = 408.6 * this.scale
    }

    update() {
      this.x += this.vel.x
      this.y += this.vel.y
      this.scale += (this.targetScale - this.scale) * 0.01
      this.width = 473.8 * this.scale
      this.height = 408.6 * this.scale
      if (this.x - this.width / 2 > ww || this.x + this.width / 2 < 0) {
        this.scale = 0
        this.x = Math.random() * ww
      }
      if (this.y - this.height / 2 > wh || this.y + this.height / 2 < 0) {
        this.scale = 0
        this.y = Math.random() * wh
      }
    }

    draw(i) {
      ctx.globalAlpha = this.opacity
      ctx.font = `${180 * this.scale}px "Microsoft YaHei", sans-serif`
      ctx.fillStyle = colors[i % 18]
      ctx.fillText(
        '源源,我爱你',
        this.x - this.width * 0.5,
        this.y - this.height * 0.5,
        this.width,
        this.height
      )
    }
  }

  for (let i = 0; i < 100; i++) {
    hearts.push(new Heart())
  }

  const renderHearts = () => {
    ctx.clearRect(0, 0, ww, wh)
    for (let i = 0; i < 100; i++) {
      hearts[i].update()
      hearts[i].draw(i)
    }
    const id = requestAnimationFrame(renderHearts)
    animationIds.push(id)
  }
  renderHearts()

  // 第二个画布 - 粒子爱心
  const pinkboard = pinkboardRef.value
  const settings = {
    particles: {
      length: 500,
      duration: 2,
      velocity: 100,
      effect: -0.75,
      size: 30
    }
  }

  class Point {
    constructor(x, y) {
      this.x = typeof x !== 'undefined' ? x : 0
      this.y = typeof y !== 'undefined' ? y : 0
    }
    clone() {
      return new Point(this.x, this.y)
    }
    length(length) {
      if (typeof length === 'undefined') {
        return Math.sqrt(this.x * this.x + this.y * this.y)
      }
      this.normalize()
      this.x *= length
      this.y *= length
      return this
    }
    normalize() {
      const length = this.length()
      this.x /= length
      this.y /= length
      return this
    }
  }

  class Particle {
    constructor() {
      this.position = new Point()
      this.velocity = new Point()
      this.acceleration = new Point()
      this.age = 0
    }
    initialize(x, y, dx, dy) {
      this.position.x = x
      this.position.y = y
      this.velocity.x = dx
      this.velocity.y = dy
      this.acceleration.x = dx * settings.particles.effect
      this.acceleration.y = dy * settings.particles.effect
      this.age = 0
    }
    update(deltaTime) {
      this.position.x += this.velocity.x * deltaTime
      this.position.y += this.velocity.y * deltaTime
      this.velocity.x += this.acceleration.x * deltaTime
      this.velocity.y += this.acceleration.y * deltaTime
      this.age += deltaTime
    }
    draw(context, image) {
      const ease = (t) => --t * t * t + 1
      const size = image.width * ease(this.age / settings.particles.duration)
      context.globalAlpha = 1 - this.age / settings.particles.duration
      context.drawImage(
        image,
        this.position.x - size / 2,
        this.position.y - size / 2,
        size,
        size
      )
    }
  }

  class ParticlePool {
    constructor(length) {
      this.particles = new Array(length)
      for (let i = 0; i < this.particles.length; i++) {
        this.particles[i] = new Particle()
      }
      this.firstActive = 0
      this.firstFree = 0
      this.duration = settings.particles.duration
    }
    add(x, y, dx, dy) {
      this.particles[this.firstFree].initialize(x, y, dx, dy)
      this.firstFree++
      if (this.firstFree === this.particles.length) this.firstFree = 0
      if (this.firstActive === this.firstFree) this.firstActive++
      if (this.firstActive === this.particles.length) this.firstActive = 0
    }
    update(deltaTime) {
      let i
      if (this.firstActive < this.firstFree) {
        for (i = this.firstActive; i < this.firstFree; i++) {
          this.particles[i].update(deltaTime)
        }
      }
      if (this.firstFree < this.firstActive) {
        for (i = this.firstActive; i < this.particles.length; i++) {
          this.particles[i].update(deltaTime)
        }
        for (i = 0; i < this.firstFree; i++) {
          this.particles[i].update(deltaTime)
        }
      }
      while (
        this.particles[this.firstActive].age >= this.duration &&
        this.firstActive !== this.firstFree
      ) {
        this.firstActive++
        if (this.firstActive === this.particles.length) this.firstActive = 0
      }
    }
    draw(context, image) {
      if (this.firstActive < this.firstFree) {
        for (let i = this.firstActive; i < this.firstFree; i++) {
          this.particles[i].draw(context, image)
        }
      }
      if (this.firstFree < this.firstActive) {
        for (let i = this.firstActive; i < this.particles.length; i++) {
          this.particles[i].draw(context, image)
        }
        for (let i = 0; i < this.firstFree; i++) {
          this.particles[i].draw(context, image)
        }
      }
    }
  }

  const context = pinkboard.getContext('2d')
  const particles = new ParticlePool(settings.particles.length)
  const particleRate = settings.particles.length / settings.particles.duration
  let time

  const pointOnHeart = (t) => {
    return new Point(
      80 * Math.pow(Math.sin(t), 3),
      65 * Math.cos(t) -
        25 * Math.cos(2 * t) -
        10 * Math.cos(3 * t) -
        5 * Math.cos(4 * t) +
        12.5
    )
  }

  const image = (() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = settings.particles.size
    canvas.height = settings.particles.size
    const to = (t) => {
      const point = pointOnHeart(t)
      point.x =
        settings.particles.size / 2 +
        (point.x * settings.particles.size) / 350
      point.y =
        settings.particles.size / 2 -
        (point.y * settings.particles.size) / 350
      return point
    }
    context.beginPath()
    let t = -Math.PI
    let point = to(t)
    context.moveTo(point.x, point.y)
    while (t < Math.PI) {
      t += 0.01
      point = to(t)
      context.lineTo(point.x, point.y)
    }
    context.closePath()
    context.fillStyle = '#ea80b0'
    context.fill()
    const img = new Image()
    img.src = canvas.toDataURL()
    return img
  })()

  const renderParticles = () => {
    const id = requestAnimationFrame(renderParticles)
    animationIds.push(id)
    const newTime = new Date().getTime() / 1000
    const deltaTime = newTime - (time || newTime)
    time = newTime
    context.clearRect(0, 0, pinkboard.width, pinkboard.height)
    const amount = particleRate * deltaTime
    for (let i = 0; i < amount; i++) {
      const pos = pointOnHeart(Math.PI - 2 * Math.PI * Math.random())
      const dir = pos.clone().length(settings.particles.velocity)
      particles.add(
        pinkboard.width / 2 + pos.x,
        pinkboard.height / 2 - pos.y,
        dir.x,
        -dir.y
      )
    }
    particles.update(deltaTime)
    particles.draw(context, image)
  }

  const onResize = () => {
    ww = window.innerWidth
    wh = window.innerHeight
    canvas.width = ww
    canvas.height = wh
    pinkboard.width = ww
    pinkboard.height = wh
  }

  window.addEventListener('resize', onResize)
  onResize()
  renderParticles()
}

const stop = () => {
  animationIds.forEach(id => cancelAnimationFrame(id))
  animationIds = []
}

onMounted(() => {
  if (props.autoStart) {
    initLovePage()
  }
})

onUnmounted(() => {
  stop()
})

defineExpose({
  initLovePage,
  stop
})
</script>

<template>
  <div class="love-page">
    <canvas ref="pinkboardRef" class="pinkboard" />
    <canvas ref="canvasRef" class="text-canvas" />
  </div>
</template>

<style scoped>
.love-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom, #000000 0%, #1a0b1a 100%);
}

.pinkboard,
.text-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.pinkboard {
  z-index: 1;
}

.text-canvas {
  z-index: 2;
  pointer-events: none;
}
</style>