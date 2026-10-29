import { useEffect,useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {CombatEffects} from './CombatEffects'
import {ABILITY_PATHS} from '../game/abilityArt'
import {ABILITY_INFO,type Ability, ABILITY_PICKUPS } from '../game/abilities'
import type { RaceRuntime } from '../game/runtime'
import {getTrackSurface,TRACK_LENGTH} from '../game/trackLayout'
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
    const time=clock.elapsedTime
    if(pickups.current) {
      for(const p of ABILITY_PICKUPS) {
        const hidden=runtime.race.phase==='finish'||runtime.pickupCooldowns[p.id]>.22
        temp.position.set(p.x,p.y+1.25+Math.sin(time*2.6+p.id)*.18,p.z)
        temp.rotation.set(.25,time*1.2+p.id,.35)
        temp.scale.setScalar(hidden?0:.68*Math.max(0,1-runtime.pickupCooldowns[p.id]/.22))
        temp.updateMatrix();pickups.current.setMatrixAt(p.id,temp.matrix);pickups.current.setColorAt(p.id,colors[p.kind])
      }
      for(let k=0;k<kinds.length;k++){
        const mesh=badges.current[k];if(!mesh)continue
        for(const p of ABILITY_PICKUPS){const hidden=p.kind!==kinds[k]||runtime.pickupCooldowns[p.id]>.22||runtime.race.phase==='finish';temp.position.set(p.x,p.y+1.25+Math.sin(time*2.6+p.id)*.18,p.z);temp.rotation.set(0,0,0);temp.quaternion.copy(camera.quaternion);temp.scale.setScalar(hidden?0:1.25*Math.max(0,1-runtime.pickupCooldowns[p.id]/.22));temp.updateMatrix();mesh.setMatrixAt(p.id,temp.matrix)}
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
  return <><CombatEffects runtime={runtime}/>{runtime.rivalAbilities.map((_,i)=><CombatEffects key={i} runtime={runtime} owner={i}/>)}<PickupFlashes runtime={runtime}/>{runtime.rivalAbilities.map((_,i)=><RivalShield key={i} runtime={runtime} index={i}/>)}{kinds.map((kind,i)=><instancedMesh key={kind} ref={node=>{badges.current[i]=node}} args={[undefined,undefined,ABILITY_PICKUPS.length]} frustumCulled={false}><planeGeometry args={[1,1]}/><meshBasicMaterial map={art[i]} transparent depthWrite={false} toneMapped={false}/></instancedMesh>)}
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

function RivalShield({runtime,index}:{runtime:RaceRuntime;index:number}){
 const root=useRef<THREE.Group>(null)
 useFrame(({clock})=>{const r=runtime.race.rivals[index],a=runtime.rivalAbilities[index];if(!root.current)return;root.current.visible=a.shieldTimer>0&&runtime.race.phase==='racing';const s=getTrackSurface(r.distance/TRACK_LENGTH,r.lane);root.current.position.copy(s.point);root.current.position.y+=1;root.current.rotation.y=clock.elapsedTime;const scale=1+Math.sin(clock.elapsedTime*6)*.035;root.current.scale.set(scale,scale*.85,scale)})
 return <group ref={root} visible={false}><mesh><icosahedronGeometry args={[1.75,1]}/><meshBasicMaterial color="#6ef4ff" wireframe transparent opacity={.55} depthWrite={false} toneMapped={false}/></mesh><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[1.75,.035,5,32]}/><meshBasicMaterial color="#a2faff" toneMapped={false}/></mesh></group>
}
/** Each captured crystal becomes a brief burst of coloured shards at its own position. */
function PickupFlashes({runtime}:{runtime:RaceRuntime}){
 const mesh=useRef<THREE.InstancedMesh>(null),dummy=useMemo(()=>new THREE.Object3D(),[]),color=useMemo(()=>new THREE.Color(),[])
 useFrame(({clock})=>{
  const pool=mesh.current;if(!pool)return;let at=0
  const emit=(bursts:RaceRuntime['abilities']['pickupBursts'])=>{for(const b of bursts){const p=ABILITY_PICKUPS[b.id],t=b.age;for(let j=0;j<8;j++){const angle=j/8*Math.PI*2;dummy.position.set(p.x+Math.cos(angle)*t*2.4,p.y+1.25+t*1.9+Math.sin(j)*t,p.z+Math.sin(angle)*t*2.4);dummy.rotation.set(clock.elapsedTime*3+j,angle,clock.elapsedTime*5);dummy.scale.setScalar(.16*(1-t/.65));dummy.updateMatrix();pool.setMatrixAt(at,dummy.matrix);color.set(ABILITY_INFO[b.kind].color);pool.setColorAt(at++,color)}}}
  if(runtime.race.phase==='racing'){emit(runtime.abilities.pickupBursts);for(const a of runtime.rivalAbilities)emit(a.pickupBursts)}
  pool.count=at;pool.instanceMatrix.needsUpdate=true;if(pool.instanceColor)pool.instanceColor.needsUpdate=true
 })
 return <instancedMesh ref={mesh} args={[undefined,undefined,192]} frustumCulled={false}><octahedronGeometry args={[1,0]}/><meshBasicMaterial toneMapped={false}/></instancedMesh>
}
