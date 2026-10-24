import {useProgress} from '@react-three/drei'
export function AssetLoadingOverlay(){
  const {active,progress,errors}=useProgress()
  if(!active&&!errors.length)return null
  return <div className="asset-loading" role="status"><div className="asset-loading-card"><div className="eyebrow">PALM PRIX</div><h2>{errors.length?'A circuit asset could not load':'Preparing the grid'}</h2><p>{errors.length?'Check your connection and reload to try again.':'Loading locally hosted racers, road textures and stadium.'}</p>{errors.length?<button onClick={()=>window.location.reload()}>Reload game</button>:<><div className="speed-bar"><div className="speed-fill" style={{width:`${Math.max(3,progress)}%`}}/></div><small>{Math.round(progress)}%</small></>}</div></div>
}
