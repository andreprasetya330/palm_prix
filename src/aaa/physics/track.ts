/**
 * Queries for the Lagoon Loop ribbon.
 * Widths match the spline deck: asphalt ±3.62, curb faces at ±3.52–4.46,
 * sand shoulders to ±6.7, lagoon ellipse inside the loop.
 * The center grid slot is (0, 8) with yaw π. Do not move that spawn.
 */
import { clamp, finite } from './math'
import {
  CURB_0,
  CURB_1,
  GRID_POSE,
  LAGOON,
  SAND_1,
  TRACK_HALF,
  ellipseValue,
  projectTrack,
  type TrackProjection,
} from './spline'

export const KART_RADIUS = 0.72
/** Half-width to the outside of the tires. Keeps the body off the curb face. */
export const CHASSIS_REACH = 0.78
/** Center stays this far from the raised curb. */
export const RIBBON_LIMIT = CURB_0 - CHASSIS_REACH - 0.02

export type SurfaceKind = 'asphalt' | 'curb' | 'grass' | 'sand' | 'water'

export type Surface = {
  kind: SurfaceKind
  max: number
  grip: number
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

/** Infield trunks. Tube radius is small; the keep-out is the visible trunk, not the fronds. */
export const PALMS: readonly CircleObstacle[] = [
  { x: -8.2, z: 2.2, r: 0.26 },
  { x: -8.6, z: 6.8, r: 0.24 },
  { x: -9.1, z: 10.2, r: 0.28 },
  { x: -17.4, z: 7.6, r: 0.27 },
  { x: -16.8, z: 2.4, r: 0.24 },
  { x: -15.6, z: 11.2, r: 0.26 },
]

/** Gate pylons beside the grid, not on the center slot. */
export const PYLONS: readonly CircleObstacle[] = [
  { x: -5.35, z: 8.15, r: 0.62 },
  { x: 5.35, z: 8.15, r: 0.62 },
]

let heightSampler: ((x: number, z: number) => number) | null = null

export function usingDefaultGround(): boolean {
  return heightSampler === null
}

export function setTrackHeightSampler(fn: ((x: number, z: number) => number) | null): void {
  heightSampler = fn
}

export function gridPose(): { x: number; z: number; yaw: number } {
  return { x: GRID_POSE.x, z: GRID_POSE.z, yaw: GRID_POSE.yaw }
}

export { projectTrack, trackLength } from './spline'

function inWater(x: number, z: number): boolean {
  return ellipseValue(x, z, LAGOON.x, LAGOON.z, LAGOON.rx, LAGOON.rz) < 1
}

function inLagoonSand(x: number, z: number): boolean {
  return ellipseValue(x, z, LAGOON.x, LAGOON.z, LAGOON.rx * 1.38, LAGOON.rz * 1.42) < 1
}

export function groundHeight(x: number, z: number): number {
  if (heightSampler) {
    const sample = heightSampler(x, z)
    if (Number.isFinite(sample)) return clamp(sample, -5, 40)
  }
  const lat = Math.abs(projectTrack(x, z).lateral)
  if (lat >= CURB_0 && lat <= CURB_1) return 0.16
  return 0
}

export function surfaceAt(x: number, z: number): Surface {
  if (inWater(x, z)) return SURFACES.water
  const lat = Math.abs(projectTrack(x, z).lateral)
  if (lat <= TRACK_HALF) return SURFACES.asphalt
  if (lat <= CURB_1) return SURFACES.curb
  if (lat <= SAND_1 || inLagoonSand(x, z)) return SURFACES.sand
  return SURFACES.grass
}

export function overlapsCurb(x: number, z: number, reach = CHASSIS_REACH): boolean {
  const lat = Math.abs(projectTrack(x, z).lateral)
  return lat + reach > CURB_0 && lat - reach < CURB_1
}

export type Body = { x: number; z: number; vx: number; vz: number }
export type ContainResult = { clamped: boolean; hopped: boolean; pond: boolean }

function killAlong(body: Body, nx: number, nz: number, outward: boolean): void {
  const vn = body.vx * nx + body.vz * nz
  if (outward ? vn > 0 : vn < 0) {
    body.vx -= vn * nx
    body.vz -= vn * nz
  }
}

function placeLateral(body: Body, proj: TrackProjection, lateral: number): void {
  const delta = lateral - proj.lateral
  body.x += proj.rx * delta
  body.z += proj.rz * delta
}

function rejectLagoon(body: Body): boolean {
  const rx = LAGOON.rx
  const rz = LAGOON.rz
  let dx = body.x - LAGOON.x
  let dz = body.z - LAGOON.z
  let f = ellipseValue(body.x, body.z, LAGOON.x, LAGOON.z, rx, rz)
  if (f >= 1) return false
  let nx = dx / (rx * rx)
  let nz = dz / (rz * rz)
  let nlen = Math.hypot(nx, nz)
  if (nlen < 1e-6) {
    nx = 1
    nz = 0
    nlen = 1
  }
  nx /= nlen
  nz /= nlen
  // Step out until the center clears the water. A few iterations covers a deep splash.
  for (let i = 0; i < 8 && f < 1.02; i++) {
    const step = 0.35 + (1.02 - f) * 1.4
    body.x += nx * step
    body.z += nz * step
    dx = body.x - LAGOON.x
    dz = body.z - LAGOON.z
    f = ellipseValue(body.x, body.z, LAGOON.x, LAGOON.z, rx, rz)
    nx = dx / (rx * rx)
    nz = dz / (rz * rz)
    nlen = Math.hypot(nx, nz) || 1
    nx /= nlen
    nz /= nlen
  }
  killAlong(body, nx, nz, false)
  body.vx *= 0.82
  body.vz *= 0.82
  return true
}

/**
 * Grounded karts slide off the raised curb instead of parking in the mesh.
 * A hard outward launch hops. The lagoon is a hard reject.
 * Sand and grass stay drivable so those surfaces can read.
 */
export function containKart(
  body: Body,
  airborne: boolean,
  _outward: number,
  canHop: boolean,
): ContainResult {
  const result: ContainResult = { clamped: false, hopped: false, pond: false }
  if (rejectLagoon(body)) {
    result.pond = true
    result.clamped = true
  }
  if (airborne) return result

  const proj = projectTrack(body.x, body.z)
  const lat = proj.lateral
  const abs = Math.abs(lat)
  const inBand = abs > RIBBON_LIMIT && abs < CURB_1 + 0.45
  if (!inBand) return result

  const vn = body.vx * proj.rx + body.vz * proj.rz
  const outward = vn * Math.sign(lat || 1)
  if (canHop && outward > 14 && abs > RIBBON_LIMIT + 0.2) {
    result.hopped = true
    return result
  }
  placeLateral(body, proj, Math.sign(lat || 1) * RIBBON_LIMIT)
  killAlong(body, proj.rx * Math.sign(lat || 1), proj.rz * Math.sign(lat || 1), true)
  result.clamped = true
  return result
}

const SKIN = 0.04
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

/** Gate pylons stand beside the straight. A nose-on hit slides off in X instead of stopping. */
function slidePylon(body: Body, c: CircleObstacle): boolean {
  const reach = c.r + KART_RADIUS + SKIN
  const dx = body.x - c.x
  const dz = body.z - c.z
  if (dx * dx + dz * dz >= reach * reach) return false
  const xDir = Math.abs(dx) > 0.12 ? Math.sign(dx) : Math.sign(c.x || 1)
  body.x = c.x + xDir * (reach + 0.06)
  const ndx = body.x - c.x
  const ndz = body.z - c.z
  const nd = Math.hypot(ndx, ndz) || 1
  const nx = ndx / nd
  const nz = ndz / nd
  const vn = body.vx * nx + body.vz * nz
  if (vn < 0) {
    body.vx -= vn * nx
    body.vz -= vn * nz
  }
  return true
}

/** Slide off palms and gate pylons. Tangent speed stays. */
export function resolveCollisions(body: Body): number {
  let hits = 0
  for (let pass = 0; pass < 3; pass++) {
    let hit = false
    for (const c of PALMS) hit = pushCircle(body, c, KART_RADIUS) || hit
    for (const c of PYLONS) hit = slidePylon(body, c) || hit
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

export function ribbonBoost(_x: number, _z: number, lock: number): { lock: number; hit: boolean } {
  return { lock, hit: false }
}
