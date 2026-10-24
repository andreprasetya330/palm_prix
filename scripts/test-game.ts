import assert from 'node:assert/strict'
import { DEFAULT_KART, stepKart, type KartState } from '../src/game/kartPhysics'
import { CHECKPOINT_ANGLES, createRaceStatus, updateCheckpoints, racePosition, type RaceStatus } from '../src/game/raceLoop'
import type { ControlState } from '../src/game/controlState'
import { getTrackSample, nearestTrack, TRACK_LENGTH, ROAD_HALF_WIDTH } from '../src/game/trackLayout'

const idle: ControlState = { steer: 0, throttle: 0, brake: 0, item: false }
const drive: ControlState = { ...idle, throttle: 1 }
const racing = (): RaceStatus => ({ ...createRaceStatus(), phase: 'racing' })
const at = (race: RaceStatus, angle: number, radius = 18) => {
  const s = getTrackSample(angle / (Math.PI * 2))
  return updateCheckpoints(race, s.point.x + s.normal.x * (radius - 18), s.point.z + s.normal.z * (radius - 18))
}
const near = (a: number, b: number, tolerance = 1e-9) => assert(Math.abs(a - b) <= tolerance, `${a} must be close to ${b}`)
let passed = 0
function test(name: string, check: () => void) { check(); passed++; console.log(`PASS ${name}`) }

