import * as THREE from 'three'

function canvasTex(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2d context missing')
  draw(ctx, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/** Thick geometric 7 — readable at chase size. Transparent outside the digit. */
export function createNumberTexture() {
  return canvasTex((ctx, s) => {
    ctx.clearRect(0, 0, s, s)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#ff3d66'
    ctx.lineWidth = s * 0.22
    ctx.beginPath()
    ctx.moveTo(s * 0.18, s * 0.22)
    ctx.lineTo(s * 0.84, s * 0.22)
    ctx.lineTo(s * 0.4, s * 0.84)
    ctx.stroke()
    ctx.strokeStyle = '#1a1024'
    ctx.lineWidth = s * 0.12
    ctx.stroke()
  })
}

/** Clear center, cyan rim — a pane, not a tube. */
export function createGlassShade() {
  return canvasTex((ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s)
    g.addColorStop(0, 'rgba(210, 248, 255, 0.55)')
    g.addColorStop(0.18, 'rgba(186, 236, 255, 0.22)')
    g.addColorStop(0.78, 'rgba(186, 236, 255, 0.16)')
    g.addColorStop(1, 'rgba(255, 255, 255, 0.72)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = s * 0.018
    ctx.strokeRect(s * 0.03, s * 0.03, s * 0.94, s * 0.94)
  }, 256)
}

/** Flat palm fan for the wing. Transparent outside the mark. */
export function createPalmTexture() {
  return canvasTex((ctx, s) => {
    ctx.clearRect(0, 0, s, s)
    ctx.beginPath()
    ctx.arc(s * 0.5, s * 0.56, s * 0.4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffc83d'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(s * 0.5, s * 0.56, s * 0.33, 0, Math.PI * 2)
    ctx.fillStyle = '#fff3e4'
    ctx.fill()
    ctx.fillStyle = '#0c7a40'
    ctx.fillRect(s * 0.46, s * 0.52, s * 0.08, s * 0.3)
    const fans = [-1.05, -0.55, 0, 0.55, 1.05]
    fans.forEach((ang, i) => {
      ctx.save()
      ctx.translate(s * 0.5, s * 0.5)
      ctx.rotate(ang)
      ctx.fillStyle = i % 2 === 0 ? '#14a35a' : '#0c7a40'
      ctx.beginPath()
      ctx.ellipse(0, -s * 0.16, s * 0.07, s * 0.22, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })
  }, 256)
}

/** Nose badge: a second 7 that reads from the three-quarter. */
export function createNoseBadge() {
  return canvasTex((ctx, s) => {
    ctx.clearRect(0, 0, s, s)
    const r = s * 0.12
    roundRect(ctx, s * 0.08, s * 0.1, s * 0.84, s * 0.8, r)
    ctx.fillStyle = '#2f6bff'
    ctx.fill()
    roundRect(ctx, s * 0.16, s * 0.18, s * 0.68, s * 0.64, r * 0.7)
    ctx.fillStyle = '#fff3e4'
    ctx.fill()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a1024'
    ctx.lineWidth = s * 0.1
    ctx.beginPath()
    ctx.moveTo(s * 0.28, s * 0.34)
    ctx.lineTo(s * 0.74, s * 0.34)
    ctx.lineTo(s * 0.4, s * 0.74)
    ctx.stroke()
  }, 256)
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

export function createShadowTexture() {
  return canvasTex((ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.08, s / 2, s / 2, s * 0.5)
    g.addColorStop(0, 'rgba(0,0,0,0.5)')
    g.addColorStop(0.55, 'rgba(0,0,0,0.22)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  }, 256)
}
