import {useEffect,useMemo,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import {HalfFloatType,Vector2,WebGLRenderTarget} from 'three'
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js'
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js'
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js'
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js'

/** Restrained HDR light spill; opaque silhouettes and road markings stay sharp. */
export function NeonPostFX(){
  const {gl,scene,camera,size}=useThree()
  const budget=useRef({scale:1,elapsed:0,frames:0,warmup:0})
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
    const b=budget.current
    // Keep UI at native resolution; reduce only 3D render targets under sustained load.
    // Ignore compilation warm-up and suspended tabs instead of reacting to single slow frames.
    if(dt>0&&dt<.1){
      b.warmup+=dt
      if(b.warmup>4){b.elapsed+=dt;b.frames++}
      if(b.elapsed>2){
        const average=b.elapsed/b.frames
        const next=average>1/55?Math.max(.75,b.scale-.1):average<1/72?Math.min(1,b.scale+.05):b.scale
        if(next!==b.scale){b.scale=next;pipeline.composer.setPixelRatio(Math.min(1,gl.getPixelRatio())*next);pipeline.composer.setSize(size.width,size.height);document.documentElement.dataset.raceRenderScale=next.toFixed(2)}
        b.elapsed=0;b.frames=0
      }
    }
    gl.info.reset();pipeline.composer.render(Math.min(dt,.05))
  },1)
  return null
}
