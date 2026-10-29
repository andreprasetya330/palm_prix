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
export type CombatContext={rivals:RivalState[];distance:number;lane:number;owner?:number;peerAbilities?:AbilityState[];player?:{kart:KartState;distance:number;lane:number;abilities:AbilityState}}
export const CRYSTAL_RESPAWN=7
export type PickupBurst={id:number;kind:Ability;age:number}
export type Bolt={distance:number;lane:number;target:number;life:number}
export type Mine={distance:number;lane:number;life:number}
export type Impact={distance:number;lane:number;age:number;kind:Ability}
export type AbilityState = {
 held:Ability|null;shieldTimer:number;pickupCount:number;activations:number
 lastEvent:'pickup'|'hit'|'miss'|'damage'|'blocked'|Ability|null;eventTimer:number;eventId:number;collected:Set<string>
 shots:Bolt[];mines:Mine[];pulse:{distance:number;lane:number;age:number}|null;impacts:Impact[];hits:number;lastTarget:number|null;feedback:string;castId:number;lastCast:Ability|null;pickupBursts:PickupBurst[];holdTimer:number;stunTimer:number;hitCooldown:number;hitsTaken:number;nearbyCue:{id:number;kind:Ability|'pickup';distance:number}|null
}
const kinds:Ability[]=['turbo','pulse','shield','bolt','mine']
export const ABILITY_PICKUPS=[.10,.32,.57,.80].flatMap((t,row)=>[-3.5,0,3.5].map((lane,column)=>{
 const surface=getTrackSurface(t,lane)
 return {id:row*3+column,row,t,lane,x:surface.point.x,y:surface.height,z:surface.point.z,kind:kinds[(row*3+column)%kinds.length]}
}))
export function createAbilityState():AbilityState{
 return {held:null,shieldTimer:0,pickupCount:0,activations:0,lastEvent:null,eventTimer:0,eventId:0,collected:new Set(),shots:[],mines:[],pulse:null,impacts:[],hits:0,lastTarget:null,feedback:'',castId:0,lastCast:null,pickupBursts:[],holdTimer:0,stunTimer:0,hitCooldown:0,hitsTaken:0,nearbyCue:null}
}
function event(state:AbilityState,kind:NonNullable<AbilityState['lastEvent']>,feedback=''){
 if(kind==='damage'||kind==='blocked')state.lastTarget=null
 state.lastEvent=kind;state.eventTimer=1.5;state.eventId++;state.feedback=feedback
}
export function tickAbilities(state:AbilityState,dt:number){
 if(!Number.isFinite(dt)||dt<=0)return
 state.holdTimer=state.held?state.holdTimer+dt:0;state.stunTimer=Math.max(0,state.stunTimer-dt);state.hitCooldown=Math.max(0,state.hitCooldown-dt)
 for(const burst of state.pickupBursts)burst.age+=dt
 state.pickupBursts=state.pickupBursts.filter(b=>b.age<.65)
 state.shieldTimer=Math.max(0,state.shieldTimer-dt);state.eventTimer=Math.max(0,state.eventTimer-dt)
 if(!state.eventTimer){state.lastEvent=null;state.feedback=''}
 for(const impact of state.impacts)impact.age+=dt
 state.impacts=state.impacts.filter(i=>i.age<.8)
 if(state.pulse){state.pulse.age+=dt;if(state.pulse.age>1)state.pulse=null}
}
function actors(context:CombatContext){
 const rivals=context.rivals.map((r,index)=>({index,distance:r.distance,lane:r.lane,finished:r.finishedAt!==null})).filter(r=>r.index!==(context.owner??-1))
 if(context.owner!==undefined&&context.owner>=0&&context.player)rivals.push({index:-1,distance:context.player.distance,lane:context.player.lane,finished:false})
 return rivals
}
function hit(state:AbilityState,context:CombatContext,index:number,kind:Ability){
 const player=index===-1?context.player:undefined,r=context.rivals[index]
 if(!player&&(!r||r.finishedAt!==null))return false
 const shield=player?.abilities??context.peerAbilities?.[index]
 if(shield&&shield.shieldTimer>0){event(shield,'blocked','PHASE SHIELD · HIT BLOCKED');return true}
 if(player){
  const k=player.kart,a=player.abilities;if(a.hitCooldown>0)return false
  a.hitCooldown=2;a.stunTimer=1.1;a.hitsTaken++;k.speed*=.55;k.vx=(k.vx??0)*.55;k.vz=(k.vz??0)*.55;k.boostTimer=0;k.drifting=false;k.driftCharge=0
  event(a,'damage',`HIT BY ${ABILITY_INFO[kind].name}`)
 }else{
  if(r.hitCooldown>0)return false
  r.stunTimer=1.1;r.slowTimer=2.8;r.hitCooldown=1.6;r.speed*=.48;r.boostTimer=0;r.driftCharge=0;r.laneVelocity=0
 }
 const target=player??r
 state.hits++;state.lastTarget=index;state.impacts.push({distance:target.distance,lane:target.lane,age:0,kind});state.impacts=state.impacts.slice(-8)
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
   let count=0;for(const r of actors(context))if(!r.finished&&Math.abs(r.distance-context.distance)<24&&hit(state,context,r.index,kind))count++
   if(!count)event(state,kind,'SHOCKWAVE · NO RIVALS IN RANGE')
  }
  if(kind==='bolt'){
   const target=actors(context).filter(r=>!r.finished&&r.distance>context.distance+1&&r.distance<context.distance+125).sort((a,b)=>a.distance-b.distance)[0]
   state.shots.push({distance:context.distance+2,lane:context.lane,target:target?.index??-2,life:2.8});state.shots=state.shots.slice(-3)
   state.lastTarget=target?.index??null
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
  const r=actors(context).find(r=>r.index===shot.target)
  if(r&&!r.finished){
   shot.lane+=(r.lane-shot.lane)*(1-Math.exp(-10*dt))
   if(previous<=r.distance+2&&shot.distance>=r.distance-2&&Math.abs(shot.lane-r.lane)<2.3){hit(state,context,shot.target,'bolt');return false}
  }
  if(shot.life<=0){event(state,'miss','SEEKER EXPIRED');return false}return true
 })
 state.mines=state.mines.filter(mine=>{
  mine.life-=dt;if(mine.life<=0)return false
  for(const r of actors(context)){
   const speed=r.index===-1?context.player!.kart.speed:context.rivals[r.index].speed,previous=r.distance-speed*dt
   if(!r.finished&&Math.abs(r.lane-mine.lane)<2.1&&previous<=mine.distance+1.6&&r.distance>=mine.distance-1.6&&hit(state,context,r.index,'mine'))return false
  }
  return true
 })
}
export function collectAbility(state:AbilityState,lap:number,ax:number,az:number,bx:number,bz:number,cooldowns?:number[]):boolean{
 if(state.held)return false
 for(const pickup of ABILITY_PICKUPS){
  const key=`${lap}:${pickup.id}`
  if((cooldowns?cooldowns[pickup.id]<=0:!state.collected.has(key))&&segmentDistanceSquared(ax,az,bx,bz,pickup.x,pickup.z)<1.65**2){state.collected.add(key);if(cooldowns)cooldowns[pickup.id]=CRYSTAL_RESPAWN;state.pickupBursts.push({id:pickup.id,kind:pickup.kind,age:0});state.pickupBursts=state.pickupBursts.slice(-4);state.held=pickup.kind;state.holdTimer=0;state.pickupCount++;state.lastTarget=null;event(state,'pickup',ABILITY_INFO[pickup.kind].name);return true}
 }
 return false
}

/** Drivers wait for a useful tactical window rather than firing every frame. */
export function shouldUseRivalItem(state:AbilityState,context:CombatContext){
 if(!state.held||state.holdTimer<.9)return false
 const nearby=actors(context).filter(r=>!r.finished)
 switch(state.held){
  case 'turbo':return true
  case 'shield':return state.holdTimer>2||nearby.some(r=>Math.abs(r.distance-context.distance)<20)
  case 'pulse':return nearby.some(r=>Math.abs(r.distance-context.distance)<24)
  case 'bolt':return nearby.some(r=>r.distance>context.distance+2&&r.distance<context.distance+125)
  case 'mine':return nearby.some(r=>r.distance<context.distance&&context.distance-r.distance<45)
 }
}
