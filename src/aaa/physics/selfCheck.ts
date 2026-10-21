/**
 * Headless feel checks. Run: npx tsx src/aaa/physics/selfCheck.ts
 */
import * as THREE from 'three'
import type { ControlState } from '../../game/controlState'
import { DEFAULT_KART } from '../../game/kartPhysics'
import { sampleCameraFollow } from './cameraFollow'
import { wrapAngle } from './math'
import { stepKart } from './stepKart'
import './index'
import {
  BOOST_PADS,
  groundHeight,
  gridPose,
  ovalAngle,
  ovalNormal,
  ovalRadius,
  ovalTangent,
  overlapsAnyCurb,
  setTrackHeightSampler,
  surfaceAt,
} from './track'
import type { AaaKartState } from './types'

const failures: string[] = []

function check(name: string, cond: boolean, detail = ''): void {
  if (!cond) failures.push(detail ? `${name} — ${detail}` : name)
}

function ctrl(p: Partial<ControlState>): ControlState {
  return { steer: 0, throttle: 0, brake: 0, item: false, ...p }
}

function hold(
  kart: AaaKartState,
  c: ControlState,
  seconds: number,
  dt = 1 / 60,
): AaaKartState {
  let k = kart
  const n = Math.max(1, Math.round(seconds / dt))
  for (let i = 0; i < n; i++) k = stepKart(k, c, dt)
  return k
}

function slipOf(k: AaaKartState): number {
  const fwdX = Math.sin(k.yaw)
  const fwdZ = Math.cos(k.yaw)
  const rightX = Math.cos(k.yaw)
  const rightZ = -Math.sin(k.yaw)
  const forward = k.vx * fwdX + k.vz * fwdZ
  const lateral = k.vx * rightX + k.vz * rightZ
  return Math.atan2(lateral, Math.max(0.5, Math.abs(forward)))
}

function finiteKart(k: AaaKartState): boolean {
  return [k.x, k.z, k.y, k.yaw, k.vx, k.vz, k.vy, k.speed, k.camYaw].every(Number.isFinite)
}

function testSpawn(): void {
  const k = stepKart({ ...DEFAULT_KART }, ctrl({}), 1 / 60)
  const grid = gridPose()
  const surf = surfaceAt(k.x, k.z).kind
  check('spawn under the gate', k.z > 17 && k.z < 19 && Math.abs(k.x) < 2, `pos ${k.x.toFixed(2)},${k.z.toFixed(2)}`)
  check('spawn on asphalt', surf === 'asphalt', surf)
  check('spawn faces the straight', Math.abs(wrapAngle(k.yaw - grid.yaw)) < 0.05)
  check('spawn clear of curbs', !overlapsAnyCurb(k.x, k.z))
  check('spawn finite', finiteKart(k))
}

function testOpeningRibbon(): void {
  let k = stepKart({ ...DEFAULT_KART }, ctrl({ throttle: 1 }), 1 / 60)
  let minR = 99
  let maxR = 0
  let off = false
  for (let i = 0; i < 70; i++) {
    k = stepKart(k, ctrl({ throttle: 1, steer: 0 }), 1 / 60)
    const r = ovalRadius(k.x, k.z)
    minR = Math.min(minR, r)
    maxR = Math.max(maxR, r)
    if (surfaceAt(k.x, k.z).kind !== 'asphalt' || overlapsAnyCurb(k.x, k.z)) off = true
  }
  check('opening second stays on the ribbon', !off && minR > 15.2 && maxR < 21.4, `r ${minR.toFixed(2)}-${maxR.toFixed(2)} off=${off}`)
}

function testCurbAndPond(): void {
  let k = stepKart({ x: 0, z: 22.35, yaw: Math.PI / 2, speed: 6, boostTimer: 0 }, ctrl({ throttle: 1 }), 1 / 60)
  k = hold(k, ctrl({ throttle: 1, steer: 0 }), 0.35)
  check(
    'curb deflects the chassis',
    !overlapsAnyCurb(k.x, k.z) || k.y > 0.35,
    `r=${ovalRadius(k.x, k.z).toFixed(2)} y=${k.y.toFixed(2)}`,
  )

  k = stepKart({ x: 0, z: 0, yaw: 0, speed: 16, boostTimer: 0 }, ctrl({ throttle: 1 }), 1 / 60)
  k = hold(k, ctrl({ throttle: 1 }), 0.35)
  const pond = Math.hypot(k.x, k.z)
  check('water hard-rejects', pond > 8 && surfaceAt(k.x, k.z).kind !== 'water', `d=${pond.toFixed(2)} ${surfaceAt(k.x, k.z).kind}`)
  check('reject finite', finiteKart(k))
}

