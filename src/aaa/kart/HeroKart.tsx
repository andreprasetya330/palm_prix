import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { KartState } from '../../game/kartPhysics'
import { Driver } from './Driver'
import { createNoseBadge, createPalmTexture, createShadowTexture } from './decals'
import {
  anchors,
  capGeo,
  endplateGeo,
  exhaustGeo,
  flameGeo,
  cowlGeo,
  glassGeo,
  lensGeo,
  lowerBodyGeo,
  numberBadgeBackGeo,
  numberBadgeGeo,
  rimGeo,
  sevenGeo,
  seatBackGeo,
  spokeGeo,
  splitterGeo,
  tailLensGeo,
  tireGeo,
  undertrayGeo,
  wingGeo,
} from './geom'
import { LAYOUT } from './palette'

export type HeroKartProps = {
  kart: KartState
  driverTextureUrl: string | null
}

const SHOT =
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('shot')

/** This branch's oval: x = sin(t) * r * 1.15, z = cos(t) * r. Asphalt is about r 14–22. */
function poseOnOval(x: number, z: number, yaw: number) {
  const radius = Math.hypot(x / 1.15, z)
  if (radius >= 13.8 && radius <= 22.4) return { x, z, yaw, planted: false }
  const t = Math.atan2(x / 1.15, z || 1e-4)
  const tx = Math.cos(t) * 1.15
  const tz = -Math.sin(t)
  const len = Math.hypot(tx, tz) || 1
  const along = 8
  return {
    x: Math.sin(t) * 18 * 1.15 + (tx / len) * along,
    z: Math.cos(t) * 18 + (tz / len) * along,
    yaw: Math.atan2(tx / len, tz / len),
    planted: true,
  }
}

const WHEELS = [
  { x: -LAYOUT.wheelX, z: LAYOUT.frontZ, front: true },
  { x: LAYOUT.wheelX, z: LAYOUT.frontZ, front: true },
  { x: -LAYOUT.wheelX, z: LAYOUT.rearZ, front: false },
  { x: LAYOUT.wheelX, z: LAYOUT.rearZ, front: false },
] as const

function makeCandyEnv(gl: THREE.WebGLRenderer, pmrem: THREE.PMREMGenerator) {
  const scene = new THREE.Scene()
  const disposables: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> = []
  const add = (mesh: THREE.Mesh) => {
    scene.add(mesh)
    disposables.push({
      geometry: mesh.geometry,
      material: mesh.material as THREE.Material,
    })
  }
  add(
    new THREE.Mesh(
      new THREE.SphereGeometry(6, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#9fd4ff', side: THREE.BackSide }),
    ),
  )
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6, 20),
    new THREE.MeshBasicMaterial({ color: '#67c56d' }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -1.4
  add(ground)
  const key = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 3.2),
    new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  )
  key.position.set(2.2, 3.4, 1.6)
  key.lookAt(0, 1, 0)
  add(key)
  const warm = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 2.2),
    new THREE.MeshBasicMaterial({ color: '#ffc9a0' }),
  )
  warm.position.set(-2.8, 1.5, 2.2)
  warm.lookAt(0, 0.4, 0)
  add(warm)
  const prev = gl.getRenderTarget()
  const tex = pmrem.fromScene(scene, 0.04).texture
  gl.setRenderTarget(prev)
  for (const item of disposables) {
    item.geometry.dispose()
    item.material.dispose()
  }
  return tex
}

function useCandyEnv() {
  const gl = useThree((s) => s.gl)
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useLayoutEffect(() => {
    let env: THREE.Texture | null = null
    let pmrem: THREE.PMREMGenerator | null = null
    try {
      const prev = gl.getRenderTarget()
      pmrem = new THREE.PMREMGenerator(gl)
      env = makeCandyEnv(gl, pmrem)
      gl.setRenderTarget(prev)
      setTex(env)
    } catch (err) {
      console.warn('Palm Dart env map skipped', err)
    }
    return () => {
      env?.dispose()
      pmrem?.dispose()
    }
  }, [gl])
  return tex
}

