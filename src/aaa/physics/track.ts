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

/**
 * Center slot under the start arch (the gate sits on z = 18).
 * Faces +X, down the start straight, on asphalt, clear of the posts at x = ±3.4.
 */
export function gridPose(): { x: number; z: number; yaw: number } {
  return { x: -0.35, z: 18, yaw: Math.PI / 2 }
}

/** Kart-center band. The body stays off the curb blocks inside this range. */
export const RIBBON_INNER = 14.95
export const RIBBON_OUTER = 20.9
/**
 * Continuous slide rail just inside the barrier blocks (centers at oval r = 24.1).
 * Discrete posts snag the chassis; the rail keeps tangent speed and stays out of the palms.
 */
export const BARRIER_WALL = 23.15
const CURB_OUTER_END = 22.75
/** Half-extent of the chassis in the ground plane, used for curb clearance. */
export const CHASSIS_REACH = 0.92

let heightSampler: ((x: number, z: number) => number) | null = null

/** Custom elevation replaces the oval ribbon walls so a sampler can shape the drive. */
export function usingDefaultGround(): boolean {
  return heightSampler === null
}

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

/** Candy curb blocks, same layout as `Track.tsx` (56 per edge). */
export const CURBS: readonly BoxObstacle[] = (() => {
  const list: BoxObstacle[] = []
  const count = 56
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2
    const yaw = -t
    const hx = 1.15 / 2
    const hz = 0.55 / 2
    const outer = ovalPoint(t, 22.35)
    const inner = ovalPoint(t, 13.65)
    list.push({ x: outer.x, z: outer.z, yaw, hx, hz })
    list.push({ x: inner.x, z: inner.z, yaw, hx, hz })
  }
  return list
})()

export function overlapsBox(x: number, z: number, box: BoxObstacle, radius: number): boolean {
  const dx = x - box.x
  const dz = z - box.z
  const c = Math.cos(box.yaw)
  const s = Math.sin(box.yaw)
  const lx = dx * c + dz * s
  const lz = -dx * s + dz * c
  const clx = clamp(lx, -box.hx, box.hx)
  const clz = clamp(lz, -box.hz, box.hz)
  const ox = lx - clx
  const oz = lz - clz
  return ox * ox + oz * oz < radius * radius
}

export function overlapsAnyCurb(x: number, z: number, radius = CHASSIS_REACH): boolean {
  for (const box of CURBS) {
    if (overlapsBox(x, z, box, radius)) return true
  }
  return false
}

export type ContainResult = { clamped: boolean; hopped: boolean; pond: boolean }

function placeOnRadius(body: Body, radius: number): void {
  const t = ovalAngle(body.x, body.z)
  body.x = Math.sin(t) * radius * OVAL_X_SCALE
  body.z = Math.cos(t) * radius
}

function killRadial(body: Body, outward: boolean): void {
  const n = ovalNormal(body.x, body.z)
  const vn = body.vx * n.x + body.vz * n.z
  if (outward ? vn > 0 : vn < 0) {
    body.vx -= vn * n.x
    body.vz -= vn * n.z
  }
}

/**
 * Keep a grounded kart on the asphalt ribbon.
 * Outer curb: slide back onto the lane, or hop if you're launching over it.
 * Inner side and the pond: hard reject onto the lane. Never sit on the blue disc.
 * Barrier blocks and palm trunks stay outside a slide rail.
 */
export function containKart(
  body: Body,
  airborne: boolean,
  _outward: number,
  _canHop: boolean,
): ContainResult {
  const result: ContainResult = { clamped: false, hopped: false, pond: false }
  let r = ovalRadius(body.x, body.z)

  if (r > BARRIER_WALL) {
    placeOnRadius(body, BARRIER_WALL)
    killRadial(body, true)
    result.clamped = true
    r = BARRIER_WALL
  }

  if (r < RIBBON_INNER && (!airborne || r < 13.5)) {
    result.pond = r < 8 || Math.hypot(body.x, body.z) < 4.6
    placeOnRadius(body, RIBBON_INNER)
    killRadial(body, false)
    result.clamped = true
    return result
  }

  if (!airborne && r > RIBBON_OUTER && r < CURB_OUTER_END) {
    placeOnRadius(body, RIBBON_OUTER)
    killRadial(body, true)
    result.clamped = true
  }

  // Still inside a curb block: shove back onto the lane. Do not park in the mesh.
  if (!airborne && overlapsAnyCurb(body.x, body.z)) {
    const rr = ovalRadius(body.x, body.z)
    placeOnRadius(body, rr >= 18 ? RIBBON_OUTER : RIBBON_INNER)
    killRadial(body, rr >= 18)
    result.clamped = true
  }
  return result
}

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

/**
 * Arch posts sit on the start-line center. Separate in Z so a kart driving the
 * straight slides past the post instead of stopping dead against it.
 */
export function passGate(body: Body): void {
  const reach = 0.86
  for (const post of PILLARS) {
    const min = post.hx + reach
    let dx = body.x - post.x
    let dz = body.z - post.z
    let d = Math.hypot(dx, dz)
    if (d >= min) continue
    const zDir = dz > 0.15 ? 1 : -1
    body.z += zDir * (min - Math.abs(dz) + 0.06)
    dx = body.x - post.x
    dz = body.z - post.z
    d = Math.hypot(dx, dz) || 1
    if (d < min) {
      const xDir = dx >= 0 ? 1 : -1
      body.x += xDir * (min - d + 0.02)
      dx = body.x - post.x
      dz = body.z - post.z
      d = Math.hypot(dx, dz) || 1
    }
    const nx = dx / d
    const nz = dz / d
    const vn = body.vx * nx + body.vz * nz
    if (vn < 0) {
      body.vx -= vn * nx
      body.vz -= vn * nz
    }
  }
}

/** Slide the body out of walls, trunks, hills, and the map edge. Keeps tangent speed. */
export function resolveCollisions(body: Body): number {
  let hits = 0
  for (let pass = 0; pass < 3; pass++) {
    let hit = false
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
