/**
 * Paints physics onto the live mesh.
 * The stock kart only copies x/z and yaw, and it does that a frame apart from
 * the sim, so a position match drops the pose as soon as the kart is moving.
 * The kart is recognized by its four wheel pivots. Roll, pitch, and hop are
 * written into the draw matrix. Front wheels get a yaw on top of their spin.
 * Chase `lookAt` lives on Object3D, not Camera, so the widen hooks that.
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
  /** Chassis yaw. The chase rig is rebuilt from this so it cannot walk outward. */
  yaw: number
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
  yaw: Math.PI,
}

const SURFACE = 'palm-prix-surface-read'

const _euler = new THREE.Euler(0, 0, 0, 'XYZ')
const _bank = new THREE.Matrix4()
const _rz = new THREE.Matrix4()
const _rx = new THREE.Matrix4()
const _qYaw = new THREE.Quaternion()
const _qStock = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)
const _aim = new THREE.Vector3()

let kartRoot: THREE.Object3D | null = null

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
  picture.boostPull = kart.boostTimer > 0 ? 4.8 : 0
  picture.camRoll = kart.camRoll
  picture.yaw = kart.yaw
}

function looksLikeKart(obj: THREE.Object3D): boolean {
  if (obj.type !== 'Group') return false
  let fronts = 0
  let rears = 0
  for (const child of obj.children) {
    const x = Math.abs(child.position.x)
    if (Math.abs(child.position.y - 0.28) > 0.08 || Math.abs(x - 0.58) > 0.08) continue
    if (Math.abs(child.position.z - 0.62) < 0.08) fronts += 1
    else if (Math.abs(child.position.z + 0.62) < 0.08) rears += 1
  }
  return fronts >= 2 && rears >= 2
}

function isFrontWheel(obj: THREE.Object3D): boolean {
  return (
    kartRoot !== null &&
    obj.parent === kartRoot &&
    obj.position.z > 0.4 &&
    Math.abs(Math.abs(obj.position.x) - 0.58) < 0.08 &&
    Math.abs(obj.position.y - 0.28) < 0.08
  )
}

/** Roll about forward, then a nose-down pitch. Right-multiply so yaw stays put. */
function bankChassis(matrix: THREE.Matrix4, roll: number, pitch: number): void {
  _rz.makeRotationZ(roll)
  _rx.makeRotationX(-pitch)
  _bank.multiplyMatrices(_rx, _rz)
  matrix.multiply(_bank)
}

function steerWheel(wheel: THREE.Object3D): void {
  const spin = wheel.rotation.x
  const steer = THREE.MathUtils.clamp(picture.wheelSteer * 1.15, -0.9, 0.9)
  _euler.set(spin, 0, Math.PI / 2, 'XYZ')
  _qStock.setFromEuler(_euler)
  _qYaw.setFromAxisAngle(_up, steer)
  wheel.quaternion.copy(_qYaw).multiply(_qStock)
}

function stretchPlume(root: THREE.Object3D): void {
  for (const child of root.children) {
    const aft = child.position.z < -0.8 && child.position.y > 0.15 && child.position.y < 0.7
    if (!aft) continue
    if (picture.boostPull > 0) child.scale.set(1.2, 2.8, 1.2)
    else child.scale.set(1, 1, 1)
  }
}

