import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { KartState } from '../game/kartPhysics'

/** Heading spring and velocity look-ahead keep turns readable without camera snapping. */
export function FollowCamera({ kart, showcase = false }: { kart: KartState; showcase?: boolean }) {
  const { camera } = useThree()
  const rig = useRef({heading:kart.yaw, initialized:false, mode:showcase, look:new THREE.Vector3(kart.x,1,kart.z), desired:new THREE.Vector3(), target:new THREE.Vector3()})
  useFrame(({clock}, delta)=>{
    const dt=Math.min(delta,.05), r=rig.current
    const speed=Math.abs(kart.speed), f=Math.min(1,speed/36)
    const angleError=Math.atan2(Math.sin(kart.yaw-r.heading),Math.cos(kart.yaw-r.heading))
    r.heading+=angleError*(1-Math.exp(-9*dt))
    if(showcase){
      const angle=kart.yaw+.6+Math.sin(clock.elapsedTime*.045)*.07
      r.desired.set(kart.x+Math.sin(angle)*10,3.8,kart.z+Math.cos(angle)*10)
      r.target.set(kart.x-Math.cos(angle)*2.8,1,kart.z+Math.sin(angle)*2.8)
    }else{
      const back=6.3+f*1.2
      r.desired.set(kart.x-Math.sin(r.heading)*back,3.1+f*.6,kart.z-Math.cos(r.heading)*back)
      const lookAhead=3.2+f*3.5
      r.target.set(kart.x+Math.sin(kart.yaw)*lookAhead+(kart.vx??0)*.045,1,kart.z+Math.cos(kart.yaw)*lookAhead+(kart.vz??0)*.045)
    }
    if(!r.initialized || r.mode!==showcase || camera.position.distanceToSquared(r.desired)>2500){
      camera.position.copy(r.desired);r.look.copy(r.target);r.heading=kart.yaw;r.initialized=true;r.mode=showcase
    }
    camera.position.lerp(r.desired,1-Math.exp(-12*dt))
    r.look.lerp(r.target,1-Math.exp(-13*dt));camera.lookAt(r.look)
    if(camera instanceof THREE.PerspectiveCamera){
      const fov=showcase?45:54+f*9+(kart.boostTimer>0?5:0)
      camera.fov=THREE.MathUtils.damp(camera.fov,fov,5,dt);camera.updateProjectionMatrix()
    }
  })
  return null
}
