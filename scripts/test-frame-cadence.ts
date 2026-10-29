import assert from 'node:assert/strict'
import { FrameCadence } from '../src/vision/frameCadence'

for (const refresh of [60,90,120,144]) for (const target of [20,30]) {
  const cadence = new FrameCadence()
  let captures = 0
  for (let i=0;i<refresh*10;i++) if (cadence.consume(i*1000/refresh,1000/target)) captures++
  assert.ok(Math.abs(captures-target*10)<=1, `${refresh}Hz RAF should deliver ${target}fps, got ${captures/10}`)
}
const jittered = new FrameCadence()
let count = 0
for (let i=0;i<600;i++) if (jittered.consume(i*1000/60+[0,0.6,-0.4][i%3],1000/30)) count++
assert.ok(Math.abs(count-300)<=1, 'Small RAF jitter cannot reduce 30fps to 20fps')
const stalled = new FrameCadence()
assert.equal(stalled.consume(0,1000/30),true)
assert.equal(stalled.consume(5000,1000/30),true)
assert.equal(stalled.consume(5001,1000/30),false,'A stall does not create catch-up bursts')
assert.equal(stalled.consume(5017,1000/30),false)
assert.equal(stalled.consume(5034,1000/30),true)
assert.equal(stalled.consume(5067,50),false,'Adaptive20Hz waits for the new interval')
assert.equal(stalled.consume(5084,50),true)
assert.equal(stalled.consume(NaN,50),false)
// The caller invokes consume only after its one-in-flight guard clears.
const busy = new FrameCadence()
let finishedAt=0, sent=0
for(let i=0;i<600;i++) {
  const now=i*1000/60
  if(now>=finishedAt && busy.consume(now,1000/30)) { sent++; finishedAt=now+80 }
}
assert.ok(sent<=121,'Slow inference cannot queue captures')
console.log('Capture pacing passed: 20/30fps across60–144Hz, RAF jitter, stall recovery, adaptive rate, and slow inference.')
