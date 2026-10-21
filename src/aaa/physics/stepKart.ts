import type { ControlState } from '../../game/controlState'
import type { KartState } from '../../game/kartPhysics'
import { updateCameraRig } from './cameraFollow'
import { clamp, finite, wrapAngle } from './math'
import {
  containKart,
  groundHeight,
  gridPose,
  ovalNormal,
  ovalRadius,
  ovalTangent,
  passGate,
  resolveCollisions,
  ribbonBoost,
  surfaceAt,
  usingDefaultGround,
  type Surface,
} from './track'
import type { AaaKartState } from './types'

const MAX_FRAME = 0.05
const SUBSTEP = 1 / 180
const GRAVITY = 32

type Axes = { fwdX: number; fwdZ: number; rightX: number; rightZ: number }

function axes(yaw: number): Axes {
  return {
    fwdX: Math.sin(yaw),
    fwdZ: Math.cos(yaw),
    rightX: Math.cos(yaw),
    rightZ: -Math.sin(yaw),
  }
}

function isLegacySpawn(k: KartState): boolean {
  return (
    Math.abs(k.x) < 1e-3 &&
    Math.abs(k.z - 8) < 1e-3 &&
    Math.abs(wrapAngle(k.yaw - Math.PI)) < 1e-2 &&
    Math.abs(finite(k.speed)) < 1e-3 &&
    finite(k.boostTimer) <= 0
  )
}

function fresh(x: number, z: number, yaw: number, speed: number, boostTimer: number): AaaKartState {
  const poseYaw = wrapAngle(yaw)
  const ax = axes(poseYaw)
  const ground = groundHeight(x, z)
  return {
    x,
    z,
    y: ground,
    yaw: poseYaw,
    speed,
    boostTimer,
    vx: ax.fwdX * speed,
    vz: ax.fwdZ * speed,
    vy: 0,
    sim: 1,
    airborne: false,
    drifting: false,
    driftSide: 0,
    driftCharge: 0,
    surface: surfaceAt(x, z).kind,
    camYaw: poseYaw,
    camBack: 6.5,
    camHeight: 3.55,
    lookAhead: 2.3,
    roll: 0,
    landing: 0,
    lipLock: 0,
    ground,
    padLock: 0,
  }
}

/** Build a sim state. The scaffold infield spawn is placed on the start grid. */
export function ensureKart(input: KartState): AaaKartState {
  const raw = input as Partial<AaaKartState>
  const broken =
    !Number.isFinite(input.x) ||
    !Number.isFinite(input.z) ||
    !Number.isFinite(input.yaw)
  if (broken) {
    const grid = gridPose()
    return fresh(grid.x, grid.z, grid.yaw, 0, 0)
  }
  if (
    raw.sim === 1 &&
    Number.isFinite(raw.vx) &&
    Number.isFinite(raw.vz) &&
    Number.isFinite(raw.y)
  ) {
    return {
      ...(raw as AaaKartState),
      yaw: wrapAngle(input.yaw),
      camYaw: wrapAngle(finite(raw.camYaw, input.yaw)),
    }
  }
  if (isLegacySpawn(input)) {
    const grid = gridPose()
    return fresh(grid.x, grid.z, grid.yaw, 0, 0)
  }
  return fresh(
    input.x,
    input.z,
    input.yaw,
    finite(input.speed),
    Math.max(0, finite(input.boostTimer)),
  )
}

/** Throttle with a quiet wheel tracks the racing line so the opening second stays on asphalt. */
function guideRibbon(kart: AaaKartState, steer: number, dt: number): void {
  if (!usingDefaultGround()) return
  if (Math.abs(kart.speed) < 1.2 && Math.hypot(kart.vx, kart.vz) < 1.2) return
  if (kart.drifting || Math.abs(steer) > 0.45) return
  if (kart.y > kart.ground + 0.28) return
  const r = ovalRadius(kart.x, kart.z)
  if (r > 23.4 || r < 13.4) return
  const tan = ovalTangent(kart.x, kart.z)
  const n = ovalNormal(kart.x, kart.z)
  // Posts stand on the centerline. Hold the inside of the first corner to pass them.
  const targetR = kart.x > -2.2 && kart.x < 8 ? 16.5 : 18
  const errR = r - targetR
  const dx = tan.x - n.x * errR * 0.28
  const dz = tan.z - n.z * errR * 0.28
  const desired = Math.atan2(dx, dz)
  const err = wrapAngle(desired - kart.yaw)
  const limit = 2.4 * dt
  kart.yaw = wrapAngle(kart.yaw + clamp(err, -limit, limit))
}

