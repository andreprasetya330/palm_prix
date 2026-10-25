import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { getTrackSample, ROAD_HALF_WIDTH } from '../game/trackLayout'

// All artwork below is original Palm Prix geometry. No external assets or Nintendo artwork.
const C = { cream:'#fff0cb', pink:'#ef718a', teal:'#379fa7', blue:'#7a89d0', gold:'#f8c663', ink:'#294b62', wood:'#a76f59' }
type Point = [number,number,number]
function paint(g:THREE.BufferGeometry,color:string) {
  const result=g.index?g.toNonIndexed():g
  if(result!==g)g.dispose()
  for(const name of Object.keys(result.attributes))if(!['position','normal'].includes(name))result.deleteAttribute(name)
  if(!result.attributes.normal)result.computeVertexNormals()
  const c=new THREE.Color(color),values=new Float32Array(result.attributes.position.count*3)
  for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b}
  result.setAttribute('color',new THREE.BufferAttribute(values,3));return result
}
function merge(parts:THREE.BufferGeometry[]){const result=mergeGeometries(parts,false)!;parts.forEach(p=>p.dispose());result.computeBoundingSphere();return result}
function add(parts:THREE.BufferGeometry[],g:THREE.BufferGeometry,color:string,p:Point=[0,0,0],rotation:Point=[0,0,0],scale:Point=[1,1,1]){
  const shape=paint(g,color);shape.scale(...scale);shape.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)));shape.translate(...p);parts.push(shape)
}
function lathe(points:[number,number][],segments=64,start=0,length=Math.PI*2){
  // LatheGeometry expects ascending profiles for outward-facing winding/normals.
  const ordered=points[0][1]>points[points.length-1][1]?[...points].reverse():points
  return new THREE.LatheGeometry(ordered.map(p=>new THREE.Vector2(...p)),segments,start,length)
}
function tube(points:Point[],radius:number){return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(12,points.length*8),radius,8,false)}
function ring(radius:number,tubeRadius:number){const g=new THREE.TorusGeometry(radius,tubeRadius,8,96);g.rotateX(Math.PI/2);return g}
function VMesh({geometry,metal=false}:{geometry:THREE.BufferGeometry;metal?:boolean}){
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={metal?0.32:0.65} metalness={metal?0.25:0.02}/></mesh>
}

