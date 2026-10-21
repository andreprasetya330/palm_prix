/**
 * Palm Prix arcade kart physics.
 *
 * Mount (the race tick already calls `stepKart`):
 *   import { stepKart } from './aaa/physics'
 *
 * Importing this module also parks the scaffold spawn on the start grid
 * and installs the pose hooks (roll, wheels, dust, spray, skid, boost camera).
 */
import { DEFAULT_KART } from '../../game/kartPhysics'
import { installPictureHooks, publishPicture } from './picture'
import { ensureKart } from './stepKart'
import { gridPose } from './track'

const grid = gridPose()
DEFAULT_KART.x = grid.x
DEFAULT_KART.z = grid.z
DEFAULT_KART.yaw = grid.yaw
DEFAULT_KART.speed = 0
DEFAULT_KART.boostTimer = 0
installPictureHooks()
publishPicture(ensureKart({ ...DEFAULT_KART }))

export { sampleCameraFollow } from './cameraFollow'
export { stepKart, ensureKart } from './stepKart'
export { gridPose, groundHeight, setTrackHeightSampler, surfaceAt } from './track'
export type { CameraFollowSample, AaaKartState } from './types'
export type { SurfaceKind } from './track'
