import * as THREE from 'three'
import { palette } from './palette'

function hash(ix: number, iy: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/** Tileable value noise on an integer lattice of `period`. */
function noise(x: number, y: number, period: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = x - x0
  const ty = y - y0
  const sx = tx * tx * (3 - 2 * tx)
  const sy = ty * ty * (3 - 2 * ty)
  const h = (ix: number, iy: number) => hash(mod(ix, period), mod(iy, period))
  const a = h(x0, y0)
  const b = h(x0 + 1, y0)
  const c = h(x0, y0 + 1)
  const d = h(x0 + 1, y0 + 1)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  repeat: boolean,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  draw(ctx)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

function heightToNormal(height: Float32Array, w: number, h: number, strength: number) {
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hl = height[y * w + mod(x - 1, w)]
      const hr = height[y * w + mod(x + 1, w)]
      const hd = height[mod(y - 1, h) * w + x]
      const hu = height[mod(y + 1, h) * w + x]
      let nx = (hl - hr) * strength
      let ny = (hd - hu) * strength
      let nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len
      const o = (y * w + x) * 4
      data[o] = (nx * 0.5 + 0.5) * 255
      data[o + 1] = (ny * 0.5 + 0.5) * 255
      data[o + 2] = (nz * 0.5 + 0.5) * 255
      data[o + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
  tex.colorSpace = THREE.NoColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  tex.anisotropy = 8
  return tex
}

function fillNoise(
  w: number,
  h: number,
  period: number,
  octaves: { scale: number; amp: number }[],
): Float32Array {
  const height = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0
      let sum = 0
      for (const o of octaves) {
        v += noise((x / w) * period * o.scale, (y / h) * period * o.scale, period * o.scale) * o.amp
        sum += o.amp
      }
      height[y * w + x] = v / sum
    }
  }
  return height
}

export type TrackTextures = {
  asphalt: THREE.CanvasTexture
  asphaltNormal: THREE.DataTexture
  grass: THREE.CanvasTexture
  sand: THREE.CanvasTexture
  wood: THREE.CanvasTexture
  bark: THREE.CanvasTexture
  banner: THREE.CanvasTexture
  checkers: THREE.CanvasTexture
  question: THREE.CanvasTexture
  sun: THREE.CanvasTexture
  signCrown: THREE.CanvasTexture
  signBank: THREE.CanvasTexture
  signBeach: THREE.CanvasTexture
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function makeSign(title: string, bg: string, fg: string): THREE.CanvasTexture {
  return canvasTexture(512, 160, (ctx) => {
    ctx.fillStyle = bg
    roundRect(ctx, 8, 8, 496, 144, 28)
    ctx.fill()
    ctx.lineWidth = 10
    ctx.strokeStyle = fg
    ctx.stroke()
    ctx.fillStyle = fg
    ctx.font = '800 64px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(title, 256, 84)
  }, false)
}

export function createTrackTextures(): TrackTextures {
  const asphaltH = fillNoise(256, 256, 8, [
    { scale: 1, amp: 0.55 },
    { scale: 2, amp: 0.3 },
    { scale: 4, amp: 0.15 },
  ])
  const asphalt = canvasTexture(256, 256, (ctx) => {
    const img = ctx.createImageData(256, 256)
    for (let i = 0; i < asphaltH.length; i++) {
      const n = asphaltH[i]
      const x = i % 256
      const streak = 0.5 + 0.5 * Math.sin(x * 0.35)
      const grit = n * 0.55 + streak * 0.08
      const base = 74 + grit * 42
      img.data[i * 4] = base + 4
      img.data[i * 4 + 1] = base + 8
      img.data[i * 4 + 2] = base + 18
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, true)

  const grassH = fillNoise(256, 256, 6, [
    { scale: 1, amp: 0.7 },
    { scale: 3, amp: 0.3 },
  ])
  const grass = canvasTexture(256, 256, (ctx) => {
    const img = ctx.createImageData(256, 256)
    for (let i = 0; i < grassH.length; i++) {
      const n = grassH[i]
      const blot = n > 0.66 ? 55 : n < 0.34 ? -40 : 0
      img.data[i * 4] = 36 + n * 70 + blot * 0.4
      img.data[i * 4 + 1] = 120 + n * 110 + blot
      img.data[i * 4 + 2] = 42 + n * 30
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, true)

  const sand = canvasTexture(256, 256, (ctx) => {
    const img = ctx.createImageData(256, 256)
    const h = fillNoise(256, 256, 6, [
      { scale: 1, amp: 0.65 },
      { scale: 4, amp: 0.35 },
    ])
    for (let i = 0; i < h.length; i++) {
      const n = h[i]
      img.data[i * 4] = 232 + n * 20
      img.data[i * 4 + 1] = 186 + n * 30
      img.data[i * 4 + 2] = 96 + n * 20
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, true)

  const wood = canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = palette.wood
    ctx.fillRect(0, 0, 256, 128)
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#c47b3e' : '#e0a15f'
      ctx.fillRect(0, i * 16, 256, 15)
      ctx.fillStyle = 'rgba(120, 64, 24, 0.25)'
      ctx.fillRect(0, i * 16 + 14, 256, 2)
    }
  }, true)

  const bark = canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = palette.trunk
    ctx.fillRect(0, 0, 128, 256)
    for (let y = 0; y < 256; y += 10) {
      ctx.fillStyle = y % 20 === 0 ? '#a86830' : '#d39252'
      ctx.fillRect(0, y, 128, 6)
    }
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = 'rgba(90, 48, 18, 0.35)'
      ctx.fillRect((i * 37) % 120, (i * 53) % 240, 8, 18)
    }
  }, true)

  const banner = canvasTexture(1024, 280, (ctx) => {
    ctx.fillStyle = '#111814'
    ctx.fillRect(0, 0, 1024, 280)
    const cell = 35
    for (let y = 0; y < 280; y += cell) {
      for (let x = 0; x < 1024; x += cell) {
        const on = (x / cell + y / cell) % 2 === 0
        ctx.fillStyle = on ? '#1b1e24' : '#fff6ea'
        ctx.fillRect(x, y, cell, cell)
      }
    }
    ctx.fillStyle = palette.arch
    roundRect(ctx, 48, 36, 928, 208, 18)
    ctx.fill()
    ctx.fillStyle = palette.gold
    ctx.fillRect(48, 36, 928, 14)
    ctx.fillRect(48, 230, 928, 14)
    ctx.fillStyle = palette.cream
    ctx.font = '800 92px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('PALM PRIX', 512, 128)
    ctx.fillStyle = palette.gold
    ctx.font = '700 32px Inter, sans-serif'
    ctx.fillText('LAGOON LOOP', 512, 186)
  }, false)

  const checkers = canvasTexture(256, 64, (ctx) => {
    const cell = 32
    for (let y = 0; y < 64; y += cell) {
      for (let x = 0; x < 256; x += cell) {
        const on = (x / cell + y / cell) % 2 === 0
        ctx.fillStyle = on ? '#1b1e24' : '#fff6ea'
        ctx.fillRect(x, y, cell, cell)
      }
    }
  }, true)

  const question = canvasTexture(256, 256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256)
    ctx.fillStyle = palette.cream
    ctx.beginPath()
    ctx.arc(128, 128, 118, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 14
    ctx.strokeStyle = palette.coral
    ctx.stroke()
    ctx.fillStyle = palette.ink
    ctx.font = '800 180px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('?', 128, 138)
  }, false)

  const sun = canvasTexture(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 120)
    g.addColorStop(0, 'rgba(255, 252, 230, 1)')
    g.addColorStop(0.35, 'rgba(255, 214, 110, 0.95)')
    g.addColorStop(0.7, 'rgba(255, 176, 70, 0.35)')
    g.addColorStop(1, 'rgba(255, 176, 70, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }, false)

  return {
    asphalt,
    asphaltNormal: heightToNormal(asphaltH, 256, 256, 3.2),
    grass,
    sand,
    wood,
    bark,
    banner,
    checkers,
    question,
    sun,
    signCrown: makeSign('TIDE CROWN', palette.archDeep, palette.gold),
    signBank: makeSign('CORAL BANK', palette.coral, palette.cream),
    signBeach: makeSign('SHELL BEACH', '#e7a04a', palette.ink),
  }
}

export function disposeTrackTextures(tex: TrackTextures) {
  for (const value of Object.values(tex)) value.dispose()
}
