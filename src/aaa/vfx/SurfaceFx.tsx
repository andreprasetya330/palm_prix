import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { ControlState } from '../../game/controlState'
import type { KartState } from '../../game/kartPhysics'
import {
  kartAxes,
  kartToWorld,
  makePaintedGeometry,
  paint,
  writeQuad,
} from './quads'
import { ITEM_BOXES, inPond, onAsphalt, onSand } from './world'

const DUST = 90
const SPLASH = 36
const SHARDS = 22
const SKID = 70

type DustP = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  cr: number
  cg: number
  cb: number
}

type Ring = { x: number; z: number; age: number; active: boolean }
type SkidPt = { x: number; z: number; nx: number; nz: number; life: number; strip: number }

const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _p = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

/**
 * Off-road dust, pond wake, and item-box burst.
 * These read from kart position only — physics is not modified.
 */
export function SurfaceFx({
  kart,
  control,
}: {
  kart: KartState
  control: ControlState
}) {
  const camera = useThree((s) => s.camera)
  const kartRef = useRef(kart)
  const controlRef = useRef(control)
  kartRef.current = kart
  controlRef.current = control

  const dust = useRef<DustP[]>(
    Array.from({ length: DUST }, () => deadDust()),
  )
  const splash = useRef<DustP[]>(
    Array.from({ length: SPLASH }, () => deadDust()),
  )
  const dustGeom = useMemo(() => makePointGeom(DUST), [])
  const splashGeom = useMemo(() => makePointGeom(SPLASH), [])
  const dustMat = useMemo(() => pointMat(false), [])
  const splashMat = useMemo(() => pointMat(true), [])

  const rings = useRef<Ring[]>(
    Array.from({ length: 7 }, () => ({ x: 0, z: 0, age: 0, active: false })),
  )
  const ringRefs = useRef<(THREE.Mesh | null)[]>([])
  const wakeClock = useRef(0)

  const burstAge = useRef(-1)
  const burstAt = useRef(new THREE.Vector3())
  const boxReady = useRef(ITEM_BOXES.map(() => 0))
  const shardGeom = useMemo(() => makePaintedGeometry((SHARDS + 2) * 6), [])
  const shards = useRef(
    Array.from({ length: SHARDS }, () => ({
      ang: 0,
      spd: 1,
      lift: 1,
      spin: 0,
    })),
  )

  const skidL = useRef<SkidPt[]>([])
  const skidR = useRef<SkidPt[]>([])
  const skidGeom = useMemo(() => makePaintedGeometry(SKID * 2 * 6), [])
  const strip = useRef(1)
  const prev = useRef({ yaw: kart.yaw, speed: kart.speed })

  useFrame((_, dt) => {
    const k = kartRef.current
    const c = controlRef.current
    const asphalt = onAsphalt(k.x, k.z)
    const sand = onSand(k.x, k.z)
    const pond = inPond(k.x, k.z)
    const speed = Math.abs(k.speed)
    kartAxes(k.yaw, _fwd, _right)

    stepDust(dust.current, dustGeom, k, dt, !asphalt && speed > 2.2, sand, _fwd)
    stepPond(splash.current, splashGeom, rings.current, ringRefs.current, wakeClock, k, dt, pond && speed > 1.5, _fwd)
    stepSkid(skidGeom, skidL.current, skidR.current, strip, prev.current, k, c, dt, asphalt, speed, _right)
    stepBurst(shardGeom, shards.current, burstAge, burstAt.current, boxReady.current, k, dt, speed, camera)
    prev.current.yaw = k.yaw
    prev.current.speed = k.speed
  })

  return (
    <>
      <points geometry={dustGeom} material={dustMat} frustumCulled={false} renderOrder={3} />
      <points geometry={splashGeom} material={splashMat} frustumCulled={false} renderOrder={4} />
      {Array.from({ length: 7 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            ringRefs.current[i] = el
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
          renderOrder={3}
        >
          <ringGeometry args={[0.72, 1.05, 32]} />
          <meshBasicMaterial
            color="#f7fdff"
            transparent
            opacity={0.9}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh geometry={shardGeom} frustumCulled={false} renderOrder={7}>
        <meshBasicMaterial
          vertexColors
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={skidGeom} frustumCulled={false} renderOrder={2}>
        <meshBasicMaterial
          vertexColors
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}

function deadDust(): DustP {
  return {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1,
    cr: 1, cg: 1, cb: 1,
  }
}

function makePointGeom(n: number) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  g.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(n), 1))
  g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 80)
  return g
}

