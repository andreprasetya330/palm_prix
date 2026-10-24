import type { ControlState } from './controlState'
import { getTrackSample, nearestTrack, ROAD_HALF_WIDTH } from './trackLayout'

export type KartState = {
  x: number; z: number; yaw: number; speed: number; boostTimer: number
  boostCooldown?: number; steering?: number; offroad?: boolean
  vx?: number; vz?: number; slip?: number
  drifting?: boolean; driftCharge?: number; driftDirection?: number
  physicsRemainder?: number; pendingItem?: boolean
  previousX?: number; previousZ?: number; previousYaw?: number
}
const spawn = getTrackSample(0.988)
export const DEFAULT_KART: KartState = { x: spawn.point.x, z: spawn.point.z, yaw: spawn.yaw, speed: 0, boostTimer: 0, boostCooldown: 0, steering: 0, vx: 0, vz: 0, slip: 0 }
export const KART_TOP_SPEED = 34
export const KART_BOOST_SPEED = 46
export const FIXED_STEP = 1 / 120
export function driftTier(charge: number) { return charge >= 2.5 ? 3 : charge >= 1.5 ? 2 : charge >= 0.65 ? 1 : 0 }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
/** Velocity-based arcade chassis: longitudinal traction, lateral tire grip, progressive steering. */
export function stepKart(kart: KartState, control: ControlState, delta: number): KartState {
  if (!Number.isFinite(delta) || delta <= 0) return kart
  let accumulated = (kart.physicsRemainder ?? 0) + Math.min(delta, 0.05)
  let pendingItem = !!kart.pendingItem || control.item
  let result = kart
  while (accumulated + 1e-10 >= FIXED_STEP) {
    result = integrate(result, { ...control, item: pendingItem }, FIXED_STEP)
    pendingItem = false
    accumulated -= FIXED_STEP
  }
  return { ...result, physicsRemainder: Math.max(0, accumulated), pendingItem }
}
function integrate(kart: KartState, control: ControlState, dt: number): KartState {
  let { x, z, yaw, boostTimer } = kart
  let boostCooldown = Math.max(0, (kart.boostCooldown ?? 0) - dt)
  const steering = (kart.steering ?? 0) + (clamp(control.steer, -1, 1) - (kart.steering ?? 0)) * (1 - Math.exp(-16 * dt))
  const offroad = nearestTrack(x, z).distance > ROAD_HALF_WIDTH
  if (control.item && boostCooldown <= 0) { boostTimer = 1.35; boostCooldown = 5 }
  boostTimer = Math.max(0, boostTimer - dt)
  const forwardX = Math.sin(yaw), forwardZ = Math.cos(yaw)
  let vx = kart.vx ?? forwardX * kart.speed, vz = kart.vz ?? forwardZ * kart.speed
  // Also support callers resetting speed without explicitly resetting velocity.
  if (Math.abs(kart.speed) > 0.01 && Math.hypot(vx, vz) < 0.001) { vx = forwardX * kart.speed; vz = forwardZ * kart.speed }
  let longitudinal = vx * forwardX + vz * forwardZ
  let lateral = vx * forwardZ - vz * forwardX
  let drifting = !!kart.drifting
  let driftCharge = kart.driftCharge ?? 0
  let driftDirection = kart.driftDirection ?? 0
  if (!drifting && control.drift && Math.abs(steering) > 0.18 && longitudinal > 12 && !offroad && control.brake < 0.1) {
    drifting = true; driftDirection = Math.sign(steering); driftCharge = 0
  }
  if (drifting && (!control.drift || longitudinal < 8 || offroad || control.brake > 0.1)) {
    // Grass, braking, and stalling cancel the charge; a deliberate release rewards it.
    if (!control.drift && !offroad && longitudinal >= 8 && control.brake < 0.1) {
      const tier = driftTier(driftCharge)
      if (tier > 0) boostTimer = Math.max(boostTimer, [0, 0.6, 1.05, 1.6][tier])
    }
    drifting = false; driftCharge = 0; driftDirection = 0
  }
  if (drifting) driftCharge = Math.min(3, driftCharge + dt * (0.65 + Math.abs(steering) * 0.6))
  const maxSpeed = offroad ? 14 : boostTimer > 0 ? KART_BOOST_SPEED : KART_TOP_SPEED
  const throttle = clamp(control.throttle, 0, 1), brake = clamp(control.brake, 0, 1)
  if (brake > 0.1) longitudinal -= Math.sign(longitudinal) * Math.min(Math.abs(longitudinal), brake * 40 * dt)
  else if (throttle > 0.05 && longitudinal < maxSpeed) longitudinal = Math.min(maxSpeed, longitudinal + (boostTimer > 0 ? 34 : 19.5) * throttle * (1 - 0.25 * clamp(longitudinal / maxSpeed, 0, 1)) * dt)
  else if (throttle <= 0.05) longitudinal -= Math.sign(longitudinal) * Math.min(Math.abs(longitudinal), 4 * dt)
  if (longitudinal > maxSpeed) longitudinal = Math.max(maxSpeed, longitudinal - (offroad ? 32 : 15) * dt)
  const turning = (drifting ? steering * 0.88 + driftDirection * 0.22 : steering) * Math.min(1, Math.abs(longitudinal) / 7)
  const yawRate = -turning * (2.8 - Math.min(0.45, Math.abs(longitudinal) / 100)) * Math.sign(longitudinal || 1)
  yaw += yawRate * dt
  // Tires scrub speed in hard turns; braking allows a controlled rear slide.
  const grip = offroad ? 8 : drifting ? 7 : 24
  lateral *= Math.exp(-grip * dt)
  longitudinal *= Math.exp(-Math.abs(turning) * Math.abs(lateral) * 0.003 * dt)
  vx = forwardX * longitudinal + forwardZ * lateral
  vz = forwardZ * longitudinal - forwardX * lateral
  x += vx * dt; z += vz * dt
  const road = nearestTrack(x, z)
  const limit = ROAD_HALF_WIDTH + 1.65
  if (road.distance > limit) {
    const side = Math.sign(road.signedDistance) || 1
    x = road.point.x + road.normal.x * limit * side
    z = road.point.z + road.normal.z * limit * side
    const outward = (vx * road.normal.x + vz * road.normal.z) * side
    if (outward > 0) { vx -= road.normal.x * outward * side * 1.12; vz -= road.normal.z * outward * side * 1.12 }
    vx *= Math.exp(-3 * dt); vz *= Math.exp(-3 * dt)
  }
  const speed = vx * Math.sin(yaw) + vz * Math.cos(yaw)
  return { previousX:kart.x, previousZ:kart.z, previousYaw:kart.yaw, x, z, yaw, speed, boostTimer, boostCooldown, steering, offroad, vx, vz, drifting, driftCharge, driftDirection, slip: Math.atan2(lateral, Math.max(1, Math.abs(longitudinal))) }
}



