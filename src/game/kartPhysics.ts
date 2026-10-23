import type { ControlState } from './controlState'

export type KartState = {
  x: number; z: number; yaw: number; speed: number; boostTimer: number
  boostCooldown?: number; steering?: number; offroad?: boolean
}
export const DEFAULT_KART: KartState = { x: -3, z: 18, yaw: Math.PI / 2, speed: 0, boostTimer: 0, boostCooldown: 0, steering: 0 }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
/** Semi-implicit arcade dynamics with speed-sensitive steering and recoverable barriers. */
export function stepKart(kart: KartState, control: ControlState, delta: number): KartState {
  if (!Number.isFinite(delta) || delta <= 0) return kart
  const dt = Math.min(delta, 0.05)
  let { x, z, yaw, speed, boostTimer } = kart
  let boostCooldown = Math.max(0, (kart.boostCooldown ?? 0) - dt)
  const steering = (kart.steering ?? 0) + (clamp(control.steer, -1, 1) - (kart.steering ?? 0)) * (1 - Math.exp(-10 * dt))
  const radius = Math.hypot(x / 1.15, z)
  const offroad = radius < 14.1 || radius > 21.9
  if (control.item && boostCooldown === 0) { boostTimer = 1.35; boostCooldown = 5 }
  boostTimer = Math.max(0, boostTimer - dt)
  const maxSpeed = offroad ? 11 : boostTimer > 0 ? 38 : 27
  if (control.brake > 0.1) speed = Math.max(-5, speed - 32 * control.brake * dt)
  else if (control.throttle > 0.05) speed += 19 * clamp(control.throttle, 0, 1) * dt
  else speed -= Math.sign(speed) * Math.min(Math.abs(speed), 5 * dt)
  if (speed > maxSpeed) speed = Math.max(maxSpeed, speed - (offroad ? 28 : 12) * dt)
  speed = clamp(speed, -5, 40)
  // Positive input is screen-right; +Y yaw turns the forward +Z axis left.
  yaw -= steering * (1.65 - Math.min(0.35, Math.abs(speed) / 100)) * Math.min(1, Math.abs(speed) / 5) * Math.sign(speed || 1) * dt
  x += Math.sin(yaw) * speed * dt
  z += Math.cos(yaw) * speed * dt
  const r = Math.hypot(x / 1.15, z)
  const bounded = clamp(r, 12.7, 23.1)
  if (r !== bounded && r > 0) { x *= bounded / r; z *= bounded / r; speed *= Math.exp(-5 * dt) }
  return { x, z, yaw, speed, boostTimer, boostCooldown, steering, offroad }
}

