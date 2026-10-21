/**
 * Palm Prix arcade kart physics.
 *
 * Mount (App race tick already calls `stepKart`):
 *   import { stepKart } from './aaa/physics'
 *
 * Camera rig (optional, does not replace the current chase cam):
 *   import { sampleCameraFollow } from './aaa/physics'
 */
export { sampleCameraFollow } from './cameraFollow'
export { stepKart, ensureKart } from './stepKart'
export { gridPose, groundHeight, setTrackHeightSampler, surfaceAt } from './track'
export type { CameraFollowSample, AaaKartState } from './types'
export type { SurfaceKind } from './track'
