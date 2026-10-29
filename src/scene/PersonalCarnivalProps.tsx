import {Component,Suspense,useMemo,useRef,type ReactNode} from 'react'
import {useGLTF} from '@react-three/drei'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import type {PersonalAssets} from './personalAssets'

function ImportedBalloon({url,position,index}:{url:string;position:[number,number,number];index:number}){
  const asset=useGLTF(url),ref=useRef<THREE.Group>(null)
  const scene=useMemo(()=>asset.scene.clone(true),[asset.scene])
  useFrame(({clock})=>{if(ref.current){ref.current.position.y=position[1]+Math.sin(clock.elapsedTime*.25+index*1.7)*.85;ref.current.rotation.y=.3+index*1.8+Math.sin(clock.elapsedTime*.12)*.1}})
  return <group ref={ref} position={position} scale={index===1?1.35:1}><primitive object={scene}/></group>
}
function ImportedRide({url}:{url:string}){
  const asset=useGLTF(url),ref=useRef<THREE.Group>(null)
  const scenes=useMemo(()=>Array.from({length:5},()=>asset.scene.clone(true)),[asset.scene])
  useFrame(({clock})=>{if(ref.current)ref.current.rotation.y=clock.elapsedTime*.16})
  return <group position={[99,0,28]}>
    <mesh position={[0,.1,0]} receiveShadow><cylinderGeometry args={[12.6,13,.5,64]}/><meshStandardMaterial color="#58aeba" roughness={.4}/></mesh>
    <mesh position={[0,.4,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[12.2,.16,8,96]}/><meshStandardMaterial color="#edbd62" metalness={.4} roughness={.3}/></mesh>
    <group ref={ref}>{scenes.map((scene,i)=>{const a=i/5*Math.PI*2;return <group key={i} position={[Math.sin(a)*8,.4,Math.cos(a)*8]} rotation={[0,-a,0]} scale={1.7}><primitive object={scene}/></group>})}</group>
  </group>
}
class PersonalBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?null:this.props.children}
}
/** Opt-in Nintendo models, local to the user's noncommercial personal build. */
export function PersonalCarnivalProps({assets}:{assets:PersonalAssets}){
  return <PersonalBoundary><Suspense fallback={null}>
    {assets.balloon&&([[17,14,29],[-49,12,-10],[62,16,-29]] as [number,number,number][]).map((p,i)=><ImportedBalloon key={i} url={assets.balloon!} position={p} index={i}/>)}
    {assets.cups&&<ImportedRide url={assets.cups}/>}
  </Suspense></PersonalBoundary>
}
