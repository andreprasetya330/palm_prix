import {useEffect,useMemo,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import {HalfFloatType,Vector2,WebGLRenderTarget} from 'three'
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js'
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js'
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js'
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js'
import {RenderBudget} from '../game/renderBudget'

/** Restrained HDR light spill; opaque silhouettes and road markings stay sharp. */
export function NeonPostFX(){
  const {gl,scene,camera,size}=useThree()
  const budget=useRef(new RenderBudget())
  const pipeline=useMemo(()=>{
    const target=new WebGLRenderTarget(1,1,{type:HalfFloatType});target.samples=2
    const composer=new EffectComposer(gl,target)
    const render=new RenderPass(scene,camera),bloom=new UnrealBloomPass(new Vector2(512,512),.45,.42,1.05),output=new OutputPass()
    composer.addPass(render);composer.addPass(bloom);composer.addPass(output)
    return {composer,bloom,render,output}
  },[gl,scene,camera])
  useEffect(()=>{pipeline.composer.setPixelRatio(Math.min(1,gl.getPixelRatio())*budget.current.scale);pipeline.composer.setSize(size.width,size.height)},[pipeline,gl,size.width,size.height])
  useEffect(()=>{
    const previous=gl.info.autoReset;gl.info.autoReset=false
    document.documentElement.dataset.raceRenderScale=budget.current.scale.toFixed(2)
    return()=>{gl.info.autoReset=previous;delete document.documentElement.dataset.raceRenderScale;pipeline.composer.dispose();pipeline.bloom.dispose();pipeline.output.dispose();pipeline.render.dispose()}
  },[gl,pipeline])
  useFrame((_,dt)=>{
    // Keep UI at native resolution; lower only the world rendering budget.
    const next=budget.current.sample(dt,document.hidden)
    if(next!==null){pipeline.composer.setPixelRatio(Math.min(1,gl.getPixelRatio())*next);pipeline.composer.setSize(size.width,size.height);document.documentElement.dataset.raceRenderScale=next.toFixed(2)}
    gl.info.reset();pipeline.composer.render(Math.min(dt,.05))
  },1)
  return null
}
