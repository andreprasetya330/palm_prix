import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type {RaceStatus} from '../game/raceLoop'
import type { KartState } from '../game/kartPhysics'
import {getRoadPose,getTrackSample} from '../game/trackLayout'

/** Heading spring and velocity look-ahead keep turns readable without camera snapping. */
export function FollowCamera({ kart, showcase = false,previewT,race }: { race?:RaceStatus;kart: KartState; showcase?: boolean;previewT?:number }) {
  const { camera } = useThree()
  const rig = useRef({heading:kart.yaw, initialized:false, mode:showcase, look:new THREE.Vector3(kart.x,1,kart.z), desired:new THREE.Vector3(), target:new THREE.Vector3()})
  useFrame(({clock}, delta)=>{
    const dt=Math.min(delta,.05), r=rig.current
    const speed=Math.abs(kart.speed), f=Math.min(1,speed/36)
    const height=getRoadPose(kart.x,kart.z).height
    const angleError=Math.atan2(Math.sin(kart.yaw-r.heading),Math.cos(kart.yaw-r.heading))
    r.heading+=angleError*(1-Math.exp(-9*dt))
    if(showcase&&previewT!==undefined){
      const section=getTrackSample(previewT)
      r.desired.copy(section.point).addScaledVector(section.tangent,-34).addScaledVector(section.normal,8);r.desired.y+=50
      r.target.copy(section.point).addScaledVector(section.tangent,8);r.target.y+=1
    }else if(showcase){
      const angle=kart.yaw+Math.PI+.65+Math.sin(clock.elapsedTime*.09)*.09
      r.desired.set(kart.x+Math.sin(angle)*7.2,height+2.6,kart.z+Math.cos(angle)*7.2)
      // Leave room for the menu while presenting the actual racer at the right.
      r.target.set(kart.x-Math.cos(angle)*1.65,height+.8,kart.z+Math.sin(angle)*1.65)
    }else if(race?.phase==='countdown'&&race.countdown>3){
      const t=(6-race.countdown)/3,angle=kart.yaw+1.0+t*1.65
      r.desired.set(kart.x+Math.sin(angle)*(5.8+t*1.5),height+1.5+t*1.7,kart.z+Math.cos(angle)*(5.8+t*1.5))
      r.target.set(kart.x,height+.8,kart.z)
    }else if(race?.phase==='finish'){
      const t=race.finishElapsed,turn=THREE.MathUtils.smoothstep(t,.6,3.8),angle=kart.yaw+Math.PI+(2.3+Math.sin(t*.22)*.15)*turn
      const radius=6.8-2*turn
      r.desired.set(kart.x+Math.sin(angle)*radius,height+2.9-1.5*turn,kart.z+Math.cos(angle)*radius)
      // Keep the moving racer left of the results card.
      r.target.set(kart.x+Math.cos(angle)*1.1*turn,height+.8,kart.z-Math.sin(angle)*1.1*turn)
    }else{
      const back=6.3+f*1.2
      r.desired.set(kart.x-Math.sin(r.heading)*back,height+3.1+f*.6,kart.z-Math.cos(r.heading)*back)
      const lookAhead=3.2+f*3.5
      r.target.set(kart.x+Math.sin(kart.yaw)*lookAhead+(kart.vx??0)*.045,1,kart.z+Math.cos(kart.yaw)*lookAhead+(kart.vz??0)*.045)
      r.target.y=getRoadPose(r.target.x,r.target.z).height+1
    }
    if(!r.initialized || r.mode!==showcase || camera.position.distanceToSquared(r.desired)>2500){
      camera.position.copy(r.desired);r.look.copy(r.target);r.heading=kart.yaw;r.initialized=true;r.mode=showcase
    }
    camera.position.lerp(r.desired,1-Math.exp(-12*dt))
    r.look.lerp(r.target,1-Math.exp(-13*dt));camera.lookAt(r.look)
    if(camera instanceof THREE.PerspectiveCamera){
      const fov=showcase?42:race?.phase==='finish'?43:race?.phase==='countdown'&&race.countdown>3?44:54+f*9+(kart.boostTimer>0?5:0)
      camera.fov=THREE.MathUtils.damp(camera.fov,fov,5,dt);camera.updateProjectionMatrix()
    }
  })
  return null
}
