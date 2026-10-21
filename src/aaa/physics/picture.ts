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
const _qSteer = new THREE.Quaternion()
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
  picture.boostPull = kart.boostTimer > 0 ? 2.6 : 0
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
  const marked = obj.userData.palmFront === true
  if (marked) return kartRoot !== null && obj.parent === kartRoot
  const hit =
    kartRoot !== null &&
    obj.parent === kartRoot &&
    obj.position.z > 0.4 &&
    Math.abs(Math.abs(obj.position.x) - 0.58) < 0.08 &&
    Math.abs(obj.position.y - 0.28) < 0.08
  if (hit) obj.userData.palmFront = true
  return hit
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
  const steer = THREE.MathUtils.clamp(picture.wheelSteer, -1.05, 1.05)
  const data = wheel.userData as { palmBase?: THREE.Vector3 }
  if (!data.palmBase) data.palmBase = wheel.position.clone()
  const base = data.palmBase
  // Swing the tire out past the nose scoop so a chase still can see the yaw.
  const mag = Math.abs(steer)
  const side = Math.sign(base.x) || 1
  wheel.position.set(base.x + side * mag * 0.34, base.y, base.z + mag * 0.48)
  _euler.set(spin, 0, Math.PI / 2, 'XYZ')
  _qStock.setFromEuler(_euler)
  _qYaw.setFromAxisAngle(_up, steer)
  _qSteer.copy(_qYaw).multiply(_qStock)
  // The kart adds spin with `rotation.x += speed`. Restoring that euler fires
  // the quaternion callback and would draw an unsteered tire. Keep the euler
  // for the next spin, then put the yaw back with that callback quiet.
  wheel.rotation.set(spin, 0, Math.PI / 2)
  const q = wheel.quaternion as THREE.Quaternion & { _onChangeCallback: () => void }
  const cb = q._onChangeCallback
  q._onChangeCallback = () => {}
  q.copy(_qSteer)
  q._onChangeCallback = cb
  wheel.matrix.compose(wheel.position, wheel.quaternion, wheel.scale)
  wheel.matrixWorldNeedsUpdate = true
}

/**
 * The stock flame's pale core, stretched, reads as a white lump on the asphalt.
 * Keep that group at exhaust scale and paint the core orange so the draw is a flame.
 */
function tameStockFlame(root: THREE.Object3D): void {
  for (const child of root.children) {
    const aft = child.position.z < -0.8 && child.position.y > 0.15 && child.position.y < 0.7
    if (!aft || child.name === SURFACE) continue
    child.scale.set(1, 1, 1)
    // The stock cone's emissive blows out to a white lump. The exhaust flame is ours.
    child.visible = false
  }
}

/** Faceted cloud puffs sit on the chase line and read as a ball in the sky. */
function hideSkyBalls(root: THREE.Object3D): void {
  let scene: THREE.Object3D = root
  while (scene.parent) scene = scene.parent
  scene.traverse((obj) => {
    if (obj.position.y < 8 || obj.children.length < 3) return
    let spheres = 0
    for (const child of obj.children) {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh && mesh.geometry?.type === 'SphereGeometry') spheres += 1
    }
    if (spheres >= 3 && spheres === obj.children.length) obj.visible = false
  })
}

function ensureSurfaceBits(root: THREE.Object3D): void {
  let group = root.getObjectByName(SURFACE) as THREE.Group | undefined
  if (!group) {
    group = new THREE.Group()
    group.name = SURFACE
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
    const plume = new THREE.Group()
    // Exhaust mouth. Cone +Y is rolled onto −Z so the tip trails back down the road.
    plume.position.set(0, 0.42, -0.98)
    plume.rotation.set(-Math.PI / 2, 0, 0)
    plume.name = 'plume'
    const flameLen = 2.7
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, flameLen, 12),
      new THREE.MeshBasicMaterial({ color: '#ff3d0a' }),
    )
    flame.position.y = flameLen / 2
    const core = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 1.6, 10),
      new THREE.MeshBasicMaterial({ color: '#ff7a18' }),
    )
    core.position.y = 0.85
    plume.add(flame)
    plume.add(core)
    group.add(plume)
    root.add(group)
  }
  for (const child of [...group.children]) {
    if (child.name === 'dust') group.remove(child)
  }
  const showSpray = picture.spray > 0.25
  const showPlume = picture.boostPull > 0
  for (const child of group.children) {
    if (child.name === 'spray') child.visible = showSpray
    else if (child.name === 'plume') child.visible = showPlume
  }
  group.visible = showSpray || showPlume
}

function poseKart(root: THREE.Object3D, origUpdate: (this: THREE.Object3D) => void): void {
  kartRoot = root
  root.position.y = 0.05 + picture.y + picture.squat
  origUpdate.call(root)
  bankChassis(root.matrix, THREE.MathUtils.clamp(picture.roll, -0.32, 0.32), picture.pitch)
  tameStockFlame(root)
  ensureSurfaceBits(root)
  hideSkyBalls(root)
}

function chaseTarget(args: unknown[]): THREE.Vector3 {
  const first = args[0]
  if (first && typeof first === 'object' && 'isVector3' in first) {
    const v = first as THREE.Vector3
    return _aim.set(v.x, v.y, v.z)
  }
  return _aim.set(Number(args[0]) || 0, Number(args[1]) || 0, Number(args[2]) || 0)
}

const _look = new THREE.Vector3()

/**
 * Chase from behind, low enough that the kart sits in the lower third.
 * Distance is absolute so a boost cannot walk the camera overhead.
 * A short shoulder keeps the near arch post off the body. The rear stays the face
 * the camera sees: 6.6 m behind, 2.5 m up, 4.8 m to the side.
 */
function frameChase(
  cam: THREE.Object3D,
  target: THREE.Vector3,
  origLook: (this: THREE.Object3D, ...args: unknown[]) => void,
): void {
  const yaw = picture.yaw
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)
  const back = 6.6 + (picture.boostPull > 0 ? picture.boostPull : 0)
  const shoulder = 4.8
  const persp = cam as THREE.PerspectiveCamera
  if (persp.isPerspectiveCamera && Math.abs(persp.fov - 52) > 0.5) {
    persp.fov = 52
    persp.updateProjectionMatrix()
  }
  cam.position.set(
    target.x - fx * back + rx * shoulder,
    2.5,
    target.z - fz * back + rz * shoulder,
  )
  _look.set(target.x + fx * 3.6, 1.15, target.z + fz * 3.6)
  origLook.call(cam, _look)
  if (Math.abs(picture.camRoll) > 0.001) cam.rotateZ(THREE.MathUtils.clamp(picture.camRoll, -0.04, 0.04))
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
      steerWheel(this)
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