export function HeroKart({ kart, driverTextureUrl }: HeroKartProps) {
  const env = useCandyEnv()
  const root = useRef<THREE.Group>(null)
  const roll = useRef<THREE.Group>(null)
  const squat = useRef<THREE.Group>(null)
  const spins = useRef<Array<THREE.Group | null>>([null, null, null, null])
  const steers = useRef<Array<THREE.Group | null>>([null, null])
  const flame = useRef<THREE.Group>(null)
  const steerAngle = useRef(0)
  const rollAngle = useRef(0)
  const squatAmt = useRef(0)
  const prevYaw = useRef(kart.yaw)
  const camRight = useRef(new THREE.Vector3())
  const camFwd = useRef(new THREE.Vector3())
  const camLook = useRef(new THREE.Vector3())
  const origin = useRef(new THREE.Vector3())
  const visual = useRef({ x: kart.x, z: kart.z, yaw: kart.yaw, planted: false })

  const shadowTex = useMemo(() => createShadowTexture(), [])
  const palmTex = useMemo(() => createPalmTexture(), [])
  const noseTex = useMemo(() => createNoseBadge(), [])
  const avatar = useMemo(() => {
    if (!driverTextureUrl) return null
    const t = new THREE.TextureLoader().load(driverTextureUrl)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [driverTextureUrl])
  const struts = useMemo(() => {
    const mk = (x: number) =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, 0.58, -0.92),
          new THREE.Vector3(x, 1.38, -1.28),
        ]),
        6,
        0.026,
        8,
        false,
      )
    return [mk(-0.38), mk(0.38)]
  }, [])
  const wing = useMemo(() => {
    const g = wingGeo.clone()
    g.computeBoundingBox()
    const c = new THREE.Vector3()
    g.boundingBox?.getCenter(c)
    g.translate(-c.x, -c.y, -c.z)
    return g
  }, [])

  useFrame((_, dt) => {
    const step = Math.min(0.05, dt)
    let dyaw = kart.yaw - prevYaw.current
    if (dyaw > Math.PI) dyaw -= Math.PI * 2
    if (dyaw < -Math.PI) dyaw += Math.PI * 2
    prevYaw.current = kart.yaw
    const rate = dyaw / Math.max(step, 1e-4)
    const steerTarget = THREE.MathUtils.clamp(rate * 0.24, -0.7, 0.7)
    const rollTarget = THREE.MathUtils.clamp(-rate * 0.1, -0.24, 0.24)
    const squatTarget =
      Math.min(0.055, Math.abs(kart.speed) * 0.002) +
      Math.min(0.035, Math.abs(rate) * 0.015)
    steerAngle.current = THREE.MathUtils.damp(steerAngle.current, steerTarget, 12, step)
    rollAngle.current = THREE.MathUtils.damp(rollAngle.current, rollTarget, 8, step)
    squatAmt.current = THREE.MathUtils.damp(squatAmt.current, squatTarget, 8, step)

    const spin = kart.speed * 2.3 * step
    for (const w of spins.current) if (w) w.rotation.x += spin
    for (const s of steers.current) if (s) s.rotation.y = steerAngle.current
    if (roll.current) {
      roll.current.rotation.z = rollAngle.current
      roll.current.rotation.x = THREE.MathUtils.clamp(-kart.speed * 0.0035, -0.07, 0.05)
    }
    if (squat.current) squat.current.position.y = -squatAmt.current
    const place = poseOnOval(kart.x, kart.z, kart.yaw)
    visual.current.x = place.x
    visual.current.z = place.z
    visual.current.yaw = place.yaw
    visual.current.planted = place.planted
    if (root.current) {
      const hop = Math.sin(performance.now() * 0.012) * Math.min(0.012, Math.abs(kart.speed) * 0.0004)
      root.current.position.set(place.x, hop, place.z)
      root.current.rotation.set(0, place.yaw, 0)
    }
    if (flame.current) {
      const flick = 0.82 + Math.sin(performance.now() * 0.04) * 0.18
      flame.current.scale.set(1, flick, 1)
    }
  })

  // Priority above 0 disables R3F's automatic render, so this hook paints the frame.
  // It runs after the chase camera and can pull in for ?shot=close.
  useFrame(({ gl, scene, camera }) => {
    const seen = visual.current
    if (SHOT === 'close' && camera instanceof THREE.PerspectiveCamera) {
      const yaw = seen.yaw
      camFwd.current.set(Math.sin(yaw), 0, Math.cos(yaw))
      camRight.current.set(Math.cos(yaw), 0, -Math.sin(yaw))
      origin.current.set(seen.x, 0, seen.z)
      camera.position
        .copy(origin.current)
        .addScaledVector(camRight.current, 1.55)
        .addScaledVector(camFwd.current, 2.25)
      camera.position.y += 1.62
      camLook.current.copy(origin.current).addScaledVector(camFwd.current, 0.05)
      camLook.current.y += 0.82
      camera.lookAt(camLook.current)
      if (camera.fov !== 40 || camera.near !== 0.08) {
        camera.fov = 40
        camera.near = 0.08
        camera.updateProjectionMatrix()
      }
    } else if (seen.planted && camera instanceof THREE.PerspectiveCamera) {
      const speedFactor = Math.min(1, Math.abs(kart.speed) / 28)
      const back = 6.5 + speedFactor * 1.4
      const yaw = seen.yaw
      camera.position.set(
        seen.x - Math.sin(yaw) * back,
        3.6 + speedFactor * 0.6,
        seen.z - Math.cos(yaw) * back,
      )
      camera.lookAt(seen.x, 1, seen.z)
      if (camera.fov !== 52) {
        camera.fov = 52
        camera.updateProjectionMatrix()
      }
    }
    gl.render(scene, camera)
  }, 1)

  const boosting = kart.boostTimer > 0
  const noseZ = anchors.nose.z

  return (
    <group ref={root} name="palm-dart">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={-1}>
        <circleGeometry args={[1.35, 40]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>

      <group ref={roll} position={[0, LAYOUT.wheelY, 0]}>
        <group position={[0, -LAYOUT.wheelY, 0]}>
          {WHEELS.map((w, i) => (
            <group
              key={i}
              position={[w.x, LAYOUT.wheelY, w.z]}
              ref={
                w.front
                  ? (el) => {
                      steers.current[i] = el
                    }
                  : undefined
              }
            >
              <group
                ref={(el) => {
                  spins.current[i] = el
                }}
              >
                <WheelMesh side={w.x > 0 ? 1 : -1} env={env} />
              </group>
            </group>
          ))}

          <group ref={squat}>
            <mesh geometry={lowerBodyGeo} castShadow receiveShadow>
              <meshPhysicalMaterial
                color="#fff3e4"
                roughness={0.16}
                metalness={0.04}
                clearcoat={1}
                clearcoatRoughness={0.05}
                envMap={env ?? undefined}
                envMapIntensity={0.85}
              />
            </mesh>
            <mesh geometry={cowlGeo} castShadow receiveShadow>
              <meshPhysicalMaterial
                color="#ff3d66"
                roughness={0.12}
                metalness={0.04}
                clearcoat={1}
                clearcoatRoughness={0.04}
                envMap={env ?? undefined}
                envMapIntensity={0.9}
              />
            </mesh>
            <mesh geometry={undertrayGeo} position={[0, 0.16, 0.04]}>
              <meshStandardMaterial color="#24182f" roughness={0.85} />
            </mesh>
            <mesh geometry={splitterGeo} position={[0, 0.2, noseZ - 0.28]} rotation={[0.15, 0, 0]}>
              <meshStandardMaterial color="#fff3e4" roughness={0.4} />
            </mesh>

            <mesh position={[0, 0.46, -0.02]} scale={[1.2, 0.42, 1.15]}>
              <sphereGeometry args={[0.3, 24, 16]} />
              <meshStandardMaterial color="#24182f" roughness={0.9} />
            </mesh>
            <mesh geometry={seatBackGeo} position={[0, 0.58, -0.28]} rotation={[-0.45, 0, 0]} castShadow>
              <meshStandardMaterial color="#3a2a52" roughness={0.7} />
            </mesh>

            <group position={[0, 0.66, 0.22]} rotation={[-0.5, 0, 0]}>
              <mesh>
                <torusGeometry args={[0.15, 0.018, 10, 24]} />
                <meshStandardMaterial color="#1a1024" roughness={0.45} metalness={0.2} />
              </mesh>
              {[0, 1, 2].map((i) => (
                <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
                  <cylinderGeometry args={[0.01, 0.01, 0.28, 8]} />
                  <meshStandardMaterial color="#1a1024" metalness={0.35} roughness={0.4} />
                </mesh>
              ))}
            </group>

            <Driver texture={avatar} envMap={env} />

            <group position={[0, 0.76, 0.48]} rotation={[-0.18, 0, 0]}>
              <mesh geometry={glassGeo}>
                <meshPhysicalMaterial
                  color="#c5f3ff"
                  transparent
                  opacity={0.32}
                  roughness={0.02}
                  metalness={0}
                  clearcoat={1}
                  clearcoatRoughness={0.02}
                  transmission={0.55}
                  thickness={0.04}
                  ior={1.45}
                  envMap={env ?? undefined}
                  envMapIntensity={0.08}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            </group>

            <mesh position={[0, 0.8, 0.78]} rotation={[-0.95, 0, 0]}>
              <planeGeometry args={[0.34, 0.3]} />
              <meshBasicMaterial
                map={noseTex}
                transparent
                polygonOffset
                polygonOffsetFactor={-2}
                depthWrite={false}
              />
            </mesh>
            <mesh position={[0.56, 0.38, 0.18]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[0.36, 0.32]} />
              <meshBasicMaterial
                map={noseTex}
                transparent
                polygonOffset
                polygonOffsetFactor={-2}
                depthWrite={false}
              />
            </mesh>
            <mesh position={[-0.56, 0.38, 0.18]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[0.36, 0.32]} />
              <meshBasicMaterial
                map={noseTex}
                transparent
                polygonOffset
                polygonOffsetFactor={-2}
                depthWrite={false}
              />
            </mesh>

            <Headlight x={-0.2} z={noseZ - 0.02} />
            <Headlight x={0.2} z={noseZ - 0.02} />

            <group position={[0, 1.52, -1.36]} rotation={[0.42, 0, 0]}>
              <mesh geometry={wing} castShadow>
                <meshPhysicalMaterial
                  color="#ff3d66"
                  roughness={0.24}
                  metalness={0.05}
                  clearcoat={1}
                  clearcoatRoughness={0.12}
                  envMap={env ?? undefined}
                  envMapIntensity={0.8}
                />
              </mesh>
              <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[1.38, 0.46]} />
                <meshBasicMaterial
                  map={palmTex}
                  transparent
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-4}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <Endplate x={0.72} yaw={-0.65} palmTex={palmTex} />
              <Endplate x={-0.72} yaw={0.65} palmTex={palmTex} />
            </group>
            {struts.map((g, i) => (
              <mesh key={i} geometry={g} castShadow>
                <meshStandardMaterial color="#2f6bff" roughness={0.4} />
              </mesh>
            ))}

            <NumberPlate position={[0, 0.72, -1.08]} />
            <TailLight x={-0.24} />
            <TailLight x={0.24} />

            <group position={[0, 0.32, -1.18]} rotation={[-Math.PI / 2, 0, 0]}>
              <mesh geometry={exhaustGeo} castShadow>
                <meshStandardMaterial
                  color="#d5dee8"
                  metalness={0.86}
                  roughness={0.18}
                  envMap={env ?? undefined}
                />
              </mesh>
            </group>
            <mesh position={[-0.22, 0.4, -1.02]}>
              <sphereGeometry args={[0.045, 16, 12]} />
              <meshStandardMaterial color="#ff2d55" emissive="#ff2d55" emissiveIntensity={1.4} />
            </mesh>
            <mesh position={[0.22, 0.4, -1.02]}>
              <sphereGeometry args={[0.045, 16, 12]} />
              <meshStandardMaterial color="#ff2d55" emissive="#ff2d55" emissiveIntensity={1.4} />
            </mesh>

            <group name="boost-flame" position={[0, 0.32, -1.36]} visible={boosting}>
              <group ref={flame} rotation={[-Math.PI / 2, 0, 0]}>
                <mesh geometry={flameGeo}>
                  <meshBasicMaterial
                    color="#ff4a16"
                    transparent
                    opacity={0.95}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                  />
                </mesh>
                <mesh geometry={flameGeo} scale={[0.48, 0.62, 0.48]}>
                  <meshBasicMaterial
                    color="#fff6b0"
                    transparent
                    opacity={1}
                    blending={THREE.AdditiveBlending}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                  />
                </mesh>
              </group>
              {boosting && (
                <pointLight color="#ffb15a" intensity={6} distance={4.5} decay={2} />
              )}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

