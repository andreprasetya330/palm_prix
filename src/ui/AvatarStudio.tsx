import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Driver } from '../aaa/kart/Driver'
import { clearCachedAvatar, saveCachedAvatar, stylizeSelfie } from '../avatar/stylizeClient'
import { DEFAULT_DRIVER_STYLE, type DriverStyle } from '../avatar/driverStyle'

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>
  currentAvatar: string | null
  onAvatar: (url: string | null) => void
  onDone: () => void
  onBack: () => void
  onEnableCamera?: () => void
  currentStyle?: DriverStyle
  onStyleChange?: (style: DriverStyle) => void
}
const colors = ['#fff3e4', '#c4254a', '#1d7182', '#2945a3', '#e6ab39', '#292e3c']
function DriverPreview({ url, style }: { url: string | null; style: DriverStyle }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    setTexture(null)
    if (!url) return
    let active = true
    const loaded = new THREE.TextureLoader().load(url, result => {
      result.colorSpace = THREE.SRGBColorSpace
      if (active) setTexture(result)
    })
    return () => { active = false; loaded.dispose() }
  }, [url])
  return <Canvas camera={{position:[0,0,2],fov:36}} dpr={[1,1.5]} style={{height:240,background:'#213c44',borderRadius:16}}>
    <ambientLight intensity={1.5}/><directionalLight position={[2,3,4]} intensity={2.5}/><directionalLight position={[-3,1,1]} intensity={1}/>
    <Suspense fallback={null}><group position={[0,-0.87,0]} rotation={[0,-0.15,0]}><Driver texture={texture} envMap={null} style={style}/></group></Suspense>
  </Canvas>
}
export function AvatarStudio({videoRef,currentAvatar,onAvatar,onDone,onBack,onEnableCamera,currentStyle=DEFAULT_DRIVER_STYLE,onStyleChange}:Props) {
  const [preview,setPreview] = useState<string|null>(null)
  const [result,setResult] = useState<string|null>(currentAvatar)
  const [busy,setBusy] = useState(false)
  const [status,setStatus] = useState<string|null>(null)
  const [optIn,setOptIn] = useState(false)
  const [ready,setReady] = useState(false)
  const [cloudAvailable,setCloudAvailable] = useState<boolean|null>(null)
  const [style,setStyle] = useState(currentStyle)
  const still = useRef<Blob|null>(null)
  const live = useRef<HTMLVideoElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let active=true
    fetch('/api/health').then(r=>r.ok?r.json():null).then(data=>{if(active)setCloudAvailable(Boolean(data?.falConfigured))}).catch(()=>{if(active)setCloudAvailable(false)})
    const update=()=>{
      const source=videoRef.current, target=live.current
      const stream=source?.srcObject
      if(target && stream && target.srcObject!==stream) {target.srcObject=stream;void target.play().catch(()=>{})}
      setReady(Boolean(source && source.readyState>=2 && source.videoWidth>0))
    }
    update();const interval=window.setInterval(update,500)
    return()=>{active=false;clearInterval(interval)}
  },[videoRef])
  const setPhoto = async (blob:Blob)=>{
    try {
      const image=await createImageBitmap(blob), size=Math.min(image.width,image.height)
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512
      canvas.getContext('2d')!.drawImage(image,(image.width-size)/2,(image.height-size)/2,size,size,0,0,512,512)
      image.close()
      const prepared=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92))
      if(!prepared)throw new Error('Could not prepare this photo.')
      still.current=prepared;setPreview(canvas.toDataURL('image/jpeg',0.92));setOptIn(false)
      setStatus('Still captured locally. Choose a portrait style below; nothing has been uploaded.')
    } catch {setStatus('Could not read that photo. Please choose a JPEG, PNG or WebP image.')}
  }
  const capture=()=>{
    const source=videoRef.current
    if(!source || source.readyState<2 || !source.videoWidth){setStatus('Camera is not ready. Enable it or choose a photo.');return}
    const canvas=document.createElement('canvas');canvas.width=source.videoWidth;canvas.height=source.videoHeight
    canvas.getContext('2d')!.drawImage(source,0,0)
    canvas.toBlob(blob=>{if(blob)void setPhoto(blob)},'image/jpeg',0.92)
  }
  const create=async(mode:'local'|'cloud')=>{
    if(!still.current || (mode==='cloud'&&!optIn))return
    setBusy(true);setStatus(mode==='cloud'?'Creating your AI portrait. This can take up to two minutes…':'Creating a local illustrated portrait…')
    try {
      const response=await stylizeSelfie(still.current,mode)
      if(!response.ok){setStatus(response.error);return}
      setResult(response.imageUrl);onAvatar(response.imageUrl)
      const saved=saveCachedAvatar(response.imageUrl)
      setStatus(`${response.source==='fal'?'AI portrait':'Local portrait effect (not AI)'} applied to your 3D driver.${saved?' Saved on this device.':' Active for this session; browser storage is unavailable.'}`)
    } finally {setBusy(false)}
  }
  const changeStyle=(next:DriverStyle)=>{setStyle(next);onStyleChange?.(next)}
  return <div className="panel avatar-studio" style={{maxWidth:1050,maxHeight:'calc(100vh - 110px)',overflowY:'auto'}}>
    <div className="eyebrow">DRIVER GARAGE</div><h2>Your face. Your racing colors.</h2>
    <p className="privacy">Create a portrait for the face inside your driver’s helmet. Camera capture and the local effect stay on your device. Cloud AI sends one selected still to our server and fal only with your consent.</p>
    <div className="avatar-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:18}}>
      <section><p className="label">01 / Frame your face</p>
        <div style={{position:'relative',height:240,background:'#142c34',borderRadius:16,overflow:'hidden'}}>
          <video ref={live} autoPlay muted playsInline style={{width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)',opacity:ready?1:0}}/>
          {ready?<div aria-hidden="true" style={{position:'absolute',inset:'12% 25%',border:'2px dashed #e8ff86',borderRadius:'50%'}}/>:<div style={{position:'absolute',inset:24,display:'grid',placeItems:'center',textAlign:'center'}}>Enable your camera or choose a photo.</div>}
        </div>
        <p className="hint">Center one face, look forward, and fill the oval. Use even lighting.</p>
        <div className="row"><button onClick={ready?capture:onEnableCamera} disabled={busy||(!ready&&!onEnableCamera)}>{ready?'Capture face':'Enable camera'}</button><button disabled={busy} onClick={()=>fileInput.current?.click()}>Choose photo</button></div>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event=>{const file=event.target.files?.[0];if(file){if(file.size>10*1024*1024)setStatus('Choose a photo smaller than 10 MB.');else void setPhoto(file)}event.target.value=''}}/>
      </section>
      <section><p className="label">02 / Your selected still</p>
        {preview?<img src={preview} alt="Selected face portrait, stored locally" style={{width:'100%',height:240,objectFit:'cover',borderRadius:16}}/>:<div className="avatar-placeholder" style={{height:240}}>Capture or choose a photo</div>}
        <p className="hint">This is the exact still used for the portrait. Retake it anytime.</p>
        <button disabled={busy||!preview} onClick={()=>void create('local')}>Use local portrait · no upload</button>
      </section>
      <section><p className="label">03 / Your actual 3D driver</p><DriverPreview url={result} style={style}/>
        <p className="hint">The same helmet, face and suit appear in your kart.</p>
        {(['helmet','suit'] as const).map(part=><fieldset key={part} style={{border:0,padding:0,margin:'10px 0'}}><legend style={{fontSize:12,textTransform:'capitalize',marginBottom:6}}>{part} color</legend><div style={{display:'flex',gap:8}}>{colors.map(color=><button key={color} aria-label={`${part} ${color}`} aria-pressed={style[part]===color} onClick={()=>changeStyle({...style,[part]:color})} style={{background:color,width:26,height:26,minWidth:26,padding:0,borderRadius:'50%',border:style[part]===color?'3px solid #e8ff86':'2px solid #ffffff44'}}/>)}</div></fieldset>)}
      </section>
    </div>
    <div style={{margin:'20px 0',padding:16,background:'#ffffff08',border:'1px solid #ffffff22',borderRadius:12}}>
      <label className="opt-in"><input type="checkbox" checked={optIn} disabled={busy||!preview} onChange={event=>setOptIn(event.target.checked)}/>I agree to send this one still to fal through the game server to create an AI portrait.</label>
      <button className="primary" disabled={busy||!preview||!optIn||cloudAvailable===false} onClick={()=>void create('cloud')}>{busy?'Creating portrait…':'Create AI portrait'}</button>
      {cloudAvailable===false&&<p className="hint">Cloud AI is unavailable on this server. The local portrait effect works now; it is not an AI face scan.</p>}
    </div>
    {status&&<p className="status" role="status">{status}</p>}
    <div className="row"><button onClick={onBack} disabled={busy}>Back</button><button className="primary" disabled={busy} onClick={onDone}>Save driver & continue</button><button disabled={busy} onClick={()=>{clearCachedAvatar();setResult(null);setPreview(null);still.current=null;setOptIn(false);onAvatar(null);setStatus('Saved portrait and captured still cleared from this device. Cloud-provider retention is separate.')}}>Clear my portrait</button></div>
  </div>
}
