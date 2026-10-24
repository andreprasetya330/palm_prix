import assert from 'node:assert/strict'
import {advanceRuntime,createRuntime,resetRuntime} from '../src/game/runtime'
import {DEFAULT_KART,FIXED_STEP} from '../src/game/kartPhysics'
const runtime=createRuntime()
const kartIdentity=runtime.kart,visualIdentity=runtime.visual,raceIdentity=runtime.race
let publications=0
runtime.publish=()=>publications++
runtime.readControls=()=>({steer:0,throttle:1,brake:0,item:false})
resetRuntime(runtime,true)
for(let i=0;i<400;i++)advanceRuntime(runtime,1/120)
assert.equal(runtime.race.phase,'racing')
assert(runtime.kart.speed>0)
assert.equal(runtime.kart,kartIdentity);assert.equal(runtime.visual,visualIdentity);assert.equal(runtime.race,raceIdentity)
assert(publications<40,'UI snapshots should stay near 10Hz, independent of 120Hz simulation')
const elapsed=runtime.race.elapsed
advanceRuntime(runtime,5)
assert.equal(runtime.race.elapsed,elapsed,'Returning from a suspended tab must not teleport the kart')
const normal=createRuntime(),slow=createRuntime()
for(const target of [normal,slow]){target.race.phase='racing';target.readControls=runtime.readControls}
for(let i=0;i<120;i++)advanceRuntime(normal,1/120)
for(let i=0;i<10;i++)advanceRuntime(slow,.1)
assert(Math.abs(normal.kart.x-slow.kart.x)<1e-8,'Ordinary slow rendering frames must retain simulation time')
assert(Math.abs(normal.kart.z-slow.kart.z)<1e-8)
assert(Math.abs(runtime.visual.x-runtime.kart.x)<Math.abs(runtime.kart.speed)*FIXED_STEP+.01)
runtime.kart.drifting=true;runtime.visual.drifting=true
resetRuntime(runtime)
assert.equal(runtime.kart.drifting,undefined);assert.equal(runtime.visual.drifting,undefined)
assert.equal(runtime.race.phase,'menu');assert.equal(runtime.kart.x,DEFAULT_KART.x)
console.log('Runtime checks passed: stable scene data, 10Hz UI, frame interpolation, slow-frame catch-up, tab suspension and reset.')
