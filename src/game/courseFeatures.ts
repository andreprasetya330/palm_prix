import {getTrackSurface,ROAD_HALF_WIDTH} from './trackLayout'

export type TrackFeature={id:number;t:number;lane:number;x:number;y:number;z:number;pitch:number;bank:number;nx:number;nz:number;tx:number;tz:number}
function feature(id:number,t:number,lane:number):TrackFeature{
 const s=getTrackSurface(t,lane),p=s.point
 return {id,t,lane,x:p.x,y:p.y,z:p.z,pitch:s.pitch,bank:s.bank,nx:s.normal.x,nz:s.normal.z,tx:s.tangent.x,tz:s.tangent.z}
}
// Pick a line: racing tokens fan into three lanes; boost strips reward the wider outer line.
export const BOOST_PADS=[.13,.36,.61,.83].map((t,id)=>feature(id,t,(id%2?1:-1)*ROAD_HALF_WIDTH*.48))
export const RACE_TOKENS=[.07,.22,.43,.55,.73,.92].flatMap((t,group)=>[-1,0,1].map((side,i)=>feature(group*3+i,t,side*ROAD_HALF_WIDTH*.45)))
export type CourseRewards={coins:number;collected:Set<string>;padCooldowns:number[];lastReward:'coin'|'boost'|null;rewardTimer:number}
export function createCourseRewards():CourseRewards{return {coins:0,collected:new Set(),padCooldowns:BOOST_PADS.map(()=>0),lastReward:null,rewardTimer:0}}

export function segmentDistanceSquared(ax:number,az:number,bx:number,bz:number,px:number,pz:number){
 const dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz
 const t=length>0?Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/length)):0
 return (ax+dx*t-px)**2+(az+dz*t-pz)**2
}
/** Swept interval test avoids missing a pad when a slow display advances several fixed physics ticks. */
export function crossedPad(pad:TrackFeature,ax:number,az:number,bx:number,bz:number){
 const x=(ax-pad.x)*pad.nx+(az-pad.z)*pad.nz,z=(ax-pad.x)*pad.tx+(az-pad.z)*pad.tz
 const dx=(bx-ax)*pad.nx+(bz-az)*pad.nz,dz=(bx-ax)*pad.tx+(bz-az)*pad.tz
 let low=0,high=1
 for(const [value,delta,half] of [[x,dx,1.8],[z,dz,2.7]]){
  if(Math.abs(delta)<1e-8){if(Math.abs(value)>half)return false;continue}
  const a=(-half-value)/delta,b=(half-value)/delta
  low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b))
  if(low>high)return false
 }
 return true
}
export function updateCourseRewards(rewards:CourseRewards,lap:number,ax:number,az:number,bx:number,bz:number,speed:number,dt:number){
 rewards.rewardTimer=Math.max(0,rewards.rewardTimer-dt)
 if(rewards.rewardTimer===0)rewards.lastReward=null
 let boost=false
 for(const pad of BOOST_PADS){
  rewards.padCooldowns[pad.id]=Math.max(0,rewards.padCooldowns[pad.id]-dt)
  if(speed>5&&rewards.padCooldowns[pad.id]===0&&crossedPad(pad,ax,az,bx,bz)){
   rewards.padCooldowns[pad.id]=2;boost=true;rewards.lastReward='boost';rewards.rewardTimer=1.2
  }
 }
 for(const token of RACE_TOKENS){
  const key=`${lap}:${token.id}`
  if(!rewards.collected.has(key)&&segmentDistanceSquared(ax,az,bx,bz,token.x,token.z)<1.3**2){
   rewards.collected.add(key);rewards.coins++;rewards.lastReward='coin';rewards.rewardTimer=.65
  }
 }
 return boost
}