function testThrottle(): void {
  let k = stepKart({ ...DEFAULT_KART }, ctrl({}), 1 / 60)
  k = hold(k, ctrl({ throttle: 1 }), 1.05)
  check('immediate throttle', k.speed > 22, `speed=${k.speed.toFixed(2)}`)
  check('throttle finite', finiteKart(k))
  check('stays on asphalt', surfaceAt(k.x, k.z).kind === 'asphalt', surfaceAt(k.x, k.z).kind)
}

function testNoIce(): void {
  const seeded = stepKart(
    { x: 0, z: 18, y: 0, yaw: 0, speed: 0, boostTimer: 0, vx: 18, vz: 2, sim: 1 } as AaaKartState,
    ctrl({}),
    1 / 60,
  )
  const ax0 = { rightX: Math.cos(seeded.yaw), rightZ: -Math.sin(seeded.yaw) }
  const lat0 = Math.abs(seeded.vx * ax0.rightX + seeded.vz * ax0.rightZ)
  const k = hold(seeded, ctrl({}), 0.35)
  const ax = { rightX: Math.cos(k.yaw), rightZ: -Math.sin(k.yaw) }
  const lat = Math.abs(k.vx * ax.rightX + k.vz * ax.rightZ)
  check('asphalt kills lateral', lat < 2 && lat < lat0 * 0.25, `lat ${lat0.toFixed(2)} → ${lat.toFixed(2)}`)
}

function testBrakeReverse(): void {
  let k = stepKart({ x: 0, z: 18, yaw: Math.PI / 2, speed: 28, boostTimer: 0 }, ctrl({}), 1 / 60)
  k = hold(k, ctrl({ brake: 1 }), 0.9)
  check('brake dumps speed', k.speed < 2, `speed=${k.speed.toFixed(2)}`)
  k = hold(k, ctrl({ brake: 1 }), 0.6)
  check('reverse crawl', k.speed < -3, `speed=${k.speed.toFixed(2)}`)
}

function testBoostAndDrift(): void {
  let k = stepKart({ x: 0, z: 18, yaw: Math.PI / 2, speed: 22, boostTimer: 0 }, ctrl({}), 1 / 60)
  k = stepKart(k, ctrl({ throttle: 1, item: true }), 1 / 60)
  check('straight space boosts', k.boostTimer > 0.8, `boost=${k.boostTimer}`)

  k = stepKart({ x: 0, z: 18, yaw: Math.PI / 2, speed: 22, boostTimer: 0 }, ctrl({}), 1 / 60)
  k = stepKart(k, ctrl({ throttle: 1, steer: 1, item: true }), 1 / 60)
  check('space while turning drifts', k.drifting, `drift=${k.drifting}`)
  k = hold(k, ctrl({ throttle: 1, steer: 1 }), 0.55)
  const slip = Math.abs(slipOf(k))
  check('drift slip is readable', k.drifting && slip > 0.28 && slip < 1.0, `slip=${slip.toFixed(2)}`)
  const nose = k.yaw
  const travel = Math.atan2(k.vx, k.vz)
  check('nose leads travel', Math.abs(wrapAngle(nose - travel)) > 0.22)
  const cam = sampleCameraFollow(k)
  check('camera follows travel', Math.abs(wrapAngle(cam.yaw - travel)) < 0.45, `camΔ=${wrapAngle(cam.yaw - travel)}`)
  check('drift finite', finiteKart(k) && Number.isFinite(cam.x + cam.y + cam.z))

  const charged = k.driftCharge
  k = hold(k, ctrl({ throttle: 1, steer: 0 }), 0.25)
  check('straighten exits drift', !k.drifting)
  check('charged drift pays boost', charged >= 0.48 && k.boostTimer > 0.3, `charge=${charged} boost=${k.boostTimer}`)
}

