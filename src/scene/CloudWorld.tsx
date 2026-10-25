import {useEffect,useMemo,useRef,Suspense} from 'react'
import {useFrame} from '@react-three/fiber'
import {useGLTF,useTexture} from '@react-three/drei'
import * as THREE from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {getTrackSample,nearestTrack,ROAD_HALF_WIDTH} from '../game/trackLayout'

const ISLANDS=[
  {x:0,z:-9,r:22,h:26,seed:1}, {x:99,z:28,r:19,h:30,seed:3},
  {x:-93,z:48,r:20,h:24,seed:5}, {x:61,z:-99,r:22,h:36,seed:7},
  {x:-70,z:-98,r:19,h:29,seed:9}, {x:8,z:103,r:17,h:22,seed:11},
]
function tint(g:THREE.BufferGeometry,color:string){
  const c=new THREE.Color(color),values=new Float32Array(g.attributes.position.count*3)
  for(let i=0;i<values.length;i+=3)c.toArray(values,i)
  g.setAttribute('color',new THREE.BufferAttribute(values,3));return g
}
function merge(gs:THREE.BufferGeometry[]){const g=mergeGeometries(gs,false)!;gs.forEach(s=>s.dispose());g.computeBoundingSphere();return g}
function cliff(radius:number,height:number,seed:number,cap=false){
  const positions:number[]=[],uv:number[]=[],indices:number[]=[],colors:number[]=[]
  const rings=cap?9:18,segments=80,c=new THREE.Color()
  for(let ring=0;ring<=rings;ring++){
    const v=ring/rings
    for(let j=0;j<=segments;j++){
      const a=j/segments*Math.PI*2
      const outline=1+.065*Math.sin(a*5+seed)+.04*Math.cos(a*9-seed)
      const profile=cap?v:Math.pow(1-v,.48)*(1+.05*Math.sin(v*30+seed))
      const r=radius*outline*profile
      const x=Math.cos(a)*r,z=Math.sin(a)*r*.86
      const y=cap?-.25+Math.sin(v*Math.PI)*.4:-.45-v*height+.5*Math.sin(a*6+seed)*Math.sin(v*Math.PI)
      positions.push(x,y,z);uv.push(j/segments*5,v*(cap?3:2))
      c.set(cap?'#71b3a1':'#c5b9cf')
      if(cap)c.lerp(new THREE.Color('#e1d3a4'),v*.4)
      else c.lerp(new THREE.Color('#716e9f'),v*.75)
      c.toArray(colors,colors.length)
      if(ring<rings&&j<segments){const n=ring*(segments+1)+j;indices.push(n,n+1,n+segments+1,n+1,n+segments+2,n+segments+1)}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g
}
function FloatingGardens(){
  const [sourceDiff,sourceNormal]=useTexture(['/assets/cloud-carnival/cliff-diff.jpg','/assets/cloud-carnival/cliff-normal.jpg'])
  const textures=useMemo(()=>{
    const diff=sourceDiff.clone(),normal=sourceNormal.clone()
    for(const t of [diff,normal]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;t.needsUpdate=true}
    diff.colorSpace=THREE.SRGBColorSpace;return {diff,normal}
  },[sourceDiff,sourceNormal])
  const rocks=useMemo(()=>merge(ISLANDS.map(i=>cliff(i.r,i.h,i.seed).translate(i.x,0,i.z))),[])
  const caps=useMemo(()=>merge(ISLANDS.map(i=>cliff(i.r,i.h,i.seed,true).translate(i.x,0,i.z))),[])
  useEffect(()=>()=>{rocks.dispose();caps.dispose();textures.diff.dispose();textures.normal.dispose()},[rocks,caps,textures])
  return <><mesh geometry={rocks} castShadow receiveShadow><meshStandardMaterial bumpMap={textures.diff} bumpScale={.13} normalMap={textures.normal} normalScale={[.3,.3]} vertexColors roughness={.84} side={THREE.DoubleSide}/></mesh><mesh geometry={caps} receiveShadow><meshStandardMaterial vertexColors roughness={.85} side={THREE.DoubleSide}/></mesh></>
}
const NATURE=['tree_detailed_fall','tree_pineTallA_detailed','mushroom_redTall'].map(n=>`/assets/festival/${n}.glb`)
function IslandGardens(){
  const assets=useGLTF(NATURE)
  const geometry=useMemo(()=>{
    const templates=assets.map(asset=>{
      asset.scene.updateMatrixWorld(true)
      const pieces:THREE.BufferGeometry[]=[]
      asset.scene.traverse(o=>{
        if(!(o instanceof THREE.Mesh))return
        const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()
        const colors=new Float32Array(g.attributes.position.count*3)
        const mats=Array.isArray(o.material)?o.material:[o.material]
        const base=new THREE.Color()
        const palette:Record<string,string>={leafsFall:'#f6aa54',leafsDark:'#329b9c',woodBarkDark:'#75516a',woodBirch:'#f8dec0',colorRed:'#e65e91',_defaultMat:'#fff3d4'}
        for(const group of g.groups.length?g.groups:[{start:0,count:g.attributes.position.count,materialIndex:0}]){
          const m=mats[group.materialIndex??0] as THREE.MeshStandardMaterial
          base.set(palette[m.name]??'#86b6ab')
          for(let i=group.start;i<Math.min(group.start+group.count,g.attributes.position.count);i++)base.toArray(colors,i*3)
        }
        for(const key of Object.keys(g.attributes))if(!['position','normal'].includes(key))g.deleteAttribute(key)
        g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.applyMatrix4(o.matrixWorld);pieces.push(g)
      })
      const g=merge(pieces);g.computeBoundingBox();const b=g.boundingBox!,c=b.getCenter(new THREE.Vector3());g.translate(-c.x,-b.min.y,-c.z);return g
    })
    const pieces:THREE.BufferGeometry[]=[]
    for(const [j,island] of ISLANDS.entries())for(let i=0;i<7;i++){
      const a=i*2.399+j,range=island.r*(.45+(i%3)*.12)
      const x=island.x+Math.cos(a)*range,z=island.z+Math.sin(a)*range*.86
      if(nearestTrack(x,z).distance<ROAD_HALF_WIDTH+4)continue
      const g=templates[(i+j)%3].clone(),s=2.3+(i%3)*.65
      g.scale(s,s,s);g.rotateY(a);g.translate(x,-.15,z);pieces.push(g)
    }
    templates.forEach(g=>g.dispose());return merge(pieces)
  },[assets])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.8}/></mesh>
}
/** One translucent ribbon shader scrolls highlights downward, without water simulation. */
function WaterfallGate(){
  const material=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0}},
    vertexShader:'varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}',
    fragmentShader:`uniform float time;varying vec2 vUv;varying vec3 vWorld;
      void main(){float lines=pow(.5+.5*sin(vUv.x*76.+sin(vUv.y*9.+time)*1.3),9.);
      float flow=pow(.5+.5*sin(vUv.y*65.+time*5.+vUv.x*16.),5.);
      vec3 color=mix(vec3(.12,.62,.75),vec3(.84,1.,1.),lines*.7+flow*.3);
      float edge=smoothstep(0.,.04,vUv.x)*smoothstep(1.,.96,vUv.x);
      gl_FragColor=vec4(color,edge*(.38+lines*.4));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`}),[])
  const sample=useMemo(()=>getTrackSample(.43),[])
  const shell=useMemo(()=>{
    const g=new THREE.CylinderGeometry(10.7,10.7,19,64,1,true,0,Math.PI)
    g.rotateZ(Math.PI/2);g.rotateY(Math.PI/2);g.translate(0,-.2,0)
    return g
  },[])
  const ribs=useMemo(()=>{
    const shapes:THREE.BufferGeometry[]=[]
    for(const z of [-10,0,10]){
      const curve=new THREE.CatmullRomCurve3(Array.from({length:33},(_,i)=>{const a=i/32*Math.PI;return new THREE.Vector3(Math.cos(a)*10.8,Math.sin(a)*10.8-.2,z)}))
      shapes.push(tint(new THREE.TubeGeometry(curve,48,.2,8,false),'#e9c77f'))
    }
    return merge(shapes)
  },[])
  useFrame(({clock})=>{material.uniforms.time.value=clock.elapsedTime})
  useEffect(()=>()=>{material.dispose();shell.dispose();ribs.dispose()},[material,shell,ribs])
  return <group position={[sample.point.x,0,sample.point.z]} rotation={[0,sample.yaw,0]}>
    <mesh geometry={shell} material={material}/>
    <mesh geometry={ribs} castShadow><meshStandardMaterial vertexColors metalness={.35} roughness={.35}/></mesh>
    {[-1,1].map(side=><mesh key={side} position={[side*11.2,-10,0]}><boxGeometry args={[1.6,20,18]}/><primitive object={material} attach="material"/></mesh>)}
  </group>
}
function CloudBanks(){
  const ref=useRef<THREE.InstancedMesh>(null)
  const material=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},
    vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);n=normalize(normalMatrix*mat3(instanceMatrix)*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader:`varying vec3 n;varying vec3 v;void main(){float rim=clamp(dot(normalize(n),normalize(v)),0.,1.);float light=.5+.5*dot(normalize(n),normalize(vec3(-.5,1.,.4)));vec3 c=mix(vec3(.57,.65,.85),vec3(1.,.94,.85),light);gl_FragColor=vec4(c,smoothstep(0.,.42,rim)*.85);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`}),[])
  useEffect(()=>{
    const o=new THREE.Object3D();let index=0
    for(let cluster=0;cluster<18;cluster++){
      const a=cluster/18*Math.PI*2,r=95+(cluster%4)*19
      for(let puff=0;puff<3;puff++){
        o.position.set(Math.cos(a)*r+Math.sin(puff*2.4)*10,-15-(cluster%4)*6+(puff%3)*3,Math.sin(a)*r+Math.cos(puff*2.4)*10)
        o.scale.set(11+puff%3*3,5+puff%3*2,8+puff%2*3);o.updateMatrix();ref.current!.setMatrixAt(index++,o.matrix)
      }
    }
    ref.current!.instanceMatrix.needsUpdate=true;ref.current!.computeBoundingSphere()
    return()=>material.dispose()
  },[material])
  return <instancedMesh ref={ref} args={[undefined,undefined,54]} material={material} renderOrder={2}><sphereGeometry args={[1,14,10]}/></instancedMesh>
}
export function CloudWorld(){return <group><Suspense fallback={null}><FloatingGardens/><IslandGardens/></Suspense><WaterfallGate/><CloudBanks/></group>}
