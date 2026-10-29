import assert from 'node:assert/strict'
import { GestureMapper, mergeControls } from '../src/vision/gestureMapper'
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

const handDrive = { steer: 0.4, throttle: 1, brake: 0, item: false }
const mixed = mergeControls(handDrive, { steer: 0, throttle: 0, brake: 0, item: false, drift: true })
assert.equal(mixed.drift, true, 'Shift drift must survive keyboard/hand control merging')
assert.equal(mixed.throttle, 1, 'Keyboard drift keeps fist acceleration')
assert.equal(mixed.steer, 0.4, 'Keyboard drift keeps wheel steering')

// Regression coverage for pose geometry and unstable detector ordering.
const { classifyPose, wheelAngle } = await import('../src/vision/landmarks')
const { HandStabilizer } = await import('../src/vision/handStabilizer')
function fixture(closed: boolean) {
  const points = Array.from({length:21},()=>({x:0,y:0,z:0}))
  for (const [i,base] of [5,9,13,17].entries()) {
    const x = (i-1)*0.25
    points[base] = {x,y:1,z:0}
    points[base+1] = {x,y:1.4,z:0}
    points[base+2] = closed ? {x,y:1.35,z:0.3} : {x,y:1.7,z:0}
    points[base+3] = closed ? {x,y:1.05,z:0.3} : {x,y:2,z:0}
  }
  return points
}
for (const closed of [true,false]) for (const angle of [0,0.8,1.8,3]) {
  const points = fixture(closed).map(({x,y,z})=>({x:2+(x*Math.cos(angle)-z*Math.sin(angle))*0.02,y:y*0.02-3,z:(x*Math.sin(angle)+z*Math.cos(angle))*0.02}))
  assert.equal(classifyPose(points),closed?'fist':'open','Pose classification must survive rotation, scale, translation')
}
assert.equal(classifyPose([]),'uncertain')
assert.equal(classifyPose(Array.from({length:21},()=>({x:0,y:0,z:0}))),'uncertain')
assert.ok(Math.abs(wheelAngle({...hand(0.2,0.2),aspectRatio:2},hand(0.4,0.6))-Math.PI/4)<1e-6)
const stabilizer = new HandStabilizer()
const pair = [{...hand(0.2,0.4),pose:'fist' as const},{...hand(0.8,0.4),pose:'fist' as const}]
assert.ok(stabilizer.update(pair,0).every(h=>!h.isFist),'A fresh grip needs confirmation')
const stable = stabilizer.update(pair,70)
assert.ok(stable.every(h=>h.isFist))
const swapped = stabilizer.update([...pair].reverse(),110)
assert.equal(swapped[0].trackingId,stable[1].trackingId)
assert.equal(swapped[1].trackingId,stable[0].trackingId)
assert.equal(stabilizer.update([{...pair[0],pose:'uncertain'}],150)[0].isFist,true)
assert.equal(stabilizer.update([{...pair[0],pose:'uncertain'}],250)[0].isFist,false)
assert.equal(stabilizer.update([{...pair[0],pose:'open'}],260)[0].pose,'open')
const lostMapper = new GestureMapper()
const turned = update(lostMapper,[hand(0.3,0.3),hand(0.7,0.6)])
const partial = update(lostMapper,[{...hand(0.3,0.3),yaw:-Math.PI}])
assert.ok(partial.steer>=0 && partial.steer<=turned.steer,'One hand cannot snap wheel steering to its yaw')
const uncertain = update(lostMapper,[{...hand(0.3,0.4,false),pose:'uncertain'}])
assert.equal(uncertain.brake,0)
console.log('3D pose, temporal stability, hand identity, aspect ratio, and safe partial-wheel tests passed.')

for (const pitch of [-Math.PI/2,0,Math.PI/2]) for (const yaw of [-Math.PI/2,0,Math.PI/2]) {
  const rotated = fixture(true).map(({x,y,z}) => {
    const py = y*Math.cos(pitch)-z*Math.sin(pitch), pz = y*Math.sin(pitch)+z*Math.cos(pitch)
    return { x:x*Math.cos(yaw)+pz*Math.sin(yaw), y:py, z:-x*Math.sin(yaw)+pz*Math.cos(yaw) }
  })
  assert.equal(classifyPose(rotated),'fist','Closed grip survives +/-90 degree pitch and yaw')
}
const occluded = fixture(true)
for (const base of [5,9]) for(let i=1;i<4;i++) occluded[base+i] = {...occluded[base]}
assert.equal(classifyPose(occluded),'uncertain','Collapsed/occluded fingers must not confidently drive or reverse')
const quickGrip = new HandStabilizer()
quickGrip.update(pair,0)
assert.ok(quickGrip.update(pair,34).every(h=>h.isFist),'Grip should confirm on the next 30Hz frame')

const { clampControl } = await import('../src/game/controlState')
const reversing = update(new GestureMapper(),[{...hand(0.3,0.4,false),pose:'open'}])
assert.equal(reversing.reverse,1,'A definite open palm explicitly requests reverse')
assert.ok(reversing.brake>0,'Reverse request also brakes forward motion')
assert.equal(uncertain.reverse,0,'Uncertain tracking cannot request reverse')
for(const pedal of [{throttle:1,brake:0},{throttle:0,brake:1}]) {
  const mixed = mergeControls(reversing,{steer:0,item:false,...pedal})
  assert.equal(mixed.reverse,0,'Keyboard pedals override hand reverse')
  assert.equal(mixed.throttle,pedal.throttle)
  assert.equal(mixed.brake,pedal.brake)
}
assert.equal(clampControl({...reversing,reverse:Infinity}).reverse,0)
assert.equal(clampControl({...reversing,reverse:2}).reverse,1)
console.log('Quarter-turn fists, partial occlusion, 30Hz confirmation, palm reverse and keyboard override tests passed.')


const reacquired = new GestureMapper()
update(reacquired,[{...hand(0.2,0.4),trackingId:1},{...hand(0.8,0.4),trackingId:2}])
update(reacquired,[{...hand(0.2,0.4),trackingId:2},{...hand(0.8,0.7),trackingId:3}])
assert.ok(reacquired.debug.wheelAngle! > 0.1, "A new pair must not reuse the surviving hand for both wheel grips")

// Natural steering grips can bend mainly at the MCP knuckles. The old
// PIP/DIP-only test rejected these even with all 21 landmarks present.
const knuckleGrip = fixture(true)
for (const base of [5,9,13,17]) for (let joint=1;joint<=3;joint++) {
  knuckleGrip[base+joint] = {x:knuckleGrip[base].x,y:1-joint*0.1,z:joint*0.12}
}
for (const angle of [0,0.7,1.5,2.4]) {
  const turned = knuckleGrip.map(({x,y,z})=>({x:x*Math.cos(angle)-z*Math.sin(angle),y,z:x*Math.sin(angle)+z*Math.cos(angle)}))
  assert.equal(classifyPose(turned),'fist','Knuckle-dominant grips must accelerate while turning')
}
const partialOpen = fixture(false)
for (const base of [5,9]) for(let i=1;i<=3;i++) partialOpen[base+i] = {...partialOpen[base]}
assert.equal(classifyPose(partialOpen),'uncertain','Two visible fingers cannot trigger reverse')
console.log('Natural knuckle grips, turned grips and incomplete open palm regressions passed.')
