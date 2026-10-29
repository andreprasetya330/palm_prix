import { Component, Suspense, useMemo, useRef, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const MODELS=['kart-oopi','kart-ooli','kart-oodi','kart-oobi','kart-oozi'].map(name=>`/assets/racers/${name}.glb`)
const MODEL_SCALE=1.75
export type RacerModelProps={player?:boolean;color?:string;variant?:number;motion?:{speed:number;steering?:number}}
type Prepared={body:THREE.BufferGeometry;material:THREE.MeshStandardMaterial;groundY:number;wheels:{geometry:THREE.BufferGeometry;center:THREE.Vector3;front:boolean}[]}
const cache=new WeakMap<THREE.Object3D,Prepared>()
/** Preserve authored atlas, seated character and wheel pivots; bake static geometry once per asset. */
function prepare(scene:THREE.Object3D):Prepared {
  const existing=cache.get(scene);if(existing)return existing
  scene.updateMatrixWorld(true)
  const pieces:THREE.BufferGeometry[]=[],wheels:Prepared['wheels']=[]
  let material:THREE.MeshStandardMaterial|undefined
  scene.traverse(object=>{
    const mesh=object as THREE.Mesh;if(!mesh.isMesh)return
    const geometry=mesh.geometry.clone()
    const colors=new Float32Array(geometry.attributes.position.count*3)
    const team=new THREE.Color(scene.children[0]?.name.includes('oopi')?'#ed3c52':scene.children[0]?.name.includes('ooli')?'#5ba0ed':scene.children[0]?.name.includes('oodi')?'#44ca98':scene.children[0]?.name.includes('oobi')?'#f4bd45':'#bb7ce0')
    const vertex=new THREE.Color(),white=new THREE.Color('#ffffff')
    for(let i=0;i<geometry.attributes.position.count;i++){
      const x=geometry.attributes.position.getX(i),y=geometry.attributes.position.getY(i)
      vertex.set('#ffffff')
      if(mesh.name==='character'&&y>.5&&Math.abs(x)<.075)vertex.copy(team)
      else if(mesh.name==='character'&&y<.3)vertex.copy(team).lerp(white,.35)
      else if(mesh.name.startsWith('kart-')&&y>.15&&y<.5)vertex.copy(team).lerp(white,.5)
      vertex.toArray(colors,i*3)
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
    // Keep the authored seated character, with proportions suited to a full-width track.
    if(mesh.name==='character')geometry.scale(.68,.68,.68)
    geometry.applyMatrix4(mesh.matrixWorld)
    const source=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as THREE.MeshStandardMaterial
    if(!material){material=source.clone();material.roughness=.43;material.metalness=.16;material.envMapIntensity=.65;material.side=THREE.FrontSide;material.vertexColors=true}
    if(mesh.name.startsWith('wheel-')){
      const center=mesh.getWorldPosition(new THREE.Vector3());geometry.translate(-center.x,-center.y,-center.z)
      wheels.push({geometry,center,front:mesh.name.includes('front')})
    }else pieces.push(geometry)
  })
  const body=mergeGeometries(pieces,false)!
  pieces.forEach(g=>g.dispose());body.computeBoundingSphere()
  const groundY=new THREE.Box3().setFromObject(scene).min.y
  const prepared={body,material:material!,wheels,groundY};cache.set(scene,prepared);return prepared
}
function AuthoredRacer({player=false,variant=0,motion}:RacerModelProps){
  const file=MODELS[player?0:(variant%4)+1]
  const {scene}=useGLTF(file)
  const asset=useMemo(()=>prepare(scene),[scene])
  const pivots=useRef<(THREE.Group|null)[]>([]),spinners=useRef<(THREE.Group|null)[]>([])
  useFrame((_,delta)=>{
    for(let i=0;i<asset.wheels.length;i++){
      const pivot=pivots.current[i],spinner=spinners.current[i]
      if(pivot&&asset.wheels[i].front)pivot.rotation.y=THREE.MathUtils.damp(pivot.rotation.y,-(motion?.steering??0)*.38,16,Math.min(delta,.05))
      if(spinner)spinner.rotation.x+=(motion?.speed??0)/(.155*MODEL_SCALE)*Math.min(delta,.05)
    }
  })
  return <group scale={MODEL_SCALE} position={[0,-asset.groundY*MODEL_SCALE,0]} dispose={null}>
    <mesh geometry={asset.body} material={asset.material} castShadow receiveShadow/>
    {asset.wheels.map((wheel,i)=><group key={i} position={wheel.center} ref={value=>{pivots.current[i]=value}}><group ref={value=>{spinners.current[i]=value}}><mesh geometry={wheel.geometry} material={asset.material} castShadow receiveShadow/></group></group>)}
  </group>
}
class ModelBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?null:this.props.children}
}
export function RacerModel(props:RacerModelProps){
  return <ModelBoundary><Suspense fallback={null}><AuthoredRacer {...props}/></Suspense></ModelBoundary>
}
for(const file of MODELS)useGLTF.preload(file)
