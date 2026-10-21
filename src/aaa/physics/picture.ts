/**
 * Paints physics onto the live mesh.
 * The stock kart only copies x/z and yaw. Roll, hop, wheel steer, dust, spray,
 * skid, and the boost camera widen have to land in the frame or the still
 * does not change. This hooks the render matrices after that copy.
 */
import * as THREE from 'three'
import type { AaaKartState } from './types'

export type PictureState = {
  active: boolean
  x: number
  z: number
  y: number
  roll: number
  pitch: number
  squat: number
  wheelSteer: number
  dust: number
  spray: number
  skid: number
  boostPull: number
  camRoll: number
}

export const picture: PictureState = {
  active: false,
  x: 0,
  z: 0,
  y: 0,
  roll: 0,
  pitch: 0,
  squat: 0,
  wheelSteer: 0,
  dust: 0,
  spray: 0,
  skid: 0,
  boostPull: 0,
  camRoll: 0,
}

const SURFACE = 'palm-prix-surface-read'

export function publishPicture(kart: AaaKartState): void {
  picture.active = true
  picture.x = kart.x
  picture.z = kart.z
  picture.y = kart.y
  picture.roll = kart.roll
  picture.pitch = kart.pitch
  picture.squat = kart.squat
  picture.wheelSteer = kart.wheelSteer
  picture.dust = kart.dust
  picture.spray = kart.spray
  picture.skid = kart.skid
  picture.boostPull = kart.boostTimer > 0 ? 3.8 : 0
  picture.camRoll = kart.camRoll
}

function ensureSurfaceBits(root: THREE.Object3D): void {
  let group = root.getObjectByName(SURFACE) as THREE.Group | undefined
  if (!group) {
    group = new THREE.Group()
    group.name = SURFACE
    const dustMat = new THREE.MeshBasicMaterial({
      color: '#d2b07a',
      transparent: true,
      opacity: 0.72,
    })
    for (let i = 0; i < 4; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), dustMat)
      puff.position.set((i - 1.5) * 0.24, 0.28, -1.05 - i * 0.18)
      puff.name = 'dust'
      group.add(puff)
    }
    const spray = new THREE.Mesh(
      new THREE.CircleGeometry(1.05, 16),
      new THREE.MeshBasicMaterial({
        color: '#8fd4ff',
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
    )
    spray.rotation.x = -Math.PI / 2
    spray.position.set(0, 0.1, 0.1)
    spray.name = 'spray'
    group.add(spray)
    const skidMat = new THREE.MeshBasicMaterial({
      color: '#141418',
      transparent: true,
      opacity: 0.72,
    })
    for (const side of [-0.46, 0.46]) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 1.5), skidMat)
      mark.position.set(side, 0.05, -0.35)
      mark.name = 'skid'
      group.add(mark)
    }
    root.add(group)
  }
  const showDust = picture.dust > 0.2
  const showSpray = picture.spray > 0.25
  const showSkid = picture.skid > 0.35
  for (const child of group.children) {
    if (child.name === 'dust') child.visible = showDust
    else if (child.name === 'spray') child.visible = showSpray
    else if (child.name === 'skid') child.visible = showSkid
  }
  group.visible = showDust || showSpray || showSkid
}

function isKartRoot(obj: THREE.Object3D): boolean {
  return (
    picture.active &&
    obj.type === 'Group' &&
    Math.abs(obj.position.x - picture.x) < 0.3 &&
    Math.abs(obj.position.z - picture.z) < 0.3 &&
    obj.position.y < 0.55 &&
    obj.position.y > -0.15
  )
}

function lookTarget(args: unknown[]): THREE.Vector3 {
  const first = args[0]
  if (first && typeof first === 'object' && 'isVector3' in first) {
    const v = first as THREE.Vector3
    return new THREE.Vector3(v.x, v.y, v.z)
  }
  return new THREE.Vector3(Number(args[0]) || 0, Number(args[1]) || 0, Number(args[2]) || 0)
}

let installed = false

/** Idempotent. Safe in node tests; it only patches prototypes. */
export function installPictureHooks(): void {
  if (installed) return
  installed = true

  const origUpdate = THREE.Object3D.prototype.updateMatrix
  THREE.Object3D.prototype.updateMatrix = function updateMatrixWithPose() {
    if (isKartRoot(this)) {
      this.position.y = 0.05 + picture.y + picture.squat
      this.rotation.z = picture.roll
      this.rotation.x = picture.pitch
      for (const child of this.children) {
        const front = child.position.z > 0.35
        const laidFlat = Math.abs(Math.abs(child.rotation.z) - Math.PI / 2) < 0.45
        if (front && laidFlat) child.rotation.y = picture.wheelSteer
      }
      ensureSurfaceBits(this)
    }
    origUpdate.call(this)
  }

  const origLook = THREE.Camera.prototype.lookAt
  THREE.Camera.prototype.lookAt = function lookAtWithBoost(this: THREE.Camera, ...args: unknown[]) {
    origLook.apply(this, args as never)
    if (!picture.active) return
    if (Math.abs(picture.camRoll) > 0.001) this.rotateZ(picture.camRoll)
    if (picture.boostPull <= 0) return
    const target = lookTarget(args)
    const offset = new THREE.Vector3().copy(this.position).sub(target)
    const dist = offset.length()
    if (dist < 0.5 || dist > 18) return
    const want = 6.8 + picture.boostPull
    offset.multiplyScalar(want / dist)
    this.position.copy(target).add(offset)
    origLook.apply(this, args as never)
    if (Math.abs(picture.camRoll) > 0.001) this.rotateZ(picture.camRoll)
  }
}
