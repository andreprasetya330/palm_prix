import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
/** Original animated tropical water; no remote texture or model dependency. */
export function Ocean() {
  const material = useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{time:{value:0}},
    vertexShader:`varying vec3 world; uniform float time;
    void main(){vec3 p=position; p.z+=sin(p.x*.18+time*.7)*.07+cos(p.y*.23-time*.5)*.05;
    world=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec3 world;uniform float time;
    void main(){float waves=sin(world.x*.65+sin(world.z*.4+time)*1.7+time)*sin(world.z*.8-time*.6);
    float glint=pow(max(0.,waves),14.);float distanceToIsland=length(world.xz);
    vec3 water=mix(vec3(.045,.64,.64),vec3(.025,.29,.48),smoothstep(48.,160.,distanceToIsland));
    water+=vec3(.24,.34,.28)*glint*.55;
    gl_FragColor=vec4(water,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,side:THREE.DoubleSide,
  }),[])
  useFrame((_,dt)=>{material.uniforms.time.value+=dt})
  return <mesh position={[0,-.55,0]} rotation={[-Math.PI/2,0,0]} material={material}><planeGeometry args={[800,800,128,128]}/></mesh>
}
