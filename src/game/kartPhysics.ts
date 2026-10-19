import type { ControlState } from './controlState'

export type KartState = {
  x: number
  z: number
  yaw: number
  speed: number
  boostTimer: number
}

export const DEFAULT_KART: KartState = {
  x: 0,
  z: 8,
  yaw: Math.PI,
  speed: 0,
  boostTimer: 0,
}

const MAX_SPEED = 28
const ACCEL = 22
const BRAKE_DECEL = 36
const COAST_FRICTION = 8
const STEER_RATE = 2.4
const BOOST_MULT = 1.45
const BOOST_DURATION = 1.2

export function stepKart(kart: KartState, control: ControlState, dt: number): KartState {
  let { x, z, yaw, speed, boostTimer } = kart

  if (control.item && boostTimer <= 0) {
    boostTimer = BOOST_DURATION
  }
  if (boostTimer > 0) boostTimer = Math.max(0, boostTimer - dt)

  const maxSpd = boostTimer > 0 ? MAX_SPEED * BOOST_MULT : MAX_SPEED

  if (control.brake > 0.1) {
    if (speed > 0.5) {
      speed = Math.max(0, speed - BRAKE_DECEL * control.brake * dt)
    } else {
      // reverse crawl
      speed = Math.max(-6, speed - 10 * control.brake * dt)
    }
  } else if (control.throttle > 0.05) {
    speed = Math.min(maxSpd, speed + ACCEL * control.throttle * dt)
  } else {
    // coast
    if (speed > 0) speed = Math.max(0, speed - COAST_FRICTION * dt)
    else if (speed < 0) speed = Math.min(0, speed + COAST_FRICTION * dt)
  }

  const steerAuthority = Math.min(1, Math.abs(speed) / 6 + 0.15)
  yaw += control.steer * STEER_RATE * steerAuthority * dt * Math.sign(speed || 1)

  x += Math.sin(yaw) * speed * dt
  z += Math.cos(yaw) * speed * dt

  // soft bounds — keep on playfield
  const bound = 42
  x = Math.max(-bound, Math.min(bound, x))
  z = Math.max(-bound, Math.min(bound, z))

  return { x, z, yaw, speed, boostTimer }
}
