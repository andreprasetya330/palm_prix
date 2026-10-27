import { Component, Suspense,useEffect, useMemo, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RIVALS } from '../game/raceLoop'
import {OPTIONAL_CIRCUIT_MODEL} from '../game/assetErrors'
import { NeonRacer, type NeonRacerProps } from './NeonRacer'
import {StylizedFace} from '../avatar/StylizedFace'
import type {FaceProfile} from '../avatar/faceProfile'
import type {DriverStyle} from '../avatar/driverStyle'

const PERSONAL_ASSETS = import.meta.env.VITE_PERSONAL_ASSETS === 'true'
const MODEL = OPTIONAL_CIRCUIT_MODEL
// Each source material has at most six team variants; geometry and texture maps
// remain loader-owned and shared across all racers. Ordinary materials are untouched.
const teamMaterials = new WeakMap<THREE.Material, Map<string, THREE.Material>>()
function materialForTeam(source: THREE.Material, color: string,helmetColor?:string): THREE.Material {
  if (!/^(TeamBody|TeamSuit)(?:[._].*)?$/.test(source.name)) return source
  let variants = teamMaterials.get(source)
  if (!variants) { variants = new Map(); teamMaterials.set(source, variants) }
  const cached = helmetColor?undefined:variants.get(color)
  if (cached) return cached
  const material = source.clone()
  if ('color' in material && material.color instanceof THREE.Color) material.color.set('#ffffff')
  const body = source.name.startsWith('TeamBody'), tint = new THREE.Color(color)
  material.onBeforeCompile = shader => {
    shader.uniforms.teamTint = { value: tint }
    shader.fragmentShader = 'uniform vec3 teamTint;\n' + shader.fragmentShader
    if(helmetColor){
      shader.uniforms.helmetTint={value:new THREE.Color(helmetColor)}
      shader.vertexShader='varying float vDriverHeight;\n'+shader.vertexShader
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvDriverHeight = position.y;')
      shader.fragmentShader='varying float vDriverHeight;\nuniform vec3 helmetTint;\n'+shader.fragmentShader
    }
    const mask = body
      ? 'smoothstep(1.35, 1.65, atlas.b / max(atlas.r, 0.0001)) * smoothstep(1.15, 1.45, atlas.b / max(atlas.g, 0.0001))'
      : 'smoothstep(1.5, 1.85, atlas.r / max(atlas.g, 0.0001)) * smoothstep(1.5, 1.85, atlas.r / max(atlas.b, 0.0001))'
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
#include <color_fragment>
vec3 atlas = diffuseColor.rgb;
float teamMask = ${mask};
float originalIntensity = ${body ? 'atlas.b' : 'atlas.r'};
teamMask *= smoothstep(0.015, 0.055, originalIntensity);
diffuseColor.rgb = mix(atlas, ${helmetColor?'mix(teamTint, helmetTint, smoothstep(0.97, 1.07, vDriverHeight))':'teamTint'} * originalIntensity, teamMask);
`)
  }
  material.customProgramCacheKey = () => body ? 'circuit-team-blue-v2' : helmetColor?'circuit-personal-driver-v1':'circuit-team-red-v2'
  if(!helmetColor)variants.set(color, material)
  return material
}
class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}
/** Optional local model: public builds never request or preload the personal asset. */
export function CircuitRacer({ player = false, variant = 0, color, motion,faceProfile,driverStyle }: NeonRacerProps) {
  const index = ((variant % RIVALS.length) + RIVALS.length) % RIVALS.length
  const team = color ?? (player ? '#49dce8' : RIVALS[index].color)
  const fallback = <NeonRacer player={player} variant={variant} color={team} motion={motion} faceProfile={faceProfile} driverStyle={driverStyle}/>
  if (!PERSONAL_ASSETS) return fallback
  return <ModelBoundary fallback={fallback}><Suspense fallback={fallback}>
    <LoadedCircuit color={team} motion={motion} faceProfile={player?faceProfile:null} driverStyle={player?driverStyle:undefined}/>
  </Suspense></ModelBoundary>
}
function LoadedCircuit({ color, motion,faceProfile,driverStyle }: { color: string; motion: NeonRacerProps['motion'];faceProfile?:FaceProfile|null;driverStyle?:DriverStyle }) {
  const { scene } = useGLTF(MODEL)
  const personalized=Boolean(faceProfile)
  const prepared = useMemo(() => {
    const root = scene.clone(true)
    const wheels: { steer: THREE.Group; spinner: THREE.Object3D; base: THREE.Quaternion; front: boolean; radius:number }[] = []
    const candidates: THREE.Object3D[] = []
    const ownedMaterials:THREE.Material[]=[]
    let facePosition:[number,number,number]=[0,1.01436,.24]
    root.updateMatrixWorld(true)
    const original=root.getObjectByName('driver-face')
    if(original){
      const bounds=new THREE.Box3().setFromObject(original),center=bounds.getCenter(new THREE.Vector3())
      facePosition=[center.x,bounds.max.y-.16*(1.46/1.34),bounds.max.z-(.143*(1.46/1.34)+.021)]
      original.visible=!personalized
    }
    const chooseMaterial=(m:THREE.Material)=>{
      if(driverStyle&&m.name.startsWith('TeamSuit')){const custom=materialForTeam(m,driverStyle.suit,driverStyle.helmet);ownedMaterials.push(custom);return custom}
      return materialForTeam(m,color)
    }
    root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.material = Array.isArray(object.material) ? object.material.map(chooseMaterial) : chooseMaterial(object.material)
        object.castShadow = true; object.receiveShadow = true
      }
      if (/^wheel-(front|rear)-(left|right)$/.test(object.name)) candidates.push(object)
    })
    for (const wheel of candidates) {
      if (!wheel.parent) continue
      const parent = wheel.parent, steer = new THREE.Group()
      steer.name = `${wheel.name}-steering`; steer.position.copy(wheel.position); steer.quaternion.copy(wheel.quaternion)
      const base = steer.quaternion.clone()
      parent.add(steer); steer.add(wheel)
      wheel.position.set(0, 0, 0); wheel.quaternion.identity()
      wheels.push({ steer, spinner: wheel, base, front: wheel.name.includes('-front-'),radius:Number(wheel.userData.wheelRadius)||.33 })
    }
    return { root, wheels,facePosition,ownedMaterials }
  }, [scene, color,driverStyle,personalized])
  useEffect(()=>()=>prepared.ownedMaterials.forEach(m=>m.dispose()),[prepared])
  const steeringRotation = useMemo(() => new THREE.Quaternion(), [])
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const steeringState = useMemo(() => ({ angle: 0 }), [])
  useFrame((_, delta) => {
    const dt = Math.min(delta, .05)
    steeringState.angle = THREE.MathUtils.damp(steeringState.angle, -(motion?.steering ?? 0) * .4, 18, dt)
    steeringRotation.setFromAxisAngle(yAxis, steeringState.angle)
    for (const wheel of prepared.wheels) {
      if (wheel.front) wheel.steer.quaternion.copy(wheel.base).multiply(steeringRotation)
      wheel.spinner.rotation.x += (motion?.speed ?? 0) / wheel.radius * dt
    }
  })
  return <group><primitive object={prepared.root} dispose={null}/>{faceProfile&&<StylizedFace profile={faceProfile} position={prepared.facePosition}/>}</group>
}

