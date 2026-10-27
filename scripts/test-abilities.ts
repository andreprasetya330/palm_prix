import assert from 'node:assert/strict'
import {ABILITY_PICKUPS,createAbilityState,collectAbility,activateAbility,tickAbilities} from '../src/game/abilities'
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