function pointMat(splash: boolean) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { uScale: { value: splash ? 36 : 52 } },
    vertexShader: /* glsl */ `
      attribute float aLife;
      attribute vec3 aColor;
      varying float vLife;
      varying vec3 vColor;
      uniform float uScale;
      void main() {
        vLife = aLife;
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uScale * aLife * (9.0 / max(1.2, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vLife;
      varying vec3 vColor;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d = dot(p, p);
        if (d > 1.0) discard;
        float a = smoothstep(1.0, 0.15, d) * vLife;
        gl_FragColor = vec4(vColor, a);
      }
    `,
  })
}

function writePoints(geom: THREE.BufferGeometry, pool: DustP[]) {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute
  const life = geom.getAttribute('aLife') as THREE.BufferAttribute
  const col = geom.getAttribute('aColor') as THREE.BufferAttribute
  const pa = pos.array as Float32Array
  const la = life.array as Float32Array
  const ca = col.array as Float32Array
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i]
    if (p.life <= 0 || p.max <= 0) {
      pa[i * 3] = 0
      pa[i * 3 + 1] = -40
      pa[i * 3 + 2] = 0
      la[i] = 0
      continue
    }
    pa[i * 3] = p.x
    pa[i * 3 + 1] = p.y
    pa[i * 3 + 2] = p.z
    la[i] = Math.max(0, p.life / p.max)
    ca[i * 3] = p.cr
    ca[i * 3 + 1] = p.cg
    ca[i * 3 + 2] = p.cb
  }
  pos.needsUpdate = true
  life.needsUpdate = true
  col.needsUpdate = true
}

function spawnDust(p: DustP, k: KartState, sand: boolean, forward: THREE.Vector3) {
  const side = Math.random() < 0.5 ? -0.55 : 0.55
  kartToWorld(k.x, k.z, k.yaw, side, 0.12, -0.85, _p)
  p.x = _p.x + (Math.random() - 0.5) * 0.3
  p.y = 0.1 + Math.random() * 0.15
  p.z = _p.z + (Math.random() - 0.5) * 0.3
  const back = 1.5 + Math.random() * 2.2
  p.vx = -forward.x * back + (Math.random() - 0.5) * 1.4
  p.vy = 1.4 + Math.random() * 2.2
  p.vz = -forward.z * back + (Math.random() - 0.5) * 1.4
  p.life = 0.55 + Math.random() * 0.35
  p.max = p.life
  if (sand) {
    p.cr = 1.15
    p.cg = 0.82
    p.cb = 0.32
  } else {
    p.cr = 0.72 + Math.random() * 0.2
    p.cg = 0.78 + Math.random() * 0.25
    p.cb = 0.28
  }
}

function stepDust(
  pool: DustP[],
  geom: THREE.BufferGeometry,
  k: KartState,
  dt: number,
  emit: boolean,
  sand: boolean,
  forward: THREE.Vector3,
) {
  if (emit) {
    let spawned = 0
    for (const p of pool) {
      if (spawned >= 4) break
      if (p.life > 0) continue
      spawnDust(p, k, sand, forward)
      spawned += 1
    }
  }
  for (const p of pool) {
    if (p.life <= 0) continue
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.z += p.vz * dt
    p.vy -= 2.4 * dt
    p.vx *= 0.98
    p.vz *= 0.98
  }
  writePoints(geom, pool)
}

