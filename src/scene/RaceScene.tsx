import { memo, Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { StadiumSky } from './StadiumSky'
import { ACESFilmicToneMapping, Group, Vector3, DirectionalLight, Object3D, CanvasTexture } from 'three'
import { PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { RaceRuntime } from '../game/runtime'
import { RIVALS, rivalAngle } from '../game/raceLoop'
import { getTrackSample } from '../game/trackLayout'
import { FollowCamera } from './FollowCamera'
import { CloudWorld } from './CloudWorld'
import { CloudLandmarks } from './CloudLandmarks'
import { CourseFun } from './CourseFun'
import { Track } from './Track'
import { RaceEffects } from './RaceEffects'
import { RaceSimulation } from './RaceSimulation'
import { FrameDiagnostics } from './FrameDiagnostics'
import { RacerModel } from './RacerModel'
import {PersonalCarnivalProps} from './PersonalCarnivalProps'
import {PersonalPlayerKart} from './PersonalPlayerKart'
import {usePersonalAssets} from './personalAssets'

type Props={runtime:RaceRuntime;showcase?:boolean}
function Environment(){
  const {gl,scene}=useThree()
  useEffect(()=>{
    const generator=new PMREMGenerator(gl), room=new RoomEnvironment()
    const target=generator.fromScene(room,.08)
    scene.environment=target.texture;scene.environmentIntensity=.55
    room.dispose();generator.dispose()
    return()=>{scene.environment=null;target.dispose()}
  },[gl,scene])
  return null
}
function RaceLighting({runtime}:{runtime:RaceRuntime}){
  const {gl}=useThree()
  const sun=useRef<DirectionalLight>(null)
  const shadowElapsed=useRef(1)
  const target=useMemo(()=>new Object3D(),[])
  useEffect(()=>{const previous=gl.shadowMap.autoUpdate;gl.shadowMap.autoUpdate=false;return()=>{gl.shadowMap.autoUpdate=previous}},[gl])
  useFrame((_,dt)=>{
    const kart=runtime.visual
    if(sun.current)sun.current.position.set(kart.x+28,45,kart.z+22)
    target.position.set(kart.x,0,kart.z);target.updateMatrixWorld()
    // Contact decals anchor the wheels every frame; distant soft shadows can update at 20Hz.
    shadowElapsed.current+=dt
    if(shadowElapsed.current>=.05){gl.shadowMap.needsUpdate=true;shadowElapsed.current=0}
  },-50)
  return <><primitive object={target}/><directionalLight ref={sun} target={target} position={[28,45,22]} intensity={2.1} color="#ffedcd" castShadow
    shadow-mapSize={[1024,1024]} shadow-bias={-.0003} shadow-normalBias={.035}
    shadow-camera-near={1} shadow-camera-far={140} shadow-camera-left={-30}
    shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30}/></>
}
function PauseHiddenRenderer(){
  const setFrameloop=useThree(state=>state.setFrameloop)
  useEffect(()=>{
    const sync=()=>setFrameloop(document.hidden?'never':'always')
    sync();document.addEventListener('visibilitychange',sync)
    return()=>document.removeEventListener('visibilitychange',sync)
  },[setFrameloop])
  return null
}
function Racer({runtime,index=-1,personalKart}:{runtime:RaceRuntime;index?:number;personalKart?:string}){
  const group=useRef<Group>(null)
  const motion=useMemo(()=>({speed:0,steering:0}),[])
  const previous=useRef(new Vector3())
  const contact=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128
    const ctx=canvas.getContext('2d')!,shade=ctx.createRadialGradient(64,64,8,64,64,63)
    shade.addColorStop(0,'rgba(17,29,43,.55)');shade.addColorStop(.45,'rgba(17,29,43,.3)');shade.addColorStop(1,'rgba(17,29,43,0)')
    ctx.fillStyle=shade;ctx.fillRect(0,0,128,128)
    return new CanvasTexture(canvas)
  },[])
  useEffect(()=>()=>contact.dispose(),[contact])
  useFrame((_,dt)=>{
    const root=group.current;if(!root)return
    if(index<0){
      const k=runtime.visual
      root.position.set(k.x,.08,k.z);root.rotation.set(0,k.yaw,(k.steering??0)*Math.min(.045,Math.abs(k.speed)*.002))
      motion.speed=k.speed;motion.steering=k.steering??0
    }else{
      const rival=RIVALS[index],angle=rivalAngle(index,runtime.race.elapsed)
      const sample=getTrackSample(angle/(Math.PI*2))
      const lane=(rival.lane-18.5)*.75+Math.sin(angle*2+index)*.25
      root.position.copy(sample.point).addScaledVector(sample.normal,lane);root.position.y=.08;root.rotation.y=sample.yaw
      motion.speed=runtime.race.phase==='racing'?Math.min(24,root.position.distanceTo(previous.current)/Math.max(.001,dt)):0
      motion.steering=Math.sin(angle)*.15;previous.current.copy(root.position)
    }
  },-20)
  return <group ref={group}>
    <mesh position={[0,-.055,.12]} rotation={[-Math.PI/2,0,0]} renderOrder={1}><planeGeometry args={[2.1,2.9]}/><meshBasicMaterial map={contact} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1}/></mesh>
    {index<0&&personalKart?<PersonalPlayerKart url={personalKart} motion={motion}/>:<RacerModel player={index<0} variant={Math.max(0,index)} color={index<0?'#ee334e':RIVALS[index].color} motion={motion}/>}
  </group>
}
/** A stable scene: HUD and camera results cannot rebuild the world while driving. */
export const RaceScene=memo(function RaceScene({runtime,showcase=false}:Props){
  const personal=usePersonalAssets()
  return <Canvas shadows camera={{position:[0,6,14],fov:54,near:.1,far:500}} dpr={1}
    style={{width:'100%',height:'100%'}}
    gl={{antialias:true,powerPreference:'high-performance',toneMapping:ACESFilmicToneMapping,toneMappingExposure:1.05}}>
    <PauseHiddenRenderer/><RaceSimulation runtime={runtime}/><FrameDiagnostics/>
    <color attach="background" args={['#9bb3cd']}/>
    <hemisphereLight args={['#c7e8ff','#556454',1.0]}/>
    <ambientLight intensity={.3} color="#dbe4ff"/>
    <RaceLighting runtime={runtime}/>
    <StadiumSky/>
    <fog attach="fog" args={['#b8d3ed',160,340]}/>
    <Environment/>
    <Suspense fallback={null}>
      <Track showcase={showcase}/>
      <CourseFun runtime={runtime}/>
      <CloudWorld/><CloudLandmarks/>
      <PersonalCarnivalProps assets={personal}/>
      <Racer runtime={runtime} personalKart={personal.kart}/>
      {RIVALS.map((r,i)=><Racer key={r.name} index={i} runtime={runtime}/>)}
    </Suspense>
    <RaceEffects kart={runtime.visual}/>
    <FollowCamera kart={runtime.visual} showcase={showcase}/>
  </Canvas>
})

