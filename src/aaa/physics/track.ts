/**
 * Queries for the Palm Prix oval built in `src/scene/Track.tsx` / `TrackProps.tsx`.
 * Radii match that mesh (x scaled by 1.15). Colliders are original approximations
 * of those props so the kart slides on what the player sees.
 */
import { clamp, finite } from './math'

export const OVAL_X_SCALE = 1.15
export const KART_RADIUS = 0.72

const ASPHALT_INNER = 14.2
const ASPHALT_OUTER = 21.8
const CURB_INNER_0 = 13.35
const CURB_OUTER_1 = 22.7

export type SurfaceKind = 'asphalt' | 'curb' | 'grass' | 'sand' | 'water'

export type Surface = {
  kind: SurfaceKind
  /** Cruising cap before boost (units / second). */
  max: number
  /** Lateral grip rate (1/s). High = sticks, low = slide. */
  grip: number
  /** How fast speed above `max` is pulled back down. */
  overDrag: number
  coast: number
  boostScale: number
}

const SURFACES: Record<SurfaceKind, Surface> = {
  asphalt: { kind: 'asphalt', max: 28, grip: 14, overDrag: 16, coast: 6.5, boostScale: 1.45 },
  curb: { kind: 'curb', max: 24, grip: 8.5, overDrag: 20, coast: 8, boostScale: 1.28 },
  grass: { kind: 'grass', max: 12.5, grip: 12, overDrag: 36, coast: 14, boostScale: 1.12 },
  sand: { kind: 'sand', max: 9, grip: 10, overDrag: 42, coast: 18, boostScale: 1.06 },
  water: { kind: 'water', max: 6.5, grip: 8, overDrag: 50, coast: 22, boostScale: 1.04 },
}

export type CircleObstacle = { x: number; z: number; r: number }
export type BoxObstacle = { x: number; z: number; yaw: number; hx: number; hz: number }

export function ovalRadius(x: number, z: number): number {
  return Math.hypot(x / OVAL_X_SCALE, z)
}

export function ovalAngle(x: number, z: number): number {
  return Math.atan2(x / OVAL_X_SCALE, z)
}

/** Outward unit normal of the oval radius field. */
export function ovalNormal(x: number, z: number): { x: number; z: number } {
  const s = OVAL_X_SCALE
  const r = Math.max(1e-4, ovalRadius(x, z))
  const gx = x / (s * s * r)
  const gz = z / r
  const g = Math.hypot(gx, gz) || 1
  return { x: gx / g, z: gz / g }
}

/** Unit tangent in the race direction (increasing oval angle). */
export function ovalTangent(x: number, z: number): { x: number; z: number } {
  const t = ovalAngle(x, z)
  const tx = Math.cos(t) * OVAL_X_SCALE
  const tz = -Math.sin(t)
  const m = Math.hypot(tx, tz) || 1
  return { x: tx / m, z: tz / m }
}

/** Start grid just before the finish stripe, pointed down the racing line. */
export function gridPose(): { x: number; z: number; yaw: number } {
  const t = -0.5
  const r = 18
  const x = Math.sin(t) * r * OVAL_X_SCALE
  const z = Math.cos(t) * r
  const tangent = ovalTangent(x, z)
  return { x, z, yaw: Math.atan2(tangent.x, tangent.z) }
}

let heightSampler: ((x: number, z: number) => number) | null = null

/**
 * Optional elevation. When set, it replaces the default curb height field.
 * Non-finite samples are ignored. Pass null to restore the built-in field.
 */
export function setTrackHeightSampler(
  fn: ((x: number, z: number) => number) | null,
): void {
  heightSampler = fn
}

function curbHeight(x: number, z: number): number {
  const r = ovalRadius(x, z)
  if ((r >= CURB_INNER_0 && r < ASPHALT_INNER) || (r > ASPHALT_OUTER && r <= CURB_OUTER_1)) {
    return 0.16
  }
  return 0
}