function stepPond(
  splash: DustP[],
  geom: THREE.BufferGeometry,
  rings: Ring[],
  ringMeshes: (THREE.Mesh | null)[],
  clock: MutableRefObject<number>,
  k: KartState,
  dt: number,
  emit: boolean,
  forward: THREE.Vector3,
) {
  clock.current -= dt
  if (emit && clock.current <= 0) {
    clock.current = 0.11
    const slot = rings.find((r) => !r.active)
    if (slot) {
      slot.active = true
      slot.age = 0
      slot.x = k.x
      slot.z = k.z
    }
    let n = 0
    for (const p of splash) {
      if (n >= 3) break
      if (p.life > 0) continue
      p.x = k.x + (Math.random() - 0.5) * 0.8
      p.y = 0.15
      p.z = k.z + (Math.random() - 0.5) * 0.8
      p.vx = -forward.x * 0.4 + (Math.random() - 0.5) * 2.4
      p.vy = 2.2 + Math.random() * 2.4
      p.vz = -forward.z * 0.4 + (Math.random() - 0.5) * 2.4
      p.life = 0.45 + Math.random() * 0.25
      p.max = p.life
      p.cr = 0.85
      p.cg = 0.96
      p.cb = 1.15
      n += 1
    }
  }
  for (const p of splash) {
    if (p.life <= 0) continue
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.z += p.vz * dt
    p.vy -= 6 * dt
  }
  writePoints(geom, splash)

  rings.forEach((r, i) => {
    const mesh = ringMeshes[i]
    if (!mesh) return
    if (!r.active) {
      mesh.visible = false
      return
    }
    r.age += dt
    const u = r.age / 0.9
    if (u >= 1) {
      r.active = false
      mesh.visible = false
      return
    }
    mesh.visible = true
    mesh.position.set(r.x, 0.08, r.z)
    const s = 0.4 + u * 3.4
    mesh.scale.setScalar(s)
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.opacity = (1 - u) * 0.85
  })
}

function stepBurst(
  geom: THREE.BufferGeometry,
  shards: { ang: number; spd: number; lift: number; spin: number }[],
  ageRef: MutableRefObject<number>,
  at: THREE.Vector3,
  ready: number[],
  k: KartState,
  dt: number,
  speed: number,
  camera: THREE.Camera,
) {
  ITEM_BOXES.forEach((box, i) => {
    ready[i] -= dt
    const dx = k.x - box.x
    const dz = k.z - box.z
    if (ready[i] > 0 || speed < 4) return
    if (dx * dx + dz * dz > 3.1 * 3.1) return
    ready[i] = 2.4
    ageRef.current = 0
    at.set(box.x, box.y, box.z)
    shards.forEach((s) => {
      s.ang = Math.random() * Math.PI * 2
      s.spd = 2.4 + Math.random() * 4.5
      s.lift = 1.5 + Math.random() * 4
      s.spin = Math.random() * Math.PI
    })
  })

  const pos = geom.getAttribute('position').array as Float32Array
  const col = geom.getAttribute('color').array as Float32Array
  let v = 0
  if (ageRef.current >= 0) {
    ageRef.current += dt
    const u = ageRef.current / 0.85
    if (u < 1) {
      const e = camera.matrixWorld.elements
      _right.set(e[0], e[1], e[2])
      _fwd.set(e[4], e[5], e[6])
      const flash = (1 - u) * (1 - u)
      _p.copy(at)
      _a.copy(_right).multiplyScalar(2.2 * (0.45 + u))
      _b.copy(_fwd).multiplyScalar(2.2 * (0.45 + u))
      v = writeQuad(pos, col, v, _p, _a, _b, {
        r: 2.4,
        g: 1.7,
        b: 0.45,
        a: flash,
      })
      shards.forEach((s, i) => {
        const dist = s.spd * ageRef.current
        _p.set(
          at.x + Math.cos(s.ang) * dist,
          at.y + s.lift * ageRef.current - 3.2 * ageRef.current * ageRef.current,
          at.z + Math.sin(s.ang) * dist,
        )
        const w = 0.22 * (1 - u)
        _a.set(Math.cos(s.spin), 0.2, Math.sin(s.spin)).multiplyScalar(w)
        _b.set(-Math.sin(s.spin), 0.35, Math.cos(s.spin)).multiplyScalar(w)
        const gold = i % 2 === 0
        v = writeQuad(pos, col, v, _p, _a, _b, {
          r: gold ? 2.2 : 1.4,
          g: gold ? 1.35 : 0.35,
          b: gold ? 0.3 : 1.3,
          a: 1 - u,
        })
      })
    } else {
      ageRef.current = -1
    }
  }
  paint(geom, v)
}

