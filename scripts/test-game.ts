import assert from 'node:assert/strict'
import { DEFAULT_KART, stepKart, type KartState } from '../src/game/kartPhysics'
import { CHECKPOINT_ANGLES, createRaceStatus, updateCheckpoints, racePosition, type RaceStatus } from '../src/game/raceLoop'
import type { ControlState } from '../src/game/controlState'

const idle: ControlState = { steer: 0, throttle: 0, brake: 0, item: false }
const drive: ControlState = { ...idle, throttle: 1 }
const racing = (): RaceStatus => ({ ...createRaceStatus(), phase: 'racing' })
const at = (race: RaceStatus, angle: number, radius = 18) => updateCheckpoints(race, Math.sin(angle) * radius * 1.15, Math.cos(angle) * radius)
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
      const radius = Math.hypot(kart.x / 1.15, kart.z)
      assert(radius >= 12.7 - 1e-9 && radius <= 23.1 + 1e-9)
      assert(Number.isFinite(kart.speed) && Number.isFinite(kart.yaw))
    }
  }
})
test('offroad decelerates and brake slows forward motion', () => {
  const road = stepKart({ ...DEFAULT_KART, speed: 27 }, drive, 0.05)
  const grass = stepKart({ ...DEFAULT_KART, z: 13, x: 0, speed: 27 }, drive, 0.05)
  assert(grass.offroad); assert(grass.speed < road.speed)
  assert(stepKart({ ...DEFAULT_KART, speed: 20 }, { ...idle, brake: 1 }, 0.05).speed < 20)
  assert.equal(racePosition(racing(), DEFAULT_KART.x, DEFAULT_KART.z), 1)
})
console.log(`${passed} game checks passed.`)
