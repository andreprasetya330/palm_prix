import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { KartState } from '../../game/kartPhysics'
import { PalmGradeShader } from './palmGrade'

type GradeUniforms = {
  tDiffuse: { value: THREE.Texture | null }
  uBoost: { value: number }
}

/**
 * Takes over the R3F render (priority > 0).
 * Linear HDR → bloom → sunny grade → Neutral tonemap in OutputPass.
 * ACES is the muddy default this replaces.
 */
export function RaceComposer({ kart }: { kart: KartState }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const kartRef = useRef(kart)
  kartRef.current = kart
  const boost = useRef(0)

  const passes = useMemo(() => {
    const composer = new EffectComposer(gl)
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.38, 1.15)
    const grade = new ShaderPass(PalmGradeShader)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(bloom)
    composer.addPass(grade)
    composer.addPass(new OutputPass())
    return { composer, bloom, grade }
  }, [gl, scene, camera])

  useEffect(() => {
    passes.composer.setPixelRatio(gl.getPixelRatio())
    passes.composer.setSize(size.width, size.height)
  }, [passes, gl, size.width, size.height])

  useEffect(() => {
    const { composer, bloom, grade } = passes
    return () => {
      bloom.dispose()
      grade.dispose()
      composer.dispose()
    }
  }, [passes])

  useFrame((_, dt) => {
    if (size.width < 2 || size.height < 2) return
    if (gl.toneMapping !== THREE.NeutralToneMapping) {
      gl.toneMapping = THREE.NeutralToneMapping
    }
    const target = kartRef.current.boostTimer > 0 ? 1 : 0
    boost.current = THREE.MathUtils.damp(boost.current, target, 6.5, dt)
    const k = boost.current
    gl.toneMappingExposure = 1.06 + k * 0.08
    passes.bloom.strength = 0.16 + k * 0.36
    passes.bloom.radius = 0.28 + k * 0.18
    passes.bloom.threshold = 1.05 - k * 0.28
    const uniforms = passes.grade.uniforms as unknown as GradeUniforms
    uniforms.uBoost.value = k
    passes.composer.render()
  }, 1)

  return null
}
