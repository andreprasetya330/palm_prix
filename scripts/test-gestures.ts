import assert from 'node:assert/strict'
import { GestureMapper } from '../src/vision/gestureMapper'
import { DEFAULT_CALIBRATION } from '../src/vision/calibration'
import type { HandSample } from '../src/vision/landmarks'

const hand = (x: number, height: number, isFist = true, depth = 0): HandSample => ({
  grip: { x, y: height }, height, depth, isFist, yaw: -Math.PI / 2,
  landmarks: Array.from({ length: 21 }, () => ({ x, y: height, z: depth })),
})
const update = (mapper: GestureMapper, hands: HandSample[]) => mapper.update(hands, DEFAULT_CALIBRATION, 16)

// Closed grips accelerate equally throughout the frame, even after abrupt depth changes.
for (const height of [0.05, 0.4, 0.95]) {
  const mapper = new GestureMapper()
  for (const depth of [-0.5, 0.5, -1]) {
    const control = update(mapper, [hand(0.3, height, true, depth), hand(0.7, height, true, depth)])
    assert.ok(control.throttle > 0, `Closed fists must accelerate at height ${height}, depth ${depth}`)
    assert.equal(control.brake, 0)
  }
}
for (const hands of [[], [hand(0.3, 0.4)]]) {
  const mapper = new GestureMapper()
  update(mapper, [hand(0.3, 0.4), hand(0.7, 0.4)])
  const control = update(mapper, hands)
  assert.equal(control.throttle, 0, 'Losing either fist must release the accelerator immediately')
  assert.equal(control.brake, 0, 'Missing hands are not a brake gesture')
}
for (const hands of [[hand(0.3, 0.4, false)], [hand(0.3, 0.4, false), hand(0.7, 0.4)], [hand(0.3, 0.4, false), hand(0.7, 0.4, false)]]) {
  const mapper = new GestureMapper()
  update(mapper, [hand(0.3, 0.4), hand(0.7, 0.4)])
  const control = update(mapper, hands)
  assert.equal(control.throttle, 0)
  assert.ok(control.brake > 0, 'An open hand must brake')
  const resumed = update(mapper, [hand(0.3, 0.4), hand(0.7, 0.4)])
  assert.equal(resumed.brake, 0, 'Closing fists releases the brake immediately')
  assert.ok(resumed.throttle > 0)
}
const mapper = new GestureMapper()
assert.ok(update(mapper, [hand(0.3, 0.3), hand(0.7, 0.6)]).steer > 0)
mapper.reset()
assert.ok(update(mapper, [hand(0.3, 0.6), hand(0.7, 0.3)]).steer < 0)
console.log('Gesture regressions passed: two-fist throttle, height/depth independence, open-hand brake, tracking loss, steering.')
