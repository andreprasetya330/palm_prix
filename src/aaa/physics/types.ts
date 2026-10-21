import type { KartState } from '../../game/kartPhysics'
import type { SurfaceKind } from './track'

/**
 * Superset of the scaffold `KartState`. Existing kart, camera, and HUD keep
 * reading `x`, `z`, `yaw`, `speed`, and `boostTimer`. The rest is sim + camera.
 */
export type AaaKartState = KartState & {
  y: number
  vx: number
  vz: number
  vy: number
  sim: 1
  airborne: boolean
  drifting: boolean
  driftSide: -1 | 0 | 1
  driftCharge: number
  surface: SurfaceKind
  /** Smoothed travel heading for the chase rig. Not the chassis yaw. */
  camYaw: number
  camBack: number
  camHeight: number
  lookAhead: number
  /** Chassis roll, radians. Negative leans right (into a positive steer). */
  roll: number
  /** Nose-up pitch, radians. Brake dips the nose. */
  pitch: number
  /** Suspension squash, meters. Negative on brake. */
  squat: number
  /** Front-wheel steer, radians, same sign as the steer input. */
  wheelSteer: number
  /** 0–1 cornering load for a skid or spark read. */
  skid: number
  /** 0–1 loose surface (grass, sand, curb edge). */
  dust: number
  /** 0–1 water contact. Hard reject still raises this for a splash. */
  spray: number
  /** Small camera dutch angle so the horizon agrees with the body. */
  camRoll: number
  time: number
  landing: number
  lipLock: number
  ground: number
  padLock: number
}

export type CameraFollowSample = {
  x: number
  y: number
  z: number
  lookX: number
  lookY: number
  lookZ: number
  roll: number
  fov: number
  /** Smoothed rig heading (velocity), in the same convention as kart yaw. */
  yaw: number
}