function Carousel(){
  const horses=useRef<THREE.InstancedMesh>(null),rotor=useRef<THREE.Group>(null)
  const transform=useMemo(()=>new THREE.Object3D(),[])
  const base=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    add(parts,lathe([[0,0],[9.3,0],[9.7,0.2],[9.7,0.4],[9.3,0.65],[0,0.65]]),C.teal)
    add(parts,ring(9.4,0.12),C.gold,[0,0.55,0])
    add(parts,lathe([[0,0.65],[2.4,0.65],[2.4,1.1],[1.8,1.35],[1.3,2],[1.1,5.4],[1.8,6],[0,6]]),C.cream)
    for(let i=0;i<16;i++){
      const a=i/16*Math.PI*2
      add(parts,new THREE.SphereGeometry(0.22,12,8),C.gold,[Math.sin(a)*9.25,0.85,Math.cos(a)*9.25])
      add(parts,new THREE.BoxGeometry(0.65,0.12,0.07),C.pink,[Math.sin(a)*1.16,3.7,Math.cos(a)*1.16],[0,a,0],[1,18,1])
    }
    return merge(parts)
  },[])
  const roof=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    const profile:[number,number][]=[[0,9.6],[0.7,9.35],[1.5,8.7],[2.7,8.1],[4.7,7.2],[6.6,6.7],[8.1,6.4],[9.4,6.35],[9.55,6.15]]
    for(let i=0;i<16;i++)add(parts,lathe(profile,12,i/16*Math.PI*2,Math.PI/8),i%2?C.pink:C.cream)
    add(parts,ring(9.42,0.15),C.gold,[0,6.22,0]);add(parts,ring(1.5,0.1),C.gold,[0,8.72,0])
    // Scalloped valance, framed jewel panels and warm decorative bulbs.
    for(let i=0;i<32;i++){
      const a=i/32*Math.PI*2
      add(parts,new THREE.SphereGeometry(0.48,14,10),i%2?C.teal:C.blue,[Math.sin(a)*9.32,5.94,Math.cos(a)*9.32],[0,a,0],[1,0.75,0.26])
      add(parts,new THREE.SphereGeometry(0.12,10,8),C.gold,[Math.sin(a)*9.48,6.28,Math.cos(a)*9.48])
    }
    add(parts,lathe([[0,9.5],[0.35,9.5],[0.26,10.4],[0,10.8]],32),C.gold)
    const flag=new THREE.Shape();flag.moveTo(0,0);flag.bezierCurveTo(0.7,0.25,1.2,-0.25,1.7,0);flag.lineTo(1.4,-0.8);flag.bezierCurveTo(0.8,-0.9,0.5,-0.6,0,-0.8);flag.closePath()
    add(parts,new THREE.ExtrudeGeometry(flag,{depth:0.04,bevelEnabled:false}),C.teal,[0,10.6,0])
    return merge(parts)
  },[])
  const horse=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    const outline=new THREE.Shape();outline.moveTo(-0.9,0.15);outline.bezierCurveTo(-1.35,0.65,-0.6,1.05,0.15,0.65);outline.bezierCurveTo(0.4,1,0.2,1.7,0.65,1.9);outline.lineTo(0.85,2.17);outline.lineTo(1.02,1.89);outline.bezierCurveTo(1.4,1.72,1.72,1.75,1.7,1.42);outline.bezierCurveTo(1.45,1.2,1.03,1.55,0.92,1.1);outline.bezierCurveTo(0.83,0.8,0.85,0.2,0.4,0.13);outline.bezierCurveTo(-0.1,-0.1,-0.6,-0.12,-0.9,0.15)
    add(parts,new THREE.ExtrudeGeometry(outline,{depth:0.42,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:0.07,bevelThickness:0.07,curveSegments:18}),C.cream,[0,0,-0.21])
    for(const z of [-0.2,0.2]){
      add(parts,tube([[-0.65,0.2,z],[-0.85,-0.35,z],[-1.12,-0.65,z]],0.12),C.cream)
      add(parts,tube([[0.52,0.22,z],[0.85,-0.18,z],[1.14,-0.12,z]],0.115),C.cream)
      add(parts,new THREE.SphereGeometry(0.16,12,8),C.gold,[-1.12,-0.65,z],[0,0,0],[1.2,0.65,1])
      add(parts,new THREE.SphereGeometry(0.16,12,8),C.gold,[1.14,-0.12,z],[0,0,0],[1.2,0.65,1])
      add(parts,new THREE.SphereGeometry(0.07,12,8),C.ink,[1.03,1.68,z*1.5])
      add(parts,tube([[0.68,1.95,z*1.5],[0.35,1.5,z*1.5],[0.28,0.8,z*1.5]],0.1),C.teal)
    }
    add(parts,tube([[-0.95,0.6,0],[-1.45,0.45,0],[-1.55,-0.1,0]],0.17),C.teal)
    add(parts,new THREE.SphereGeometry(0.5,20,12),C.pink,[-0.12,0.68,0],[0,0,0],[1,0.2,0.72])
    add(parts,ring(0.22,0.035),C.gold,[-0.05,0.2,0.43],[Math.PI/2,0,0])
    return merge(parts)
  },[])
  const poles=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2;add(parts,new THREE.CylinderGeometry(0.065,0.065,5.6,12),C.gold,[Math.sin(a)*6.6,3.4,Math.cos(a)*6.6])}
    return merge(parts)
  },[])
  useEffect(()=>()=>horse.dispose(),[horse])
  useFrame(({clock})=>{
    const t=clock.elapsedTime,angle=t*0.12
    if(rotor.current)rotor.current.rotation.y=angle
    if(horses.current){for(let i=0;i<8;i++){const a=i/8*Math.PI*2+angle;transform.position.set(Math.sin(a)*6.6,2.2+Math.sin(t*1.35+i*Math.PI/2)*0.48,Math.cos(a)*6.6);transform.rotation.set(0,a,0);transform.updateMatrix();horses.current.setMatrixAt(i,transform.matrix)}horses.current.instanceMatrix.needsUpdate=true}
  })
  return <group position={[0,0,-5]}><VMesh geometry={base}/><VMesh geometry={roof}/><group ref={rotor}><VMesh geometry={poles} metal/></group><instancedMesh ref={horses} args={[horse,undefined,8]} frustumCulled={false} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={0.48}/></instancedMesh></group>
}

