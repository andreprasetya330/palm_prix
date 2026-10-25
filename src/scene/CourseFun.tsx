import {useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import type {RaceRuntime} from '../game/runtime'
import {BOOST_PADS,RACE_TOKENS} from '../game/courseFeatures'

function tokenStamp(){
 const c=document.createElement('canvas');c.width=c.height=128
 const ctx=c.getContext('2d')!;ctx.fillStyle='#ffd163';ctx.fillRect(0,0,128,128)
 ctx.strokeStyle='#b87821';ctx.lineWidth=7;ctx.beginPath();ctx.arc(64,64,51,0,Math.PI*2);ctx.stroke()
 ctx.fillStyle='#a86514';ctx.font='italic 900 76px Arial';ctx.textAlign='center';ctx.fillText('P',60,91)
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
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(3.6,.045,5.4),new THREE.MeshStandardMaterial({color:'#17628a',roughness:.35,metalness:.2,emissive:'#087cb1',emissiveIntensity:.45}),BOOST_PADS.length)
  const o=new THREE.Object3D()
  for(const p of BOOST_PADS){o.position.set(p.x,.09,p.z);o.rotation.y=Math.atan2(p.tx,p.tz);o.updateMatrix();mesh.setMatrixAt(p.id,o.matrix)}
  mesh.computeBoundingSphere();return mesh
 },[])
 const padArrows=useMemo(()=>{
  const mesh=new THREE.InstancedMesh(padGeometry,new THREE.MeshBasicMaterial({color:'#8df7ff',toneMapped:false,side:THREE.DoubleSide}),BOOST_PADS.length*3)
  const o=new THREE.Object3D()
  for(const pad of BOOST_PADS)for(let i=0;i<3;i++){
   const offset=(i-1)*1.4;o.position.set(pad.x+pad.tx*offset,.13,pad.z+pad.tz*offset);o.rotation.y=Math.atan2(pad.tx,pad.tz);o.updateMatrix();mesh.setMatrixAt(pad.id*3+i,o.matrix)
  }
  mesh.computeBoundingSphere();return mesh
 },[padGeometry])
 useFrame((_,delta)=>{
  if(!coins.current)return
  clock.current+=Math.min(delta,.05)
  const lap=Math.floor(runtime.race.checkpointsHit/4)
  for(const token of RACE_TOKENS){
   const visible=!runtime.rewards.collected.has(`${lap}:${token.id}`)
   transform.position.set(token.x,1.05+Math.sin(clock.current*2+token.id)*.13,token.z)
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
   <meshStandardMaterial attach="material-0" color="#f3b63a" metalness={.65} roughness={.25}/>
   <meshStandardMaterial attach="material-1" map={stamp} metalness={.35} roughness={.3} emissive="#b87917" emissiveIntensity={.15}/>
   <meshStandardMaterial attach="material-2" map={stamp} metalness={.35} roughness={.3}/>
  </instancedMesh>
 </group>
}