function WheelMesh({ side, env }: { side: 1 | -1; env: THREE.Texture | null }) {
  return (
    <group rotation={[0, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2]}>
      <mesh geometry={tireGeo} castShadow>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.12, 0.12, 0.16, 32]} />
        <meshStandardMaterial color="#1c1e26" metalness={0.4} roughness={0.55} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <ringGeometry args={[0.07, 0.16, 48]} />
        <meshStandardMaterial color="#2c313c" metalness={0.5} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.108, 0]}>
        <torusGeometry args={[0.214, 0.016, 16, 72]} />
        <meshPhysicalMaterial
          color="#ffc83d"
          metalness={0.92}
          roughness={0.14}
          clearcoat={0.4}
          envMap={env ?? undefined}
          envMapIntensity={1}
        />
      </mesh>
      <mesh geometry={rimGeo} castShadow>
        <meshPhysicalMaterial
          color="#ffc83d"
          metalness={0.9}
          roughness={0.16}
          clearcoat={0.55}
          clearcoatRoughness={0.15}
          envMap={env ?? undefined}
          envMapIntensity={1.1}
        />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} geometry={spokeGeo} rotation={[0, (i / 5) * Math.PI * 2, 0]} castShadow>
          <meshPhysicalMaterial
            color="#ffe08a"
            metalness={0.88}
            roughness={0.18}
            envMap={env ?? undefined}
          />
        </mesh>
      ))}
      <mesh geometry={capGeo}>
        <meshStandardMaterial color="#ffc83d" metalness={0.75} roughness={0.22} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.172, 0]}>
        <circleGeometry args={[0.045, 20]} />
        <meshStandardMaterial color="#14a35a" />
      </mesh>
    </group>
  )
}