function Booths(){
  const geometry=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    for(const [cx,cz,color] of [[-16,-4,C.pink],[15,-8,C.teal],[-10,-21,C.blue]] as const){
      add(parts,lathe([[0,0],[2.9,0],[3.1,0.25],[2.7,0.55],[2.65,3.6],[2.9,3.7],[0,3.7]]),C.cream,[cx,0,cz])
      for(let i=0;i<12;i++){const a=i/12*Math.PI*2;add(parts,new THREE.BoxGeometry(0.7,2.1,0.1),i%2?color:C.cream,[cx+Math.sin(a)*2.63,1.65,cz+Math.cos(a)*2.63],[0,a,0])}
      add(parts,new THREE.BoxGeometry(2,1.35,0.18),C.ink,[cx,2.3,cz+2.65])
      add(parts,new THREE.BoxGeometry(2.4,0.15,0.7),C.gold,[cx,1.55,cz+2.8])
      const profile:[number,number][]=[[0,7.2],[0.3,6.7],[0.8,5.9],[1.8,4.7],[2.7,4.25],[3.4,4.05],[3.5,3.85]]
      for(let i=0;i<12;i++)add(parts,lathe(profile,8,i/12*Math.PI*2,Math.PI/6),i%2?color:C.cream,[cx,0,cz])
      add(parts,ring(3.45,0.09),C.gold,[cx,3.95,cz])
      add(parts,new THREE.SphereGeometry(0.25,16,12),C.gold,[cx,7,cz])
      for(let i=0;i<12;i++){const a=i/12*Math.PI*2;add(parts,new THREE.SphereGeometry(0.15,12,8),C.gold,[cx+Math.sin(a)*3.4,3.8,cz+Math.cos(a)*3.4])}
    }
    return merge(parts)
  },[])
  return <VMesh geometry={geometry}/>
}
function CarnivalGate(){
  const sample=useMemo(()=>getTrackSample(0.025),[])
  const signTexture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=192
    const context=canvas.getContext('2d')!
    context.fillStyle=C.cream;context.fillRect(0,0,1536,192)
    context.fillStyle=C.ink;context.font='900 112px Arial';context.textAlign='center';context.textBaseline='middle'
    context.fillText('CLOUD CARNIVAL',768,103)
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture
  },[])
  useEffect(()=>()=>signTexture.dispose(),[signTexture])
  const geometry=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    const width=ROAD_HALF_WIDTH+2.3
    for(const side of [-1,1]){
      const x=side*width
      add(parts,lathe([[0,0],[0.7,0],[0.7,0.6],[0.52,0.8],[0.45,6.4],[0.7,6.6],[0.6,7.2],[0,7.2]],32),C.cream,[x,0,0])
      for(let y=1;y<6.3;y+=0.65)add(parts,ring(0.48,0.045),C.pink,[x,y,0])
      add(parts,lathe([[0,9.5],[0.2,9],[0.6,8.1],[1.05,7.3],[0,7.3]],32),C.teal,[x,0,0])
      add(parts,new THREE.SphereGeometry(0.24,16,12),C.gold,[x,9.35,0])
    }
    const arc=new THREE.Shape();arc.moveTo(-width,7.2);arc.quadraticCurveTo(0,13.4,width,7.2);arc.lineTo(width,8.2);arc.quadraticCurveTo(0,14.4,-width,8.2);arc.closePath()
    add(parts,new THREE.ExtrudeGeometry(arc,{depth:0.55,bevelEnabled:true,bevelSegments:3,bevelSize:0.12,bevelThickness:0.12,curveSegments:48}),C.teal,[0,0,-0.275])
    for(const side of [-1,1]){
      const points:Point[]=Array.from({length:33},(_,i)=>{const t=i/32;return[-width+2*width*t,7.65+12.4*t*(1-t),side*0.43]})
      add(parts,tube(points,0.095),C.gold)
      for(let i=0;i<=20;i++){const t=i/20;add(parts,new THREE.SphereGeometry(0.12,12,8),C.cream,[-width+2*width*t,7.65+12.4*t*(1-t),side*0.52])}
    }
    // The menu views the gate from the rear: decorate both approaches equally.
    const board=new THREE.Shape();board.moveTo(-3.5,-0.65);board.lineTo(3.5,-0.65);board.quadraticCurveTo(3.9,-0.65,3.9,-0.25);board.lineTo(3.9,0.25);board.quadraticCurveTo(3.9,0.65,3.5,0.65);board.lineTo(-3.5,0.65);board.quadraticCurveTo(-3.9,0.65,-3.9,0.25);board.lineTo(-3.9,-0.25);board.quadraticCurveTo(-3.9,-0.65,-3.5,-0.65)
    add(parts,new THREE.ExtrudeGeometry(board,{depth:0.3,bevelEnabled:true,bevelSize:0.08,bevelThickness:0.08,bevelSegments:3}),C.gold,[0,9.45,-0.15])
    for(const x of [-2.8,2.8])add(parts,tube([[x,9.9,0],[x,10.7,0]],0.07),C.gold)
    // Central star is a sculpted original medallion, not a borrowed game mark.
    const star=new THREE.Shape();for(let i=0;i<10;i++){const a=i/10*Math.PI*2+Math.PI/2,r=i%2?0.55:1.18;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)star.moveTo(x,y);else star.lineTo(x,y)}star.closePath()
    add(parts,new THREE.ExtrudeGeometry(star,{depth:0.25,bevelEnabled:true,bevelSize:0.08,bevelThickness:0.08,bevelSegments:3}),C.gold,[0,11.1,0.42])
    add(parts,new THREE.ExtrudeGeometry(star,{depth:0.25,bevelEnabled:true,bevelSize:0.08,bevelThickness:0.08,bevelSegments:3}),C.gold,[0,11.1,-0.42],[0,Math.PI,0])
    return merge(parts)
  },[])
  return <group position={[sample.point.x,0,sample.point.z]} rotation={[0,sample.yaw,0]}><VMesh geometry={geometry}/>{[-1,1].map(side=><mesh key={side} position={[0,9.45,side*0.235]} rotation={[0,side<0?Math.PI:0,0]}><planeGeometry args={[7.2,0.9]}/><meshStandardMaterial map={signTexture} roughness={0.7}/></mesh>)}</group>
}
function ToyAirship(){
  const ship=useRef<THREE.Group>(null),propeller=useRef<THREE.Group>(null),key=useRef<THREE.Group>(null)
  const hull=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    const profile:[number,number][]=[[0,-10],[1.15,-9.5],[2.4,-8],[3.25,-5],[3.6,-1],[3.45,3],[2.6,6],[1.2,8],[0,9.4]]
    for(let i=0;i<16;i++)add(parts,lathe(profile,10,i/16*Math.PI*2,Math.PI/8),i%4===0?C.gold:i%2?C.cream:C.pink,[0,0,0],[Math.PI/2,0,0])
    for(const z of [-5,4])add(parts,new THREE.TorusGeometry(z<0?3.05:3.3,0.09,8,64),C.gold,[0,0,z])
    return merge(parts)
  },[])
  const fittings=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    // A shaped gondola with rounded bow, gold gunwale and framed panoramic windows.
    add(parts,new THREE.CapsuleGeometry(1.05,5.4,8,24),C.teal,[0,-4.6,0],[Math.PI/2,0,0],[1,1,0.68])
    for(const x of [-0.97,0.97])for(let z=-2.5;z<=2.5;z+=1.25){
      add(parts,new THREE.SphereGeometry(0.42,18,12),C.gold,[x,-4.45,z],[0,0,0],[0.14,1,1])
      add(parts,new THREE.SphereGeometry(0.32,18,12),C.ink,[x*1.035,-4.45,z],[0,0,0],[0.14,1,1])
    }
    for(const x of [-0.65,0.65])for(const z of [-2.5,2.5])add(parts,tube([[x,-4,z],[x*2,-2.7,z],[x*2.2,-2.4,z]],0.07),C.gold)
    const fin=new THREE.Shape();fin.moveTo(0,0);fin.bezierCurveTo(1,0.5,3,2,3.3,3.7);fin.quadraticCurveTo(1.4,3.5,0,2.8);fin.closePath()
    for(let i=0;i<4;i++)add(parts,new THREE.ExtrudeGeometry(fin,{depth:0.15,bevelEnabled:true,bevelThickness:0.06,bevelSize:0.08,bevelSegments:2,curveSegments:16}),i%2?C.teal:C.blue,[0,0,5],[Math.PI/2,0,i*Math.PI/2])
    add(parts,new THREE.SphereGeometry(0.65,24,16),C.gold,[0,0,9.3])
    return merge(parts)
  },[])
  const blades=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    for(let i=0;i<3;i++){const blade=new THREE.Shape();blade.moveTo(-0.12,0);blade.bezierCurveTo(-0.5,0.8,-0.7,2.5,-0.25,2.8);blade.bezierCurveTo(0.5,2.9,0.7,1.2,0.12,0);blade.closePath();add(parts,new THREE.ExtrudeGeometry(blade,{depth:0.13,bevelEnabled:true,bevelSize:0.07,bevelThickness:0.06,bevelSegments:2}),C.wood,[0,0,0],[0,0,i/3*Math.PI*2])}
    add(parts,new THREE.SphereGeometry(0.38,20,12),C.gold);return merge(parts)
  },[])
  const keyGeometry=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    add(parts,new THREE.CylinderGeometry(0.15,0.15,1.5,16),C.gold,[0,0,0],[0,0,Math.PI/2])
    for(const y of [-0.6,0.6])add(parts,new THREE.TorusGeometry(0.65,0.16,12,32),C.gold,[0.8,y,0],[0,Math.PI/2,0])
    return merge(parts)
  },[])
  useFrame(({clock},dt)=>{
    const t=clock.elapsedTime
    if(ship.current){ship.current.position.set(20+Math.sin(t*0.035)*7,27+Math.sin(t*0.25)*0.65,-24);ship.current.rotation.set(Math.sin(t*0.15)*0.02,-0.65+Math.sin(t*0.035)*0.1,Math.sin(t*0.2)*0.025)}
    if(propeller.current)propeller.current.rotation.z+=dt*5.4
    if(key.current)key.current.rotation.x-=dt*0.22
  })
  return <group ref={ship} position={[20,27,-24]}><VMesh geometry={hull}/><VMesh geometry={fittings}/><group ref={propeller} position={[0,0,10]}><VMesh geometry={blades}/></group><group ref={key} position={[3.7,0,0]}><VMesh geometry={keyGeometry} metal/></group></group>
}
function BalloonFleet(){
  const groups=useRef<(THREE.Group|null)[]>([])
  const geometry=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    const profile:[number,number][]=[[0.55,1.6],[0.7,2.2],[1.4,3],[2.1,4.2],[2.4,5.7],[2.1,7.2],[1.3,8.1],[0,8.6]]
    for(let i=0;i<12;i++)add(parts,lathe(profile,8,i/12*Math.PI*2,Math.PI/6),i%3===0?C.gold:i%2?C.teal:C.cream)
    add(parts,lathe([[0,0],[0.8,0],[0.95,0.85],[0.8,1],[0,1]],24),C.wood)
    for(let y=0.15;y<0.9;y+=0.18)add(parts,ring(0.82+y*0.1,0.035),C.gold,[0,y,0])
    for(const x of [-0.65,0.65])for(const z of [-0.65,0.65])add(parts,tube([[x,0.8,z],[x,2.15,z]],0.035),C.cream)
    add(parts,ring(0.6,0.08),C.gold,[0,1.8,0]);return merge(parts)
  },[])
  useFrame(({clock})=>groups.current.forEach((g,i)=>{if(g){g.position.y=20+i*3+Math.sin(clock.elapsedTime*0.2+i*1.8)*1.1;g.rotation.z=Math.sin(clock.elapsedTime*0.14+i)*0.04}}))
  return <>{[[-28,4],[-5,-34],[28,12]].map(([x,z],i)=><group key={i} position={[x,20+i*3,z]} scale={0.85+i*0.12} ref={g=>{groups.current[i]=g}}><VMesh geometry={geometry}/></group>)}</>
}
/** 15 main-pass draw calls: 4 carousel, 1 booths, 3 entrance, 4 airship, 3 balloons. */
export function CloudLandmarks(){
  return <group name="original-cloud-carnival-landmarks"><Carousel/><Booths/><CarnivalGate/><ToyAirship/><BalloonFleet/></group>
}
