import {useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import type {RaceRuntime} from '../game/runtime'
import {getRoadPose} from '../game/trackLayout'
/** A fixed pool celebrates the line crossing without allocations or additional textures. */
export function RaceCeremony({runtime}:{runtime:RaceRuntime}){
 const mesh=useRef<THREE.InstancedMesh>(null)
 const pieces=useMemo(()=>Array.from({length:120},(_,i)=>({side:i%2?1:-1,seed:(i*.61803398875)%1,offset:i%30/30,spin:i*2.399})),[])
 const dummy=useMemo(()=>new THREE.Object3D(),[]),color=useMemo(()=>new THREE.Color(),[])
 useFrame(()=>{
  const pool=mesh.current;if(!pool)return
  const r=runtime.race,k=runtime.visual,t=r.finishElapsed
  pool.visible=r.phase==='finish'&&t<6
  if(!pool.visible)return
  const road=getRoadPose(k.x,k.z),forwardX=Math.sin(k.yaw),forwardZ=Math.cos(k.yaw)
  for(let i=0;i<pieces.length;i++){
   const p=pieces[i],age=t-p.offset*1.1,life=Math.max(0,Math.min(1,age/3.3)),spread=2.5+life*(2+p.seed*5),along=(p.seed-.5)*14-life*12
   dummy.position.set(k.x+forwardZ*p.side*spread+forwardX*along,road.height+.6+Math.max(0,Math.sin(life*Math.PI))*(3+p.seed*4),k.z-forwardX*p.side*spread+forwardZ*along)
   dummy.rotation.set(p.spin+age*4,p.spin+age*3,age*5)
   dummy.scale.set(age>0&&life<1?.08:0,.16, .035);dummy.updateMatrix();pool.setMatrixAt(i,dummy.matrix)
   color.set(['#7df8ff','#ff66b9','#ffe99c','#b791ff'][i%4]);pool.setColorAt(i,color)
  }
  pool.instanceMatrix.needsUpdate=true;if(pool.instanceColor)pool.instanceColor.needsUpdate=true
 })
 return <instancedMesh ref={mesh} args={[undefined,undefined,120]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshBasicMaterial toneMapped={false}/></instancedMesh>
}
