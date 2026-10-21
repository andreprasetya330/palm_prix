import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { palette } from './palette'
import { LAGOON } from './spline'
import type { TrackTextures } from './textures'

const palms: [number, number, number, number, number][] = [
  [-10.7, 0, 4.1, 1.05, 0.28],
  [-10.3, 0, 9.5, 0.92, -0.22],
  [-11.5, 0, 12.8, 1.12, 0.16],
  [-25.6, 0, 11.4, 1.05, 0.34],
  [-26.2, 0, 6.6, 1.18, -0.18],
  [-25.2, 0, 2.4, 0.88, 0.3],
  [-22.4, 0, 13.6, 1.0, 0.08],
]

function frondGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(0.32, 0.45, 0.24, 1.1, 0.02, 1.7)
  shape.bezierCurveTo(-0.1, 1.05, -0.32, 0.45, 0, 0)
  const geo = new THREE.ShapeGeometry(shape, 5)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    pos.setZ(i, y * y * 0.16)
  }
  geo.computeVertexNormals()
  return geo
}

function Palm({
  position,
  scale,
  lean,
  bark,
}: {
  position: [number, number, number]
  scale: number
  lean: number
  bark: THREE.Texture
}) {
  const trunk = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(lean * 0.3, 1.15, 0.05),
      new THREE.Vector3(lean * 0.75, 2.35, lean * 0.08),
      new THREE.Vector3(lean, 3.45, 0),
    ])
    const geo = new THREE.TubeGeometry(curve, 7, 0.17, 6, false)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const k = 1.25 - (y / 3.6) * 0.62
      pos.setX(i, pos.getX(i) * k)
      pos.setZ(i, pos.getZ(i) * k)
    }
    geo.computeVertexNormals()
    return geo
  }, [lean])
  const frond = useMemo(() => frondGeometry(), [])

  return (
    <group position={position} scale={scale}>
      <mesh geometry={trunk} castShadow>
        <meshStandardMaterial map={bark} color={palette.trunk} roughness={0.86} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2
        const lite = i % 2 === 0
        return (
          <mesh
            key={i}
            geometry={frond}
            position={[Math.sin(a) * 0.08, 3.35, Math.cos(a) * 0.08]}
            rotation={[0.85, a, 0.15]}
            castShadow
          >
            <meshStandardMaterial
              color={lite ? palette.frondLite : palette.frond}
              side={THREE.DoubleSide}
              roughness={0.7}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function Grass({ map }: { map: THREE.Texture }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(210, 210, 72, 72)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const near = new THREE.Color(palette.grassNear)
    const mid = new THREE.Color(palette.grassMid)
    const far = new THREE.Color(palette.grassFar)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const ahead = THREE.MathUtils.clamp((12 - z) / 40, 0, 1)
      const side = THREE.MathUtils.clamp((Math.abs(x + 10) - 8) / 55, 0, 1)
      const t = Math.max(ahead, side)
      c.copy(near).lerp(mid, Math.min(1, t * 1.35))
      if (t > 0.4) c.lerp(far, (t - 0.4) / 0.6)
      const n = Math.sin(x * 0.33) * Math.cos(z * 0.29) * 0.06
      c.offsetHSL(0, 0, n)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const uv = g.attributes.uv
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 9, pos.getZ(i) / 9)
    return g
  }, [])

  return (
    <mesh geometry={geo} position={[-16, -0.05, 2]} receiveShadow>
      <meshStandardMaterial map={map} vertexColors roughness={1} />
    </mesh>
  )
}