test('checkpoints must be visited in order and on the track', () => {
  const race = racing()
  assert.equal(at(race, Math.PI).checkpointsHit, 0)
  assert.equal(at(race, Math.PI / 2, 4).checkpointsHit, 0)
  assert.equal(at(race, Math.PI / 2, 28).checkpointsHit, 0)
  const first = at(race, Math.PI / 2)
  assert.equal(first.checkpointsHit, 1)
  assert.equal(at(first, Math.PI / 2).checkpointsHit, 1)
  assert.equal(at({ ...race, phase: 'countdown' }, Math.PI / 2).checkpointsHit, 0)
})
test('exactly three ordered circuits finish the race', () => {
  let race = racing()
  for (let lap = 1; lap <= 3; lap++) {
    for (const [i, angle] of CHECKPOINT_ANGLES.entries()) {
      race = at(race, angle)
      assert.equal(race.checkpointsHit, (lap - 1) * 4 + i + 1)
      if (lap < 3 || i < 3) assert.equal(race.phase, 'racing')
    }
    assert.equal(race.lap, Math.min(3, lap + 1))
  }
  assert.equal(race.phase, 'finish')
  assert.equal(at(race, Math.PI / 2), race)
})
test('oscillating across start cannot skip laps', () => {
  for (const initial of [racing(), { ...racing(), checkpointsHit: 3 }]) {
    let race = initial
    for (let i = 0; i < 200; i++) race = at(race, i % 2 ? 0.05 : -0.05)
    assert.equal(race.checkpointsHit, initial.checkpointsHit === 3 ? 4 : 0)
    assert.equal(race.phase, 'racing')
  }
})
test('boost cooldown rejects retrigger and becomes available again', () => {
  let kart = stepKart(DEFAULT_KART, { ...drive, item: true }, 1 / 60)
  assert(kart.boostTimer > 1 && kart.boostCooldown! > 4)
  const again = stepKart(kart, { ...drive, item: true }, 1 / 60)
  assert(again.boostTimer < kart.boostTimer)
  for (let i = 0; i < 310; i++) kart = stepKart(kart, idle, 1 / 60)
  assert.equal(kart.boostTimer, 0); assert.equal(kart.boostCooldown, 0)
  assert(stepKart(kart, { ...idle, item: true }, 1 / 60).boostTimer > 1)
})
test('steering direction, reverse steering, and stationary steering', () => {
  const moving = { ...DEFAULT_KART, speed: 20 }
  assert(stepKart(moving, { ...drive, steer: 1 }, 0.05).yaw < moving.yaw)
  assert(stepKart(moving, { ...drive, steer: -1 }, 0.05).yaw > moving.yaw)
  assert(stepKart({ ...moving, speed: -4 }, { ...idle, steer: 1 }, 0.05).yaw > moving.yaw)
  near(stepKart(DEFAULT_KART, { ...idle, steer: 1 }, 0.05).yaw, DEFAULT_KART.yaw)
})
test('long frames are capped; zero, negative, and invalid time do not advance', () => {
  assert.deepEqual(stepKart(DEFAULT_KART, drive, 10), stepKart(DEFAULT_KART, drive, 0.05))
  for (const dt of [0, -1, Number.NaN, Infinity]) assert.deepEqual(stepKart(DEFAULT_KART, drive, dt), DEFAULT_KART)
})
test('inner and outer barriers contain the kart during sustained driving', () => {
  for (const steer of [-1, 0, 1]) {
    let kart: KartState = { ...DEFAULT_KART }
    for (let i = 0; i < 1800; i++) {
      kart = stepKart(kart, { ...drive, steer, item: i % 360 === 0 }, 1 / 60)
      const distance = nearestTrack(kart.x, kart.z).distance
      assert(distance <= ROAD_HALF_WIDTH + 1.66)
      assert(Number.isFinite(kart.speed) && Number.isFinite(kart.yaw))
    }
  }
})
test('offroad decelerates and brake slows forward motion', () => {
  const road = stepKart({ ...DEFAULT_KART, speed: 27 }, drive, 0.05)
  const s = getTrackSample(0)
  const grass = stepKart({ ...DEFAULT_KART, x: s.point.x + s.normal.x * 5, z: s.point.z + s.normal.z * 5, speed: 27 }, drive, 0.05)
  assert(grass.offroad); assert(grass.speed < road.speed)
  assert(stepKart({ ...DEFAULT_KART, speed: 20 }, { ...idle, brake: 1 }, 0.05).speed < 20)
  assert.equal(racePosition(racing(), DEFAULT_KART.x, DEFAULT_KART.z), 1)
})
test('shared circuit projection, closure, and non-circular shape', () => {
  const start = getTrackSample(0), end = getTrackSample(1)
  near(start.point.distanceTo(end.point), 0)
  assert(TRACK_LENGTH > 200)
  const radii: number[] = []
  for (let i = 0; i < 100; i++) {
    const s = getTrackSample(i / 100)
    const n = nearestTrack(s.point.x, s.point.z)
    assert(n.distance < 0.01)
    const progressDiff = Math.abs(n.t - i / 100)
    assert(Math.min(progressDiff, 1 - progressDiff) < 0.001)
    near(s.tangent.dot(s.normal), 0, 1e-6)
    radii.push(s.point.length())
  }
  assert(Math.max(...radii) - Math.min(...radii) > 12)
})
test('brake holds a stopped kart without reversing', () => {
  let kart = { ...DEFAULT_KART, speed: 12 }
  for (let i = 0; i < 600; i++) kart = stepKart(kart, { ...idle, brake: 1 }, 1 / 60)
  assert(Math.abs(kart.speed) < 0.001)
})
test('launch reaches 90 km/h in under two seconds on the starting straight', () => {
  let kart = { ...DEFAULT_KART }, seconds = 0
  while (kart.speed < 25 && seconds < 2) { kart = stepKart(kart, drive, 1 / 120); seconds += 1 / 120 }
  assert(kart.speed >= 25)
  console.log(`  Measured 0–90 km/h: ${seconds.toFixed(3)} s`)
})
test('fixed simulation gives matching trajectories at 30, 60, 120 and 144 fps', () => {
  const samples = [30, 60, 120, 144].map(fps => {
    let kart = { ...DEFAULT_KART }
    for (let i = 0; i < fps; i++) kart = stepKart(kart, { ...drive, steer: -0.2 }, 1 / fps)
    return kart
  })
  for (const kart of samples) {
    near(kart.x, samples[0].x, 1e-8); near(kart.z, samples[0].z, 1e-8)
    near(kart.speed, samples[0].speed, 1e-8); near(kart.yaw, samples[0].yaw, 1e-8)
  }
})
test('a sustained corner drift charges and releasing it awards a mini turbo', () => {
  const s = getTrackSample(0.11)
  let kart: KartState = { ...DEFAULT_KART, x: s.point.x, z: s.point.z, yaw: s.yaw, speed: 24 }
  for (let i = 0; i < 90; i++) kart = stepKart(kart, { ...drive, steer: -0.65, drift: true }, 1 / 120)
  assert(kart.drifting && kart.driftCharge! >= 0.65)
  assert.equal(kart.boostTimer, 0)
  kart = stepKart(kart, drive, 1 / 120)
  assert.equal(kart.drifting, false); assert.equal(kart.driftCharge, 0)
  assert(kart.boostTimer > 0.5)
  assert.equal(kart.boostCooldown, 0, 'mini turbo must not consume the separate item boost')
})
test('stationary drift and grass cannot farm turbo; braking cancels charge', () => {
  const stationary = stepKart(DEFAULT_KART, { ...idle, drift: true, steer: 1 }, 0.05)
  assert(!stationary.drifting); assert.equal(stationary.boostTimer, 0)
  const charged = { ...DEFAULT_KART, speed: 25, drifting: true, driftCharge: 2 }
  const braked = stepKart(charged, { ...idle, brake: 1 }, 1 / 120)
  assert(!braked.drifting); assert.equal(braked.boostTimer, 0)
  const s = getTrackSample(0)
  const grass = stepKart({ ...charged, x: s.point.x + s.normal.x * 5, z: s.point.z + s.normal.z * 5 }, drive, 1 / 120)
  assert(!grass.drifting); assert.equal(grass.boostTimer, 0)
})
test('boost input survives a frame shorter than a fixed step', () => {
  let kart = stepKart(DEFAULT_KART, { ...drive, item: true }, 1 / 1000)
  assert.equal(kart.boostTimer, 0)
  kart = stepKart(kart, drive, 1 / 120)
  assert(kart.boostTimer > 1)
})
console.log(`${passed} game checks passed.`)


