import type { KartState } from '../../game/kartPhysics'
import { clamp, damp, dampAngle, finite } from './math'
import type { AaaKartState, CameraFollowSample } from './types'

/**
 * Chase rig tuned so drift (chassis yaw) does not whip the lens.
 * The rig follows travel direction, with a short look-ahead and a tiny roll.
 * Call after `stepKart`. Safe on a bare scaffold `KartState` too.
 */
export function updateCameraRig(kart: AaaKartState, dt: number): void {
  const speed = Math.hypot(finite(kart.vx), finite(kart.vz))
  const travelYaw = speed > 3.5 ? Math.atan2(kart.vx, kart.vz) : kart.yaw
  kart.camYaw = dampAngle(finite(kart.camYaw, kart.yaw), travelYaw, 5.2, dt)
  const boosting = kart.boostTimer > 0
  const targetBack = 6.1 + Math.min(1.5, speed * 0.045) + (boosting ? 3.8 : 0)
  const targetHeight =
    3.45 + Math.min(1.05, speed * 0.032) + Math.min(1.1, Math.max(0, kart.y) * 0.8) + (boosting ? 0.45 : 0)
  const targetLook = 2.15 + Math.min(3.4, speed * 0.095) + (boosting ? 1.4 : 0)
  kart.camBack = damp(kart.camBack, targetBack, boosting ? 9 : 4.2, dt)
  kart.camHeight = damp(kart.camHeight, targetHeight, boosting ? 8 : 4.5, dt)
  kart.lookAhead = damp(kart.lookAhead, targetLook, 4.5, dt)
  kart.camRoll = damp(finite(kart.camRoll), clamp(-finite(kart.roll) * 0.22, -0.08, 0.08), 6, dt)
}

export function sampleCameraFollow(input: KartState): CameraFollowSample {
  const kart = input as Partial<AaaKartState>
  const yaw = finite(kart.camYaw, finite(input.yaw))
  const back = finite(kart.camBack, 6.5)
  const height = finite(kart.camHeight, 3.6)
  const look = finite(kart.lookAhead, 2.4)
  const y = finite(kart.y, 0)
  const speed = Math.abs(finite(input.speed))
  return {
    x: finite(input.x) - Math.sin(yaw) * back,
    y: height + y * 0.35,
    z: finite(input.z) - Math.cos(yaw) * back,
    lookX: finite(input.x) + Math.sin(yaw) * look,
    lookY: 1.05 + y * 0.25,
    lookZ: finite(input.z) + Math.cos(yaw) * look,
    roll: Math.max(-0.1, Math.min(0.1, finite(kart.roll))),
    fov: 52 + Math.min(5, speed * 0.1),
    yaw,
  }
}
