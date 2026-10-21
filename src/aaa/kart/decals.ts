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
