import * as THREE from 'three'
import { LAYOUT, paint } from './palette'

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

function smooth01(t: number) {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function gauss(t: number, center: number, sigma: number) {
  const d = (t - center) / sigma
  return Math.exp(-d * d)
}

export type Profile = {
  t: number
  z: number
  hw: number
  yb: number
  yt: number
  cockpit: number
}

export function sampleProfile(t: number): Profile {
  const z = lerp(LAYOUT.zTail, LAYOUT.zNose, t)
  const cowl = gauss(t, 0.44, 0.15)
  const hood = gauss(t, 0.74, 0.13)
  const deck = smooth01(1 - t / 0.24)
  const noseLift = smooth01((t - 0.72) / 0.22)

  let hw = 0.48
  hw += 0.045 * Math.sin(Math.PI * clamp(t, 0, 1))
  hw -= 0.035 * gauss(t, 0.5, 0.18)

  const yb = 0.2 + 0.07 * noseLift
  let yt = 0.45
  yt += 0.32 * cowl
  yt += 0.07 * hood
  yt += 0.14 * deck

  const cockpit = gauss(t, 0.45, 0.105)
  return { t, z, hw, yb, yt, cockpit }
}

/** Point on the monocoque. phi 0 = crown, increasing toward +X. */
export function sectionPoint(p: Profile, phi: number): THREE.Vector3 {
  const c = Math.cos(phi)
  const s = Math.sin(phi)
  const n = 2.6
  const ax = Math.sign(s) * Math.pow(Math.abs(s), 2 / n)
  const ay = Math.sign(c) * Math.pow(Math.abs(c), 2 / n)

  let x = ax * p.hw
  const mid = (p.yt + p.yb) * 0.5
  const ry = (p.yt - p.yb) * 0.5
  let y = mid + ay * ry

  if (c > 0) {
    y = mid + Math.pow(c, 0.72) * ry
    // widen the shoulder so the crown reads as a panel, not a sausage
    const shoulder = Math.exp(-Math.pow((Math.abs(s) - 0.72) / 0.32, 2))
    x *= 1 + 0.06 * shoulder
  } else {
    const f = Math.pow(-c, 1.35)
    y = mid - f * ry * 0.7
    x *= 1 - 0.16 * Math.pow(-c, 2)
  }

  if (p.cockpit > 0.02 && c > 0) {
    const center = 1 - smooth01((Math.abs(s) - 0.12) / 0.38)
    y -= p.cockpit * Math.pow(c, 0.85) * center * 0.36
  }

  // rounded nose: collapse the section toward a bumper center
  if (p.t > 0.86) {
    const u = (p.t - 0.86) / 0.14
    const sc = Math.cos(clamp(u, 0, 1) * Math.PI * 0.5)
    x *= sc
    const cy = 0.4
    y = cy + (y - cy) * sc
  }

  if (p.t < 0.1) {
    const u = smooth01(1 - p.t / 0.1)
    x *= lerp(1, 0.78, u)
  }

  return new THREE.Vector3(x, y, p.z)
}

export function surface(t: number, phi: number) {
  return sectionPoint(sampleProfile(t), phi)
}

function reverseWinding(geo: THREE.BufferGeometry) {
  const idx = geo.getIndex()
  if (!idx) return
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i)
    const c = idx.getX(i + 2)
    idx.setX(i, c)
    idx.setX(i + 2, a)
  }
}

function orientNormals(
  geo: THREE.BufferGeometry,
  outward: (pos: THREE.Vector3, nor: THREE.Vector3) => number,
) {
  geo.computeVertexNormals()
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  let score = 0
  const step = Math.max(1, Math.floor(pos.count / 80))
  for (let i = 0; i < pos.count; i += step) {
    p.fromBufferAttribute(pos, i)
    n.fromBufferAttribute(nor, i)
    score += outward(p, n)
  }
  if (score < 0) {
    reverseWinding(geo)
    geo.computeVertexNormals()
  }
}