export function groundHeight(x: number, z: number): number {
  if (heightSampler) {
    const sample = heightSampler(x, z)
    if (Number.isFinite(sample)) return clamp(sample, -5, 40)
  }
  return curbHeight(x, z)
}

export function surfaceAt(x: number, z: number): Surface {
  if (Math.hypot(x, z) < 4.2) return SURFACES.water
  if (Math.hypot(x + 26, z - 8) < 5.5) return SURFACES.sand
  if (Math.hypot(x - 24, z + 14) < 4.2) return SURFACES.sand
  const r = ovalRadius(x, z)
  if (r >= ASPHALT_INNER && r <= ASPHALT_OUTER) return SURFACES.asphalt
  if ((r >= CURB_INNER_0 && r < ASPHALT_INNER) || (r > ASPHALT_OUTER && r <= CURB_OUTER_1)) {
    return SURFACES.curb
  }
  return SURFACES.grass
}

function ovalPoint(t: number, r: number): { x: number; z: number } {
  return { x: Math.sin(t) * r * OVAL_X_SCALE, z: Math.cos(t) * r }
}

export const BARRIERS: readonly BoxObstacle[] = Array.from({ length: 36 }, (_, i) => {
  const t = (i / 36) * Math.PI * 2
  const p = ovalPoint(t, 24.1)
  return { x: p.x, z: p.z, yaw: -t, hx: 1.55 / 2, hz: 0.4 / 2 }
})

/** Start-line arch posts. World positions match the group at z = 18. */
export const PILLARS: readonly BoxObstacle[] = [
  { x: -3.4, z: 18, yaw: 0, hx: 0.28, hz: 0.28 },
  { x: 3.4, z: 18, yaw: 0, hx: 0.28, hz: 0.28 },
]

export const TRUNKS: readonly CircleObstacle[] = (() => {
  const list: CircleObstacle[] = []
  for (let i = 0; i < 18; i++) {
    const t = (i / 18) * Math.PI * 2
    const r = 28 + (i % 3) * 2.2
    const s = 0.85 + (i % 4) * 0.12
    const p = ovalPoint(t, r)
    list.push({ x: p.x, z: p.z, r: 0.34 * s })
  }
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + 0.3
    const p = ovalPoint(t, 7.5)
    list.push({ x: p.x, z: p.z, r: 0.34 * 0.7 })
  }
  return list
})()

export const HILLS: readonly CircleObstacle[] = [
  { x: -38, z: -20, r: 6 * 1.4 * 0.92 },
  { x: -32, z: -28, r: 6 * 1.1 * 0.92 },
  { x: 36, z: -16, r: 6 * 1.25 * 0.92 },
  { x: 40, z: 10, r: 6 * 0.95 * 0.92 },
]

/** Floating item boxes along the racing line — driving through one is a speed ribbon. */
export const BOOST_PADS: readonly { x: number; z: number; r: number }[] = [0.35, 1.05, 1.75, 2.45].map(
  (t) => {
    const p = ovalPoint(t, 18)
    return { x: p.x, z: p.z, r: 1.25 }
  },
)

export type Body = { x: number; z: number; vx: number; vz: number }

const SKIN = 0.02
const BOUND = 54

function pushCircle(body: Body, c: CircleObstacle, radius: number): boolean {
  const dx = body.x - c.x
  const dz = body.z - c.z
  const min = c.r + radius
  const d2 = dx * dx + dz * dz
  const reach = min + SKIN
  if (d2 >= reach * reach) return false
  const d = Math.sqrt(Math.max(d2, 0))
  let nx = 1
  let nz = 0
  if (d > 1e-6) {
    nx = dx / d
    nz = dz / d
  }
  const pen = Math.min(2.5, reach - d)
  body.x += nx * pen
  body.z += nz * pen
  const vn = body.vx * nx + body.vz * nz
  if (vn < 0) {
    body.vx -= vn * nx
    body.vz -= vn * nz
  }
  return true
}

