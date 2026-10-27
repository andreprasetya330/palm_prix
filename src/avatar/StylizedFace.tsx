import {useEffect,useMemo} from 'react'
import * as THREE from 'three'
import {buildFaceGeometry} from './faceGeometry'
import type {FaceProfile} from './faceProfile'
const ramp=new THREE.DataTexture(new Uint8Array([75,135,195,255]),4,1,THREE.RedFormat)
ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.generateMipmaps=false;ramp.needsUpdate=true
export function StylizedFace({profile,position=[0,0,0]}:{profile:FaceProfile;position?:[number,number,number]}){
 const geometry=useMemo(()=>buildFaceGeometry(profile),[profile])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return <mesh name="personalized-driver-face" geometry={geometry} position={position} castShadow><meshToonMaterial vertexColors gradientMap={ramp}/></mesh>
}
