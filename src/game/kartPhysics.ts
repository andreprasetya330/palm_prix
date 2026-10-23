import type { ControlState } from './controlState'
import { getTrackSample, nearestTrack, ROAD_HALF_WIDTH } from './trackLayout'

export type KartState = {
  x: number; z: number; yaw: number; speed: number; boostTimer: number
  boostCooldown?: number; steering?: number; offroad?: boolean
  vx?: number; vz?: number; slip?: number
}
const spawn = getTrackSample(0.988)
export const DEFAULT_KART: KartState = { x: spawn.point.x, z: spawn.point.z, yaw: spawn.yaw, speed: 0, boostTimer: 0, boostCooldown: 0, steering: 0, vx: 0, vz: 0, slip: 0 }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
/** Velocity-based arcade chassis: longitudinal traction, lateral tire grip, progressive steering. */
export function stepKart(kart: KartState, control: ControlState, delta: number): KartState {
  if (!Number.isFinite(delta) || delta <= 0) return kart
  const dt = Math.min(delta, 0.05)
  let result = kart
  const steps = Math.ceil(dt / (1 / 120))
  for (let i = 0; i < steps; i++) result = integrate(result, { ...control, item: i === 0 && control.item }, dt / steps)
  return result
}
function integrate(kart: KartState, control: ControlState, dt: number): KartState {
  let { x, z, yaw, boostTimer } = kart
  let boostCooldown = Math.max(0, (kart.boostCooldown ?? 0) - dt)
  const steering = (kart.steering ?? 0) + (clamp(control.steer, -1, 1) - (kart.steering ?? 0)) * (1 - Math.exp(-9 * dt))
  const offroad = nearestTrack(x, z).distance > ROAD_HALF_WIDTH
  if (control.item && boostCooldown <= 0) { boostTimer = 1.35; boostCooldown = 5 }
  boostTimer = Math.max(0, boostTimer - dt)
  const forwardX = Math.sin(yaw), forwardZ = Math.cos(yaw)
  let vx = kart.vx ?? forwardX * kart.speed, vz = kart.vz ?? forwardZ * kart.speed
  // Also support callers resetting speed without explicitly resetting velocity.
  if (Math.abs(kart.speed) > 0.01 && Math.hypot(vx, vz) < 0.001) { vx = forwardX * kart.speed; vz = forwardZ * kart.speed }
  let longitudinal = vx * forwardX + vz * forwardZ
  let lateral = vx * forwardZ - vz * forwardX
  const maxSpeed = offroad ? 12 : boostTimer > 0 ? 38 : 28
  const throttle = clamp(control.throttle, 0, 1), brake = clamp(control.brake, 0, 1)
  if (brake > 0.1) longitudinal -= Math.sign(longitudinal) * Math.min(Math.abs(longitudinal), brake * 34 * dt)
  else if (throttle > 0.05) longitudinal += 23 * throttle * Math.max(0.12, 1 - Math.max(0, longitudinal) / (maxSpeed * 1.15)) * dt
  else longitudinal -= Math.sign(longitudinal) * Math.min(Math.abs(longitudinal), 4 * dt)
  if (longitudinal > maxSpeed) longitudinal = Math.max(maxSpeed, longitudinal - (offroad ? 32 : 15) * dt)
  const turning = steering * Math.min(1, Math.abs(longitudinal) / 7)
  const yawRate = -turning * (1.75 - Math.min(0.45, Math.abs(longitudinal) / 70)) * Math.sign(longitudinal || 1)
  yaw += yawRate * dt
  // Tires scrub speed in hard turns; braking allows a controlled rear slide.
  const grip = offroad ? 5 : brake > 0.1 && longitudinal > 10 ? 4.5 : 11
  lateral *= Math.exp(-grip * dt)
  longitudinal *= Math.exp(-Math.abs(turning) * Math.abs(lateral) * 0.008 * dt)
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
  return { x, z, yaw, speed, boostTimer, boostCooldown, steering, offroad, vx, vz, slip: Math.atan2(lateral, Math.max(1, Math.abs(longitudinal))) }
}

