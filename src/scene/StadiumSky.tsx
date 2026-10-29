import {useRef,useMemo,useEffect} from 'react'
import {useFrame} from '@react-three/fiber'
import {useTexture} from '@react-three/drei'
import * as THREE from 'three'
/** Original panoramic cloud painting, centered on the camera to stay infinitely distant. */
export function StadiumSky(){
  const source=useTexture('/assets/cloud-carnival/cloud-panorama.png')
  const map=useMemo(()=>{const texture=source.clone();texture.colorSpace=THREE.SRGBColorSpace;return texture},[source])
  useEffect(()=>()=>map.dispose(),[map])
  const ref=useRef<THREE.Mesh>(null)
  useFrame(({camera})=>{if(ref.current)ref.current.position.copy(camera.position)},-90)
  return <mesh ref={ref} rotation={[0,1.2,0]} renderOrder={-100}>
    <sphereGeometry args={[380,64,32]}/>
    <meshBasicMaterial map={map} side={THREE.BackSide} depthWrite={false} toneMapped={false} fog={false}/>
  </mesh>
}
