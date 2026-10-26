import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RIVALS } from '../game/raceLoop'
import {OPTIONAL_CIRCUIT_MODEL} from '../game/assetErrors'
import { NeonRacer, type NeonRacerProps } from './NeonRacer'

const PERSONAL_ASSETS = import.meta.env.VITE_PERSONAL_ASSETS === 'true'
const MODEL = OPTIONAL_CIRCUIT_MODEL
// Each source material has at most six team variants; geometry and texture maps
// remain loader-owned and shared across all racers. Ordinary materials are untouched.
const teamMaterials = new WeakMap<THREE.Material, Map<string, THREE.Material>>()
function materialForTeam(source: THREE.Material, color: string): THREE.Material {
  if (!/^(TeamBody|TeamSuit)(?:[._].*)?$/.test(source.name)) return source
  let variants = teamMaterials.get(source)
  if (!variants) { variants = new Map(); teamMaterials.set(source, variants) }
  const cached = variants.get(color)
  if (cached) return cached
  const material = source.clone()
  if ('color' in material && material.color instanceof THREE.Color) material.color.set('#ffffff')
  const body = source.name.startsWith('TeamBody'), tint = new THREE.Color(color)
  material.onBeforeCompile = shader => {
    shader.uniforms.teamTint = { value: tint }
    shader.fragmentShader = 'uniform vec3 teamTint;\n' + shader.fragmentShader
    const mask = body
      ? 'smoothstep(1.35, 1.65, atlas.b / max(atlas.r, 0.0001)) * smoothstep(1.15, 1.45, atlas.b / max(atlas.g, 0.0001))'
      : 'smoothstep(1.5, 1.85, atlas.r / max(atlas.g, 0.0001)) * smoothstep(1.5, 1.85, atlas.r / max(atlas.b, 0.0001))'
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
#include <color_fragment>
vec3 atlas = diffuseColor.rgb;
float teamMask = ${mask};
float originalIntensity = ${body ? 'atlas.b' : 'atlas.r'};
teamMask *= smoothstep(0.015, 0.055, originalIntensity);
diffuseColor.rgb = mix(atlas, teamTint * originalIntensity, teamMask);
`)
  }
  material.customProgramCacheKey = () => body ? 'circuit-team-blue-v2' : 'circuit-team-red-v2'
  variants.set(color, material)
  return material
}
class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}
/** Optional local model: public builds never request or preload the personal asset. */
export function CircuitRacer({ player = false, variant = 0, color, motion }: NeonRacerProps) {
  const index = ((variant % RIVALS.length) + RIVALS.length) % RIVALS.length
  const team = color ?? (player ? '#49dce8' : RIVALS[index].color)
  const fallback = <NeonRacer player={player} variant={variant} color={team} motion={motion} />
  if (!PERSONAL_ASSETS) return fallback
  return <ModelBoundary fallback={fallback}><Suspense fallback={fallback}>
    <LoadedCircuit color={team} motion={motion} />
  </Suspense></ModelBoundary>
}
function LoadedCircuit({ color, motion }: { color: string; motion: NeonRacerProps['motion'] }) {
  const { scene } = useGLTF(MODEL)
  const prepared = useMemo(() => {
    const root = scene.clone(true)
    const wheels: { steer: THREE.Group; spinner: THREE.Object3D; base: THREE.Quaternion; front: boolean; radius:number }[] = []
    const candidates: THREE.Object3D[] = []
    root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.material = Array.isArray(object.material) ? object.material.map(m => materialForTeam(m, color)) : materialForTeam(object.material, color)
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
    return { root, wheels }
  }, [scene, color])
  const steeringRotation = useMemo(() => new THREE.Quaternion(), [])
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const steeringState = useMemo(() => ({ angle: 0 }), [prepared])
  useFrame((_, delta) => {
    const dt = Math.min(delta, .05)
    steeringState.angle = THREE.MathUtils.damp(steeringState.angle, -(motion?.steering ?? 0) * .4, 18, dt)
    steeringRotation.setFromAxisAngle(yAxis, steeringState.angle)
    for (const wheel of prepared.wheels) {
      if (wheel.front) wheel.steer.quaternion.copy(wheel.base).multiply(steeringRotation)
      wheel.spinner.rotation.x += (motion?.speed ?? 0) / wheel.radius * dt
    }
  })
  return <primitive object={prepared.root} dispose={null} />
}

