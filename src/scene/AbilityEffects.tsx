import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ABILITY_PICKUPS } from '../game/abilities'
import type { RaceRuntime } from '../game/runtime'
import { getRoadPose } from '../game/trackLayout'

/** One instanced draw for all pickups; protective shell follows the interpolated racer. */
export function AbilityEffects({runtime}:{runtime:RaceRuntime}) {
  const pickups=useRef<THREE.InstancedMesh>(null),shell=useRef<THREE.Group>(null)
  const shellMaterial=useRef<THREE.MeshBasicMaterial>(null)
  const temp=useMemo(()=>new THREE.Object3D(),[])
  const colors=useMemo(()=>({turbo:new THREE.Color('#ffb444'),shield:new THREE.Color('#64eaff')}),[])
  useFrame(({clock})=>{
    const time=clock.elapsedTime,lap=Math.floor(runtime.race.checkpointsHit/4)
    if(pickups.current) {
      for(const p of ABILITY_PICKUPS) {
        const hidden=runtime.abilities.collected.has(`${lap}:${p.row}`)
        temp.position.set(p.x,p.y+1.25+Math.sin(time*2.6+p.id)*.18,p.z)
        temp.rotation.set(.25,time*1.2+p.id,.35)
        temp.scale.setScalar(hidden?0:.68)
        temp.updateMatrix();pickups.current.setMatrixAt(p.id,temp.matrix);pickups.current.setColorAt(p.id,colors[p.kind])
      }
      pickups.current.instanceMatrix.needsUpdate=true
      if(pickups.current.instanceColor)pickups.current.instanceColor.needsUpdate=true
    }
    if(shell.current) {
      const k=runtime.visual,remaining=runtime.abilities.shieldTimer
      shell.current.visible=remaining>0
      shell.current.position.set(k.x,getRoadPose(k.x,k.z).height+1,k.z)
      shell.current.rotation.y=time*.65
      const pulse=1+Math.sin(time*5)*.025
      shell.current.scale.set(pulse,pulse*.8,pulse)
      if(shellMaterial.current)shellMaterial.current.opacity=remaining<1?.07+Math.abs(Math.sin(time*14))*.13:.14
    }
  })
  return <>
    <instancedMesh ref={pickups} args={[undefined,undefined,ABILITY_PICKUPS.length]} frustumCulled={false}>
      <octahedronGeometry args={[1,0]}/><meshStandardMaterial metalness={.45} roughness={.2} emissive="#ffffff" emissiveIntensity={.22}/>
    </instancedMesh>
    <group ref={shell} visible={false}>
      <mesh><icosahedronGeometry args={[1.75,2]}/><meshBasicMaterial ref={shellMaterial} color="#64eaff" transparent opacity={.14} depthWrite={false} toneMapped={false}/></mesh>
      <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[1.75,.035,5,48]}/><meshBasicMaterial color="#9cf5ff" toneMapped={false}/></mesh>
      <mesh rotation={[0,0,.6]}><torusGeometry args={[1.75,.018,4,48]}/><meshBasicMaterial color="#78cfff" toneMapped={false}/></mesh>
    </group>
  </>
}
