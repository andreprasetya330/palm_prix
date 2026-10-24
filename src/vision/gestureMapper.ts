import {
  clampControl,
  ZERO_CONTROL,
  type ControlState,
} from '../game/controlState'
import type { Calibration } from './calibration'
import type { HandSample } from './landmarks'

function ema(prev: number, next: number, alpha: number): number {
  return prev + alpha * (next - prev)
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

function mapAngleToSteer(
  angle: number,
  neutral: number,
  cal: Calibration,
): number {
  let delta = wrapAngle(angle - neutral)
  const abs = Math.abs(delta)
  if (abs < cal.deadzoneRad) return 0
  const sign = Math.sign(delta)
  const usable = abs - cal.deadzoneRad
  const span = Math.max(1e-4, cal.sensitivityRad - cal.deadzoneRad)
  return Math.max(-1, Math.min(1, sign * (usable / span)))
}


export type MapperDebug = {
  mode: 'two-fist' | 'one-hand' | 'none'
  wheelAngle: number | null
  steerRaw: number
  handsVisible: number
  fists: number
}

/**
 * Maps MediaPipe hand samples → ControlState (wheel-angle steer).
 * Not palm-X. Deadzone, EMA smooth, decay on loss.
 */
export class GestureMapper {
  private smoothedSteer = 0
  private smoothedThrottle = 0
  private smoothedBrake = 0
  private lossMs = 0
  private itemCooldownMs = 0
  private prevThumbUp = false
  debug: MapperDebug = {
    mode: 'none',
    wheelAngle: null,
    steerRaw: 0,
    handsVisible: 0,
    fists: 0,
  }

  reset(): void {
    this.smoothedSteer = 0
    this.smoothedThrottle = 0
    this.smoothedBrake = 0
    this.lossMs = 0
    this.itemCooldownMs = 0
    this.prevThumbUp = false
  }

  update(
    hands: HandSample[],
    cal: Calibration,
    dtMs: number,
  ): ControlState {
    dtMs = Math.max(0, Math.min(100, Number.isFinite(dtMs) ? dtMs : 0))
    this.itemCooldownMs = Math.max(0, this.itemCooldownMs - dtMs)
    const fists = hands.filter((h) => h.isFist)
    this.debug.handsVisible = hands.length
    this.debug.fists = fists.length

    let steerTarget = 0
    let throttleTarget = 0
    let brakeTarget = 0
    let item = false

    if (fists.length >= 2) {
      this.lossMs = 0
      this.debug.mode = 'two-fist'
      // left = smaller mirrored x, right = larger x
      const sorted = [...fists].sort((a, b) => a.grip.x - b.grip.x)
      const left = sorted[0]
      const right = sorted[sorted.length - 1]
      const dx = right.grip.x - left.grip.x
      const dy = right.grip.y - left.grip.y
      const wheelAngle = Math.atan2(dy, dx)
      this.debug.wheelAngle = wheelAngle
      steerTarget = mapAngleToSteer(wheelAngle, cal.neutralAngle, cal)

      // A closed two-hand grip is the accelerator, at any height or depth.
      throttleTarget = 1
      item = this.detectItem(hands)
    } else if (fists.length === 1 || hands.length === 1) {
      this.lossMs = 0
      this.debug.mode = 'one-hand'
      const h = fists[0] ?? hands[0]
      this.debug.wheelAngle = h.yaw
      if (h.isFist) {
        steerTarget = mapAngleToSteer(h.yaw, cal.oneHandNeutral, cal)
      } else {
        // open hand: soft decay (handled below via lower target)
        steerTarget = this.smoothedSteer * 0.5
      }
      item = this.detectItem(hands)
    } else {
      this.debug.mode = 'none'
      this.debug.wheelAngle = null
      this.lossMs += dtMs
      this.prevThumbUp = false
      // decay toward 0 over ~200ms
      const decay = Math.min(1, this.lossMs / 200)
      steerTarget = this.smoothedSteer * (1 - decay)
      throttleTarget = 0
      brakeTarget = 0
    }

    // Opening either visible hand brakes; losing tracking only coasts.
    brakeTarget = hands.some((h) => !h.isFist) ? 1 : 0
    this.debug.steerRaw = steerTarget
    const alpha = 1 - Math.exp(-dtMs / 60) // ~EMA τ≈60ms
    this.smoothedSteer = ema(this.smoothedSteer, steerTarget, alpha)
    this.smoothedThrottle = throttleTarget > 0 ? ema(this.smoothedThrottle, throttleTarget, alpha) : 0
    this.smoothedBrake = brakeTarget > 0 ? ema(this.smoothedBrake, brakeTarget, alpha) : 0

    return clampControl({
      steer: this.smoothedSteer,
      throttle: this.smoothedThrottle,
      brake: this.smoothedBrake,
      item,
    })
  }

  private detectItem(hands: HandSample[]): boolean {

    // crude thumbs-up: thumb tip above wrist and away from palm center
    let thumbUp = false
    for (const h of hands) {
      const wrist = h.landmarks[0]
      const thumb = h.landmarks[4]
      if (thumb.y < wrist.y - 0.05 && Math.abs(thumb.x - wrist.x) > 0.04) {
        thumbUp = true
        break
      }
    }
    const edge = thumbUp && !this.prevThumbUp
    this.prevThumbUp = thumbUp
    if (edge && this.itemCooldownMs <= 0) {
      this.itemCooldownMs = 400
      return true
    }
    return false
  }
}

export function mergeControls(
  primary: ControlState,
  fallback: ControlState,
): ControlState {
  // Keyboard overrides when any key is active
  const kbActive =
    fallback.steer !== 0 ||
    fallback.throttle !== 0 ||
    fallback.brake !== 0 ||
    fallback.item || fallback.drift
  if (!kbActive) return primary
  return clampControl({
    steer: fallback.steer !== 0 ? fallback.steer : primary.steer,
    throttle: Math.max(primary.throttle, fallback.throttle),
    brake: Math.max(primary.brake, fallback.brake),
    item: primary.item || fallback.item,
    drift: Boolean(primary.drift || fallback.drift),
  })
}

export { ZERO_CONTROL }




