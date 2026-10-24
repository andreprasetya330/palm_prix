import { memo, Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { StadiumSky } from './StadiumSky'
import { ACESFilmicToneMapping, Group, Vector3 } from 'three'
import { PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { RaceRuntime } from '../game/runtime'
import { RIVALS, rivalAngle } from '../game/raceLoop'
import { getTrackSample } from '../game/trackLayout'
import { FollowCamera } from './FollowCamera'
import { Track } from './Track'
import { RaceEffects } from './RaceEffects'
import { RaceSimulation } from './RaceSimulation'
import { FrameDiagnostics } from './FrameDiagnostics'
import { RacerModel } from './RacerModel'

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
function Racer({runtime,index=-1}:{runtime:RaceRuntime;index?:number}){
  const group=useRef<Group>(null)
  const motion=useMemo(()=>({speed:0,steering:0}),[])
  const previous=useRef(new Vector3())
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
  return <group ref={group}><RacerModel player={index<0} variant={Math.max(0,index)} color={index<0?'#ee334e':RIVALS[index].color} motion={motion}/></group>
}
/** A stable scene: HUD and camera results cannot rebuild the world while driving. */
export const RaceScene=memo(function RaceScene({runtime,showcase=false}:Props){
  return <Canvas shadows camera={{position:[0,6,14],fov:54,near:.1,far:240}} dpr={1}
    style={{width:'100%',height:'100%'}}
    gl={{antialias:true,powerPreference:'high-performance',toneMapping:ACESFilmicToneMapping,toneMappingExposure:1.15}}>
    <RaceSimulation runtime={runtime}/><FrameDiagnostics/>
    <color attach="background" args={['#9bb3cd']}/>
    <hemisphereLight args={['#bed8f9','#4a4545',1.2]}/>
    <ambientLight intensity={.45} color="#dbe4ff"/>
    <directionalLight position={[28,45,22]} intensity={2.6} color="#ffdab5" castShadow
      shadow-mapSize={[1024,1024]} shadow-bias={-.0003} shadow-normalBias={.035}
      shadow-camera-near={1} shadow-camera-far={140} shadow-camera-left={-55}
      shadow-camera-right={55} shadow-camera-top={55} shadow-camera-bottom={-55}/>
    <StadiumSky/>
    <fog attach="fog" args={['#56657c',110,220]}/>
    <Environment/>
    <Suspense fallback={null}>
      <Track showcase={showcase}/>
      <Racer runtime={runtime}/>
      {RIVALS.map((r,i)=><Racer key={r.name} index={i} runtime={runtime}/>)}
    </Suspense>
    <RaceEffects kart={runtime.visual}/>
    <FollowCamera kart={runtime.visual} showcase={showcase}/>
  </Canvas>
})

