import {useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'

/** The sunset is geometry against a procedural sky, not a surrounding photograph. */
export function NeonHorizon(){
  const skyRef=useRef<THREE.Mesh>(null)
  const sky=useMemo(()=>new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false,
    vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;
      void main(){vec3 d=normalize(direction);float h=d.y;
      vec3 color=mix(vec3(.64,.10,.38),vec3(.09,.025,.20),smoothstep(-.03,.46,h));
      color=mix(vec3(1.,.36,.17),color,smoothstep(-.13,.11,h));
      float glow=pow(max(0.,dot(d,normalize(vec3(.83,.03,-.56)))),16.);
      color+=vec3(.29,.09,.015)*glow;
      gl_FragColor=vec4(color,1.);
      #include <colorspace_fragment>
      }`}),[])
  const sun=useMemo(()=>{
    const positions:number[]=[],colors:number[]=[],radius=31,color=new THREE.Color()
    const strip=(lo:number,hi:number)=>{
      const steps=Math.max(4,Math.ceil((hi-lo)*2)),points:THREE.Vector2[]=[]
      for(let i=0;i<=steps;i++){const y=lo+(hi-lo)*i/steps;points.push(new THREE.Vector2(Math.sqrt(Math.max(0,radius*radius-y*y)),y))}
      for(let i=steps;i>=0;i--){const y=lo+(hi-lo)*i/steps;points.push(new THREE.Vector2(-Math.sqrt(Math.max(0,radius*radius-y*y)),y))}
      const shape=new THREE.Shape(points),geometry=new THREE.ShapeGeometry(shape).toNonIndexed()
      for(let i=0;i<geometry.attributes.position.count;i++){
        const x=geometry.attributes.position.getX(i),y=geometry.attributes.position.getY(i)
        positions.push(x,y,0)
        color.set('#ff4d9e').lerp(new THREE.Color('#fff29a'),(y+radius)/(radius*2)).toArray(colors,colors.length)
      }
      geometry.dispose()
    }
    strip(1,radius)
    for(const [lo,hi] of [[-5,-.2],[-11,-7],[-17,-13],[-23,-20],[-28,-26],[-31,-30]])strip(lo,hi)
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geometry
  },[])
  const sunQuaternion=useMemo(()=>new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(-210,0,150).normalize()),[])
  const water=useMemo(()=>new THREE.ShaderMaterial({uniforms:{time:{value:0}},side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float time;varying vec2 vUv;
      void main(){float wave=sin(vUv.y*630.+time*.8+sin(vUv.x*50.)*.6);
      float reflection=pow(max(0.,1.-abs(vUv.x-.55)*2.),5.)*(.3+.7*step(.6,wave));
      vec3 c=mix(vec3(.018,.035,.11),vec3(.14,.08,.25),vUv.y);
      c+=vec3(.6,.09,.25)*reflection*.65;
      c+=vec3(.02,.15,.2)*step(.96,wave);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`}),[])
  useFrame(({camera,clock})=>{skyRef.current?.position.copy(camera.position);water.uniforms.time.value=clock.elapsedTime},-80)
  useEffect(()=>()=>{sky.dispose();sun.dispose();water.dispose()},[sky,sun,water])
  return <group>
    <mesh ref={skyRef} material={sky} renderOrder={-100}><sphereGeometry args={[420,32,20]}/></mesh>
    <mesh geometry={sun} position={[210,59,-150]} quaternion={sunQuaternion} renderOrder={-90}><meshBasicMaterial vertexColors color={[1.5,1.5,1.5]} toneMapped={false} fog={false}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.32,0]} receiveShadow><planeGeometry args={[600,600]}/><meshStandardMaterial color="#211c35" roughness={.9}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[105,-.11,-5]} material={water}><planeGeometry args={[42,270]}/></mesh>
  </group>
}