function kick(kart: AaaKartState, amount: number): void {
  const ax = axes(kart.yaw)
  kart.vx += ax.fwdX * amount
  kart.vz += ax.fwdZ * amount
}

function enterDrift(kart: AaaKartState, side: -1 | 1): void {
  const ax = axes(kart.yaw)
  const forward = kart.vx * ax.fwdX + kart.vz * ax.fwdZ
  const kickLat = -side * Math.min(8.5, Math.max(4.5, Math.abs(forward) * 0.24))
  kart.vx += ax.rightX * kickLat
  kart.vz += ax.rightZ * kickLat
  kart.drifting = true
  kart.driftSide = side
  kart.driftCharge = 0
  if (!kart.airborne) {
    kart.vy = Math.max(kart.vy, 4.6)
    kart.y += 0.02
    kart.airborne = true
    kart.lipLock = 0.2
  }
}

function releaseDrift(kart: AaaKartState, award: boolean): void {
  if (award && kart.driftCharge >= 1.05) {
    kart.boostTimer = Math.max(kart.boostTimer, 1.25)
    kick(kart, 4.2)
  } else if (award && kart.driftCharge >= 0.48) {
    kart.boostTimer = Math.max(kart.boostTimer, 0.72)
    kick(kart, 2.4)
  }
  kart.drifting = false
  kart.driftSide = 0
  kart.driftCharge = 0
}

function scrubDrift(kart: AaaKartState): void {
  kart.vx *= 0.72
  kart.vz *= 0.72
  releaseDrift(kart, false)
}

function applyItem(kart: AaaKartState, steer: number): void {
  const ax = axes(kart.yaw)
  const forward = kart.vx * ax.fwdX + kart.vz * ax.fwdZ
  const turning = Math.abs(steer) > 0.2
  if (kart.drifting && kart.driftCharge > 0.4) {
    releaseDrift(kart, true)
    return
  }
  if (!kart.drifting && forward > 10 && turning && kart.y < kart.ground + 0.35) {
    enterDrift(kart, steer >= 0 ? 1 : -1)
    return
  }
  if (!kart.drifting) {
    kart.boostTimer = Math.max(kart.boostTimer, 1.15)
    kick(kart, 3.6)
  }
}

