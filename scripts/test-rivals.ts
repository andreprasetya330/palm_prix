import assert from 'node:assert/strict'
import {advanceRivals} from '../src/game/rivalAI'
import {createRaceStatus,racePosition,rivalAngle,playerProgressDistance} from '../src/game/raceLoop'
import {TRACK_LENGTH,getTrackSample} from '../src/game/trackLayout'
import {createRuntime,resetRuntime,advanceRuntime} from '../src/game/runtime'
import {DEFAULT_KART} from '../src/game/kartPhysics'
import {OBSTACLES,getObstaclePose} from '../src/game/obstacles'

const race=createRaceStatus(),start=race.rivals.map(r=>r.distance)
let elapsed=0,maxSpeed=0,laneChanges=0
for(let frame=0;frame<3600;frame++){
 elapsed+=1/60
 const before=race.rivals.map(r=>({...r}))
 advanceRivals(race,{distance:-.012*TRACK_LENGTH+30*elapsed,lane:0,speed:30},elapsed,1/60)
 for(let i=0;i<race.rivals.length;i++){
  const r=race.rivals[i],old=before[i]
  assert(r.distance>=old.distance)
  assert(r.distance-old.distance<=44/60+1e-6,'CPUs cannot teleport to catch the player')
  assert(Math.abs(r.lane-old.lane)<=2.8/60+1e-6,'Overtaking lanes must move smoothly')
  assert(Math.abs(r.lane)<=5.2,'All racing lines stay well inside the road')
  assert(r.speed<=44.000001,'CPU boosts stay below player boost speed')
  if(Math.abs(r.lane-old.lane)>.01)laneChanges++
  maxSpeed=Math.max(maxSpeed,r.speed)
  for(let j=0;j<OBSTACLES.length;j++){
   const delta=Math.abs(((r.distance/TRACK_LENGTH-OBSTACLES[j].t)%1+1)%1)
   if(Math.min(delta,1-delta)*TRACK_LENGTH<1.3){
    const hazard=getObstaclePose(j,elapsed)
    assert(Math.abs(r.lane-hazard.lane)>hazard.radius+.65,'CPU racing lines must clear hazards rather than pass through them')
   }
  }
 }
}
const pace=race.rivals.map((r,i)=>(r.distance-start[i])/elapsed)
assert(Math.max(...pace)>29,'The strongest CPUs must challenge a 30m/s player instead of cruising at 20m/s')
assert(maxSpeed>36,'CPUs should deploy boosts on suitable straights')
assert(laneChanges>100,'CPU lines must react to corners, traffic and hazards')
console.log('CPU average speeds (m/s):',pace.map(v=>v.toFixed(2)).join(', '),'peak',maxSpeed.toFixed(2))

const run=(fps:number)=>{
 const state=createRaceStatus()
 for(let i=0;i<fps*20;i++)advanceRivals(state,{distance:700,lane:0,speed:30},(i+1)/fps,1/fps)
 return state
}
const slow=run(30),fast=run(120)
for(let i=0;i<slow.rivals.length;i++){
 assert(Math.abs(slow.rivals[i].distance-fast.rivals[i].distance)<1e-5,'Frame rate cannot change opponent pace')
 assert(Math.abs(slow.rivals[i].lane-fast.rivals[i].lane)<1e-5)
}
const idle=createRaceStatus()
for(let i=0;i<7200;i++)advanceRivals(idle,{distance:-10,lane:0,speed:0},(i+1)/60,1/60)
assert(idle.rivals.every(r=>r.finishedAt!==null),'CPUs must finish independently instead of waiting for an idle player')
const distance=idle.rivals.map(r=>r.distance)
advanceRivals(idle,{distance:0,lane:0,speed:0},121,1/60)
assert.deepEqual(idle.rivals.map(r=>r.distance),distance,'Finished CPUs cannot continue farming laps')

const snapshot=createRaceStatus(),p=getTrackSample(.1).point
snapshot.rivals.forEach((r,i)=>{r.distance=(i<2?.2:.05)*TRACK_LENGTH})
assert.equal(racePosition(snapshot,p.x,p.z),3,'Standings must use actual simulated progress')
assert.equal(rivalAngle(0,0,snapshot.rivals),snapshot.rivals[0].distance/TRACK_LENGTH*Math.PI*2)
assert(Math.abs(playerProgressDistance(createRaceStatus(),DEFAULT_KART.x,DEFAULT_KART.z)+.012*TRACK_LENGTH)<.02)
const runtime=createRuntime();runtime.race.phase='racing'
advanceRuntime(runtime,.1)
assert(runtime.race.rivals.some((r,i)=>r.distance>start[i]),'The race runtime must advance CPUs')
resetRuntime(runtime)
assert.deepEqual(runtime.race.rivals,createRaceStatus().rivals)
assert.equal(runtime.race.rivalAccumulator,0)
console.log('CPU checks passed: competitive pace, boost limits, smooth passes, 30/120fps parity, independent finish, standings and reset.')
