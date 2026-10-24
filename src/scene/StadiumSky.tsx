import { useMemo } from 'react'
import * as THREE from 'three'
/** Original dusk backdrop: horizon haze, a warm low sun and a clear blue upper sky. */
export function StadiumSky(){
  const material=useMemo(()=>new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;
      void main(){vec3 d=normalize(direction);float h=max(0.,d.y);
      vec3 color=mix(vec3(.31,.36,.46),vec3(.055,.11,.21),smoothstep(0.,.65,h));
      float glow=pow(max(0.,dot(d,normalize(vec3(-.8,.09,-.4)))),18.);
      color+=vec3(.45,.19,.06)*glow;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  }),[])
  return <mesh material={material} renderOrder={-10}><sphereGeometry args={[230,24,16]}/></mesh>
}
