import {useEffect,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'

/** Licensed authored support vehicles, statically batched including their wheel geometry. */
export function PaddockVehicles(){
 return <><ParkedVehicle file="delivery" position={[-24,0,33.5]} yaw={Math.PI}/><ParkedVehicle file="ambulance" position={[25,0,32.8]} yaw={Math.PI*.3}/></>
}
function ParkedVehicle({file,position,yaw}:{file:string;position:[number,number,number];yaw:number}){
 const {scene}=useGLTF(`/assets/racers/${file}.glb`)
 const asset=useMemo(()=>{
  scene.updateMatrixWorld(true)
  const pieces:THREE.BufferGeometry[]=[]
  let material:THREE.MeshStandardMaterial|undefined
  scene.traverse(object=>{
   const mesh=object as THREE.Mesh;if(!mesh.isMesh)return
   pieces.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld))
   if(!material){material=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material).clone() as THREE.MeshStandardMaterial;material.roughness=.45;material.metalness=.12}
  })
  const geometry=mergeGeometries(pieces,false)!;pieces.forEach(piece=>piece.dispose())
  return {geometry,material}
 },[scene])
 useEffect(()=>()=>{asset.geometry.dispose();asset.material?.dispose()},[asset])
 return <mesh position={position} rotation={[0,yaw,0]} scale={1.65} geometry={asset.geometry} material={asset.material} receiveShadow/>
}