function stepSkid(
  geom: THREE.BufferGeometry,
  left: SkidPt[],
  right: SkidPt[],
  strip: MutableRefObject<number>,
  prev: { yaw: number; speed: number },
  k: KartState,
  control: ControlState,
  dt: number,
  asphalt: boolean,
  speed: number,
  sideAxis: THREE.Vector3,
) {
  let dy = k.yaw - prev.yaw
  while (dy > Math.PI) dy -= Math.PI * 2
  while (dy < -Math.PI) dy += Math.PI * 2
  const yawRate = dy / Math.max(dt, 1e-3)
  const dropping = (prev.speed - k.speed) / Math.max(dt, 1e-3)
  const slip =
    asphalt &&
    speed > 7 &&
    (Math.abs(control.steer) > 0.55 ||
      control.brake > 0.35 ||
      Math.abs(yawRate) * speed > 2.2 ||
      dropping > 16)

  if (slip) {
    const last = left[left.length - 1]
    kartToWorld(k.x, k.z, k.yaw, -0.58, 0.05, -0.62, _p)
    if (!last || (last.x - _p.x) ** 2 + (last.z - _p.z) ** 2 > 0.12) {
      pushSkid(left, _p.x, _p.z, sideAxis, strip.current)
      kartToWorld(k.x, k.z, k.yaw, 0.58, 0.05, -0.62, _p)
      pushSkid(right, _p.x, _p.z, sideAxis, strip.current)
    }
  } else if (left.length && left[left.length - 1].strip === strip.current) {
    strip.current += 1
  }

  fadeSkid(left, dt)
  fadeSkid(right, dt)

  const pos = geom.getAttribute('position').array as Float32Array
  const col = geom.getAttribute('color').array as Float32Array
  let v = 0
  v = skidStrip(pos, col, v, left)
  v = skidStrip(pos, col, v, right)
  paint(geom, v)
}

function pushSkid(list: SkidPt[], x: number, z: number, right: THREE.Vector3, strip: number) {
  list.push({ x, z, nx: right.x, nz: right.z, life: 1, strip })
  if (list.length > SKID) list.shift()
}

function fadeSkid(list: SkidPt[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    list[i].life -= dt * 0.16
    if (list[i].life <= 0) list.splice(i, 1)
  }
}

function skidStrip(
  positions: Float32Array,
  colors: Float32Array,
  vertex: number,
  pts: SkidPt[],
): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (a.strip !== b.strip) continue
    const dx = b.x - a.x
    const dz = b.z - a.z
    if (dx * dx + dz * dz > 4) continue
    const w = 0.16
    _p.set((a.x + b.x) * 0.5, 0.045, (a.z + b.z) * 0.5)
    _a.set(dx * 0.5, 0, dz * 0.5)
    _b.set(a.nx * w, 0, a.nz * w)
    const alpha = Math.min(a.life, b.life) * 0.72
    vertex = writeQuad(positions, colors, vertex, _p, _a, _b, {
      r: 0.08,
      g: 0.07,
      b: 0.06,
      a: alpha,
    })
  }
  return vertex
}
