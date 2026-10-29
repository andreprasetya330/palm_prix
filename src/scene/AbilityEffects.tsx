import { useEffect,useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {CombatEffects} from './CombatEffects'
import {ABILITY_PATHS} from '../game/abilityArt'
import {ABILITY_INFO,type Ability, ABILITY_PICKUPS } from '../game/abilities'
import type { RaceRuntime } from '../game/runtime'
import { getRoadPose } from '../game/trackLayout'

/** Batched holographic cells and original shared emblems; shield follows the interpolated racer. */
export function AbilityEffects({runtime}:{runtime:RaceRuntime}) {
  const pickups=useRef<THREE.InstancedMesh>(null),shell=useRef<THREE.Group>(null)
  const shellMaterial=useRef<THREE.MeshBasicMaterial>(null)
  const temp=useMemo(()=>new THREE.Object3D(),[])
  const kinds=Object.keys(ABILITY_INFO) as Ability[],badges=useRef<(THREE.InstancedMesh|null)[]>([])
  const art=useMemo(()=>Object.entries(ABILITY_INFO).map(([kind,info])=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!
    ctx.scale(2,2);ctx.strokeStyle=info.color;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowColor=info.color;ctx.shadowBlur=6;ctx.stroke(new Path2D(ABILITY_PATHS[kind as Ability]));const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture
  }),[])
  useEffect(()=>()=>art.forEach(t=>t.dispose()),[art])
  const colors=useMemo(()=>Object.fromEntries(Object.entries(ABILITY_INFO).map(([kind,info])=>[kind,new THREE.Color(info.color)])),[])
  useFrame(({clock,camera})=>{
    const time=clock.elapsedTime,lap=Math.floor(runtime.race.checkpointsHit/4)
    if(pickups.current) {
      for(const p of ABILITY_PICKUPS) {
        const hidden=runtime.race.phase==='finish'||runtime.abilities.collected.has(`${lap}:${p.row}`)
        temp.position.set(p.x,p.y+1.25+Math.sin(time*2.6+p.id)*.18,p.z)
        temp.rotation.set(.25,time*1.2+p.id,.35)
        temp.scale.setScalar(hidden?0:.68)
        temp.updateMatrix();pickups.current.setMatrixAt(p.id,temp.matrix);pickups.current.setColorAt(p.id,colors[p.kind])
      }
      for(let k=0;k<kinds.length;k++){
        const mesh=badges.current[k];if(!mesh)continue
        for(const p of ABILITY_PICKUPS){const hidden=p.kind!==kinds[k]||runtime.abilities.collected.has(`${lap}:${p.row}`)||runtime.race.phase==='finish';temp.position.set(p.x,p.y+1.25+Math.sin(time*2.6+p.id)*.18,p.z);temp.rotation.set(0,0,0);temp.quaternion.copy(camera.quaternion);temp.scale.setScalar(hidden?0:1.25);temp.updateMatrix();mesh.setMatrixAt(p.id,temp.matrix)}
        mesh.instanceMatrix.needsUpdate=true
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
  return <><CombatEffects runtime={runtime}/>{kinds.map((kind,i)=><instancedMesh key={kind} ref={node=>{badges.current[i]=node}} args={[undefined,undefined,ABILITY_PICKUPS.length]} frustumCulled={false}><planeGeometry args={[1,1]}/><meshBasicMaterial map={art[i]} transparent depthWrite={false} toneMapped={false}/></instancedMesh>)}
    <instancedMesh ref={pickups} args={[undefined,undefined,ABILITY_PICKUPS.length]} frustumCulled={false}>
      <octahedronGeometry args={[1,0]}/><meshStandardMaterial metalness={.45} roughness={.2} wireframe emissive="#ffffff" emissiveIntensity={.7}/>
    </instancedMesh>
    <group ref={shell} visible={false}>
      <mesh><icosahedronGeometry args={[1.75,2]}/><meshBasicMaterial ref={shellMaterial} color="#64eaff" transparent opacity={.14} depthWrite={false} toneMapped={false}/></mesh>
      <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[1.75,.035,5,48]}/><meshBasicMaterial color="#9cf5ff" toneMapped={false}/></mesh>
      <mesh rotation={[0,0,.6]}><torusGeometry args={[1.75,.018,4,48]}/><meshBasicMaterial color="#78cfff" toneMapped={false}/></mesh>
    </group>
  </>
}