function pushBox(body: Body, box: BoxObstacle, radius: number): boolean {
  const dx = body.x - box.x
  const dz = body.z - box.z
  const c = Math.cos(box.yaw)
  const s = Math.sin(box.yaw)
  let lx = dx * c + dz * s
  let lz = -dx * s + dz * c
  const clx = clamp(lx, -box.hx, box.hx)
  const clz = clamp(lz, -box.hz, box.hz)
  const ox = lx - clx
  const oz = lz - clz
  const d2 = ox * ox + oz * oz
  const reach = radius + SKIN
  if (d2 >= reach * reach) return false

  let nx: number
  let nz: number
  let pen: number
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2)
    nx = ox / d
    nz = oz / d
    pen = Math.min(2.5, reach - d)
  } else {
    const penL = lx + box.hx
    const penR = box.hx - lx
    const penN = lz + box.hz
    const penF = box.hz - lz
    const minPen = Math.min(penL, penR, penN, penF)
    if (minPen === penL) {
      nx = -1
      nz = 0
      pen = penL + reach
    } else if (minPen === penR) {
      nx = 1
      nz = 0
      pen = penR + reach
    } else if (minPen === penN) {
      nx = 0
      nz = -1
      pen = penN + reach
    } else {
      nx = 0
      nz = 1
      pen = penF + reach
    }
    pen = Math.min(2.5, pen)
  }

  lx += nx * pen
  lz += nz * pen
  body.x = box.x + (lx * c - lz * s)
  body.z = box.z + (lx * s + lz * c)

  const wnx = nx * c - nz * s
  const wnz = nx * s + nz * c
  const vn = body.vx * wnx + body.vz * wnz
  if (vn < 0) {
    body.vx -= vn * wnx
    body.vz -= vn * wnz
  }
  return true
}

function pushBounds(body: Body): void {
  if (body.x > BOUND) {
    body.x = BOUND
    if (body.vx > 0) body.vx = 0
  } else if (body.x < -BOUND) {
    body.x = -BOUND
    if (body.vx < 0) body.vx = 0
  }
  if (body.z > BOUND) {
    body.z = BOUND
    if (body.vz > 0) body.vz = 0
  } else if (body.z < -BOUND) {
    body.z = -BOUND
    if (body.vz < 0) body.vz = 0
  }
}

/** Slide the body out of walls, trunks, hills, and the map edge. Keeps tangent speed. */
export function resolveCollisions(body: Body): number {
  let hits = 0
  for (let pass = 0; pass < 3; pass++) {
    let hit = false
    for (const box of BARRIERS) hit = pushBox(body, box, KART_RADIUS) || hit
    for (const box of PILLARS) hit = pushBox(body, box, KART_RADIUS) || hit
    for (const c of TRUNKS) hit = pushCircle(body, c, KART_RADIUS) || hit
    for (const c of HILLS) hit = pushCircle(body, c, KART_RADIUS) || hit
    pushBounds(body)
    if (hit) hits += 1
    if (!hit) break
  }
  body.vx = clamp(finite(body.vx), -52, 52)
  body.vz = clamp(finite(body.vz), -52, 52)
  body.x = clamp(finite(body.x), -BOUND, BOUND)
  body.z = clamp(finite(body.z), -BOUND, BOUND)
  return hits
}

export function ribbonBoost(x: number, z: number, lock: number): { lock: number; hit: boolean } {
  let next = lock
  let hit = false
  for (let i = 0; i < BOOST_PADS.length; i++) {
    const pad = BOOST_PADS[i]
    const bit = 1 << i
    const overlapping = Math.hypot(x - pad.x, z - pad.z) < pad.r + 0.35
    if (overlapping) {
      if ((next & bit) === 0) {
        next |= bit
        hit = true
      }
    } else {
      next &= ~bit
    }
  }
  return { lock: next, hit }
}
