/**
 * Palm Prix arcade kart physics.
 *
 * Mount (the race tick already calls `stepKart`):
 *   import { stepKart } from './aaa/physics'
 *
 * The scaffold pose (0, 8, yaw π) is the center grid slot under the gate.
 * Importing this module does not move it. It installs the pose hooks.
 */
import { installPictureHooks } from './picture'

installPictureHooks()

export { sampleCameraFollow } from './cameraFollow'
export { stepKart, ensureKart } from './stepKart'
export { gridPose, groundHeight, setTrackHeightSampler, surfaceAt } from './track'
export type { CameraFollowSample, AaaKartState } from './types'
export type { SurfaceKind } from './track'