function Lagoon({ sand }: { sand: THREE.Texture }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(palette.waterDeep) },
          uShallow: { value: new THREE.Color(palette.waterShallow) },
          uFoam: { value: new THREE.Color(palette.foam) },
        },
        vertexShader: `
          varying vec2 vUv;
          uniform float uTime;
          void main() {
            vUv = uv;
            vec3 p = position;
            float w = sin(position.x * 6.0 + uTime * 1.4) * cos(position.y * 5.0 - uTime) * 0.012;
            p.z += w;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform vec3 uFoam;
          uniform float uTime;
          void main() {
            float r = length(vUv - 0.5) * 2.0;
            float caustic = pow(max(0.0, sin(vUv.x * 40.0 + uTime * 1.6) * sin(vUv.y * 36.0 - uTime * 1.3)), 4.0);
            vec3 col = mix(uDeep, uShallow, smoothstep(0.08, 0.95, r));
            col += vec3(0.65, 0.9, 1.0) * caustic * (1.0 - r) * 0.45;
            float foam = smoothstep(0.7, 0.98, r);
            col = mix(col, uFoam, foam * 0.9);
            gl_FragColor = vec4(col, mix(0.95, 0.38, foam));
          }
        `,
      }),
    [],
  )
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt
  })

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[LAGOON.x, 0.02, LAGOON.z]}
        scale={[LAGOON.rx * 1.38, LAGOON.rz * 1.42, 1]}
        receiveShadow
      >
        <circleGeometry args={[1, 40]} />
        <meshStandardMaterial map={sand} color={palette.sand} roughness={0.96} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[LAGOON.x, 0.045, LAGOON.z]}
        scale={[LAGOON.rx, LAGOON.rz, 1]}
        material={mat}
      >
        <circleGeometry args={[1, 56]} />
      </mesh>
    </group>
  )
}

function ItemCrate({
  position,
  phase,
  question,
}: {
  position: [number, number, number]
  phase: number
  question: THREE.Texture
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    g.position.y = position[1] + Math.sin(clock.elapsedTime * 1.5 + phase) * 0.14
  })
  return (
    <group ref={ref} position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.35, 1.15, 1.35]} />
        <meshStandardMaterial color={palette.crate} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0, 0.69]}>
        <planeGeometry args={[1.15, 0.95]} />
        <meshStandardMaterial color={palette.crateTrim} />
      </mesh>
      <sprite position={[0, 1.55, 0]} scale={[1.9, 1.9, 1]}>
        <spriteMaterial map={question} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

function Crowd() {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const body = bodies.current
    const head = heads.current
    if (!body || !head) return
    const dummy = new THREE.Object3D()
    const shirt = new THREE.Color()
    const skin = new THREE.Color()
    const shirts = ['#ff5d73', '#ffd166', '#2ec4b6', '#ffffff', '#7cc6ff', '#c77dff', '#80ed99']
    const skins = ['#ffd8be', '#e8b892', '#c68642', '#8d5524', '#ffcc99']
    let i = 0
    for (let row = 0; row < 3; row++) {
      for (let seat = 0; seat < 14; seat++) {
        const x = 0.4 + row * 1.15
        const y = 0.78 + row * 0.55
        const z = -6.4 + seat * 0.98
        dummy.position.set(x, y, z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        body.setMatrixAt(i, dummy.matrix)
        dummy.position.set(x, y + 0.38, z)
        dummy.updateMatrix()
        head.setMatrixAt(i, dummy.matrix)
        shirt.set(shirts[(seat + row * 2) % shirts.length])
        skin.set(skins[(seat + row) % skins.length])
        body.setColorAt(i, shirt)
        head.setColorAt(i, skin)
        i++
      }
    }
    body.instanceMatrix.needsUpdate = true
    head.instanceMatrix.needsUpdate = true
    if (body.instanceColor) body.instanceColor.needsUpdate = true
    if (head.instanceColor) head.instanceColor.needsUpdate = true
  }, [])

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, 42]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.16, 0.26, 2, 6]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, 42]} castShadow frustumCulled={false}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
    </group>
  )
}

function CoralBank({ sign }: { sign: THREE.Texture }) {
  return (
    <group position={[10.4, 0, -9.5]}>
      {[
        { x: 0.7, y: 0.28, w: 1.7, h: 0.56, color: palette.cream },
        { x: 1.85, y: 0.82, w: 1.55, h: 0.5, color: '#ff8aa0' },
        { x: 2.95, y: 1.32, w: 1.4, h: 0.48, color: palette.seat },
        { x: 3.95, y: 1.78, w: 1.25, h: 0.42, color: palette.gold },
      ].map((tier) => (
        <mesh key={tier.y} position={[tier.x, tier.y, 0]} castShadow receiveShadow>
          <boxGeometry args={[tier.w, tier.h, 14.2]} />
          <meshStandardMaterial color={tier.color} roughness={0.62} />
        </mesh>
      ))}
      <mesh position={[2.3, 2.85, 0]} castShadow>
        <boxGeometry args={[5.4, 0.16, 14.6]} />
        <meshStandardMaterial color={palette.roof} roughness={0.45} />
      </mesh>
      <mesh position={[2.3, 2.7, 0]}>
        <boxGeometry args={[5.5, 0.08, 14.7]} />
        <meshStandardMaterial color={palette.gold} roughness={0.4} />
      </mesh>
      {[-6.6, -2.2, 2.2, 6.6].map((z) => (
        <mesh key={z} position={[4.3, 1.4, z]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 2.8, 8]} />
          <meshStandardMaterial color={palette.archDeep} />
        </mesh>
      ))}
      <mesh position={[1.2, 2.15, 7.15]} castShadow>
        <planeGeometry args={[3.6, 1.1]} />
        <meshStandardMaterial map={sign} roughness={0.5} />
      </mesh>
      <Crowd />
    </group>
  )
}

