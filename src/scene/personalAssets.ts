import {useEffect,useState} from 'react'

export type PersonalAssets={balloon?:string;cups?:string;kart?:string}
let pending:Promise<PersonalAssets>|null=null
/** Optional local models are deliberately separate from the reusable asset library. */
function loadPersonalAssets(){
  if(import.meta.env.VITE_PERSONAL_ASSETS!=='true')return Promise.resolve({} as PersonalAssets)
  if(!pending)pending=fetch('/assets/personal/manifest.json').then(async response=>{
    if(!response.ok)return {}
    const json=await response.json() as PersonalAssets,result:PersonalAssets={}
    await Promise.all((['balloon','cups','kart'] as const).map(async key=>{
      const path=json[key]
      if(typeof path!=='string'||!/^\/assets\/personal\/[a-z0-9-]+\.glb$/.test(path))return
      if((await fetch(path,{method:'HEAD'})).ok)result[key]=path
    }))
    return result
  }).catch(()=>({}))
  return pending
}
export function usePersonalAssets(){
  const [assets,setAssets]=useState<PersonalAssets>({})
  useEffect(()=>{let active=true;void loadPersonalAssets().then(value=>{if(active)setAssets(value)});return()=>{active=false}},[])
  return assets
}
