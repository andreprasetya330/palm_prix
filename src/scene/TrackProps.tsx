import { useMemo } from 'react'
import * as THREE from 'three'
import { nearestTrack } from '../game/trackLayout'

function Palm({x,z,s=1,angle=0}:{x:number;z:number;s?:number;angle?:number}){
 const frond=useMemo(()=>{
  const p:number[]=[],ix:number[]=[]
  for(let i=0;i<=12;i++){const t=i/12,w=Math.sin(t*Math.PI)*0.36; p.push(t*2.7,Math.sin(t*Math.PI)*0.6-t*t*0.7,-w,t*2.7,Math.sin(t*Math.PI)*0.6-t*t*0.7,w);if(i<12){const n=i*2;ix.push(n,n+1,n+2,n+1,n+3,n+2)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g
 },[])
 if(nearestTrack(x,z).distance<7) return null
 return <group position={[x,0,z]} scale={s} rotation={[0,angle,-0.08]}>
  <mesh position={[0,2,0]} castShadow><cylinderGeometry args={[0.12,0.28,4,10]}/><meshStandardMaterial color="#b58a59" roughness={1}/></mesh>
  {Array.from({length:10},(_,i)=><mesh key={i} position={[0,0.35+i*0.35,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.26-i*0.012,0.018,4,10]}/><meshStandardMaterial color="#876746"/></mesh>)}
  {Array.from({length:9},(_,i)=><mesh key={i} geometry={frond} position={[0,4,0]} rotation={[0,i/9*Math.PI*2,i%2*0.2]} castShadow><meshStandardMaterial color={i%2?'#268965':'#49a66d'} side={THREE.DoubleSide} roughness={0.8}/></mesh>)}
  {[0,1,2].map(i=><mesh key={i} position={[Math.sin(i*2)*0.22,3.85,Math.cos(i*2)*0.22]}><sphereGeometry args={[0.18,8,8]}/><meshStandardMaterial color="#8f653b"/></mesh>)}
 </group>
}
function Umbrella({x,z,color}:{x:number;z:number;color:string}){
 if(nearestTrack(x,z).distance<7) return null
 return <group position={[x,0,z]}>
 <mesh position={[0,1,0]}><cylinderGeometry args={[0.035,0.035,2,8]}/><meshStandardMaterial color="#e9d1a1"/></mesh>
 <mesh position={[0,2,0]} castShadow><coneGeometry args={[1.3,0.5,12,1,true]}/><meshStandardMaterial color={color} side={THREE.DoubleSide}/></mesh>
 {[0,1].map(i=><mesh key={i} position={[(i-0.5)*1.1,0.28,0.8]} rotation={[-0.12,0,0]} castShadow><boxGeometry args={[0.6,0.13,1.5]}/><meshStandardMaterial color="#fff0cb"/></mesh>)}
 </group>
}
function Hotel({x,z,rotation=0}:{x:number;z:number;rotation?:number}){
 return <group position={[x,0,z]} rotation={[0,rotation,0]}>
 <mesh position={[0,2.5,0]} castShadow receiveShadow><boxGeometry args={[8,5,3]}/><meshStandardMaterial color="#f4d4ab"/></mesh>
 {[1,2,3].map(f=><group key={f} position={[0,f*1.3,1.55]}>
 <mesh position={[0,-0.45,0.25]} castShadow><boxGeometry args={[8.5,0.12,0.9]}/><meshStandardMaterial color="#fff1d8"/></mesh>
 {[-3,-1.5,0,1.5,3].map(x=><mesh key={x} position={[x,0,0]}><boxGeometry args={[0.8,0.85,0.04]}/><meshStandardMaterial color="#246974" roughness={0.25} metalness={0.2}/></mesh>)}
 </group>)}
 <mesh position={[0,5.1,0]} castShadow><boxGeometry args={[8.7,0.25,3.7]}/><meshStandardMaterial color="#ce7759"/></mesh>
 <mesh position={[0,5.3,0]}><boxGeometry args={[6.7,0.2,2.7]}/><meshStandardMaterial color="#f6ddbd"/></mesh>
 </group>
}
function GardenBeds(){
 const foliage=useMemo(()=>{
  const geometry=new THREE.SphereGeometry(1,8,6)
  const material=new THREE.MeshStandardMaterial({color:'#398563',roughness:1})
  const mesh=new THREE.InstancedMesh(geometry,material,80)
  const transform=new THREE.Object3D()
  for(let i=0;i<80;i++){
   const cluster=Math.floor(i/20),angle=(cluster/4)*Math.PI*2+0.4,t=(i%20)*2.39996,r=Math.sqrt(i%20)*0.23
   transform.position.set(Math.sin(angle)*10.4+Math.sin(t)*r,0.2+(i%3)*0.07,Math.cos(angle)*8.4+Math.cos(t)*r)
   transform.scale.set(0.36+(i%3)*0.09,0.25+(i%4)*0.08,0.4)
   transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix)
   mesh.setColorAt(i,new THREE.Color(i%4===0?'#8fae50':i%3===0?'#226b54':'#418969'))
  }
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh
 },[])
 return <group>
 <primitive object={foliage}/>
 {Array.from({length:20},(_,i)=>{const cluster=Math.floor(i/5),a=cluster/4*Math.PI*2+0.4,t=i*2.4;return <mesh key={i} position={[Math.sin(a)*10.4+Math.sin(t)*0.65,0.58,Math.cos(a)*8.4+Math.cos(t)*0.65]}><sphereGeometry args={[0.12,6,5]}/><meshStandardMaterial color={i%2?'#ffab6a':'#ffe3a0'} roughness={0.8}/></mesh>})}
 </group>
}
export function TrackProps(){
 return <group>
 {Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2,r=40+(i%3)*2.4;return <Palm key={i} x={Math.sin(a)*r*1.15} z={Math.cos(a)*r} s={0.9+i%4*0.18} angle={i*2}/>})}
 {[[-8,-5],[6,6],[-6,8],[8,-7]].map(([x,z],i)=><Palm key={`inner-${i}`} x={x} z={z} s={0.85} angle={i}/>)}
 <mesh position={[0,0.07,0]} rotation={[-Math.PI/2,0,0]} scale={[1.4,1,1]}><circleGeometry args={[6.8,64]}/><meshStandardMaterial color="#e7d6aa"/></mesh>
 <mesh position={[0,0.09,0]} rotation={[-Math.PI/2,0,0]} scale={[1.4,1,1]}><circleGeometry args={[5.9,64]}/><meshStandardMaterial color="#38bdc5" roughness={0.18} metalness={0.25}/></mesh>
 {[2,3.7,5.4].map(r=><mesh key={r} position={[0,0.105,0]} rotation={[-Math.PI/2,0,0]} scale={[1.4,1,1]}><ringGeometry args={[r,r+0.025,64]}/><meshBasicMaterial color="#a1ede0" transparent opacity={0.3}/></mesh>)}
 <mesh position={[0,0.1,0]} scale={[2,0.32,1.6]} receiveShadow><sphereGeometry args={[1,32,16]}/><meshStandardMaterial color="#e7d7ad" roughness={1}/></mesh>
 <mesh position={[0,0.3,0]} scale={[1.35,0.15,1.05]} receiveShadow><sphereGeometry args={[1,24,12]}/><meshStandardMaterial color="#699559" roughness={1}/></mesh>
 {[0,1,2,3,4].map(i=><mesh key={`rock-${i}`} position={[Math.sin(i*1.9)*1.45,0.2,Math.cos(i*1.9)*1.12]} rotation={[i,0,i*0.6]} scale={[0.35,0.2,0.28]} castShadow><dodecahedronGeometry args={[1,1]}/><meshStandardMaterial color={i%2?'#c3b798':'#dacdaf'} roughness={1}/></mesh>)}
 <Palm x={0} z={0} s={1.2}/>
 <GardenBeds/>
 <Hotel x={-15} z={-43} rotation={0.2}/><Hotel x={-28} z={-38} rotation={0.5}/><Hotel x={1} z={-45}/>
 {Array.from({length:8},(_,i)=><Umbrella key={i} x={41+i%2*4} z={-15+i*4.5} color={i%2?'#f38167':'#2d9d9d'}/>)}
 {Array.from({length:10},(_,i)=>{const a=i/10*Math.PI*2;return <mesh key={`isle-${i}`} position={[Math.sin(a)*110,-1.5,Math.cos(a)*110]} scale={[1.3,1,1]}><coneGeometry args={[12+i%3*5,15+i%4*5,9]}/><meshStandardMaterial color={i%2?'#6d9c8a':'#74aaa1'} roughness={1}/></mesh>})}
 {Array.from({length:8},(_,i)=><group key={`cloud-${i}`} position={[Math.sin(i*2.4)*90,25+i%3*4,Math.cos(i*2.4)*90]} scale={[2,1,1]}>{[0,1,2].map(j=><mesh key={j} position={[j*2,Math.sin(j)*0.6,0]}><sphereGeometry args={[2.4,16,12]}/><meshStandardMaterial color="#fff6df" roughness={1}/></mesh>)}</group>)}
 </group>
}
