import {useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import type {RaceRuntime} from '../game/runtime'
import {BOOST_PADS,RACE_TOKENS} from '../game/courseFeatures'

function tokenStamp(){
 const c=document.createElement('canvas');c.width=c.height=128
 const ctx=c.getContext('2d')!;ctx.fillStyle='#20dcea';ctx.fillRect(0,0,128,128)
 ctx.strokeStyle='#122c50';ctx.lineWidth=7;ctx.beginPath();ctx.arc(64,64,51,0,Math.PI*2);ctx.stroke()
 ctx.fillStyle='#082c42';ctx.font='italic 900 76px Arial';ctx.textAlign='center';ctx.fillText('P',60,91)
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t
}
/** Four pad meshes and eighteen collectibles share a tiny fixed set of draw calls. */
export function CourseFun({runtime}:{runtime:RaceRuntime}){
 const coins=useRef<THREE.InstancedMesh>(null),clock=useRef(0)
 const transform=useMemo(()=>new THREE.Object3D(),[])
 const stamp=useMemo(()=>tokenStamp(),[])
 const padGeometry=useMemo(()=>{
  const shape=new THREE.Shape();shape.moveTo(-1.35,-.2);shape.lineTo(0,.5);shape.lineTo(1.35,-.2);shape.lineTo(1.35,.25);shape.lineTo(0,.95);shape.lineTo(-1.35,.25);shape.closePath()
  const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(Math.PI/2);return geometry
 },[])
 const padBodies=useMemo(()=>{
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(3.6,.045,5.4),new THREE.MeshStandardMaterial({color:'#231d46',roughness:.35,metalness:.2,emissive:'#ff218f',emissiveIntensity:1.4}),BOOST_PADS.length)
  const o=new THREE.Object3D()
  for(const p of BOOST_PADS){o.position.set(p.x,p.y+.09,p.z);o.rotation.set(-p.pitch,Math.atan2(p.tx,p.tz),p.bank,'YXZ');o.updateMatrix();mesh.setMatrixAt(p.id,o.matrix)}
  mesh.computeBoundingSphere();return mesh
 },[])
 const padArrows=useMemo(()=>{
  const mesh=new THREE.InstancedMesh(padGeometry,new THREE.MeshBasicMaterial({color:new THREE.Color('#40ffff').multiplyScalar(2),toneMapped:false,side:THREE.DoubleSide}),BOOST_PADS.length*3)
  const o=new THREE.Object3D()
  for(const pad of BOOST_PADS)for(let i=0;i<3;i++){
   const offset=(i-1)*1.4;o.position.set(pad.x+pad.tx*offset,pad.y+Math.tan(pad.pitch)*offset+.13,pad.z+pad.tz*offset);o.rotation.set(-pad.pitch,Math.atan2(pad.tx,pad.tz),pad.bank,'YXZ');o.updateMatrix();mesh.setMatrixAt(pad.id*3+i,o.matrix)
  }
  mesh.computeBoundingSphere();return mesh
 },[padGeometry])
 useFrame((_,delta)=>{
  if(!coins.current)return
  clock.current+=Math.min(delta,.05)
  const lap=Math.floor(runtime.race.checkpointsHit/4)
  for(const token of RACE_TOKENS){
   const visible=!runtime.rewards.collected.has(`${lap}:${token.id}`)
   transform.position.set(token.x,token.y+1.05+Math.sin(clock.current*2+token.id)*.13,token.z)
   transform.rotation.set(Math.PI/2,0,clock.current*1.5+token.id*.3)
   transform.scale.setScalar(visible?1:0);transform.updateMatrix();coins.current.setMatrixAt(token.id,transform.matrix)
  }
  coins.current.instanceMatrix.needsUpdate=true
 })
 useEffect(()=>()=>{stamp.dispose();padGeometry.dispose();padBodies.geometry.dispose();(padBodies.material as THREE.Material).dispose();padBodies.dispose();(padArrows.material as THREE.Material).dispose();padArrows.dispose()},[stamp,padGeometry,padBodies,padArrows])
 return <group>
  <primitive object={padBodies}/>
  <primitive object={padArrows}/>
  <instancedMesh ref={coins} args={[undefined,undefined,RACE_TOKENS.length]} frustumCulled={false}>
   <cylinderGeometry args={[.52,.52,.13,24]}/>
   <meshStandardMaterial attach="material-0" color="#41dded" metalness={.65} roughness={.25}/>
   <meshStandardMaterial attach="material-1" map={stamp} metalness={.35} roughness={.3} emissive="#00d8ed" emissiveIntensity={1.3}/>
   <meshStandardMaterial attach="material-2" map={stamp} metalness={.35} roughness={.3}/>
  </instancedMesh>
 </group>
}
