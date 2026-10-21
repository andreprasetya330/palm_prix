/**
 * Headless feel checks. Run: npx tsx src/aaa/physics/selfCheck.ts
 */
import * as THREE from 'three'
import type { ControlState } from '../../game/controlState'
import { DEFAULT_KART } from '../../game/kartPhysics'
import { createRaceStatus, updateCheckpoints, type RaceStatus } from '../../game/raceLoop'
import { sampleCameraFollow } from './cameraFollow'
import { wrapAngle } from './math'
import { stepKart } from './stepKart'
import './index'
import { LAGOON, projectTrack, trackLength } from './spline'
import {
  groundHeight,
  gridPose,
  overlapsCurb,
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

function hold(kart: AaaKartState, c: ControlState, seconds: number, dt = 1 / 60): AaaKartState {
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

function testSplineMirror(): void {
  const length = trackLength()
  check('loop length matches the ribbon', length > 130 && length < 145, `len=${length.toFixed(1)}`)
  const slot = projectTrack(0, 8)
  check('center slot sits on the straight', Math.abs(slot.lateral) < 0.05, `lat=${slot.lateral.toFixed(3)}`)
  check('straight travel is −Z', Math.abs(wrapAngle(Math.atan2(slot.tx, slot.tz) - Math.PI)) < 0.05)
  const back = projectTrack(-32, 8)
  check('back straight is on the line', Math.abs(back.lateral) < 0.2 && back.tz > 0.9, `lat=${back.lateral.toFixed(2)} tz=${back.tz.toFixed(2)}`)
  const nose = projectTrack(-16, -18)
  check('north corner reaches the bulge', Math.hypot(nose.x + 16, nose.z + 18) < 1.5, `p ${nose.x.toFixed(1)},${nose.z.toFixed(1)}`)
}

function testSpawn(): void {
  const grid = gridPose()
  check('countdown spawn stays in the center slot', DEFAULT_KART.x === 0 && DEFAULT_KART.z === 8 && Math.abs(DEFAULT_KART.yaw - Math.PI) < 1e-9)
  const k = stepKart({ ...DEFAULT_KART }, ctrl({}), 1 / 60)
  const surf = surfaceAt(k.x, k.z).kind
  check('spawn under the gate', Math.abs(k.x) < 0.4 && k.z > 7.2 && k.z < 8.8, `pos ${k.x.toFixed(2)},${k.z.toFixed(2)}`)
  check('spawn on asphalt', surf === 'asphalt', surf)
  check('spawn faces the straight', Math.abs(wrapAngle(k.yaw - grid.yaw)) < 0.05)
  check('spawn clear of curbs', !overlapsCurb(k.x, k.z))
  check('spawn matches the grid pose', Math.abs(k.x - grid.x) < 1e-6 && Math.abs(k.z - grid.z) < 1e-6)
  check('spawn finite', finiteKart(k))
}

function testOpeningRibbon(): void {
  let k = stepKart({ ...DEFAULT_KART }, ctrl({ throttle: 1 }), 1 / 60)
  let off = false
  let maxLat = 0
  let minZ = 99
  for (let i = 0; i < 70; i++) {
    k = stepKart(k, ctrl({ throttle: 1, steer: 0 }), 1 / 60)
    const proj = projectTrack(k.x, k.z)
    maxLat = Math.max(maxLat, Math.abs(proj.lateral))
    minZ = Math.min(minZ, k.z)
    if (surfaceAt(k.x, k.z).kind !== 'asphalt' || overlapsCurb(k.x, k.z)) off = true
  }
  check('opening second stays on the ribbon', !off && maxLat < 2.2, `lat=${maxLat.toFixed(2)} z=${minZ.toFixed(2)} off=${off}`)
  check('opening second heads down the straight', minZ < 4, `z=${minZ.toFixed(2)}`)
}

function testCurbWaterGrass(): void {
  let k = stepKart({ x: 4.1, z: 8, yaw: Math.PI, speed: 8, boostTimer: 0 }, ctrl({ throttle: 1 }), 1 / 60)
  k = hold(k, ctrl({ throttle: 1, steer: 0 }), 0.3)
  check(
    'curb deflects the chassis',
    !overlapsCurb(k.x, k.z) || k.y > 0.35,
    `lat=${projectTrack(k.x, k.z).lateral.toFixed(2)} y=${k.y.toFixed(2)}`,
  )

  k = stepKart({ x: LAGOON.x, z: LAGOON.z, yaw: 0, speed: 12, boostTimer: 0 }, ctrl({ throttle: 1 }), 1 / 60)
  k = hold(k, ctrl({ throttle: 1 }), 0.35)
  const wet = surfaceAt(k.x, k.z).kind === 'water'
  const pond = Math.hypot(k.x - LAGOON.x, k.z - LAGOON.z)
  check('water hard-rejects', !wet && pond > LAGOON.rx * 0.85, `d=${pond.toFixed(2)} ${surfaceAt(k.x, k.z).kind}`)
  check('reject throws spray', k.spray > 0.4, `spray=${k.spray.toFixed(2)}`)
  check('reject finite', finiteKart(k))

  k = stepKart({ x: 8.2, z: 8, yaw: Math.PI, speed: 16, boostTimer: 0 }, ctrl({}), 1 / 60)
  check('grass is not asphalt', surfaceAt(k.x, k.z).kind === 'grass', surfaceAt(k.x, k.z).kind)
  k = hold(k, ctrl({ throttle: 1, steer: 0 }), 0.45)
  check('grass chews the run', k.dust > 0.45 && Math.abs(k.speed) < 18, `dust=${k.dust.toFixed(2)} v=${k.speed.toFixed(2)} ${k.surface}`)

  k = stepKart({ x: 5.4, z: 10, yaw: Math.PI, speed: 14, boostTimer: 0 }, ctrl({}), 1 / 60)
  check('sand shoulder is sand', k.surface === 'sand', k.surface)
  k = hold(k, ctrl({ throttle: 1 }), 0.35)
  check('sand is slower than the straight', Math.abs(k.speed) < 14, `v=${k.speed.toFixed(2)}`)
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
    { x: 0, z: 12, y: 0, yaw: Math.PI, speed: 0, boostTimer: 0, vx: 14, vz: -6, sim: 1 } as AaaKartState,
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
  let k = stepKart({ x: 0, z: 12, yaw: Math.PI, speed: 28, boostTimer: 0 }, ctrl({}), 1 / 60)
  k = hold(k, ctrl({ brake: 1 }), 0.9)
  check('brake dumps speed', k.speed < 2, `speed=${k.speed.toFixed(2)}`)
  k = hold(k, ctrl({ brake: 1 }), 0.6)
  check('reverse crawl', k.speed < -3, `speed=${k.speed.toFixed(2)}`)
}

function testBoostAndDrift(): void {
  let k = stepKart({ x: 0, z: 12, yaw: Math.PI, speed: 22, boostTimer: 0 }, ctrl({}), 1 / 60)
  k = stepKart(k, ctrl({ throttle: 1, item: true }), 1 / 60)
  check('straight space boosts', k.boostTimer > 0.8, `boost=${k.boostTimer}`)

  k = stepKart({ x: 0, z: 12, yaw: Math.PI, speed: 22, boostTimer: 0 }, ctrl({}), 1 / 60)
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
  let k = stepKart({ x: 3.3, z: 12, yaw: Math.PI, speed: 20, boostTimer: 0 }, ctrl({ throttle: 1 }), 1 / 60)
  const z0 = k.z
  k = hold(k, ctrl({ throttle: 1, steer: 0 }), 0.45)
  check('curb contact keeps sliding', z0 - k.z > 4, `dz=${(z0 - k.z).toFixed(2)}`)
  check('slide stays off the curb mesh', !overlapsCurb(k.x, k.z), `lat=${projectTrack(k.x, k.z).lateral.toFixed(2)}`)

  k = stepKart({ x: 5.35, z: 11.2, yaw: Math.PI, speed: 18, boostTimer: 0 }, ctrl({ throttle: 1 }), 1 / 60)
  k = hold(k, ctrl({ throttle: 1, steer: 0 }), 0.55)
  const pylon = Math.hypot(k.x - 5.35, k.z - 8.15)
  check('pylon slides the body', pylon > 1.2, `d=${pylon.toFixed(2)} pos ${k.x.toFixed(2)},${k.z.toFixed(2)}`)
  check('pylon does not stop the kart', Math.hypot(k.vx, k.vz) > 3, `v=${Math.hypot(k.vx, k.vz).toFixed(2)}`)

  k = stepKart({ x: -8.2, z: 2.2, yaw: 0, speed: 4, boostTimer: 0 }, ctrl({}), 1 / 60)
  const palm = Math.hypot(k.x + 8.2, k.z - 2.2)
  check('palm pushes the chassis out', palm > 0.9, `d=${palm.toFixed(2)}`)
  check('wall contact finite', finiteKart(k))
}

function testAir(): void {
  const start = stepKart(
    {
      x: 0,
      z: 12,
      yaw: Math.PI,
      speed: 10,
      boostTimer: 0,
      y: 3,
      vx: 0,
      vz: -10,
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
  check('default ground restored', groundHeight(0, 8) === 0)
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
    if (!finiteKart(k) || worst > 80) break
  }
  check('storm stays finite', finiteKart(k), `pos ${k.x},${k.z}`)
  check('storm stays in bounds', worst < 80, `r=${worst.toFixed(1)}`)
}

function testLaps(): void {
  let k = stepKart({ ...DEFAULT_KART }, ctrl({ throttle: 1 }), 1 / 60)
  const length = trackLength()
  let prevD = projectTrack(k.x, k.z).distance
  let progress = 0
  let prevCam = sampleCameraFollow(k)
  let maxCamJump = 0
  let maxLat = 0
  let sawNorth = false
  let sawBack = false
  let sawSouth = false
  let status: RaceStatus = { ...createRaceStatus(), phase: 'racing' }
  const dt = 1 / 60
  let time = 0
  for (let i = 0; i < 36 / dt; i++) {
    k = stepKart(k, ctrl({ throttle: 1, steer: 0 }), dt)
    const proj = projectTrack(k.x, k.z)
    maxLat = Math.max(maxLat, Math.abs(proj.lateral))
    let delta = proj.distance - prevD
    if (delta < -length * 0.5) delta += length
    if (delta > 0 && delta < 12) progress += delta
    prevD = proj.distance
    if (Math.hypot(k.x + 16, k.z + 18) < 5) sawNorth = true
    if (k.x < -28 && k.z > 0 && k.z < 14) sawBack = true
    if (Math.hypot(k.x + 16, k.z - 32) < 5) sawSouth = true
    status = updateCheckpoints(status, k.x, k.z)
    const cam = sampleCameraFollow(k)
    const jump = Math.hypot(cam.x - prevCam.x, cam.y - prevCam.y, cam.z - prevCam.z)
    maxCamJump = Math.max(maxCamJump, jump)
    prevCam = cam
    time += dt
    if (!finiteKart(k)) break
    if (progress > length * 2.15 && sawNorth && sawBack && sawSouth) break
  }
  check('quiet throttle follows the spline', progress > length * 2, `progress=${progress.toFixed(1)} len=${length.toFixed(1)} t=${time.toFixed(1)}`)
  check('two laps visit the whole loop', sawNorth && sawBack && sawSouth, `N=${sawNorth} B=${sawBack} S=${sawSouth}`)
  check('lap line stays off the curbs', maxLat < 3.2, `lat=${maxLat.toFixed(2)}`)
  check('lap time is arcade', time < 28, `t=${time.toFixed(1)}`)
  check('camera does not pop', maxCamJump < 6, `jump=${maxCamJump.toFixed(2)}`)
  check('laps finite', finiteKart(k))
  check(
    'oval gates off the ribbon still block a lap',
    status.checkpointsHit === 1 && status.lap === 1,
    `hits=${status.checkpointsHit} lap=${status.lap}`,
  )
}

function testPoseAndBoost(): void {
  const grid = gridPose()
  check('module leaves the countdown spawn on the center slot', DEFAULT_KART.x === grid.x && DEFAULT_KART.z === grid.z)

  let k = stepKart({ ...DEFAULT_KART }, ctrl({ throttle: 1, steer: 1 }), 1 / 60)
  k = hold(k, ctrl({ throttle: 1, steer: 1 }), 0.5)
  check('full lock rolls into the turn', k.roll < -0.2, `roll=${k.roll.toFixed(3)}`)
  check('front wheels turn', k.wheelSteer > 0.35, `wheel=${k.wheelSteer.toFixed(3)}`)
  check('corner leaves a skid read', k.skid > 0.4, `skid=${k.skid.toFixed(2)}`)

  k = stepKart({ x: grid.x, z: grid.z, yaw: grid.yaw, speed: 18, boostTimer: 0 }, ctrl({ throttle: 1, item: true }), 1 / 60)
  k = hold(k, ctrl({ throttle: 1 }), 0.45)
  check('boost widens the chase rig', k.camBack > 8.6, `back=${k.camBack.toFixed(2)} boost=${k.boostTimer.toFixed(2)}`)

  let braked = stepKart({ x: grid.x, z: grid.z, yaw: grid.yaw, speed: 22, boostTimer: 0 }, ctrl({}), 1 / 60)
  braked = hold(braked, ctrl({ brake: 1 }), 0.25)
  check('brake dips the nose', braked.pitch < -0.05, `pitch=${braked.pitch.toFixed(3)}`)
}

function testPictureHook(): void {
  let posed = stepKart({ ...DEFAULT_KART }, ctrl({ throttle: 1, steer: 1 }), 1 / 60)
  posed = hold(posed, ctrl({ throttle: 1, steer: 1 }), 0.45)
  const root = new THREE.Group()
  // A frame behind the published pose. The old position match missed this.
  root.position.set(posed.x + 4, 0.05, posed.z - 3)
  const plume = new THREE.Group()
  plume.position.set(0, 0.35, -1.05)
  root.add(plume)
  const wheels: THREE.Object3D[] = []
  for (const [x, y, z] of [
    [-0.58, 0.28, 0.62],
    [0.58, 0.28, 0.62],
    [-0.58, 0.28, -0.62],
    [0.58, 0.28, -0.62],
  ] as const) {
    const wheel = new THREE.Group()
    wheel.position.set(x, y, z)
    wheel.rotation.set(0.4, 0, Math.PI / 2)
    root.add(wheel)
    wheels.push(wheel)
  }
  root.updateMatrixWorld(true)
  const up = new THREE.Vector3().setFromMatrixColumn(root.matrix, 1)
  check('roll tilts the chassis', Math.abs(up.y) < 0.97, `up=${up.y.toFixed(3)} roll=${posed.roll.toFixed(3)}`)
  const stock = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0, Math.PI / 2))
  const drawn = new THREE.Quaternion().setFromRotationMatrix(wheels[0].matrix)
  const steerAng = drawn.angleTo(stock)
  check('front wheel steered', steerAng > 0.25, `ang=${steerAng.toFixed(3)} wheel=${posed.wheelSteer.toFixed(3)}`)
  check(
    'wheel spin stays on the axle',
    Math.abs(wheels[0].rotation.z - Math.PI / 2) < 1e-3 && Math.abs(wheels[0].rotation.y) < 1e-3,
    `euler ${wheels[0].rotation.x.toFixed(2)},${wheels[0].rotation.y.toFixed(2)},${wheels[0].rotation.z.toFixed(2)}`,
  )
  const bits = root.getObjectByName('palm-prix-surface-read')
  const skidOn = !!bits && bits.children.some((child) => child.name === 'skid' && child.visible)
  check('corner plants a skid', skidOn, `skid=${posed.skid.toFixed(2)}`)

  const aim = new THREE.Vector3(posed.x, 1, posed.z)
  const cam = new THREE.PerspectiveCamera()
  cam.position.set(posed.x, 3.6, posed.z + 7.2)
  cam.lookAt(aim)
  const plain = cam.position.distanceTo(aim)
  const side = Math.hypot(cam.position.x - posed.x, cam.position.z - (posed.z + 7.2))
  check('chase steps off the gate line', side > 1.2, `side=${side.toFixed(2)} dist=${plain.toFixed(2)}`)

  const boosted = stepKart(
    { ...posed, boostTimer: 1.2, speed: Math.max(posed.speed, 18) },
    ctrl({ throttle: 1 }),
    1 / 60,
  )
  const camB = new THREE.PerspectiveCamera()
  const aimB = new THREE.Vector3(boosted.x, 1, boosted.z)
  camB.position.set(boosted.x, 3.6, boosted.z + 7.2)
  camB.lookAt(aimB)
  const wide = camB.position.distanceTo(aimB)
  check('boost pulls the camera wider', wide > plain + 3, `plain=${plain.toFixed(2)} wide=${wide.toFixed(2)}`)
  root.updateMatrixWorld(true)
  const streaks = root.getObjectByName('palm-prix-surface-read')
  const streakOn = !!streaks && streaks.children.some((child) => child.name === 'streak' && child.visible)
  check('boost leaves streaks', streakOn && boosted.boostTimer > 0.5, `boost=${boosted.boostTimer.toFixed(2)}`)
  check('boost stretches the plume', plume.scale.y > 2, `sy=${plume.scale.y.toFixed(2)}`)

  let grass = stepKart({ x: 8.4, z: 8, yaw: Math.PI, speed: 12, boostTimer: 0 }, ctrl({}), 1 / 60)
  grass = hold(grass, ctrl({ throttle: 1, steer: 0 }), 0.25)
  root.updateMatrixWorld(true)
  const dustBits = root.getObjectByName('palm-prix-surface-read')
  const dustOn = !!dustBits && dustBits.children.some((child) => child.name === 'dust' && child.visible)
  check('grass throws dust', grass.surface === 'grass' && dustOn, `surf=${grass.surface} dust=${grass.dust.toFixed(2)}`)

  let hopper = stepKart({ ...DEFAULT_KART }, ctrl({}), 1 / 60)
  hopper = stepKart(
    { ...hopper, x: 3.1, z: 10, yaw: Math.PI / 2, speed: 22, vx: 22, vz: 0, y: 0 },
    ctrl({ throttle: 1, steer: 1 }),
    1 / 60,
  )
  root.updateMatrixWorld(true)
  check(
    'curb hop lifts the chassis',
    root.position.y > 0.28 || hopper.y > 0.28,
    `mesh=${root.position.y.toFixed(2)} sim=${hopper.y.toFixed(2)}`,
  )
}

function testNaN(): void {
  const k = stepKart(
    { x: Number.NaN, z: 0, yaw: 0, speed: 0, boostTimer: 0 },
    ctrl({ throttle: 1, steer: Number.NaN }),
    Number.NaN,
  )
  check('nan input recovers', finiteKart(k))
  check('nan recovery uses the center slot', Math.abs(k.x) < 1e-6 && Math.abs(k.z - 8) < 1e-6, `pos ${k.x},${k.z}`)
}

testSplineMirror()
testSpawn()
testOpeningRibbon()
testCurbWaterGrass()
testThrottle()
testNoIce()
testBrakeReverse()
testBoostAndDrift()
testWall()
testAir()
testElevationHook()
testStorm()
testLaps()
testPoseAndBoost()
testPictureHook()
testNaN()

if (failures.length) {
  console.error(`SELF-CHECK FAILED (${failures.length})`)
  for (const f of failures) console.error(' - ' + f)
  throw new Error(`SELF-CHECK FAILED (${failures.length})`)
}
console.log('self-check ok')
