import assert from 'node:assert/strict'
import {createRivalStates,advanceRivals} from '../src/game/rivalAI'
import {ABILITY_PICKUPS,advanceCombat,createAbilityState,collectAbility,activateAbility,tickAbilities} from '../src/game/abilities'
import {createRuntime,advanceRuntime,resetRuntime} from '../src/game/runtime'
import {DEFAULT_KART} from '../src/game/kartPhysics'
import {getObstaclePose} from '../src/game/obstacles'
const state=createAbilityState(),p=ABILITY_PICKUPS[0],kart={...DEFAULT_KART}
assert(collectAbility(state,0,p.x-4,p.z,p.x+4,p.z),'Swept motion must collect an item between rendered frames')
assert.equal(state.held,'turbo')
assert(activateAbility(state,kart));assert.equal(kart.boostTimer,2);assert.equal(state.held,null)
assert(!collectAbility(state,0,p.x,p.z,p.x,p.z),'A pickup row may only be collected once per lap')
assert(collectAbility(state,1,p.x,p.z,p.x,p.z),'The next lap replenishes pickup rows')
const runtime=createRuntime(),hazard=getObstaclePose(0,0)
runtime.race.phase='racing';runtime.abilities.held='shield'
Object.assign(runtime.kart,{x:hazard.x,z:hazard.z,yaw:hazard.yaw,speed:12,vx:Math.sin(hazard.yaw)*12,vz:Math.cos(hazard.yaw)*12})
runtime.readControls=()=>({steer:0,throttle:1,brake:0,item:true})
advanceRuntime(runtime,1/60)
assert.equal(runtime.obstacles.hits,0,'Activating a shield prevents the actual runtime hazard collision')
assert(runtime.abilities.shieldTimer>4)
assert.equal(runtime.kart.boostTimer,0,'Shield activation cannot also trigger rechargeable boost')
tickAbilities(runtime.abilities,5);assert.equal(runtime.abilities.shieldTimer,0)
resetRuntime(runtime);assert.equal(runtime.abilities.held,null);assert.equal(runtime.abilities.activations,0)
assert.equal(runtime.abilities.collected.size,0)
console.log('Abilities passed: swept pickup, per-lap refill, turbo, shield collision protection and reset.')
const makeContext=()=>({distance:100,lane:0,rivals:createRivalStates().map((r,i)=>({...r,distance:110+i*35,speed:30}))})
const pulse=createAbilityState(),pc=makeContext();pulse.held='pulse'
pc.rivals[1].distance=90;pc.rivals[2].distance=150;pc.rivals[3].distance=108;pc.rivals[3].finishedAt=9
assert(activateAbility(pulse,{...DEFAULT_KART},pc))
assert.equal(pulse.hits,2,'Pulse must hit nearby rivals ahead and behind, leaving distant and finished racers alone')
assert(pc.rivals[0].stunTimer>0&&pc.rivals[0].slowTimer>0&&pc.rivals[0].speed<20)
pulse.held='pulse';activateAbility(pulse,{...DEFAULT_KART},pc);assert.equal(pulse.hits,2,'Hit immunity prevents stacked stun locks')
const unbound=createAbilityState();unbound.held='bolt';assert(!activateAbility(unbound,{...DEFAULT_KART}));assert.equal(unbound.held,'bolt')
const seeker=createAbilityState(),sc=makeContext();seeker.held='bolt';sc.rivals[1].distance=105;sc.rivals[1].finishedAt=1
activateAbility(seeker,{...DEFAULT_KART},sc);assert.equal(seeker.shots[0].target,0,'Homing excludes already finished racers')
for(let i=0;i<40;i++){tickAbilities(seeker,1/60);advanceCombat(seeker,sc,1/60)}
assert.equal(seeker.hits,1);assert.equal(seeker.shots.length,0);assert.equal(seeker.lastTarget,0)
const trap=createAbilityState(),tc=makeContext();trap.held='mine';tc.lane=1;activateAbility(trap,{...DEFAULT_KART},tc)
assert.equal(trap.mines[0].distance,96);tc.rivals[0].lane=1;tc.rivals[0].distance=99;tc.rivals[0].speed=80
advanceCombat(trap,tc,.1);assert.equal(trap.hits,1,'A fast rival sweeping across a trap must be hit');assert.equal(trap.mines.length,0)
const clear=createAbilityState(),cc=makeContext();clear.held='mine';activateAbility(clear,{...DEFAULT_KART},cc);cc.rivals.forEach(r=>{r.distance=96;r.lane=4})
advanceCombat(clear,cc,.1);assert.equal(clear.hits,0,'Other lanes remain safe')
for(let i=0;i<150;i++)advanceCombat(clear,cc,.1);assert.equal(clear.mines.length,0,'Abandoned traps must expire')
for(let i=0;i<8;i++){clear.held='mine';activateAbility(clear,{...DEFAULT_KART},cc)}assert.equal(clear.mines.length,4,'World hazards have a bounded render pool')
const before=JSON.stringify(clear);advanceCombat(clear,cc,NaN);advanceCombat(clear,cc,5);assert.equal(JSON.stringify(clear),before)
for(let i=0;i<300;i++)advanceRivals({rivals:pc.rivals,rivalAccumulator:0,totalLaps:3},{distance:100,lane:0,speed:0},i/60,1/60)
assert.equal(pc.rivals[0].stunTimer,0);assert.equal(pc.rivals[0].slowTimer,0);assert(pc.rivals[0].speed>25,'Disrupted CPU must recover competitive speed')
const offensive=createRuntime();offensive.race.phase='racing';offensive.abilities.held='pulse';offensive.readControls=()=>({steer:0,throttle:0,brake:0,item:true});advanceRuntime(offensive,1/60)
assert.equal(offensive.kart.boostTimer,0,'Offensive item must consume the input without also triggering nitro')
assert(offensive.abilities.hits>0,'Offensive effect must reach actual runtime opponents')
resetRuntime(offensive);assert.equal(offensive.abilities.hits,0);assert.equal(offensive.abilities.mines.length,0);assert.equal(offensive.abilities.shots.length,0)
console.log('PASS offensive radius/eligibility, homing, swept traps, safe lanes, immunity, CPU recovery, bounded pools, expiry and runtime reset')
