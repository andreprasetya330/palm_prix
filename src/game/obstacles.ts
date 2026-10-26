import { getTrackSample, getTrackSurface, ROAD_HALF_WIDTH } from './trackLayout'
import type { KartState } from './kartPhysics'

export const OBSTACLES = [
  { id: 'waterfront-works', t: .18, lane: -3.5, radius: 1.25, moving: false },
  { id: 'tunnel-works', t: .48, lane: 3.5, radius: 1.25, moving: false },
  { id: 'traffic-drone', t: .72, lane: 0, radius: 1.15, moving: true },
] as const
export type ObstacleState = { cooldowns: number[]; hits: number; lastHit: string | null; flashTimer: number }
export function createObstacleState(): ObstacleState { return { cooldowns: OBSTACLES.map(() => 0), hits: 0, lastHit: null, flashTimer: 0 } }
/** Visuals and collision use the same slow, predictable lane motion. */
export function getObstaclePose(index: number, elapsed: number) {
  const obstacle = OBSTACLES[index], s = getTrackSample(obstacle.t)
  const lane = obstacle.moving ? Math.sin(elapsed * .42) * 3.5 : obstacle.lane
  const surface=getTrackSurface(obstacle.t,lane)
  return { x: s.point.x + s.normal.x * lane, y:surface.height, z: s.point.z + s.normal.z * lane, yaw: s.yaw, pitch:surface.pitch, bank:surface.bank, radius: obstacle.radius, lane }
}
const KART_RADIUS = .65
/** Mutates state/kart. Call after each movement with pre-move x/z and end-of-step race time. */
export function updateObstacles(state: ObstacleState, kart: KartState, previousX: number, previousZ: number, elapsed: number, dt: number): boolean {
  if (!Number.isFinite(dt) || dt <= 0) return false
  state.flashTimer = Math.max(0, state.flashTimer - dt)
  let hit = false
  OBSTACLES.forEach((obstacle, i) => {
    state.cooldowns[i] = Math.max(0, state.cooldowns[i] - dt)
    const now = getObstaclePose(i, elapsed), before = getObstaclePose(i, Math.max(0, elapsed - dt))
    const ax = previousX - before.x, az = previousZ - before.z
    const bx = kart.x - now.x, bz = kart.z - now.z
    const dx = bx - ax, dz = bz - az, radius = obstacle.radius + KART_RADIUS
    const a = dx * dx + dz * dz, b = 2 * (ax * dx + az * dz), c = ax * ax + az * az - radius * radius
    let contact = -1
    if (c <= 0) contact = 0
    else if (a > 1e-12) {
      const discriminant = b * b - 4 * a * c
      if (discriminant >= 0) { const t = (-b - Math.sqrt(discriminant)) / (2 * a); if (t >= 0 && t <= 1) contact = t }
    }
    if (contact < 0) return
    let nx = ax + dx * contact, nz = az + dz * contact
    let length = Math.hypot(nx, nz)
    if (length < 1e-6) { const s = getTrackSample(obstacle.t); nx = s.normal.x; nz = s.normal.z; length = 1 }
    nx /= length; nz /= length
    // Resolve position every time, but don't repeatedly punish a driver resting against a barrier.
    kart.x = now.x + nx * (radius + .015); kart.z = now.z + nz * (radius + .015)
    let vx = kart.vx ?? Math.sin(kart.yaw) * kart.speed, vz = kart.vz ?? Math.cos(kart.yaw) * kart.speed
    const inward = vx * nx + vz * nz
    if (inward < 0) { vx -= inward * nx; vz -= inward * nz }
    if (state.cooldowns[i] <= 0) {
      vx *= .55; vz *= .55; state.hits++; state.lastHit = obstacle.id; state.flashTimer = .45; state.cooldowns[i] = .8; hit = true
      kart.boostTimer = 0; kart.driftCharge = 0; kart.drifting = false
    }
    kart.vx = vx; kart.vz = vz; kart.speed = vx * Math.sin(kart.yaw) + vz * Math.cos(kart.yaw)
    kart.previousX = kart.x; kart.previousZ = kart.z
  })
  return hit
}
/** Collision diameter leaves at least two thirds of the full road unobstructed. */
export const MIN_CLEAR_ROAD = ROAD_HALF_WIDTH * 2 - Math.max(...OBSTACLES.map(o => o.radius * 2))