function TideCrown({ sign }: { sign: THREE.Texture }) {
  return (
    <group position={[-16, 0, -30]}>
      <mesh receiveShadow position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[2.1, 2.4, 0.5, 16]} />
        <meshStandardMaterial color={palette.stone} roughness={0.75} />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.7, 1.05, 4.2, 12]} />
        <meshStandardMaterial color={palette.arch} roughness={0.42} />
      </mesh>
      <mesh position={[0, 4.9, 0]} castShadow>
        <torusGeometry args={[1.35, 0.22, 10, 24]} />
        <meshStandardMaterial color={palette.gold} metalness={0.2} roughness={0.32} emissive={palette.gold} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, 5.7, 0]} castShadow>
        <coneGeometry args={[0.45, 1.1, 8]} />
        <meshStandardMaterial color={palette.coral} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.15, 1.55]}>
        <planeGeometry args={[3.2, 0.95]} />
        <meshStandardMaterial map={sign} />
      </mesh>
    </group>
  )
}

function ShellBeach({
  textures,
}: {
  textures: TrackTextures
}) {
  return (
    <group>
      <Lagoon sand={textures.sand} />
      {palms.map(([x, y, z, s, lean]) => (
        <Palm key={`${x}-${z}`} position={[x, y, z]} scale={s} lean={lean} bark={textures.bark} />
      ))}
      {[-13.2, -14.4, -15.6].map((x) => (
        <mesh key={x} position={[x, 0.22, 6.5]} receiveShadow castShadow>
          <boxGeometry args={[1.15, 0.12, 1.35]} />
          <meshStandardMaterial map={textures.wood} roughness={0.8} />
        </mesh>
      ))}
      {[-12.6, -16.2].map((x) => (
        <mesh key={x} position={[x, 0.15, 6.5]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 0.5, 6]} />
          <meshStandardMaterial color={palette.woodDark} />
        </mesh>
      ))}
      <mesh position={[-12.2, 1.15, 8.4]}>
        <planeGeometry args={[2.8, 0.85]} />
        <meshStandardMaterial map={textures.signBeach} />
      </mesh>
      <group position={[-20.2, 0.18, 8.4]} rotation={[0, 0.6, 0]}>
        <mesh castShadow scale={[1.55, 0.36, 0.62]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={palette.cream} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.28, 0]} castShadow>
          <boxGeometry args={[0.85, 0.08, 0.55]} />
          <meshStandardMaterial color={palette.coral} />
        </mesh>
      </group>
      {[
        [-14.5, 0.2, 3.2, 0.7],
        [-23.5, 0.15, 3.4, 0.55],
        [-21.2, 0.18, 12.2, 0.8],
      ].map(([x, y, z, s]) => (
        <mesh key={`${x}-${z}`} position={[x, y, z]} scale={[s, s * 0.6, s]} castShadow receiveShadow>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={palette.stone} roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

export function World({ textures }: { textures: TrackTextures }) {
  return (
    <group>
      <Grass map={textures.grass} />
      <ShellBeach textures={textures} />
      <CoralBank sign={textures.signBank} />
      <TideCrown sign={textures.signCrown} />
      <ItemCrate position={[6.5, 0.7, 1.6]} phase={0.2} question={textures.question} />
      <ItemCrate position={[7.4, 0.7, -4.5]} phase={1.3} question={textures.question} />
      <ItemCrate position={[-22, 0.7, 22]} phase={2.1} question={textures.question} />
      <mesh position={[-16, -1.5, -52]} scale={[20, 4.2, 12]} receiveShadow>
        <sphereGeometry args={[1, 18, 12]} />
        <meshStandardMaterial color={palette.grassFar} roughness={1} />
      </mesh>
      <mesh position={[28, -1.2, 24]} scale={[14, 3.4, 11]} receiveShadow>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color={palette.grassMid} roughness={1} />
      </mesh>
    </group>
  )
}
