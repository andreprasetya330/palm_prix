import assert from 'node:assert/strict'
import { OBSTACLES, createObstacleState, getObstaclePose, updateObstacles, MIN_CLEAR_ROAD } from '../src/game/obstacles'
import { DEFAULT_KART } from '../src/game/kartPhysics'
import { getTrackSample, ROAD_HALF_WIDTH } from '../src/game/trackLayout'
for (const direction of [-1, 1]) {
 const s=getTrackSample(OBSTACLES[0].t),p=getObstaclePose(0,1)
 const previousX=p.x-s.tangent.x*10*direction,previousZ=p.z-s.tangent.z*10*direction
 const k={...DEFAULT_KART,x:p.x+s.tangent.x*10*direction,z:p.z+s.tangent.z*10*direction,speed:30*direction,vx:s.tangent.x*30*direction,vz:s.tangent.z*30*direction,yaw:s.yaw}
 const state=createObstacleState()
 assert(updateObstacles(state,k,previousX,previousZ,1,.05))
 assert.equal(state.hits,1);assert(Math.hypot(k.x-p.x,k.z-p.z)>p.radius+.65)
 assert(Math.abs(k.speed)<30)
 updateObstacles(state,k,k.x,k.z,1.01,.01);assert.equal(state.hits,1)
}
console.log('PASS forward/reverse swept hits, pushout, speed penalty and cooldown')
{
 const s=getTrackSample(OBSTACLES[0].t),p=getObstaclePose(0,1),offset=4
 const k={...DEFAULT_KART,x:p.x+s.tangent.x*10+s.normal.x*offset,z:p.z+s.tangent.z*10+s.normal.z*offset}
 assert(!updateObstacles(createObstacleState(),k,p.x-s.tangent.x*10+s.normal.x*offset,p.z-s.tangent.z*10+s.normal.z*offset,1,.05))
}
console.log('PASS clear lane does not collide')
assert(MIN_CLEAR_ROAD>=ROAD_HALF_WIDTH*2*2/3)
for(let time=0;time<30;time+=.05) for(let i=0;i<OBSTACLES.length;i++) {const p=getObstaclePose(i,time);assert(Math.abs(p.lane)+p.radius<ROAD_HALF_WIDTH)}
console.log('PASS moving hazard stays inside road and leaves over two thirds clear')
