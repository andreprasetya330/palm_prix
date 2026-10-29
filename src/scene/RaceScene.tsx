import { memo, Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {NeonHorizon} from './NeonHorizon'
import {NeonCity} from './NeonCity'
import {NeonPostFX} from './NeonPostFX'
import {TrackObstacles} from './TrackObstacles'
import {CourseDistricts} from './CourseDistricts'
import { ACESFilmicToneMapping, Group, DirectionalLight, Object3D, CanvasTexture } from 'three'
import { PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { RaceRuntime } from '../game/runtime'
import { RIVALS } from '../game/raceLoop'
import { getRoadPose, getTrackSurface,TRACK_LENGTH } from '../game/trackLayout'
import { FollowCamera } from './FollowCamera'
import { CourseFun } from './CourseFun'
import { Track } from './Track'
import {RaceCeremony} from './RaceCeremony'
import { RaceEffects } from './RaceEffects'
import { RaceSimulation } from './RaceSimulation'
import { FrameDiagnostics } from './FrameDiagnostics'
import {CircuitRacer} from './CircuitRacer'
import {AbilityEffects} from './AbilityEffects'
import type {FaceProfile} from '../avatar/faceProfile'
import type {DriverStyle} from '../avatar/driverStyle'

type Props={runtime:RaceRuntime;showcase?:boolean;previewT?:number;faceProfile?:FaceProfile|null;driverStyle?:DriverStyle;paused?:boolean}
function Environment(){
  const {gl,scene}=useThree()
  useEffect(()=>{
    const generator=new PMREMGenerator(gl), room=new RoomEnvironment()
    const target=generator.fromScene(room,.08)
    scene.environment=target.texture;scene.environmentIntensity=.12
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
    const height=getRoadPose(kart.x,kart.z).height
    if(sun.current)sun.current.position.set(kart.x+45,height+28,kart.z-45)
    target.position.set(kart.x,height,kart.z);target.updateMatrixWorld()
    // Contact decals anchor the wheels every frame; distant soft shadows can update at 20Hz.
    shadowElapsed.current+=dt
    if(shadowElapsed.current>=.05){gl.shadowMap.needsUpdate=true;shadowElapsed.current=0}
  },-50)
  return <><primitive object={target}/><directionalLight ref={sun} target={target} position={[45,28,-45]} intensity={2.0} color="#ff9d74" castShadow
    shadow-mapSize={[1024,1024]} shadow-bias={-.0003} shadow-normalBias={.035}
    shadow-camera-near={1} shadow-camera-far={140} shadow-camera-left={-30}
    shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30}/></>
}
function PauseHiddenRenderer({paused=false}:{paused?:boolean}){
  const setFrameloop=useThree(state=>state.setFrameloop)
  useEffect(()=>{
    const sync=()=>setFrameloop(document.hidden||paused?'never':'always')
    sync();document.addEventListener('visibilitychange',sync)
    return()=>document.removeEventListener('visibilitychange',sync)
  },[setFrameloop,paused])
  return null
}
function Racer({runtime,index=-1,faceProfile,driverStyle}:{runtime:RaceRuntime;index?:number;faceProfile?:FaceProfile|null;driverStyle?:DriverStyle}){
  const group=useRef<Group>(null)
  const motion=useMemo(()=>({speed:0,steering:0,rev:0,celebration:0}),[])
  const contact=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128
    const ctx=canvas.getContext('2d')!,shade=ctx.createRadialGradient(64,64,8,64,64,63)
    shade.addColorStop(0,'rgba(2,3,12,.6)');shade.addColorStop(.45,'rgba(2,3,12,.35)');shade.addColorStop(1,'rgba(2,3,12,0)')
    ctx.fillStyle=shade;ctx.fillRect(0,0,128,128)
    for(const x of [26,102])for(const y of [26,102]){
      const tire=ctx.createRadialGradient(x,y,1,x,y,12)
      tire.addColorStop(0,'rgba(0,0,5,.55)');tire.addColorStop(1,'rgba(0,0,5,0)')
      ctx.fillStyle=tire;ctx.fillRect(x-12,y-12,24,24)
    }
    return new CanvasTexture(canvas)
  },[])
  useEffect(()=>()=>contact.dispose(),[contact])
  useFrame(()=>{
    const root=group.current;if(!root)return
    if(index<0){
      const k=runtime.visual
      const road=getRoadPose(k.x,k.z),delta=k.yaw-road.yaw
      const pitch=Math.atan(road.grade*Math.cos(delta)+Math.tan(road.bank)*Math.sin(delta))
      const roll=Math.atan(-road.grade*Math.sin(delta)+Math.tan(road.bank)*Math.cos(delta))
      // Follow the road bank without leaning the wheel assembly off the tarmac.
      root.position.set(k.x,road.height+.005,k.z);root.rotation.set(-pitch,k.yaw,roll,'YXZ')
      motion.speed=k.speed;motion.steering=k.steering??0
      motion.rev=runtime.race.phase==='countdown'&&runtime.race.countdown<=3?runtime.control.throttle:0
      motion.celebration=runtime.race.phase==='finish'?runtime.race.finishElapsed:0
    }else{
      const rival=runtime.race.rivals[index]
      const remainder=1/60-runtime.race.rivalAccumulator
      const distance=rival.distance-rival.speed*remainder,lane=rival.lane-rival.laneVelocity*remainder
      const surface=getTrackSurface(distance/TRACK_LENGTH,lane)
      const delta=Math.atan2(rival.laneVelocity,Math.max(1,rival.speed)),heading=surface.yaw+delta
      const pitch=Math.atan(surface.grade*Math.cos(delta)+Math.tan(surface.bank)*Math.sin(delta))
      const bank=Math.atan(-surface.grade*Math.sin(delta)+Math.tan(surface.bank)*Math.cos(delta))
      root.position.copy(surface.point);root.position.y+=.005+(rival.stunTimer>0?Math.sin((1.1-rival.stunTimer)/1.1*Math.PI)*.25:0);root.rotation.set(-pitch,heading+(rival.stunTimer>0?(1.1-rival.stunTimer)/1.1*Math.PI*4:0),bank,'YXZ')
      motion.speed=runtime.race.phase==='racing'||runtime.race.phase==='finish'?rival.speed:0
      motion.steering=rival.steering
    }
  },-20)
  return <group ref={group}>
    <mesh position={[0,.004,.12]} rotation={[-Math.PI/2,0,0]} renderOrder={1}><planeGeometry args={[2.1,2.9]}/><meshBasicMaterial map={contact} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1}/></mesh>
    <CircuitRacer player={index<0} variant={index<0?0:index} color={index<0?'#49dce8':RIVALS[index].color} motion={motion} faceProfile={index<0?faceProfile:null} driverStyle={index<0?driverStyle:undefined}/>
  </group>
}
/** A stable scene: HUD and camera results cannot rebuild the world while driving. */
export const RaceScene=memo(function RaceScene({runtime,showcase=false,previewT,faceProfile,driverStyle,paused=false}:Props){
  return <Canvas shadows camera={{position:[0,6,14],fov:54,near:.1,far:500}} dpr={1}
    style={{width:'100%',height:'100%'}}
    gl={{antialias:false,powerPreference:'high-performance',toneMapping:ACESFilmicToneMapping,toneMappingExposure:1.05}}>
    <PauseHiddenRenderer paused={paused}/><RaceSimulation runtime={runtime}/><FrameDiagnostics/>
    <color attach="background" args={['#24102f']}/>
    <hemisphereLight args={['#b7bafa','#351330',.85]}/>
    <ambientLight intensity={.25} color="#bca0ff"/>
    <directionalLight position={[-40,18,25]} intensity={1.3} color="#46d8ff"/>
    <RaceLighting runtime={runtime}/>
    <NeonHorizon/>
    <fog attach="fog" args={['#291339',130,370]}/>
    <Environment/>
    <Suspense fallback={null}>
      <Track showcase={showcase}/>
      <CourseFun runtime={runtime}/>
      <AbilityEffects runtime={runtime}/>
      <NeonCity/><CourseDistricts/><TrackObstacles runtime={runtime}/>
      <Racer runtime={runtime} faceProfile={faceProfile} driverStyle={driverStyle}/>
      {!showcase&&RIVALS.map((r,i)=><Racer key={r.name} index={i} runtime={runtime}/>)}
    </Suspense>
    <RaceEffects kart={runtime.visual}/><RaceCeremony runtime={runtime}/>
    <FollowCamera kart={runtime.visual} showcase={showcase} previewT={previewT} race={runtime.race}/>
    <NeonPostFX/>
  </Canvas>
})