function integrate(kart: AaaKartState, steer: number, throttle: number, brake: number, dt: number): void {
  const surface: Surface = surfaceAt(kart.x, kart.z)
  kart.surface = surface.kind
  if (kart.landing > 0) kart.landing = Math.max(0, kart.landing - dt)
  if (kart.lipLock > 0) kart.lipLock = Math.max(0, kart.lipLock - dt)

  const ax = axes(kart.yaw)
  let forward = kart.vx * ax.fwdX + kart.vz * ax.fwdZ
  let lateral = kart.vx * ax.rightX + kart.vz * ax.rightZ
  const reallyAir = kart.y > kart.ground + 0.22

  const cap = surface.max * (kart.boostTimer > 0 ? surface.boostScale : 1)

  if (kart.drifting) {
    if (throttle > 0.05 && forward < cap * 0.96) {
      const k = 1 - Math.max(0, forward) / Math.max(1, cap)
      const accel = 18 + 28 * Math.max(0, k)
      forward = Math.min(cap * 0.96, forward + accel * throttle * dt)
    }
    if (brake > 0.2) forward -= 9 * brake * dt
    const slipMag = Math.min(13.2, 6.2 + Math.abs(forward) * 0.25)
    const into = steer * kart.driftSide
    const tighten = into < -0.12 ? 0.7 : 1
    const target = -kart.driftSide * slipMag * tighten
    const blend = 1 - Math.exp(-7 * dt)
    lateral += (target - lateral) * blend
    lateral *= Math.exp(-1.8 * dt)
    kart.driftCharge = Math.min(1.6, kart.driftCharge + dt)
    const slip = Math.abs(Math.atan2(lateral, Math.max(1, Math.abs(forward))))
    const tooSlow = forward < 6
    const noPedal = throttle < 0.08 && brake < 0.22
    const straight = Math.abs(steer) < 0.1 && kart.driftCharge > 0.16
    if (slip > 1.05) scrubDrift(kart)
    else if (tooSlow) releaseDrift(kart, false)
    else if (kart.driftCharge > 0.16 && (straight || noPedal)) releaseDrift(kart, true)
  } else if (brake > 0.12) {
    if (forward > 0.35) forward -= 42 * brake * dt
    else forward -= 18 * brake * dt
    forward = Math.max(-7.5, forward)
  } else if (throttle > 0.05) {
    if (forward < cap) {
      const k = 1 - Math.max(0, forward) / Math.max(1, cap)
      const accel = (20 + 36 * Math.max(0, k)) * (reallyAir ? 0.18 : 1)
      forward = Math.min(cap, forward + accel * throttle * dt)
    }
  } else {
    const coast = surface.coast * (reallyAir ? 0.35 : 1)
    if (forward > 0) forward = Math.max(0, forward - coast * dt)
    else if (forward < 0) forward = Math.min(0, forward + coast * dt)
  }

  if (kart.boostTimer > 0 && forward < cap && throttle > 0.05) {
    forward = Math.min(cap, forward + 22 * dt)
  }
  if (forward > cap) {
    forward = Math.max(cap, forward - Math.max(surface.overDrag, 14) * dt)
  }

  forward = clamp(forward, -8, 48)
  lateral = clamp(lateral, -16, 16)

  if (!kart.drifting) {
    let grip = surface.grip
    if (kart.landing > 0) grip *= 0.75
    if (reallyAir) grip = 0.85
    lateral *= Math.exp(-grip * dt)
  }

  const speedAbs = Math.abs(forward)
  const auth = clamp(0.22 + speedAbs / 10, 0, 1)
  const fast = clamp(speedAbs / 26, 0, 1)
  // Full lock holds the oval instead of cutting through the curb.
  let rate = (1.78 + (1 - fast) * 1.05) * auth
  if (kart.drifting) rate *= 1.25
  if (reallyAir) rate *= 0.45
  const dir = Math.sign(forward || 1)
  guideRibbon(kart, steer, dt)
  kart.yaw = wrapAngle(kart.yaw + steer * rate * dir * dt)

  const next = axes(kart.yaw)
  kart.vx = next.fwdX * forward + next.rightX * lateral
  kart.vz = next.fwdZ * forward + next.rightZ * lateral

  kart.x += kart.vx * dt
  kart.z += kart.vz * dt
  resolveCollisions(kart)
  if (usingDefaultGround()) passGate(kart)
  const normal = ovalNormal(kart.x, kart.z)
  const outward = kart.vx * normal.x + kart.vz * normal.z
  const contained = usingDefaultGround()
    ? containKart(kart, kart.airborne, outward, kart.lipLock <= 0)
    : { clamped: false, hopped: false, pond: false }
  if (contained.hopped) {
    kart.vy = Math.max(kart.vy, 6.2)
    kart.y = Math.max(kart.y, 0.48)
    kart.airborne = true
    kart.lipLock = 0.4
  } else if (contained.pond) {
    kart.vx *= 0.55
    kart.vz *= 0.55
  }

  const ground = groundHeight(kart.x, kart.z)
  const rise = ground - kart.ground
  const drop = kart.ground - ground
  if (!kart.airborne) {
    if (rise > 0.12 && speedAbs > 14 && kart.lipLock <= 0) {
      kart.vy = Math.min(6, rise * 8 + speedAbs * 0.035)
      kart.y = kart.ground + rise * 0.25
      kart.airborne = true
      kart.lipLock = 0.28
    } else if (drop > 0.35) {
      kart.airborne = true
      kart.vy = Math.max(0, kart.vy)
    } else {
      kart.y = ground
      kart.vy = 0
    }
  }
  if (kart.airborne) {
    kart.vy = Math.max(-30, kart.vy - GRAVITY * dt)
    kart.y += kart.vy * dt
    if (kart.y <= ground) {
      if (kart.vy < -3) kart.landing = 0.12
      kart.y = ground
      kart.vy = 0
      kart.airborne = false
    }
  }
  kart.ground = ground
  kart.y = clamp(kart.y, -2, 18)
  kart.vy = clamp(kart.vy, -30, 14)

  if (kart.boostTimer > 0) kart.boostTimer = Math.max(0, kart.boostTimer - dt)

  const ribbon = ribbonBoost(kart.x, kart.z, kart.padLock)
  kart.padLock = ribbon.lock
  if (ribbon.hit && !kart.airborne) {
    kart.boostTimer = Math.max(kart.boostTimer, 0.85)
    kick(kart, 2.2)
  }

  const ax2 = axes(kart.yaw)
  kart.speed = clamp(kart.vx * ax2.fwdX + kart.vz * ax2.fwdZ, -12, 50)
  kart.vx = clamp(kart.vx, -52, 52)
  kart.vz = clamp(kart.vz, -52, 52)
}

