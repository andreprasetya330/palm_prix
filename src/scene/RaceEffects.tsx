import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { KartState } from '../game/kartPhysics'
import {getRoadPose} from '../game/trackLayout'

/** A small reusable pool keeps turbo dust and drift sparks allocation-free in play. */
export function RaceEffects({kart}:{kart:KartState}) {
  const mesh=useRef<THREE.InstancedMesh>(null)
  const data=useMemo(()=>Array.from({length:64},()=>({x:0,y:-10,z:0,vx:0,vz:0,life:0})),[])
  const temp=useMemo(()=>new THREE.Object3D(),[])
  const cursor=useRef(0), clock=useRef(0)
  useFrame((_,delta)=>{
    const dt=Math.min(delta,.05);clock.current+=dt
    const drifting=Boolean(kart.drifting), boosting=kart.boostTimer>0
    if((drifting||boosting||kart.offroad) && Math.abs(kart.speed)>8 && clock.current>.025){
      clock.current=0
      for(const side of [-1,1]){
        const p=data[cursor.current++%data.length],fX=Math.sin(kart.yaw),fZ=Math.cos(kart.yaw)
        p.x=kart.x-fX*.8+fZ*side*.65;p.z=kart.z-fZ*.8-fX*side*.65;p.y=getRoadPose(p.x,p.z).height+.15
        p.vx=-fX*2+fZ*side*1.2;p.vz=-fZ*2-fX*side*1.2;p.life=.5
      }
    }
    if(!mesh.current)return
    const color=new THREE.Color(drifting?'#67deff':boosting?'#ff46bd':'#aa83d2')
    for(let i=0;i<data.length;i++){
      const p=data[i];p.life=Math.max(0,p.life-dt);p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=dt*.4
      temp.position.set(p.x,p.y,p.z);temp.scale.setScalar(p.life*.15);temp.updateMatrix()
      mesh.current.setMatrixAt(i,temp.matrix);mesh.current.setColorAt(i,color)
    }
    mesh.current.instanceMatrix.needsUpdate=true
    if(mesh.current.instanceColor)mesh.current.instanceColor.needsUpdate=true
  })
  return <instancedMesh ref={mesh} args={[undefined,undefined,64]} frustumCulled={false}><sphereGeometry args={[1,5,4]}/><meshBasicMaterial toneMapped={false}/></instancedMesh>
}
