import { Suspense, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { getTrackSample, nearestTrack, ROAD_HALF_WIDTH } from '../game/trackLayout'

const FILES = ['tree_detailed','tree_detailed_fall','tree_pineTallA_detailed','rock_largeA','rock_tallB','mushroom_redGroup','mushroom_redTall']
const URLS = FILES.map(name => `/assets/festival/${name}.glb`)
function colored(geometry: THREE.BufferGeometry, color: THREE.Color | string) {
  const shape = geometry.index ? geometry.toNonIndexed() : geometry
  if (shape !== geometry) geometry.dispose()
  for (const attribute of Object.keys(shape.attributes)) if (!['position','normal'].includes(attribute)) shape.deleteAttribute(attribute)
  if (!shape.attributes.normal) shape.computeVertexNormals()
  const value = new THREE.Color(color), colors = new Float32Array(shape.attributes.position.count * 3)
  for (let i=0;i<colors.length;i+=3) { colors[i]=value.r;colors[i+1]=value.g;colors[i+2]=value.b }
  shape.setAttribute('color',new THREE.BufferAttribute(colors,3))
  return shape
}
function joined(shapes: THREE.BufferGeometry[]) {
  const merged=mergeGeometries(shapes,false)!
  shapes.forEach(shape=>shape.dispose());merged.computeBoundingSphere();return merged
}
function ScenicAssets() {
  const assets=useGLTF(URLS)
  const geometry=useMemo(()=>{
    const templates=assets.map(asset=>{
      asset.scene.updateMatrixWorld(true)
      const bounds=new THREE.Box3().setFromObject(asset.scene), center=bounds.getCenter(new THREE.Vector3())
      const pieces:THREE.BufferGeometry[]=[]
      asset.scene.traverse(object=>{
        const mesh=object as THREE.Mesh
        if(!mesh.isMesh)return
        const material=mesh.material as THREE.MeshStandardMaterial
        const piece=colored(mesh.geometry.clone(),material.color)
        piece.applyMatrix4(mesh.matrixWorld);piece.translate(-center.x,-bounds.min.y,-center.z);pieces.push(piece)
      })
      return joined(pieces)
    })
    const pieces:THREE.BufferGeometry[]=[]
    const place=(index:number,t:number,side:number,offset:number,scale:number,yaw:number)=>{
      const sample=getTrackSample(t),location=sample.point.clone().addScaledVector(sample.normal,side*(ROAD_HALF_WIDTH+offset))
      const template=templates[index];template.computeBoundingSphere()
      const radius=Math.min(4.5,(template.boundingSphere?.radius??1)*scale*0.55)
      if(nearestTrack(location.x,location.z).distance<ROAD_HALF_WIDTH+3+radius)return
      const piece=template.clone();piece.scale(scale,scale,scale);piece.rotateY(yaw);piece.translate(location.x,0,location.z);pieces.push(piece)
    }
    // Golden canopy grove: authored branches and foliage, clustered outside both verges.
    for(let i=0;i<52;i++)place(i%3,0.13+i/52*0.3,i%3===0?1:-1,8+(i%4)*2.6,4.2+(i%4)*0.6,i*2.399)
    // Crystal canyon: the rock kit gives a layered silhouette; original crystals add a bright focal point.
    for(let i=0;i<32;i++)place(i%3===0?3:4,0.46+i/32*0.26,i%4===0?1:-1,9+(i%3)*3,5.2+(i%5)*0.9,i*1.3)
    // Oversized strawberry mushrooms make the return straight feel like a miniature adventure.
    for(let i=0;i<32;i++)place(i%3===0?5:6,0.77+i/32*0.2,i%2?1:-1,7+(i%4)*2,8+(i%5)*2.3,i*2.1)
    for(let i=0;i<18;i++){
      const sample=getTrackSample(0.49+i/18*0.18),p=sample.point.clone().addScaledVector(sample.normal,-(ROAD_HALF_WIDTH+10+i%3*2))
      if(nearestTrack(p.x,p.z).distance<ROAD_HALF_WIDTH+5)continue
      const crystal=colored(new THREE.CylinderGeometry(0,0.7+i%3*0.22,3+i%4*1.6,5),i%2?'#80dfe4':'#b6a3f8')
      crystal.rotateZ((i%3-1)*0.18);crystal.translate(p.x,1.6+i%4*0.8,p.z);pieces.push(crystal)
    }
    templates.forEach(template=>template.dispose())
    return joined(pieces)
  },[assets])
  return <mesh geometry={geometry} receiveShadow castShadow><meshStandardMaterial vertexColors roughness={0.88}/></mesh>
}
function beam(from:THREE.Vector3,to:THREE.Vector3,radius:number,color:string){
  const shape=colored(new THREE.CylinderGeometry(radius,radius,from.distanceTo(to),8),color)
  const quaternion=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize())
  shape.applyQuaternion(quaternion);shape.translate(...from.clone().lerp(to,0.5).toArray());return shape
}
function FestivalWheel(){
  const rotating=useRef<THREE.Group>(null),cabins=useRef<THREE.InstancedMesh>(null)
  const transform=useMemo(()=>new THREE.Object3D(),[])
  const support=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    for(const z of [-2.2,2.2])for(const x of [-5.5,5.5])parts.push(beam(new THREE.Vector3(x,0,z),new THREE.Vector3(0,13,z*0.25),0.28,'#e9ddbd'))
    const base=colored(new THREE.CylinderGeometry(7,8,0.8,48),'#568f9a');base.translate(0,0.2,0);parts.push(base)
    parts.push(beam(new THREE.Vector3(0,13,-1.4),new THREE.Vector3(0,13,1.4),0.6,'#ffc85f'))
    return joined(parts)
  },[])
  const wheel=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    for(const z of [-0.5,0.5]){
      const ring=colored(new THREE.TorusGeometry(10,0.22,8,96),'#ffb357');ring.translate(0,0,z);parts.push(ring)
      for(let i=0;i<12;i++){const angle=i/12*Math.PI*2;parts.push(beam(new THREE.Vector3(0,0,z),new THREE.Vector3(Math.cos(angle)*10,Math.sin(angle)*10,z),0.095,i%2?'#ffdf96':'#e4efe6'))}
    }
    const center=colored(new THREE.CylinderGeometry(1.1,1.1,1.2,16),'#e87583');center.rotateX(Math.PI/2);parts.push(center)
    return joined(parts)
  },[])
  const cabin=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    const body=colored(new THREE.BoxGeometry(1.65,1.3,1.25),'#fff0d6');body.translate(0,-1,0);parts.push(body)
    const glass=colored(new THREE.BoxGeometry(1.36,0.64,1.32),'#235b69');glass.translate(0,-0.82,0);parts.push(glass)
    const roof=colored(new THREE.ConeGeometry(1.3,0.6,4),'#e77986');roof.rotateY(Math.PI/4);roof.translate(0,-0.1,0);parts.push(roof)
    parts.push(beam(new THREE.Vector3(0,0,0),new THREE.Vector3(0,0.8,0),0.07,'#ffd687'))
    return joined(parts)
  },[])
  useFrame(({clock})=>{
    const angle=clock.elapsedTime*0.055
    if(rotating.current)rotating.current.rotation.z=angle
    if(cabins.current){for(let i=0;i<12;i++){const phase=i/12*Math.PI*2+angle;transform.position.set(Math.cos(phase)*10,13+Math.sin(phase)*10,0);transform.updateMatrix();cabins.current.setMatrixAt(i,transform.matrix)}cabins.current.instanceMatrix.needsUpdate=true}
  })
  return <group position={[0,0,-3]} rotation={[0,0.22,0]}>
    <mesh geometry={support} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={0.65}/></mesh>
    <group ref={rotating} position={[0,13,0]}><mesh geometry={wheel}><meshStandardMaterial vertexColors roughness={0.5}/></mesh></group>
    <instancedMesh ref={cabins} args={[cabin,undefined,12]}><meshStandardMaterial vertexColors roughness={0.6}/></instancedMesh>
  </group>
}
function RacingBalloons(){
  const refs=useRef<(THREE.Group|null)[]>([])
  const geometry=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[]
    // Alternating colored longitudinal panels read as sewn balloon fabric.
    for(let i=0;i<10;i++){
      const panel=colored(new THREE.SphereGeometry(2.2,6,20,i/10*Math.PI*2,Math.PI/5),i%2?'#fff3d6':'#ef8290')
      panel.scale(1,1.35,1);panel.translate(0,4.3,0);parts.push(panel)
    }
    const basket=colored(new THREE.BoxGeometry(1.2,0.9,1.05),'#bb8256');basket.translate(0,0.45,0);parts.push(basket)
    for(const x of [-0.5,0.5])for(const z of [-0.4,0.4])parts.push(beam(new THREE.Vector3(x,0.7,z),new THREE.Vector3(x*1.5,2.5,z*1.5),0.035,'#f7d59e'))
    return joined(parts)
  },[])
  useFrame(({clock})=>refs.current.forEach((group,i)=>{if(group){group.position.y=18+i*4+Math.sin(clock.elapsedTime*0.35+i*2)*0.7;group.rotation.z=Math.sin(clock.elapsedTime*0.22+i)*0.04}}))
  return <>{[[20,-15],[-24,-8],[7,23]].map(([x,z],i)=><group key={i} position={[x,18+i*4,z]} scale={1+i*0.12} ref={group=>{refs.current[i]=group}}><mesh geometry={geometry}><meshStandardMaterial vertexColors roughness={0.9}/></mesh></group>)}</>
}
/** Seven CC0 authored models, merged static scenery, one rotating landmark and three shared balloon meshes. */
export function FestivalWorld(){
  return <group><Suspense fallback={null}><ScenicAssets/></Suspense><FestivalWheel/><RacingBalloons/></group>
}
URLS.forEach(url=>useGLTF.preload(url))
