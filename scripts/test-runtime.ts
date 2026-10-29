import assert from 'node:assert/strict'
import {advanceRuntime,createRuntime,resetRuntime} from '../src/game/runtime'
import {DEFAULT_KART,FIXED_STEP} from '../src/game/kartPhysics'
import {getObstaclePose} from '../src/game/obstacles'
import {BOOST_PADS,RACE_TOKENS} from '../src/game/courseFeatures'
import {getRoadPose,getTrackSurface} from '../src/game/trackLayout'
const runtime=createRuntime()
const kartIdentity=runtime.kart,visualIdentity=runtime.visual,raceIdentity=runtime.race
let publications=0
runtime.publish=()=>publications++
runtime.readControls=()=>({steer:0,throttle:1,brake:0,item:false})
resetRuntime(runtime,true)
for(let i=0;i<760;i++)advanceRuntime(runtime,1/120)
assert.equal(runtime.race.phase,'racing')
assert(runtime.kart.speed>0)
assert.equal(runtime.kart,kartIdentity);assert.equal(runtime.visual,visualIdentity);assert.equal(runtime.race,raceIdentity)
assert(publications<70,'UI snapshots should stay near 10Hz, independent of 120Hz simulation')
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
// Exercise the actual runtime collision path, rather than only the isolated hazard function.
const collision=createRuntime(),hazard=getObstaclePose(0,0)
collision.race.phase='racing'
Object.assign(collision.kart,{x:hazard.x,z:hazard.z,yaw:hazard.yaw,speed:10,vx:Math.sin(hazard.yaw)*10,vz:Math.cos(hazard.yaw)*10})
advanceRuntime(collision,1/60)
assert.equal(collision.obstacles.hits,1)
assert.equal(collision.obstacles.lastHit,'waterfront-works')
assert(collision.obstacles.flashTimer>0)
resetRuntime(collision)
assert.equal(collision.obstacles.hits,0);assert.equal(collision.obstacles.flashTimer,0)
assert(collision.obstacles.cooldowns.every(t=>t===0))
// All rewards/hazards must use the same elevated surface as racers and the road mesh.
for(const f of [...BOOST_PADS,...RACE_TOKENS]){
 const surface=getTrackSurface(f.t,f.lane),road=getRoadPose(f.x,f.z)
 assert(Math.abs(f.y-surface.height)<1e-10)
 assert(Math.abs(f.y-road.height)<.015)
}
for(let i=0;i<3;i++)for(const time of [0,2,9]){
 const obstacle=getObstaclePose(i,time),road=getRoadPose(obstacle.x,obstacle.z)
 assert(Math.abs(obstacle.y-road.height)<.015)
}
console.log('PASS runtime obstacle impact/reset and elevated reward/hazard alignment')
// The real final checkpoint must seal results and hand off to a moving road-following ceremony.
const ceremony=createRuntime(),line=getTrackSurface(.999,0)
Object.assign(ceremony.race,{phase:'racing',checkpointsHit:11,lap:3,elapsed:90})
Object.assign(ceremony.kart,{x:line.point.x,z:line.point.z,yaw:line.yaw,speed:30,vx:Math.sin(line.yaw)*30,vz:Math.cos(line.yaw)*30})
advanceRuntime(ceremony,1/120)
assert.equal(ceremony.race.phase,'finish')
const finishTime=ceremony.race.elapsed,finishPlace=ceremony.race.finishPosition,startX=ceremony.kart.x,startZ=ceremony.kart.z
ceremony.readControls=()=>({steer:1,throttle:0,brake:1,item:true})
for(let i=0;i<600;i++)advanceRuntime(ceremony,1/120)
assert.equal(ceremony.race.elapsed,finishTime,'Ceremony must not add to finish time')
assert.equal(ceremony.race.finishPosition,finishPlace,'Coasting rivals must not change player placing')
assert(ceremony.race.finishElapsed>4.9)
assert(Math.hypot(ceremony.kart.x-startX,ceremony.kart.z-startZ)>25,'Kart must continue moving after the line')
assert(ceremony.kart.speed>10&&ceremony.kart.speed<16)
assert.equal(ceremony.kart.boostTimer,0,'Input must not activate items during the ceremony')
resetRuntime(ceremony,true)
assert.equal(ceremony.race.countdown,6);assert.equal(ceremony.race.finishElapsed,0);assert.equal(ceremony.race.finishPosition,0)
for(let i=0;i<350;i++)advanceRuntime(ceremony,1/120)
assert.equal(ceremony.race.phase,'countdown');assert.equal(ceremony.kart.speed,0,'Grid intro must keep the kart grounded on its slot')
console.log('PASS cinematic grid, live finish handoff, sealed results, rolling ceremony and rematch reset')