function paintHull(t: number, phi: number): THREE.Color {
  const c = Math.cos(phi)
  const s = Math.sin(phi)
  let base: THREE.Color
  if (t > 0.8 || (t < 0.22 && c > -0.15)) base = paint.coral
  else if (c > 0.02) base = paint.coral
  else base = paint.cream

  const pit =
    gauss(t, 0.45, 0.105) > 0.45 && c > 0.45 && Math.abs(s) < 0.42
  if (pit) base = paint.plum

  const col = base.clone()

  const belt = Math.exp(-Math.pow((c - 0.06) / 0.045, 2))
  if (t > 0.14 && t < 0.84 && !pit) col.lerp(paint.gold, belt * 0.92)

  const grooveT = Math.exp(-Math.pow((t - 0.6) / 0.012, 2))
  if (c > 0.25 && t > 0.5 && t < 0.7) {
    col.lerp(base.clone().multiplyScalar(0.62), grooveT * 0.85)
  }

  const onHood = t > 0.62 && t < 0.9 && c > 0.5
  if (onHood) {
    const stripe = Math.exp(-Math.pow((Math.abs(s) - 0.14) / 0.02, 2))
    col.lerp(paint.cream, stripe * 0.9)
    const spine = Math.exp(-Math.pow(s / 0.02, 2))
    col.lerp(paint.coralDeep, spine * 0.55)
  }

  const deckBand = Math.exp(-Math.pow((t - 0.12) / 0.012, 2))
  if (t < 0.2 && c > 0.2) col.lerp(paint.gold, deckBand * 0.75)

  return col
}