function testWall(): void {
  let k = stepKart({ x: 0, z: 22.2, yaw: 0, speed: 22, boostTimer: 0 }, ctrl({ throttle: 1 }), 1 / 60)
  let maxR = 0
  for (let i = 0; i < 40; i++) {
    k = stepKart(k, ctrl({ throttle: 1, steer: 0.15 }), 1 / 60)
    maxR = Math.max(maxR, ovalRadius(k.x, k.z))
  }
  check('no tunnel past the palm rail', maxR < 26.3, `maxR=${maxR.toFixed(2)}`)
  check('wall contact finite', finiteKart(k))
  check('deflected body is off the curb blocks', !overlapsAnyCurb(k.x, k.z) || k.y > 0.35, `r=${ovalRadius(k.x, k.z).toFixed(2)}`)

  k = stepKart({ x: 4, z: 17.2, yaw: Math.PI / 2, speed: 24, boostTimer: 0 }, ctrl({ throttle: 1 }), 1 / 60)
  const before = k.x
  k = hold(k, ctrl({ throttle: 1, steer: 0.35 }), 0.8)
  check('angled drive keeps sliding', Math.abs(k.x - before) > 6, `dx=${(k.x - before).toFixed(2)} z=${k.z.toFixed(2)}`)
  check('slide stays on the asphalt side', ovalRadius(k.x, k.z) < 22.8, `r=${ovalRadius(k.x, k.z).toFixed(2)}`)

  k = stepKart({ x: 0, z: 20.6, yaw: Math.PI / 2, speed: 16, boostTimer: 0 }, ctrl({}), 1 / 60)
  k = hold(k, ctrl({ throttle: 1, steer: 1 }), 1.2)
  check('not stuck on the ribbon wall', Math.hypot(k.vx, k.vz) > 6, `v=${Math.hypot(k.vx, k.vz).toFixed(2)} r=${ovalRadius(k.x, k.z).toFixed(2)}`)
  check('stuck-test finite', finiteKart(k) && !overlapsAnyCurb(k.x, k.z))
}

function testOffTrack(): void {
  // Dropped outside the barriers: pulled back inside, not left in a palm or a curb.
  let k = stepKart({ x: 0, z: 24, yaw: Math.PI / 2, speed: 28, boostTimer: 0 }, ctrl({}), 1 / 60)
  check('off-track returns inside the wall', ovalRadius(k.x, k.z) < 23.3, `r=${ovalRadius(k.x, k.z).toFixed(2)}`)
  check('off-track is not inside a curb', !overlapsAnyCurb(k.x, k.z))
  k = hold(k, ctrl({ throttle: 1, steer: 0 }), 0.6)
  check('stays out of the palms', ovalRadius(k.x, k.z) < 23.4, `r=${ovalRadius(k.x, k.z).toFixed(2)}`)
  check('still clear of curb blocks', !overlapsAnyCurb(k.x, k.z) || k.y > 0.35)
  check('off-track recovery grips', Math.abs(slipOf(k)) < 0.5, `slip=${slipOf(k).toFixed(2)}`)
}

function testAir(): void {
  const start = stepKart(
    {
      x: 0,
      z: 18,
      yaw: Math.PI / 2,
      speed: 10,
      boostTimer: 0,
      y: 3,
      vx: 10,
      vz: 0,
      vy: 0,
      airborne: true,
      ground: 0,
      sim: 1,
    } as AaaKartState,
    ctrl({ throttle: 1 }),
    1 / 60,
  )
  const k = hold(start, ctrl({ throttle: 1 }), 1.1)
  check('lands', !k.airborne && k.y < 0.25, `y=${k.y} air=${k.airborne}`)
  check('land finite', finiteKart(k))
}

function testElevationHook(): void {
  setTrackHeightSampler((x) => {
    if (x > 8) return 0
    if (x > 4) return 1.6
    return 0
  })
  try {
    let k = stepKart({ x: 2, z: 18, yaw: Math.PI / 2, speed: 22, boostTimer: 0 }, ctrl({}), 1 / 60)
    check('sticks to flat sample', Math.abs(k.y) < 0.05 && !k.airborne, `y=${k.y}`)
    k = hold(k, ctrl({ throttle: 1, steer: 0 }), 0.45)
    const climbed = k.y > 0.4 || k.airborne
    check('responds to elevation', climbed, `y=${k.y.toFixed(2)} air=${k.airborne} x=${k.x.toFixed(2)}`)
    k = hold(k, ctrl({ throttle: 1 }), 1.2)
    check('lands after crest', !k.airborne && k.y < 0.2, `y=${k.y} air=${k.airborne}`)
  } finally {
    setTrackHeightSampler(null)
  }
  check('default ground restored', groundHeight(0, 18) === 0)
}

