import {Component,Suspense,useMemo,type ReactNode} from 'react'
import {useGLTF} from '@react-three/drei'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {RacerModel} from './RacerModel'

type Props={url:string;motion:{speed:number;steering?:number}}
function ImportedKart({url,motion}:Props){
  const asset=useGLTF(url)
  const {scene,wheels}=useMemo(()=>{
    const scene=asset.scene.clone(true),wheels:THREE.Object3D[]=[]
    scene.traverse(object=>{
      if(object.name.startsWith('wheel-'))wheels.push(object)
      if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true}
    })
    return {scene,wheels}
  },[asset.scene])
  useFrame((_,delta)=>{
    for(const wheel of wheels){
      wheel.rotation.x+=motion.speed/.33*Math.min(delta,.05)
      if(wheel.name.includes('front'))wheel.rotation.y=THREE.MathUtils.damp(wheel.rotation.y,-(motion.steering??0)*.38,16,Math.min(delta,.05))
    }
  })
  return <primitive object={scene}/>
}
class KartBoundary extends Component<{children:ReactNode;motion:Props['motion']},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<RacerModel player motion={this.props.motion}/>:this.props.children}
}
export function PersonalPlayerKart(props:Props){return <KartBoundary motion={props.motion}><Suspense fallback={<RacerModel player motion={props.motion}/>}><ImportedKart {...props}/></Suspense></KartBoundary>}