export function createMonocoque(): THREE.BufferGeometry {
  const zN = 52
  const aN = 40
  const stride = aN + 1
  const positions: number[] = []
  const colors: number[] = []

  for (let i = 0; i <= zN; i++) {
    const t = i / zN
    const profile = sampleProfile(t)
    for (let j = 0; j <= aN; j++) {
      const phi = (j / aN) * Math.PI * 2
      const v = sectionPoint(profile, phi)
      positions.push(v.x, v.y, v.z)
      const col = paintHull(t, phi)
      colors.push(col.r, col.g, col.b)
    }
  }

  const indices: number[] = []
  for (let i = 0; i < zN; i++) {
    for (let j = 0; j < aN; j++) {
      const a = i * stride + j
      const b = a + 1
      const d = a + stride
      const e = d + 1
      indices.push(a, d, b, b, d, e)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  orientNormals(geo, (p, n) => n.x * Math.sign(p.x || 1) + n.y * 0.25)
  geo.computeBoundingSphere()
  return geo
}

export function createPontoon(side: 1 | -1): THREE.BufferGeometry {
  const zN = 36
  const aN = 16
  const stride = aN + 1
  const centers: THREE.Vector3[] = []
  const radii: { rx: number; ry: number }[] = []

  for (let i = 0; i <= zN; i++) {
    const t = i / zN
    const z = lerp(-1.0, 1.08, t)
    const front = gauss(t, 0.8, 0.085)
    const rear = gauss(t, 0.145, 0.095)
    const arch = clamp(front * 1.15 + rear * 1.1, 0, 1)
    const end =
      Math.sin(clamp(t / 0.07, 0, 1) * Math.PI * 0.5) *
      Math.sin(clamp((1 - t) / 0.07, 0, 1) * Math.PI * 0.5)
    const x = side * lerp(0.5, 0.6, arch)
    const y = lerp(0.36, 0.57, arch)
    centers.push(new THREE.Vector3(x, y, z))
    radii.push({
      rx: lerp(0.2, 0.28, arch) * lerp(0.2, 1, end),
      ry: lerp(0.12, 0.24, arch) * lerp(0.2, 1, end),
    })
  }

  const positions: number[] = []
  const colors: number[] = []
  const outward = new THREE.Vector3(side, 0, 0)
  const tangent = new THREE.Vector3()
  const binormal = new THREE.Vector3()
  const normal = new THREE.Vector3()

  for (let i = 0; i <= zN; i++) {
    const prev = centers[Math.max(0, i - 1)]
    const next = centers[Math.min(zN, i + 1)]
    tangent.copy(next).sub(prev).normalize()
    binormal.crossVectors(tangent, outward).normalize()
    normal.crossVectors(binormal, tangent).normalize()
    const { rx, ry } = radii[i]
    const t = i / zN
    for (let j = 0; j <= aN; j++) {
      const a = (j / aN) * Math.PI
      const p = centers[i].clone()
      p.addScaledVector(normal, Math.cos(a) * rx)
      p.addScaledVector(binormal, Math.sin(a) * ry)
      positions.push(p.x, p.y, p.z)
      const up = Math.sin(a)
      const base = up > 0.2 ? paint.coral : paint.cream
      const col = base.clone()
      const stripe = Math.exp(-Math.pow((a - 0.42) / 0.09, 2))
      if (t > 0.28 && t < 0.68) col.lerp(paint.blue, stripe)
      const lip = Math.exp(-Math.pow((a - 0.05) / 0.08, 2))
      col.lerp(paint.gold, lip * 0.85)
      colors.push(col.r, col.g, col.b)
    }
  }

  const indices: number[] = []
  for (let i = 0; i < zN; i++) {
    for (let j = 0; j < aN; j++) {
      const a = i * stride + j
      const b = a + 1
      const d = a + stride
      const e = d + 1
      indices.push(a, d, b, b, d, e)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  orientNormals(geo, (p, n) => n.y * 0.7 + n.x * side * Math.sign(Math.abs(p.x) + 0.001))
  return geo
}

function displaceTread(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i)
    let y = pos.getY(i)
    let z = pos.getZ(i)
    const radial = Math.hypot(x, z) || 1
    const ang = Math.atan2(z, x)
    const blocks = 22
    let r = paint.sidewall.r
    let g = paint.sidewall.g
    let b = paint.sidewall.b

    if (radial > 0.318 && Math.abs(y) < 0.07) {
      const row = y >= 0 ? 0 : Math.PI / blocks
      const wave = Math.sin(ang * blocks + row)
      const bump = wave > 0.15 ? 0.01 : -0.006
      const k = (radial + bump) / radial
      x *= k
      z *= k
      r = paint.tire.r
      g = paint.tire.g
      b = paint.tire.b
    } else if (radial > 0.292 && Math.abs(y) >= 0.078 && Math.abs(y) < 0.112) {
      const wave = Math.sin(ang * blocks + 0.4)
      const bump = wave > 0 ? 0.008 : -0.004
      const k = (radial + bump) / radial
      x *= k
      z *= k
      r = paint.tire.r
      g = paint.tire.g
      b = paint.tire.b
    }

    const band = Math.abs(Math.abs(y) - 0.1) < 0.02 && radial > 0.22 && radial < 0.31
    if (band) {
      r = paint.letter.r
      g = paint.letter.g
      b = paint.letter.b
    }

    pos.setXYZ(i, x, y, z)
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()
}

export function createTire(): THREE.BufferGeometry {
  const bead = 0.2
  const tread = LAYOUT.wheelR
  const half = 0.132
  const pts = [
    new THREE.Vector2(bead, -0.055),
    new THREE.Vector2(bead + 0.012, -0.078),
    new THREE.Vector2(0.25, -half),
    new THREE.Vector2(0.29, -0.108),
    new THREE.Vector2(tread - 0.008, -0.078),
    new THREE.Vector2(tread, -0.04),
    new THREE.Vector2(tread, 0.04),
    new THREE.Vector2(tread - 0.008, 0.078),
    new THREE.Vector2(0.29, 0.108),
    new THREE.Vector2(0.25, half),
    new THREE.Vector2(bead + 0.012, 0.078),
    new THREE.Vector2(bead, 0.055),
  ]
  const geo = new THREE.LatheGeometry(pts, 128)
  displaceTread(geo)
  orientNormals(geo, (p, n) => n.dot(p))
  return geo
}

export function createRim(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.055, 0.045),
    new THREE.Vector2(0.08, 0.07),
    new THREE.Vector2(0.13, 0.1),
    new THREE.Vector2(0.185, 0.128),
    new THREE.Vector2(0.222, 0.122),
    new THREE.Vector2(0.23, 0.095),
    new THREE.Vector2(0.2, 0.078),
    new THREE.Vector2(0.11, 0.06),
  ]
  const geo = new THREE.LatheGeometry(pts, 96)
  orientNormals(geo, (p, n) => n.dot(p))
  return geo
}

export function createSpoke(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(0.05, -0.011)
  s.lineTo(0.195, -0.02)
  s.lineTo(0.214, 0)
  s.lineTo(0.195, 0.02)
  s.lineTo(0.05, 0.014)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
    curveSegments: 3,
  })
  g.translate(0, 0, -0.013)
  g.rotateX(Math.PI / 2)
  g.translate(0, 0.132, 0)
  return g
}

export function createCap(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 0.5
    pts.push(new THREE.Vector2(Math.cos(a) * 0.058, 0.125 + Math.sin(a) * 0.042))
  }
  return new THREE.LatheGeometry(pts, 28)
}

export function createWing(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(0.02, 0)
  s.bezierCurveTo(0.16, 0.07, 0.4, 0.06, 0.58, 0.012)
  s.bezierCurveTo(0.4, -0.018, 0.16, -0.012, 0.02, 0)
  const depth = 1.55
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 12,
  })
  g.translate(0, 0, -depth / 2)
  g.rotateY(Math.PI / 2)
  g.translate(0, 0, 0.22)
  g.computeVertexNormals()
  return g
}