function Endplate({
  x,
  yaw,
  palmTex,
}: {
  x: number
  yaw: number
  palmTex: THREE.Texture
}) {
  return (
    <group position={[x, 0.02, 0.04]} rotation={[0.05, yaw, 0]} scale={1.35}>
      <mesh geometry={endplateGeo} castShadow>
        <meshStandardMaterial color="#2f6bff" roughness={0.35} />
      </mesh>
      <mesh position={[0.28, 0.16, 0.06]}>
        <planeGeometry args={[0.46, 0.32]} />
        <meshBasicMaterial
          map={palmTex}
          transparent
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-3}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0.28, 0.16, -0.06]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.46, 0.32]} />
        <meshBasicMaterial
          map={palmTex}
          transparent
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function Headlight({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.4, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.07, 0.014, 8, 16]} />
        <meshStandardMaterial color="#d5dee8" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh geometry={lensGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.01]}>
        <meshStandardMaterial color="#fff6cc" emissive="#fff1a8" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}

function TailLight({ x }: { x: number }) {
  return (
    <mesh geometry={tailLensGeo} position={[x, 0.42, -1.05]} rotation={[Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#ff2d55" emissive="#ff2d55" emissiveIntensity={1.5} />
    </mesh>
  )
}

function NumberPlate({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, Math.PI, 0]}>
      <mesh geometry={numberBadgeBackGeo}>
        <meshStandardMaterial color="#2f6bff" roughness={0.35} />
      </mesh>
      <mesh geometry={numberBadgeGeo} position={[0, 0, 0.03]}>
        <meshStandardMaterial color="#fff3e4" roughness={0.3} />
      </mesh>
      <mesh geometry={sevenGeo} position={[0, 0, 0.07]} scale={1.15}>
        <meshStandardMaterial color="#1a1024" roughness={0.4} />
      </mesh>
    </group>
  )
}

