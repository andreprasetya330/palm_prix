import {useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {ABILITY_INFO} from '../game/abilities'
import type {RaceRuntime} from '../game/runtime'
import {getTrackSurface,TRACK_LENGTH} from '../game/trackLayout'

/** Bounded original neon meshes: three seekers, four traps and eight impact bursts. */
export function CombatEffects({runtime}:{runtime:RaceRuntime}){
 const sceneGroup=useRef<THREE.Group>(null)
 const coreGeometry=useMemo(()=>new THREE.TorusGeometry(.55,.08,5,6).rotateX(-Math.PI/2),[])
 useEffect(()=>()=>coreGeometry.dispose(),[coreGeometry])
 const bolts=useRef<(THREE.Group|null)[]>([]),pulse=useRef<THREE.Group>(null),pulseMaterial=useRef<THREE.MeshBasicMaterial>(null)
 const traps=useRef<THREE.InstancedMesh>(null),cores=useRef<THREE.InstancedMesh>(null),sparks=useRef<THREE.InstancedMesh>(null),stars=useRef<THREE.InstancedMesh>(null),trails=useRef<THREE.InstancedMesh>(null),lock=useRef<THREE.Group>(null)
 const dummy=useMemo(()=>new THREE.Object3D(),[]),color=useMemo(()=>new THREE.Color(),[])
 const point=(distance:number,lane:number)=>getTrackSurface(distance/TRACK_LENGTH,lane)
 useFrame(({clock,camera})=>{
  const a=runtime.abilities,time=clock.elapsedTime,active=runtime.race.phase==='racing'
  if(sceneGroup.current)sceneGroup.current.visible=active
  if(!active)return
  if(trails.current)trails.current.count=a.shots.length*10
  if(traps.current)traps.current.count=a.mines.length
  if(cores.current)cores.current.count=a.mines.length
  if(sparks.current)sparks.current.count=a.impacts.length*12
  if(stars.current)stars.current.visible=runtime.race.rivals.some(r=>r.stunTimer>0)
  for(let i=0;i<3;i++){
   const root=bolts.current[i],shot=a.shots[i];if(!root)continue;root.visible=active&&!!shot
   if(shot){const s=point(shot.distance,shot.lane);root.position.copy(s.point);root.position.y+=.85;root.rotation.set(-Math.atan(s.grade),s.yaw,time*9,'YXZ')}
  }
  for(let i=0;i<a.shots.length*10;i++){
   const shot=a.shots[Math.floor(i/10)],j=i%10
   if(shot&&active){const s=point(shot.distance-j*.75,shot.lane);dummy.position.copy(s.point);dummy.position.y+=.85;dummy.scale.setScalar((1-j/10)*.18)}else dummy.scale.setScalar(0)
   dummy.rotation.set(time+i,time*2,0);dummy.updateMatrix();trails.current?.setMatrixAt(i,dummy.matrix)
  }
  if(trails.current)trails.current.instanceMatrix.needsUpdate=true
  if(pulse.current){
   pulse.current.visible=active&&!!a.pulse
   if(a.pulse){const p=a.pulse,s=point(p.distance,p.lane),radius=.8+Math.min(1,p.age/.75)*24;pulse.current.position.copy(s.point);pulse.current.position.y+=.3;pulse.current.rotation.set(-Math.atan(s.grade),s.yaw,s.bank,'YXZ');pulse.current.scale.setScalar(radius);if(pulseMaterial.current)pulseMaterial.current.opacity=Math.max(0,1-p.age)}
  }
  for(let i=0;i<a.mines.length;i++){
   const mine=a.mines[i]
   if(mine&&active){const s=point(mine.distance,mine.lane);dummy.position.copy(s.point);dummy.position.y+=.13;dummy.rotation.set(-Math.atan(s.grade),s.yaw,s.bank,'YXZ');dummy.scale.set(1,1,1)}else dummy.scale.setScalar(0)
   dummy.updateMatrix();traps.current?.setMatrixAt(i,dummy.matrix)
   dummy.position.y+=.16;dummy.scale.multiplyScalar(.7+Math.sin(time*7+i)*.12);dummy.updateMatrix();cores.current?.setMatrixAt(i,dummy.matrix)
  }
  if(traps.current)traps.current.instanceMatrix.needsUpdate=true;if(cores.current)cores.current.instanceMatrix.needsUpdate=true
  for(let i=0;i<a.impacts.length*12;i++){
   const impact=a.impacts[Math.floor(i/12)],j=i%12
   if(impact&&active){const s=point(impact.distance,impact.lane),t=impact.age,angle=j/12*Math.PI*2;dummy.position.set(s.point.x+Math.sin(angle)*t*7,s.height+.7+Math.sin(t*Math.PI)*1.7+Math.cos(j*3)*t,s.point.z+Math.cos(angle)*t*7);dummy.scale.setScalar((1-t/.8)*.13);color.set(ABILITY_INFO[impact.kind].color)}else{dummy.scale.setScalar(0);color.set('#ffffff')}
   dummy.rotation.set(time*5+i,time*3,0);dummy.updateMatrix();sparks.current?.setMatrixAt(i,dummy.matrix);sparks.current?.setColorAt(i,color)
  }
  if(sparks.current){sparks.current.instanceMatrix.needsUpdate=true;if(sparks.current.instanceColor)sparks.current.instanceColor.needsUpdate=true}
  for(let i=0;i<5;i++){
   const r=runtime.race.rivals[i]
   if(r.stunTimer>0&&active){const s=point(r.distance,r.lane),angle=time*8+i;dummy.position.set(s.point.x+Math.cos(angle)*.6,s.height+2.1+Math.sin(time*10+i)*.15,s.point.z+Math.sin(angle)*.6);dummy.scale.setScalar(.17)}else dummy.scale.setScalar(0)
   dummy.rotation.set(time,time*3,time*2);dummy.updateMatrix();stars.current?.setMatrixAt(i,dummy.matrix)
  }
  if(stars.current)stars.current.instanceMatrix.needsUpdate=true
  if(lock.current){const target=a.shots[0]?.target??-1,r=runtime.race.rivals[target];lock.current.visible=active&&!!r&&r.finishedAt===null;if(r){const s=point(r.distance,r.lane);lock.current.position.copy(s.point);lock.current.position.y+=2;lock.current.quaternion.copy(camera.quaternion);lock.current.scale.setScalar(.8+Math.sin(time*8)*.06)}}
 })
 return <group ref={sceneGroup} visible={false}>
  {[0,1,2].map(i=><group key={i} ref={node=>{bolts.current[i]=node}} visible={false}>
   <mesh scale={[.26,.26,.65]}><octahedronGeometry/><meshBasicMaterial color="#fff0fa" toneMapped={false}/></mesh>
   <mesh><torusGeometry args={[.43,.065,6,16]}/><meshBasicMaterial color="#ff669e" toneMapped={false}/></mesh>
   <mesh rotation={[0,Math.PI/2,0]}><torusGeometry args={[.35,.035,5,16]}/><meshBasicMaterial color="#89f8ff" toneMapped={false}/></mesh>
  </group>)}
  <instancedMesh ref={trails} args={[undefined,undefined,30]} frustumCulled={false}><octahedronGeometry/><meshBasicMaterial color="#ff73bc" toneMapped={false}/></instancedMesh>
  <group ref={pulse} visible={false}>
   <mesh rotation={[-Math.PI/2,0,0]}><torusGeometry args={[1,.012,5,96]}/><meshBasicMaterial ref={pulseMaterial} color="#ed7cff" transparent depthWrite={false} toneMapped={false}/></mesh>
   <mesh scale={[.95,.05,.95]}><icosahedronGeometry args={[1,1]}/><meshBasicMaterial color="#8befff" wireframe transparent opacity={.18} depthWrite={false} toneMapped={false}/></mesh>
  </group>
  <instancedMesh ref={traps} args={[undefined,undefined,4]} frustumCulled={false}><cylinderGeometry args={[.65,.85,.18,6]}/><meshStandardMaterial color="#25213e" metalness={.7} roughness={.3} emissive="#6cae65" emissiveIntensity={.3}/></instancedMesh>
  <instancedMesh ref={cores} args={[undefined,undefined,4]} frustumCulled={false}><primitive object={coreGeometry} attach="geometry"/><meshBasicMaterial color="#a7ff8a" toneMapped={false}/></instancedMesh>
  <instancedMesh ref={sparks} args={[undefined,undefined,96]} frustumCulled={false}><octahedronGeometry/><meshBasicMaterial toneMapped={false}/></instancedMesh>
  <instancedMesh ref={stars} args={[undefined,undefined,5]} frustumCulled={false}><octahedronGeometry/><meshBasicMaterial color="#ffe6a1" toneMapped={false}/></instancedMesh>
  <group ref={lock} visible={false}><mesh><torusGeometry args={[.65,.025,5,32]}/><meshBasicMaterial color="#ff7ba7" toneMapped={false} transparent opacity={.9} depthTest={false}/></mesh>{[-1,1].map(side=><mesh key={side} position={[side*.85,0,0]}><boxGeometry args={[.22,.045,.02]}/><meshBasicMaterial color="#ffb6dd" toneMapped={false} depthTest={false}/></mesh>)}</group>
 </group>
}
