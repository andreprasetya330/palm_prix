/**
 * Headless feel checks. Run: npx tsx src/aaa/physics/selfCheck.ts
 */
import type { ControlState } from '../../game/controlState'
import { DEFAULT_KART } from '../../game/kartPhysics'
import { sampleCameraFollow } from './cameraFollow'
import { wrapAngle } from './math'
import { stepKart } from './stepKart'
import {
  groundHeight,
  gridPose,
  ovalAngle,
  ovalNormal,
  ovalRadius,
  ovalTangent,
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
  check('spawn on grid', Math.abs(ovalRadius(k.x, k.z) - 18) < 0.4, `r=${ovalRadius(k.x, k.z)}`)
  check('spawn yaw', Math.abs(wrapAngle(k.yaw - grid.yaw)) < 0.05)
  check('spawn finite', finiteKart(k))
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
    { x: 0, z: 18, yaw: 0, speed: 0, boostTimer: 0, vx: 18, vz: 2, sim: 1 } as AaaKartState,
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
  let k = stepKart({ x: 0, z: 22.2, yaw: 0, speed: 40, boostTimer: 0 }, ctrl({ throttle: 1 }), 0.05)
  let maxZ = k.z
  for (let i = 0; i < 12; i++) {
    k = stepKart(k, ctrl({ throttle: 1 }), 0.05)
    maxZ = Math.max(maxZ, k.z)
  }
  check('no tunnel through outer wall', maxZ < 25.5, `maxZ=${maxZ.toFixed(2)}`)
  check('wall contact finite', finiteKart(k))

  k = stepKart({ x: -2, z: 22.3, yaw: 0.55, speed: 26, boostTimer: 0 }, ctrl({ throttle: 1 }), 1 / 60)
  const before = k.x
  k = hold(k, ctrl({ throttle: 1, steer: 0.2 }), 0.8)
  check('angled hit keeps sliding', Math.abs(k.x - before) > 3, `dx=${(k.x - before).toFixed(2)} z=${k.z.toFixed(2)}`)
  check('slide stays outside the post line', k.z < 25.2, `z=${k.z.toFixed(2)}`)

  k = stepKart({ x: 0, z: 22.5, yaw: 0, speed: 18, boostTimer: 0 }, ctrl({}), 1 / 60)
  k = hold(k, ctrl({ throttle: 1, steer: 0 }), 0.8)
  const stuckZ = k.z
  k = hold(k, ctrl({ throttle: 1, steer: 1 }), 1.4)
  check('not stuck on wall', Math.abs(k.x) > 4, `x=${k.x.toFixed(2)} z=${stuckZ.toFixed(2)}→${k.z.toFixed(2)}`)
  check('stuck-test finite', finiteKart(k))
}

function testOffTrack(): void {
  let k = stepKart({ x: 0, z: 30, yaw: Math.PI, speed: 28, boostTimer: 0 }, ctrl({}), 1 / 60)
  check('grass surface', k.surface === 'grass', k.surface)
  k = hold(k, ctrl({ throttle: 1 }), 0.85)
  check('grass bogs speed', Math.abs(k.speed) < 16, `speed=${k.speed.toFixed(2)}`)
  check('grass still grips', Math.abs(slipOf(k)) < 0.35, `slip=${slipOf(k).toFixed(2)}`)

  k = stepKart({ x: 0, z: 0, yaw: 0, speed: 20, boostTimer: 0 }, ctrl({}), 1 / 60)
  k = hold(k, ctrl({ throttle: 1 }), 0.7)
  check('water is slow', k.surface === 'water' && Math.abs(k.speed) < 10, `${k.surface} ${k.speed.toFixed(2)}`)
  check('water not stuck at origin', Math.hypot(k.x, k.z) > 0.4, `pos ${k.x.toFixed(2)},${k.z.toFixed(2)}`)
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

function testNaN(): void {
  const k = stepKart(
    { x: Number.NaN, z: 0, yaw: 0, speed: 0, boostTimer: 0 },
    ctrl({ throttle: 1, steer: Number.NaN }),
    Number.NaN,
  )
  check('nan input recovers', finiteKart(k))
}

testSpawn()
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
testNaN()

if (failures.length) {
  console.error(`SELF-CHECK FAILED (${failures.length})`)
  for (const f of failures) console.error(' - ' + f)
  process.exit(1)
}
console.log('self-check ok')
