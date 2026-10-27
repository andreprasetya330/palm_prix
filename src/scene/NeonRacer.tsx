import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type {FaceProfile} from '../avatar/faceProfile'
import type {DriverStyle} from '../avatar/driverStyle'
import {StylizedFace} from '../avatar/StylizedFace'

export type NeonRacerProps = { player?: boolean; variant?: number; color?: string; motion?: { speed: number; steering?: number };faceProfile?:FaceProfile|null;driverStyle?:DriverStyle }
type Part = THREE.BufferGeometry
const teamColors = ['#6833c8', '#ce347e', '#197cbd', '#e47825', '#318c80', '#a634cf']
const glowColors = ['#55f7ff', '#ffe17b', '#ff6bbd', '#7cffff', '#d7ff65', '#ff8aca']
const white = '#dcecff', ink = '#131827', tire = '#11121c'

function painted(g: Part, color: string, position: [number, number, number] = [0, 0, 0], rotation: [number, number, number] = [0, 0, 0]): Part {
  const geometry = g.index ? g.toNonIndexed() : g
  if (geometry !== g) g.dispose()
  geometry.deleteAttribute('uv')
  const transform = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1))
  geometry.applyMatrix4(transform)
  const c = new THREE.Color(color), data = new Float32Array(geometry.attributes.position.count * 3)
  for (let i = 0; i < geometry.attributes.position.count; i++) c.toArray(data, i * 3)
  geometry.setAttribute('color', new THREE.BufferAttribute(data, 3))
  return geometry
}
function combine(parts: Part[]): Part {
  const merged = mergeGeometries(parts, false)!
  parts.forEach(part => part.dispose())
  merged.computeBoundingBox(); merged.computeBoundingSphere()
  return merged
}
function box(w: number, h: number, d: number) { return new THREE.BoxGeometry(w, h, d) }
function slab(w: number, d: number, h: number, bevel = .045) {
  const shape = new THREE.Shape()
  shape.moveTo(-w/2,-d/2); shape.lineTo(w/2,-d/2); shape.lineTo(w/2,d/2); shape.lineTo(-w/2,d/2); shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1 })
  g.rotateX(-Math.PI/2); g.translate(0,-h/2,0)
  return g
}
function nose() {
  // Side profile of the swept wedge; extrude across vehicle width.
  const shape = new THREE.Shape()
  shape.moveTo(-1.23,.38); shape.lineTo(-1.28,.51); shape.lineTo(-.47,.77); shape.lineTo(.85,.7); shape.lineTo(1.13,.46); shape.lineTo(1.1,.34); shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape,{depth:1.24,bevelEnabled:true,bevelSize:.045,bevelThickness:.045,bevelSegments:1,steps:1})
  g.translate(0,0,-.62); g.rotateY(Math.PI/2)
  return g
}
function wheelGeometry(): Part {
  // Ascending axial coordinates avoid self-intersection in the lathe profile.
  const profile = [[.13,-.13],[.25,-.13],[.305,-.105],[.32,-.065],[.32,.065],[.305,.105],[.25,.13],[.13,.13]].map(([radius,axis])=>new THREE.Vector2(radius,axis))
  const rubber = new THREE.LatheGeometry(profile,16)
  rubber.rotateZ(Math.PI/2)
  const parts = [painted(rubber,tire)]
  for (const side of [-1,1]) {
    const rim = new THREE.CylinderGeometry(.233,.233,.018,12)
    rim.rotateZ(Math.PI/2)
    parts.push(painted(rim,'#c43baf',[side*.135,0,0]))
    const hub = new THREE.CylinderGeometry(.095,.095,.025,8)
    hub.rotateZ(Math.PI/2)
    parts.push(painted(hub,white,[side*.15,0,0]))
    for(let i=0;i<5;i++) {
      const angle=i*Math.PI*2/5
      parts.push(painted(box(.028,.16,.037),'#65e6ed',[side*.15,Math.cos(angle)*.14,Math.sin(angle)*.14],[angle,0,0]))
    }
  }
  return combine(parts)
}
const wheel = wheelGeometry()
const ramp = new THREE.DataTexture(new Uint8Array([72,72,72,255, 135,135,135,255, 205,205,205,255, 255,255,255,255]),4,1)
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true
const bodyMaterial = new THREE.MeshToonMaterial({vertexColors:true,gradientMap:ramp})
const glowMaterial = new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false,color:new THREE.Color(2.2,2.2,2.2)})
const visorMaterial = new THREE.MeshStandardMaterial({color:'#111624',metalness:.8,roughness:.19})
const assets = new Map<string, { body: Part; glow: Part; driver: Part; visor: Part }>()
function prepare(team: string, glow: string,helmetAccent=team,personalized=false,suitColor=team) {
  const key=team+glow+helmetAccent+suitColor+Number(personalized), cached=assets.get(key)
  if(cached)return cached
  const body:Part[]=[], lights:Part[]=[], driver:Part[]=[], glass:Part[]=[]
  body.push(painted(nose(),team),painted(slab(1.5,2.48,.1,.025),ink,[0,.29,0]))
  body.push(painted(slab(.71,.86,.16),ink,[0,.77,-.18]))
  // Side pods and inset cooling vanes make the silhouette read as a racer.
  for(const side of [-1,1]) {
    body.push(painted(slab(.3,1.36,.25,.025),team,[side*.67,.55,-.1]))
    body.push(painted(box(.015,.135,.52),ink,[side*.85,.57,-.13]))
    for(let i=0;i<4;i++) body.push(painted(box(.025,.13,.025),white,[side*.86,.57,-.34+i*.14],[.12,0,0]))
    lights.push(painted(box(.025,.025,1.05),glow,[side*.85,.39,.1]))
    body.push(painted(box(.09,.39,.1),ink,[side*.56,.89,-.98],[.18,0,0]))
    body.push(painted(slab(.07,.39,.23,.012),team,[side*.84,1.13,-.99]))
  }
  body.push(painted(slab(1.7,.33,.08,.02),team,[0,1.1,-1.02]))
  lights.push(painted(box(1.45,.025,.035),'#ff42c5',[0,1.105,-1.205]))
  // Rear deck inlays and wing end graphics break up the broad colored panels.
  body.push(painted(slab(.62,.32,.025,.01),ink,[0,.729,-.69]))
  for(let i=0;i<5;i++)body.push(painted(box(.48,.015,.024),white,[0,.75,-.81+i*.058]))
  for(const side of [-1,1]) {
    body.push(painted(box(.08,.014,.25),white,[side*.62,1.166,-1.02]))
    body.push(painted(box(.045,.014,.25),'#ff60cf',[side*.71,1.166,-1.02]))
    body.push(painted(box(.012,.055,.66),white,[side*.864,.65,-.17]))
  }
  // Wide front headlamp and rear ribbon; dark diffuser under the rear deck.
  lights.push(painted(box(.97,.045,.018),glow,[0,.52,1.328]),painted(box(1.1,.045,.02),'#ff398c',[0,.45,-1.17]))
  body.push(painted(box(1.1,.16,.18),ink,[0,.31,-1.19]))
  for(let i=0;i<5;i++)body.push(painted(box(.025,.13,.28),white,[-.44+i*.22,.265,-1.18],[.12,0,0]))
  // Original geometric hood livery and seven-segment racing number 07.
  body.push(painted(box(.11,.014,.5),white,[-.41,.663,.84],[.3,0,0]),painted(box(.045,.014,.5),'#ff50c9',[-.3,.663,.84],[.3,0,0]))
  const segments = [[0,.09,.1,.018],[-.05,0,.018,.16],[.05,0,.018,.16],[0,-.09,.1,.018]]
  for(const [x,z,w,d] of segments)body.push(painted(box(w,.012,d),white,[.17+x,.663,.84+z],[.3,0,0]))
  body.push(painted(box(.1,.012,.018),white,[.34,.69,.75]),painted(box(.018,.012,.18),white,[.38,.66,.85],[.3,0,0]))
  // Seated pilot: angular shoulders, bent sleeves, gloves, helmet chin and ear pods.
  driver.push(painted(new THREE.CylinderGeometry(.2,.27,.33,6),suitColor,[0,.94,-.21]))
  driver.push(painted(box(.16,.21,.18),white,[0,.97,-.04]))
  for(const side of [-1,1]) {
    driver.push(painted(box(.14,.17,.24),suitColor,[side*.24,.98,-.03],[.45,0,side*.2]))
    driver.push(painted(box(.12,.11,.13),ink,[side*.2,.93,.14]))
    driver.push(painted(box(.06,.12,.13),white,[side*.255,1.31,-.18]))
  }
  const helmet=personalized?new THREE.SphereGeometry(1,20,12,Math.PI/2+.68,Math.PI*2-1.36):new THREE.SphereGeometry(1,12,8);helmet.scale(.25,.27,.27)
  driver.push(painted(helmet,white,[0,1.31,-.2]))
  if(personalized){
    for(const [start,length]of [[0,.85],[2.35,Math.PI-2.35]]){
      const guard=new THREE.SphereGeometry(1,12,6,Math.PI/2-.68,1.36,start,length);guard.scale(.25,.27,.27);driver.push(painted(guard,white,[0,1.31,-.2]))
    }
  }
  const helmetStripe=new THREE.SphereGeometry(1,4,8,Math.PI*1.39,Math.PI*.22,.12,2.3)
  helmetStripe.scale(.255,.275,.275)
  driver.push(painted(helmetStripe,helmetAccent,[0,1.31,-.2]))
  for(let i=0;i<3;i++)driver.push(painted(box(.13,.016,.016),ink,[0,1.28+i*.035,-.471]))
  for(const side of [-1,1])lights.push(painted(box(.018,.06,.02),glow,[side*.107,1.31,-.455]))
  driver.push(painted(box(.13,.035,.4),helmetAccent,[0,1.558,-.2]))
  driver.push(painted(slab(.39,.19,.085,.02),helmetAccent,[0,1.13,-.005]))
  const visor=new THREE.SphereGeometry(1,12,4,0,Math.PI,.62,1.55);visor.scale(.256,.22,.278)
  glass.push(painted(visor,ink,[0,1.32,-.2]))
  lights.push(painted(box(.24,.016,.02),glow,[0,1.36,.076]))
  const steering=new THREE.TorusGeometry(.18,.022,4,12)
  driver.push(painted(steering,ink,[0,.92,.17],[-.45,0,0]))
  const result={body:combine(body),glow:combine(lights),driver:combine(driver),visor:combine(glass)}
  assets.set(key,result);return result
}

