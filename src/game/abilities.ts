import { getTrackSurface } from './trackLayout'
import { segmentDistanceSquared } from './courseFeatures'
import type { KartState } from './kartPhysics'
import type {RivalState} from './rivalAI'

export type Ability = 'turbo' | 'shield' | 'pulse' | 'bolt' | 'mine'
export const ABILITY_INFO:Record<Ability,{name:string;hint:string;color:string;glyph:string}>={
 turbo:{name:'OVERDRIVE',hint:'2 SECOND TURBO',color:'#ffbf67',glyph:'»'},
 shield:{name:'PHASE SHIELD',hint:'BLOCK TRACK HAZARDS',color:'#6ef4ff',glyph:'◇'},
 pulse:{name:'SHOCKWAVE',hint:'HIT NEARBY RIVALS · 24 M',color:'#ed7cff',glyph:'◎'},
 bolt:{name:'NEON SEEKER',hint:'LOCK ON TO A RIVAL AHEAD',color:'#ff669e',glyph:'➤'},
 mine:{name:'ECHO TRAP',hint:'DROP A HAZARD BEHIND YOU',color:'#a7ff8a',glyph:'✦'},
}
export type CombatContext={rivals:RivalState[];distance:number;lane:number}
export type Bolt={distance:number;lane:number;target:number;life:number}
export type Mine={distance:number;lane:number;life:number}
export type Impact={distance:number;lane:number;age:number;kind:Ability}
export type AbilityState = {
 held:Ability|null;shieldTimer:number;pickupCount:number;activations:number
 lastEvent:'pickup'|'hit'|'miss'|Ability|null;eventTimer:number;eventId:number;collected:Set<string>
 shots:Bolt[];mines:Mine[];pulse:{distance:number;lane:number;age:number}|null;impacts:Impact[];hits:number;lastTarget:number|null;feedback:string;castId:number;lastCast:Ability|null
}
const kinds:Ability[]=['turbo','pulse','shield','bolt','mine']
export const ABILITY_PICKUPS=[.10,.32,.57,.80].flatMap((t,row)=>[-3.5,0,3.5].map((lane,column)=>{
 const surface=getTrackSurface(t,lane)
 return {id:row*3+column,row,t,lane,x:surface.point.x,y:surface.height,z:surface.point.z,kind:kinds[(row*3+column)%kinds.length]}
}))
export function createAbilityState():AbilityState{
 return {held:null,shieldTimer:0,pickupCount:0,activations:0,lastEvent:null,eventTimer:0,eventId:0,collected:new Set(),shots:[],mines:[],pulse:null,impacts:[],hits:0,lastTarget:null,feedback:'',castId:0,lastCast:null}
}
function event(state:AbilityState,kind:NonNullable<AbilityState['lastEvent']>,feedback=''){
 state.lastEvent=kind;state.eventTimer=1.5;state.eventId++;state.feedback=feedback
}
export function tickAbilities(state:AbilityState,dt:number){
 if(!Number.isFinite(dt)||dt<=0)return
 state.shieldTimer=Math.max(0,state.shieldTimer-dt);state.eventTimer=Math.max(0,state.eventTimer-dt)
 if(!state.eventTimer){state.lastEvent=null;state.feedback=''}
 for(const impact of state.impacts)impact.age+=dt
 state.impacts=state.impacts.filter(i=>i.age<.8)
 if(state.pulse){state.pulse.age+=dt;if(state.pulse.age>1)state.pulse=null}
}
function hit(state:AbilityState,context:CombatContext,index:number,kind:Ability){
 const r=context.rivals[index];if(r.finishedAt!==null||r.hitCooldown>0)return false
 r.stunTimer=1.1;r.slowTimer=2.8;r.hitCooldown=1.6;r.speed*=.48;r.boostTimer=0;r.driftCharge=0;r.laneVelocity=0
 state.hits++;state.lastTarget=index;state.impacts.push({distance:r.distance,lane:r.lane,age:0,kind});state.impacts=state.impacts.slice(-8)
 event(state,'hit',kind==='mine'?'ECHO TRAP HIT':kind==='bolt'?'SEEKER HIT':'SHOCKWAVE HIT');return true
}
/** Empty slots retain the rechargeable boost. Offensive items require the actual race context. */
export function activateAbility(state:AbilityState,kart:KartState,context?:CombatContext):boolean{
 if(!state.held)return false
 const kind=state.held
 if(kind!=='turbo'&&kind!=='shield'&&!context)return false
 if(kind==='turbo')kart.boostTimer=Math.max(kart.boostTimer,2)
 if(kind==='shield')state.shieldTimer=4.5
 state.held=null;state.activations++;state.castId++;state.lastCast=kind;state.lastTarget=null;event(state,kind,ABILITY_INFO[kind].name)
 if(context){
  if(kind==='pulse'){
   state.pulse={distance:context.distance,lane:context.lane,age:0}
   let count=0;for(let i=0;i<context.rivals.length;i++)if(Math.abs(context.rivals[i].distance-context.distance)<24&&hit(state,context,i,kind))count++
   if(!count)event(state,kind,'SHOCKWAVE · NO RIVALS IN RANGE')
  }
  if(kind==='bolt'){
   const target=context.rivals.map((r,i)=>({r,i})).filter(({r})=>r.finishedAt===null&&r.distance>context.distance+1&&r.distance<context.distance+125).sort((a,b)=>a.r.distance-b.r.distance)[0]
   state.shots.push({distance:context.distance+2,lane:context.lane,target:target?.i??-1,life:2.8});state.shots=state.shots.slice(-3)
   state.lastTarget=target?.i??null
  }
  if(kind==='mine'){state.mines.push({distance:context.distance-4,lane:context.lane,life:14});state.mines=state.mines.slice(-4)}
 }
 return true
}
/** Swept longitudinal collision prevents projectiles/traps tunnelling at low render rates. */
export function advanceCombat(state:AbilityState,context:CombatContext,dt:number){
 if(!Number.isFinite(dt)||dt<=0||dt>.25)return
 state.shots=state.shots.filter(shot=>{
  shot.life-=dt;const previous=shot.distance;shot.distance+=78*dt
  const r=context.rivals[shot.target]
  if(r&&r.finishedAt===null){
   shot.lane+=(r.lane-shot.lane)*(1-Math.exp(-10*dt))
   if(previous<=r.distance+2&&shot.distance>=r.distance-2&&Math.abs(shot.lane-r.lane)<2.3){hit(state,context,shot.target,'bolt');return false}
  }
  if(shot.life<=0){event(state,'miss','SEEKER EXPIRED');return false}return true
 })
 state.mines=state.mines.filter(mine=>{
  mine.life-=dt;if(mine.life<=0)return false
  for(let i=0;i<context.rivals.length;i++){
   const r=context.rivals[i],previous=r.distance-r.speed*dt
   if(r.finishedAt===null&&Math.abs(r.lane-mine.lane)<2.1&&previous<=mine.distance+1.6&&r.distance>=mine.distance-1.6&&hit(state,context,i,'mine'))return false
  }
  return true
 })
}
export function collectAbility(state:AbilityState,lap:number,ax:number,az:number,bx:number,bz:number):boolean{
 if(state.held)return false
 for(const pickup of ABILITY_PICKUPS){
  const key=`${lap}:${pickup.row}`
  if(!state.collected.has(key)&&segmentDistanceSquared(ax,az,bx,bz,pickup.x,pickup.z)<1.65**2){state.collected.add(key);state.held=pickup.kind;state.pickupCount++;state.lastTarget=null;event(state,'pickup',ABILITY_INFO[pickup.kind].name);return true}
 }
 return false
}