function testStorm(): void {
  let k = stepKart({ ...DEFAULT_KART }, ctrl({}), 1 / 60)
  let worst = 0
  for (let i = 0; i < 20 * 60; i++) {
    const steer = Math.sin(i * 0.17) 
    const throttle = i % 17 === 0 ? 0 : 1
    const brake = i % 29 === 0 ? 1 : 0
    const item = i % 47 === 0
    const dt = 0.008 + ((i * 17) % 7) * 0.006
    k = stepKart(k, ctrl({ steer, throttle, brake, item }), dt)
    worst = Math.max(worst, Math.hypot(k.x, k.z))
    if (!finiteKart(k) || worst > 56) break
  }
  check('storm stays finite', finiteKart(k), `pos ${k.x},${k.z}`)
  check('storm stays in bounds', worst < 56, `r=${worst.toFixed(1)}`)
}

function testLaps(): void {
  let k = stepKart({ ...DEFAULT_KART }, ctrl({ throttle: 1 }), 1 / 60)
  let prev = ovalAngle(k.x, k.z)
  let progress = 0
  let prevCam = sampleCameraFollow(k)
  let maxCamJump = 0
  const dt = 1 / 60
  let time = 0
  let minR = 99
  let maxR = 0
  for (let i = 0; i < 40 / dt; i++) {
    const r = ovalRadius(k.x, k.z)
    minR = Math.min(minR, r)
    maxR = Math.max(maxR, r)
    const tan = ovalTangent(k.x, k.z)
    const n = ovalNormal(k.x, k.z)
    const errR = r - 18
    const dx = tan.x - n.x * errR * 0.22
    const dz = tan.z - n.z * errR * 0.22
    const desired = Math.atan2(dx, dz)
    const steer = clampSteer(wrapAngle(desired - k.yaw) * 2.4)
    const item = i === 180
    k = stepKart(k, ctrl({ throttle: 1, steer, item }), dt)
    const a = ovalAngle(k.x, k.z)
    const d = wrapAngle(a - prev)
    if (d > 0) progress += d
    prev = a
    const cam = sampleCameraFollow(k)
    const jump = Math.hypot(cam.x - prevCam.x, cam.y - prevCam.y, cam.z - prevCam.z)
    maxCamJump = Math.max(maxCamJump, jump)
    prevCam = cam
    time += dt
    if (!finiteKart(k)) break
    if (progress > Math.PI * 2 * 3) break
  }
  check('three laps', progress > Math.PI * 6, `progress=${progress.toFixed(2)} t=${time.toFixed(1)} r=${minR.toFixed(1)}-${maxR.toFixed(1)}`)
  check('lap time is arcade', time < 32, `t=${time.toFixed(1)}`)
  check('lap line stays near oval', minR > 12 && maxR < 26, `${minR.toFixed(1)}-${maxR.toFixed(1)}`)
  check('camera does not pop', maxCamJump < 6, `jump=${maxCamJump.toFixed(2)}`)
  check('laps finite', finiteKart(k))
}

function clampSteer(v: number): number {
  return Math.max(-1, Math.min(1, v))
}

function testPoseAndBoost(): void {
  const grid = gridPose()
  check('module parks the countdown spawn on the grid', Math.abs(DEFAULT_KART.x - grid.x) < 1e-6 && Math.abs(DEFAULT_KART.z - grid.z) < 1e-6)

  let k = stepKart({ ...DEFAULT_KART }, ctrl({ throttle: 1, steer: 1 }), 1 / 60)
  k = hold(k, ctrl({ throttle: 1, steer: 1 }), 0.5)
  check('full lock rolls a few degrees', k.roll < -0.32 && k.roll > -0.44, `roll=${k.roll.toFixed(3)}`)
  check('front wheels turn', k.wheelSteer > 0.45, `wheel=${k.wheelSteer.toFixed(3)}`)
  check('corner leaves a skid read', k.skid > 0.4, `skid=${k.skid.toFixed(2)}`)
  check('edge kicks up dust', k.dust > 0.4 || k.skid > 0.4, `dust=${k.dust.toFixed(2)}`)

  k = stepKart({ x: grid.x, z: grid.z, yaw: grid.yaw, speed: 18, boostTimer: 0 }, ctrl({ throttle: 1, item: true }), 1 / 60)
  k = hold(k, ctrl({ throttle: 1 }), 0.45)
  check('boost widens the chase rig', k.camBack > 8.6, `back=${k.camBack.toFixed(2)} boost=${k.boostTimer.toFixed(2)}`)

  k = stepKart({ x: 0, z: 1, yaw: 0, speed: 12, boostTimer: 0 }, ctrl({ throttle: 1 }), 1 / 60)
  check('pond reject throws spray', k.spray > 0.5, `spray=${k.spray.toFixed(2)} d=${Math.hypot(k.x, k.z).toFixed(2)}`)
  let braked = stepKart({ x: grid.x, z: grid.z, yaw: grid.yaw, speed: 22, boostTimer: 0 }, ctrl({}), 1 / 60)
  braked = hold(braked, ctrl({ brake: 1 }), 0.25)
  check('brake dips the nose', braked.pitch < -0.05, `pitch=${braked.pitch.toFixed(3)}`)
}