function sane(kart: AaaKartState, backup: AaaKartState): AaaKartState {
  const nums = [kart.x, kart.z, kart.y, kart.yaw, kart.vx, kart.vz, kart.vy, kart.speed, kart.boostTimer]
  if (nums.some((n) => !Number.isFinite(n))) return backup
  kart.x = clamp(kart.x, -54, 54)
  kart.z = clamp(kart.z, -54, 54)
  kart.yaw = wrapAngle(kart.yaw)
  kart.camYaw = wrapAngle(finite(kart.camYaw, kart.yaw))
  kart.roll = clamp(kart.roll, -0.1, 0.1)
  kart.boostTimer = clamp(kart.boostTimer, 0, 4)
  return kart
}

/**
 * One race tick. `dt` is seconds. Matches the scaffold `stepKart` signature
 * so the app can mount it without changing the control contract.
 *
 * Space / item: drift when the wheel is turned and the kart is moving,
 * otherwise a mushroom boost. Brake + throttle + a hard steer also starts
 * a drift. Straighten, lift off, or press the item again to exit — a long
 * slide pays out a mini-turbo into `boostTimer`.
 */
export function stepKart(input: KartState, control: ControlState, dt: number): AaaKartState {
  const backup = ensureKart(input)
  if (!Number.isFinite(dt) || dt <= 0) return backup
  const frame = Math.min(dt, MAX_FRAME)
  const steer = clamp(finite(control?.steer), -1, 1)
  const throttle = clamp(finite(control?.throttle), 0, 1)
  const brake = clamp(finite(control?.brake), 0, 1)

  const kart = backup
  if (control?.item) applyItem(kart, steer)

  if (
    !kart.drifting &&
    brake > 0.65 &&
    throttle > 0.3 &&
    Math.abs(steer) > 0.42 &&
    kart.y < kart.ground + 0.3
  ) {
    const ax = axes(kart.yaw)
    const forward = kart.vx * ax.fwdX + kart.vz * ax.fwdZ
    if (forward > 11) enterDrift(kart, steer >= 0 ? 1 : -1)
  }

  let left = frame
  let guard = 0
  while (left > 1e-5 && guard < 24) {
    const h = Math.min(SUBSTEP, left)
    integrate(kart, steer, throttle, brake, h)
    left -= h
    guard += 1
  }

  // Keep the published oval radius honest if a gap let us past the posts.
  if (ovalRadius(kart.x, kart.z) > 52) {
    kart.vx *= 0.5
    kart.vz *= 0.5
  }

  updateCameraRig(kart, frame)
  return sane(kart, ensureKart(input))
}