function ensureSurfaceBits(root: THREE.Object3D): void {
  let group = root.getObjectByName(SURFACE) as THREE.Group | undefined
  if (!group) {
    group = new THREE.Group()
    group.name = SURFACE
    const dustMat = new THREE.MeshBasicMaterial({
      color: '#c4a46a',
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    })
    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), dustMat)
      puff.position.set((i - 2) * 0.22, 0.22, -1.15 - i * 0.28)
      puff.name = 'dust'
      group.add(puff)
    }
    const spray = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 18),
      new THREE.MeshBasicMaterial({
        color: '#9ad7ff',
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    spray.rotation.x = -Math.PI / 2
    spray.position.set(0, 0.08, 0.05)
    spray.name = 'spray'
    group.add(spray)
    const skidMat = new THREE.MeshBasicMaterial({
      color: '#1a1a1e',
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    })
    for (const side of [-0.5, 0.5]) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 2.6), skidMat)
      mark.position.set(side, 0.07, -0.85)
      mark.name = 'skid'
      group.add(mark)
    }
    const sparkMat = new THREE.MeshBasicMaterial({
      color: '#ffb03a',
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
    const sparks: [number, number, number][] = [
      [-0.52, 0.22, -0.55],
      [0.48, 0.28, -0.95],
      [-0.3, 0.18, -1.35],
      [0.62, 0.34, -1.15],
    ]
    for (const [x, y, z] of sparks) {
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), sparkMat)
      spark.position.set(x, y, z)
      spark.name = 'skid'
      group.add(spark)
    }
    const streakMat = new THREE.MeshBasicMaterial({
      color: '#fff4c4',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    for (let i = 0; i < 4; i++) {
      const streak = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.8), streakMat)
      streak.position.set((i - 1.5) * 0.34, 0.45 + (i % 2) * 0.18, -1.7 - i * 0.35)
      streak.name = 'streak'
      group.add(streak)
    }
    root.add(group)
  }
  const showDust = picture.dust > 0.2
  const showSpray = picture.spray > 0.25
  const showSkid = picture.skid > 0.3
  const showStreak = picture.boostPull > 0
  for (const child of group.children) {
    if (child.name === 'dust') child.visible = showDust
    else if (child.name === 'spray') child.visible = showSpray
    else if (child.name === 'skid') child.visible = showSkid
    else if (child.name === 'streak') child.visible = showStreak
  }
  group.visible = showDust || showSpray || showSkid || showStreak
}

function poseKart(root: THREE.Object3D, origUpdate: (this: THREE.Object3D) => void): void {
  kartRoot = root
  root.position.y = 0.05 + picture.y + picture.squat
  origUpdate.call(root)
  bankChassis(root.matrix, THREE.MathUtils.clamp(picture.roll * 1.25, -0.62, 0.62), picture.pitch)
  stretchPlume(root)
  ensureSurfaceBits(root)
}

function chaseTarget(args: unknown[]): THREE.Vector3 {
  const first = args[0]
  if (first && typeof first === 'object' && 'isVector3' in first) {
    const v = first as THREE.Vector3
    return _aim.set(v.x, v.y, v.z)
  }
  return _aim.set(Number(args[0]) || 0, Number(args[1]) || 0, Number(args[2]) || 0)
}

/**
 * Place the chase from the chassis yaw every time. Adding to the current
 * distance ratchets, because the stock camera only eases partway back.
 * The shoulder keeps a gate post on the centerline from covering the kart.
 */
function frameChase(
  cam: THREE.Object3D,
  target: THREE.Vector3,
  origLook: (this: THREE.Object3D, ...args: unknown[]) => void,
): void {
  const back = 7.4 + (picture.boostPull > 0 ? picture.boostPull : 0)
  const yaw = picture.yaw
  const sx = -Math.sin(yaw)
  const sz = -Math.cos(yaw)
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)
  const shoulder = 2.15
  cam.position.set(
    target.x + sx * back + rx * shoulder,
    target.y + 4.15,
    target.z + sz * back + rz * shoulder,
  )
  origLook.call(cam, target)
  if (Math.abs(picture.camRoll) > 0.001) cam.rotateZ(picture.camRoll)
}

let installed = false

/** Idempotent. Safe in node tests; it only patches prototypes. */
export function installPictureHooks(): void {
  if (installed) return
  installed = true

  const origUpdate = THREE.Object3D.prototype.updateMatrix
  THREE.Object3D.prototype.updateMatrix = function updateMatrixWithPose() {
    if (picture.active && (this === kartRoot || looksLikeKart(this))) {
      poseKart(this, origUpdate)
      return
    }
    if (picture.active && isFrontWheel(this)) {
      const spin = this.rotation.x
      steerWheel(this)
      origUpdate.call(this)
      // The draw matrix already has the steer. Put the axle euler back so the
      // kart's spin (`rotation.x += speed`) does not tumble the tire.
      this.rotation.set(spin, 0, Math.PI / 2)
      return
    }
    origUpdate.call(this)
  }

  const origLook = THREE.Object3D.prototype.lookAt
  THREE.Object3D.prototype.lookAt = function lookAtWithChase(this: THREE.Object3D, ...args: unknown[]) {
    const cam = this as THREE.Object3D & { isCamera?: boolean }
    if (!picture.active || !cam.isCamera) {
      origLook.apply(this, args as never)
      return
    }
    const target = chaseTarget(args)
    const dx = target.x - picture.x
    const dz = target.z - picture.z
    if (dx * dx + dz * dz > 25) {
      origLook.apply(this, args as never)
      return
    }
    origLook.apply(this, args as never)
    frameChase(this, target, origLook as (this: THREE.Object3D, ...a: unknown[]) => void)
  }
}