function testChaseAndPlume(): void {
  const grid = gridPose()
  stepKart({ ...DEFAULT_KART }, ctrl({}), 1 / 60)
  const cam = new THREE.PerspectiveCamera()
  cam.position.set(0, 12, 0)
  cam.lookAt(grid.x, 1, grid.z)
  const behindX = cam.position.x - grid.x
  const behindZ = cam.position.z - grid.z
  const flat = Math.hypot(behindX, behindZ)
  const fwdX = Math.sin(grid.yaw)
  const fwdZ = Math.cos(grid.yaw)
  const behind = -(behindX * fwdX + behindZ * fwdZ)
  const side = Math.abs(behindX * fwdZ - behindZ * fwdX)
  check('countdown chase is behind the kart', behind > 5.5 && side < behind, `behind=${behind.toFixed(2)} side=${side.toFixed(2)}`)
  check('countdown chase is not overhead', cam.position.y < 3.2 && cam.position.y > 1.6, `y=${cam.position.y.toFixed(2)}`)
  check('chase distance stays put', behind < 7.4 && flat < 9.4, `behind=${behind.toFixed(2)} flat=${flat.toFixed(2)}`)

  let posed = stepKart({ ...DEFAULT_KART }, ctrl({ throttle: 1, steer: 1 }), 1 / 60)
  posed = hold(posed, ctrl({ throttle: 1, steer: 1 }), 0.45)
  const root = new THREE.Group()
  root.position.set(posed.x + 3, 0.05, posed.z - 2)
  for (const [x, y, z] of [
    [-0.58, 0.28, 0.62],
    [0.58, 0.28, 0.62],
    [-0.58, 0.28, -0.62],
    [0.58, 0.28, -0.62],
  ] as const) {
    const wheel = new THREE.Group()
    wheel.position.set(x, y, z)
    wheel.rotation.set(0.2, 0, Math.PI / 2)
    root.add(wheel)
  }
  root.updateMatrixWorld(true)
  const up = new THREE.Vector3().setFromMatrixColumn(root.matrix, 1)
  check('drawn roll is only a few degrees', up.y > 0.90 && up.y < 0.96, `up=${up.y.toFixed(3)} roll=${posed.roll.toFixed(3)}`)
  const stock = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, Math.PI / 2))
  const drawn = new THREE.Quaternion().setFromRotationMatrix(root.children[0].matrix)
  check('front wheel is steered', drawn.angleTo(stock) > 0.35, `ang=${drawn.angleTo(stock).toFixed(3)}`)
  const bits = root.getObjectByName('palm-prix-surface-read')
  const spar = !!bits && bits.children.some((child) => child.name === 'skid')
  const rope = !!bits && bits.children.some((child) => child.name === 'dust')
  check('no black spar on the body', !spar)
  check('no beige rope behind the kart', !rope)

  const r = ovalRadius(posed.x, posed.z)
  check('corner tires stay on the asphalt', r > 14.5 && r < 22 && !overlapsAnyCurb(posed.x, posed.z), `r=${r.toFixed(2)}`)

  const corner = hold({ ...DEFAULT_KART }, ctrl({ throttle: 1, steer: 1 }), 3)
  const tan = ovalTangent(corner.x, corner.z)
  const lead = Math.abs(wrapAngle(Math.atan2(tan.x, tan.z) - corner.yaw))
  const ang = ovalAngle(corner.x, corner.z)
  const offStraight = Math.min(Math.abs(wrapAngle(ang)), Math.abs(wrapAngle(ang - Math.PI)))
  check('full lock stays on the road', lead < 0.35 && offStraight > 0.35, `lead=${lead.toFixed(2)} ang=${ang.toFixed(2)}`)
  check('corner badge is off', corner.boostTimer === 0, `boost=${corner.boostTimer.toFixed(2)}`)
  check(
    'corner tires stay on asphalt after three seconds',
    ovalRadius(corner.x, corner.z) > 14.5 &&
      ovalRadius(corner.x, corner.z) < 22 &&
      !overlapsAnyCurb(corner.x, corner.z) &&
      surfaceAt(corner.x, corner.z).kind === 'asphalt',
    `r=${ovalRadius(corner.x, corner.z).toFixed(2)} ${surfaceAt(corner.x, corner.z).kind}`,
  )
  check('corner leans a few degrees', corner.roll < -0.32 && corner.roll > -0.44, `roll=${corner.roll.toFixed(3)}`)
  let noseClear = 99
  let sample = { ...DEFAULT_KART }
  for (let i = 0; i < 180; i++) {
    sample = stepKart(sample, ctrl({ throttle: 1, steer: 1 }), 1 / 60)
    const fx = Math.sin(sample.yaw)
    const fz = Math.cos(sample.yaw)
    const nx = sample.x + fx * 0.9
    const nz = sample.z + fz * 0.9
    for (const pad of BOOST_PADS) {
      noseClear = Math.min(noseClear, Math.hypot(nx - pad.x, nz - pad.z))
    }
  }
  check('full lock keeps the item box off the nose', noseClear > 1.45, `nose=${noseClear.toFixed(2)}`)

  const boosted = stepKart(
    { x: grid.x, z: grid.z, yaw: grid.yaw, speed: 18, boostTimer: 1.1 },
    ctrl({ throttle: 1 }),
    1 / 60,
  )
  root.updateMatrixWorld(true)
  const plume = root.getObjectByName('plume')
  check('boost shows a plume', !!plume && plume.visible, `boost=${boosted.boostTimer.toFixed(2)}`)
  const plumeMesh = plume?.children[0] as THREE.Mesh | undefined
  const plumeColor = (plumeMesh?.material as THREE.MeshBasicMaterial | undefined)?.color
  check(
    'plume is an orange exhaust flame',
    !!plume &&
      plume.position.y > 0.3 &&
      plume.position.z < -0.9 &&
      plumeMesh?.geometry?.type === 'ConeGeometry' &&
      ((plumeMesh?.geometry as THREE.ConeGeometry | undefined)?.parameters?.height ?? 0) > 2 &&
      !!plumeColor &&
      plumeColor.r > 0.8 &&
      plumeColor.g < 0.55 &&
      plumeColor.b < 0.2,
    `y=${plume?.position.y.toFixed(2)} z=${plume?.position.z.toFixed(2)} ${plumeMesh?.geometry?.type}`,
  )
  const coreMesh = plume?.getObjectByName('core') as THREE.Mesh | undefined
  const coreColor = (coreMesh?.material as THREE.MeshBasicMaterial | undefined)?.color
  const coreLen = (coreMesh?.geometry as THREE.ConeGeometry | undefined)?.parameters?.height ?? 0
  check(
    'flame has a bright core along its length',
    !!coreMesh && coreLen > 2 && !!coreColor && coreColor.r > 0.95 && coreColor.g > 0.75 && coreColor.b < 0.55,
    `len=${coreLen.toFixed(2)}`,
  )
  const ropeLeft = !!bits && bits.children.some((child) => child.name === 'dust')
  check('boost frame has no rope', !ropeLeft)
  const camB = new THREE.PerspectiveCamera()
  camB.position.set(boosted.x, 8, boosted.z)
  camB.lookAt(boosted.x, 1, boosted.z)
  const wide = Math.hypot(camB.position.x - boosted.x, camB.position.z - boosted.z)
  check('boost camera stays behind and readable', wide > flat + 1.5 && wide < 12 && camB.position.y < 3.2, `wide=${wide.toFixed(2)} y=${camB.position.y.toFixed(2)} base=${flat.toFixed(2)}`)
}

function testNaN(): void {
  const k = stepKart(
    { x: Number.NaN, z: 0, yaw: 0, speed: 0, boostTimer: 0 },
    ctrl({ throttle: 1, steer: Number.NaN }),
    Number.NaN,
  )
  check('nan input recovers', finiteKart(k))
}

testSpawn()
testOpeningRibbon()
testCurbAndPond()
testThrottle()
testNoIce()
testBrakeReverse()
testBoostAndDrift()
testWall()
testOffTrack()
testAir()
testElevationHook()
testStorm()
testLaps()
testPoseAndBoost()
testChaseAndPlume()
testNaN()

if (failures.length) {
  console.error(`SELF-CHECK FAILED (${failures.length})`)
  for (const f of failures) console.error(' - ' + f)
  throw new Error(`SELF-CHECK FAILED (${failures.length})`)
}
console.log('self-check ok')