/** Eight draw calls per racer: four static batches plus four independently steered wheels. */
export function NeonRacer({player=false,variant=0,color,motion,faceProfile,driverStyle}:NeonRacerProps) {
  const index=player?0:((variant%5)+5)%5+1
  const team=color??teamColors[index],glow=glowColors[index]
  const personalized=Boolean(player&&faceProfile)
  const model=useMemo(()=>prepare(team,glow,player?driverStyle?.helmet:undefined,personalized,player?driverStyle?.suit:undefined),[team,glow,player,driverStyle,personalized])
  const pivots=useRef<(THREE.Group|null)[]>([]),spinners=useRef<(THREE.Mesh|null)[]>([])
  useFrame((_,delta)=>{
    const dt=Math.min(delta,.05)
    for(let i=0;i<4;i++) {
      const pivot=pivots.current[i],spinner=spinners.current[i]
      if(pivot&&i<2)pivot.rotation.y=THREE.MathUtils.damp(pivot.rotation.y,-(motion?.steering??0)*.4,18,dt)
      if(spinner)spinner.rotation.x+=(motion?.speed??0)/.32*dt
    }
  })
  return <group dispose={null}>
    <mesh geometry={model.body} material={bodyMaterial} castShadow receiveShadow/>
    <mesh geometry={model.glow} material={glowMaterial}/>
    <mesh geometry={model.driver} material={bodyMaterial} castShadow receiveShadow/>
    {player&&faceProfile?<StylizedFace profile={faceProfile} position={[0,1.31,-.10]}/>:<mesh geometry={model.visor} material={visorMaterial}/>}
    {[-1,1,-1,1].map((side,i)=><group key={i} position={[side*.79,.32,i<2?.79:-.8]} ref={node=>{pivots.current[i]=node}}>
      <mesh ref={node=>{spinners.current[i]=node}} geometry={wheel} material={bodyMaterial} castShadow receiveShadow/>
    </group>)}
  </group>
}