export function createEndplate(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(0.0, 0.0)
  s.bezierCurveTo(0.22, 0.0, 0.48, 0.02, 0.56, 0.08)
  s.bezierCurveTo(0.6, 0.16, 0.5, 0.3, 0.36, 0.32)
  s.bezierCurveTo(0.18, 0.3, 0.02, 0.2, 0.0, 0.12)
  s.bezierCurveTo(-0.02, 0.06, -0.01, 0.02, 0.0, 0.0)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 8,
  })
  g.translate(0, 0, -0.022)
  g.computeVertexNormals()
  return g
}

export function createWindshield(): THREE.BufferGeometry {
  const uN = 18
  const vN = 10
  const positions: number[] = []
  const uvs: number[] = []
  for (let i = 0; i <= uN; i++) {
    const u = i / uN
    for (let j = 0; j <= vN; j++) {
      const v = j / vN
      const x = lerp(-0.4, 0.4, v)
      const y = lerp(0, 0.48, u)
      const bow = 0.13 * (1 - Math.pow((v - 0.5) * 2, 2))
      const lean = -0.26 * u
      const z = bow + lean
      positions.push(x, y, z)
      uvs.push(v, u)
    }
  }
  const indices: number[] = []
  const stride = vN + 1
  for (let i = 0; i < uN; i++) {
    for (let j = 0; j < vN; j++) {
      const a = i * stride + j
      const b = a + 1
      const d = a + stride
      const e = d + 1
      indices.push(a, d, b, b, d, e)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export function createFlame(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = []
  const n = 16
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const belly = Math.sin(t * Math.PI)
    const radius = 0.2 * Math.pow(1 - t, 0.5) * (0.65 + 0.4 * belly)
    pts.push(new THREE.Vector2(Math.max(0.008, radius), t * 0.4))
  }
  const geo = new THREE.LatheGeometry(pts, 18)
  geo.computeVertexNormals()
  return geo
}

export function createLens(radius = 0.07): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 0.5
    pts.push(new THREE.Vector2(Math.cos(a) * radius, Math.sin(a) * radius * 0.62))
  }
  return new THREE.LatheGeometry(pts, 20)
}

export function createExhaust(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.04, 0),
    new THREE.Vector2(0.046, 0.08),
    new THREE.Vector2(0.05, 0.14),
    new THREE.Vector2(0.07, 0.18),
    new THREE.Vector2(0.045, 0.2),
  ]
  return new THREE.LatheGeometry(pts, 16)
}

export function createUndertray(): THREE.BufferGeometry {
  const w = 0.78
  const h = 1.7
  const r = 0.16
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.016,
    bevelSegments: 2,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, 0.03, 0.02)
  g.computeVertexNormals()
  return g
}

export function createSeatBack(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-0.2, 0)
  s.bezierCurveTo(-0.26, 0.16, -0.2, 0.34, -0.12, 0.4)
  s.bezierCurveTo(-0.04, 0.46, 0.04, 0.46, 0.12, 0.4)
  s.bezierCurveTo(0.2, 0.34, 0.26, 0.16, 0.2, 0)
  s.bezierCurveTo(0.08, -0.05, -0.08, -0.05, -0.2, 0)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.018,
    bevelSegments: 2,
    curveSegments: 10,
  })
  g.translate(0, 0, -0.05)
  g.computeVertexNormals()
  return g
}

export function createChevron(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(0, 0.14)
  s.lineTo(0.13, -0.08)
  s.lineTo(0.07, -0.08)
  s.lineTo(0, 0.02)
  s.lineTo(-0.07, -0.08)
  s.lineTo(-0.13, -0.08)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.025,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.004,
    bevelSegments: 1,
  })
  g.translate(0, 0, -0.012)
  return g
}

export function createLeaf(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.07, 0.08, 0.06, 0.2, 0.01, 0.32)
  s.bezierCurveTo(0.0, 0.36, -0.01, 0.36, -0.01, 0.32)
  s.bezierCurveTo(-0.06, 0.2, -0.07, 0.08, 0, 0)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 1,
    curveSegments: 8,
  })
  g.translate(0, 0, -0.009)
  return g
}

export function createGlassFrame(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = []
  const n = 24
  const edge = (u: number, v: number) => {
    const x = lerp(-0.4, 0.4, v)
    const y = lerp(0, 0.48, u)
    const bow = 0.13 * (1 - Math.pow((v - 0.5) * 2, 2))
    return new THREE.Vector3(x, y, bow - 0.26 * u)
  }
  for (let i = 0; i <= n; i++) pts.push(edge(i / n, 0))
  for (let i = 1; i <= n; i++) pts.push(edge(1, i / n))
  for (let i = n - 1; i >= 0; i--) pts.push(edge(i / n, 1))
  for (let i = n - 1; i >= 1; i--) pts.push(edge(0, i / n))
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 80, 0.014, 6, true)
}

export function createBadge(w: number, h: number, depth: number): THREE.BufferGeometry {
  const r = Math.min(w, h) * 0.22
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.4,
    bevelSize: r * 0.22,
    bevelSegments: 2,
  })
  g.translate(0, 0, -depth / 2)
  g.computeVertexNormals()
  return g
}

export function createSplitter(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-0.42, 0)
  s.lineTo(0.42, 0)
  s.lineTo(0.34, 0.16)
  s.lineTo(-0.34, 0.16)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.025,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 1,
  })
  g.rotateX(-Math.PI / 2)
  g.computeVertexNormals()
  return g
}

function kartPlan(nose: number, tail: number, waist: number): THREE.Shape {
  const s = new THREE.Shape()
  // Nose is -Y here. rotX(-90) maps that to +Z.
  s.moveTo(0, -nose)
  s.bezierCurveTo(waist * 0.85, -nose * 0.82, waist, -nose * 0.28, waist * 0.96, 0.02)
  s.bezierCurveTo(waist * 0.9, tail * 0.35, waist * 0.62, tail * 0.72, waist * 0.42, tail)
  s.lineTo(-waist * 0.42, tail)
  s.bezierCurveTo(-waist * 0.78, tail * 0.72, -waist * 0.92, tail * 0.35, -waist * 0.96, 0.02)
  s.bezierCurveTo(-waist, -nose * 0.28, -waist * 0.85, -nose * 0.82, 0, -nose)
  return s
}

function extrudePlan(shape: THREE.Shape, depth: number, y: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.09,
    bevelSize: 0.11,
    bevelSegments: 4,
    curveSegments: 18,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  g.computeVertexNormals()
  return g
}

/** Cream lower tub. Soft plan-view kart, not a stack of boxes. */
export function createLowerBody(): THREE.BufferGeometry {
  return extrudePlan(kartPlan(1.02, 0.96, 0.5), 0.28, 0.2)
}

/** Coral cowl with an open cockpit. */
export function createCowl(): THREE.BufferGeometry {
  const s = kartPlan(0.78, 0.7, 0.4)
  const hole = new THREE.Path()
  hole.absellipse(0, 0.08, 0.2, 0.28, 0, Math.PI * 2, true)
  s.holes.push(hole)
  return extrudePlan(s, 0.2, 0.46)
}

/** Thick geometric 7, standing in the XY plane. */
export function createSeven(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-0.12, 0.16)
  s.lineTo(0.16, 0.16)
  s.lineTo(0.16, 0.07)
  s.lineTo(-0.01, 0.07)
  s.lineTo(-0.12, -0.16)
  s.lineTo(-0.2, -0.12)
  s.lineTo(-0.06, 0.05)
  s.lineTo(-0.12, 0.05)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 1,
  })
  g.translate(0, 0, -0.02)
  g.computeVertexNormals()
  return g
}

export const monocoqueGeo = createMonocoque()
export const lowerBodyGeo = createLowerBody()
export const cowlGeo = createCowl()
export const sevenGeo = createSeven()
export const pontoonGeoL = createPontoon(-1)
export const pontoonGeoR = createPontoon(1)
export const tireGeo = createTire()
export const rimGeo = createRim()
export const spokeGeo = createSpoke()
export const capGeo = createCap()
export const wingGeo = createWing()
export const endplateGeo = createEndplate()
export const glassGeo = createWindshield()
export const glassFrameGeo = createGlassFrame()
export const numberBadgeGeo = createBadge(0.46, 0.4, 0.045)
export const numberBadgeBackGeo = createBadge(0.54, 0.48, 0.04)
export const flameGeo = createFlame()
export const lensGeo = createLens(0.062)
export const tailLensGeo = createLens(0.055)
export const exhaustGeo = createExhaust()
export const undertrayGeo = createUndertray()
export const seatBackGeo = createSeatBack()
export const chevronGeo = createChevron()
export const leafGeo = createLeaf()
export const splitterGeo = createSplitter()

export const anchors = {
  nose: surface(0.96, 0),
  hood: surface(0.75, 0),
  cockpit: surface(0.45, 0),
  tail: surface(0.07, 0),
}
