import {Suspense,useEffect,useRef,useState} from 'react'
import {Canvas,useThree} from '@react-three/fiber'
import {OrbitControls} from '@react-three/drei'
import {MiiCreator} from './MiiCreator'
import {DEFAULT_PARTS} from '../avatar/creatorParts'
import {StylizedFace} from '../avatar/StylizedFace'
import {CircuitRacer} from '../scene/CircuitRacer'
import {DEFAULT_FACE,type FaceProfile} from '../avatar/faceProfile'
import {scanFace} from '../avatar/scanFace'
import {DEFAULT_DRIVER_STYLE,type DriverStyle} from '../avatar/driverStyle'
import './AvatarStudio.css'

type Props={currentProfile:FaceProfile|null;currentStyle:DriverStyle;onApply:(profile:FaceProfile,style:DriverStyle)=>boolean;onClear:()=>void;onBack:()=>void}
const palette=['#49dce8','#f36bb7','#a28bff','#ffb65e','#e4e5f4','#26263e']
const headHeight=import.meta.env.VITE_PERSONAL_ASSETS==='true'?1.06:1.32
function PreviewCamera({close}:{close:boolean}){
 const {camera,invalidate}=useThree()
 useEffect(()=>{camera.position.set(...(close?[0,headHeight+.02,1.25]:[3.4,2.5,5.0]) as [number,number,number]);camera.lookAt(0,close?headHeight:.7,.1);camera.updateProjectionMatrix();invalidate()},[camera,invalidate,close])
 return <OrbitControls makeDefault target={[0,close?headHeight:.7,.1]} enablePan={false} minDistance={close?.9:2} maxDistance={close?2.5:8} minPolarAngle={.45} maxPolarAngle={1.85}/>
}
function DriverPreview({profile,style,close}:{profile:FaceProfile;style:DriverStyle;close:boolean}){
 return <Canvas frameloop="demand" camera={{position:[0,1.12,1.6],fov:34}} dpr={[1,1.5]} aria-label="Actual personalized player model. Drag to rotate.">
  <color attach="background" args={['#141329']}/><hemisphereLight args={['#d6dcff','#54405e',1.4]}/><ambientLight intensity={.7}/>
  <directionalLight position={[2,4,5]} intensity={2.5} color="#ffdfc7"/><directionalLight position={[-3,2,1]} intensity={1.7} color="#7ae8ff"/>
  <Suspense fallback={null}>{close&&profile.creator?<StylizedFace profile={profile} position={[0,headHeight,.1]}/>:<CircuitRacer player faceProfile={profile} driverStyle={style} color="#49dce8"/>}</Suspense>
  <PreviewCamera close={close}/>
 </Canvas>
}
async function preparePhoto(blob:Blob){
 const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas'),scale=Math.min(512/bitmap.width,512/bitmap.height)
 canvas.width=canvas.height=512;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#141329';ctx.fillRect(0,0,512,512)
 ctx.drawImage(bitmap,(512-bitmap.width*scale)/2,(512-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);bitmap.close()
 const photo=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.92))
 if(!photo)throw new Error('Could not prepare that image. Try a JPEG, PNG or WebP photo.')
 return photo
}
export function AvatarStudio({currentProfile,currentStyle,onApply,onClear,onBack}:Props){
 const [draft,setDraft]=useState<FaceProfile>(currentProfile??{...DEFAULT_FACE}),[style,setStyle]=useState(currentStyle??DEFAULT_DRIVER_STYLE)
 const [partsAvailable,setPartsAvailable]=useState(false)
 useEffect(()=>{let active=true;void fetch('/assets/personal/mii-maker/face-02.svg').then(r=>r.ok?r.text():'').then(text=>{if(active&&text.includes('<svg')){setPartsAvailable(true);setDraft(p=>({...p,creator:p.creator??structuredClone(DEFAULT_PARTS)}))}}).catch(()=>{});return()=>{active=false}},[])
 const [cameraOn,setCameraOn]=useState(false),[ready,setReady]=useState(false),[photo,setPhoto]=useState<Blob|null>(null),[preview,setPreview]=useState<string|null>(null)
 const [busy,setBusy]=useState(false),[status,setStatus]=useState('Capture one face or choose a photo. Your image stays on this device.')
 const [scanned,setScanned]=useState(Boolean(currentProfile)),[points,setPoints]=useState<{x:number;y:number}[]>([]),[close,setClose]=useState(true)
 const video=useRef<HTMLVideoElement>(null),file=useRef<HTMLInputElement>(null),request=useRef<AbortController|null>(null),active=useRef(true),modelSection=useRef<HTMLElement>(null)
 useEffect(()=>{active.current=true;return()=>{active.current=false;request.current?.abort()}},[])
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview])
 useEffect(()=>{
  if(!cameraOn)return
  const target=video.current
  let cancelled=false,stream:MediaStream|null=null
  void(async()=>{try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access requires localhost or HTTPS in a current browser.')
   stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:960},height:{ideal:720},facingMode:'user'},audio:false})
   if(cancelled){stream.getTracks().forEach(t=>t.stop());return}
   if(target){target.srcObject=stream;await target.play()}
   if(!cancelled){setReady(true);setStatus('Look forward with your face inside the guide, then capture.')}
  }catch(e){if(!cancelled){setCameraOn(false);setStatus(e instanceof DOMException&&e.name==='NotAllowedError'?'Camera permission is blocked. Allow access in the browser or choose a photo.':e instanceof Error?e.message:'The camera could not start. Choose a photo instead.')}}})()
  return()=>{cancelled=true;setReady(false);stream?.getTracks().forEach(t=>t.stop());if(target&&target.srcObject===stream)target.srcObject=null}
 },[cameraOn])
 const selectPhoto=async(blob:Blob)=>{
  try{if(!['image/jpeg','image/png','image/webp'].includes(blob.type))throw new Error('Choose a JPEG, PNG or WebP photo.');const prepared=await preparePhoto(blob);if(!active.current)return;setPhoto(prepared);setPreview(URL.createObjectURL(prepared));setPoints([]);setStatus('Still selected locally. Scan it to create your 3D racer.')}catch(e){if(active.current)setStatus(e instanceof Error?e.message:'Could not read that photo.')}
 }
 const capture=()=>{
  const source=video.current;if(!source||!ready||!source.videoWidth)return
  const canvas=document.createElement('canvas'),size=Math.min(source.videoWidth,source.videoHeight);canvas.width=canvas.height=512;canvas.getContext('2d')!.drawImage(source,(source.videoWidth-size)/2,(source.videoHeight-size)/2,size,size,0,0,512,512)
  canvas.toBlob(blob=>{if(blob)void selectPhoto(blob)},'image/jpeg',.92)
 }
 const scan=async()=>{
  if(!photo||busy)return
  setBusy(true);request.current?.abort();const controller=new AbortController();request.current=controller
  try{const result=await scanFace(photo,setStatus,controller.signal);setDraft({...result.profile,creator:partsAvailable?{...structuredClone(DEFAULT_PARTS),eyes:result.profile.eyeShape==='hooded'?39:result.profile.eyeShape==='round'?3:1,mustache:result.profile.facialHair==='moustache'?2:1,goatee:result.profile.facialHair==='beard'?3:1}:null});setPoints(result.landmarks);setScanned(true);setClose(true);setStatus('Scan complete. Eye shape, nose, lips and colours measured. Check facial hair and fine-tune your likeness, then apply.');if(window.matchMedia('(max-width:620px)').matches)requestAnimationFrame(()=>modelSection.current?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'}))}
  catch(e){if(!controller.signal.aborted)setStatus(e instanceof Error?e.message:'Face scan failed. Please retry.')}
  finally{if(!controller.signal.aborted)setBusy(false)}
 }
 const change=(patch:Partial<FaceProfile>)=>setDraft(p=>({...p,...patch}))
 // Zoom only the on-screen reference; inference always uses the original prepared still.
 const referenceZoom=points.length?Math.min(4,1/Math.max(Math.abs(points[454].x-points[234].x)*1.8,Math.abs(points[152].y-points[10].y)*1.45)):1
 const referenceStyle=points.length?{transformOrigin:'0 0',transform:`translate(${( .5-(points[234].x+points[454].x)*.5*referenceZoom)*100}%,${(.5-(points[10].y+points[152].y)*.5*referenceZoom)*100}%) scale(${referenceZoom})`}:undefined
 const sliders=[['faceWidth','Face width',.85,1.12],['jaw','Jaw shape',.78,1.12],['eyeSpacing','Eye spacing',.8,1.2],['eyeHeight','Eye height',.005,.075],['noseHeight','Nose height',-.04,.02],['mouthHeight','Mouth height',-.10,-.035],['eyeAspect','Eye opening',.3,1.2],['eyeTilt','Eye slant',-.3,.3],['browWeight','Brow weight',.5,1.6],['noseWidth','Nose width',.65,1.6],['noseLength','Nose length',.65,1.5],['noseProjection','Nose profile',.65,1.5],['lipFullness','Lip fullness',.5,1.6],['mouthWidth','Smile width',.7,1.5],['smile','Expression',0,1]] as const
 return <section className="avatar-studio panel" aria-labelledby="avatar-title">
  <header className="avatar-heading"><div><small>AFTERGLOW / DRIVER STUDIO</small><h1 id="avatar-title">Your face. <em>Neon soul.</em></h1><p>Build your racer part by part, or start from a private on-device face scan.</p></div><button type="button" onClick={onBack}>← BACK TO GRID</button></header>
  <div className="avatar-workspace">
   <section className="avatar-capture"><h2><span>01</span> Capture your likeness</h2><div className={`avatar-camera ${busy?'is-scanning':''}`}>
    <video ref={video} autoPlay muted playsInline style={{opacity:ready&&!preview?1:0}}/>
    {preview?<img src={preview} alt="Selected still, kept locally" style={referenceStyle}/>:<>{!ready&&<div className="avatar-camera-empty"><span aria-hidden="true">◎</span><strong>Meet your next racer.</strong><p>Enable the webcam or choose a photo.</p></div>}<div className="avatar-face-guide" aria-hidden="true"/></>}
    {points.length>0&&<svg viewBox="0 0 512 512" style={referenceStyle} aria-label="Face landmarks detected by the on-device model">{[10,152,234,454,33,133,362,263,1,61,291,70,300].map(i=><circle key={i} cx={points[i].x*512} cy={points[i].y*512} r="3"/>)}</svg>}
    {busy&&<div className="avatar-scan-line" aria-hidden="true"/>}<span className="avatar-local">● LOCAL ONLY</span>
   </div><p className="avatar-hint">One face, straight on, in even light. Keep forehead and chin in view.</p>
   <div className="avatar-capture-actions"><button type="button" disabled={busy} onClick={()=>{if(preview){setPreview(null);setPhoto(null);setPoints([])}else if(ready)capture();else {setStatus('Connecting camera…');setCameraOn(true)}}}>{preview?'Retake':ready?'Capture face':'Enable webcam'}</button><button type="button" disabled={busy} onClick={()=>file.current?.click()}>Choose photo</button></div>
   <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{const selected=e.target.files?.[0];if(selected){if(selected.size>10*1024*1024)setStatus('Choose a photo smaller than 10 MB.');else void selectPhoto(selected)}e.target.value=''}}/>
   <button className="avatar-scan primary" type="button" disabled={!photo||busy} onClick={()=>void scan()}>{busy?'BUILDING YOUR RACER…':'SCAN & CREATE DRIVER'}<span aria-hidden="true">↗</span></button>
   <p className="avatar-privacy">The face model downloads once. Your still and face measurements are processed here, without an upload. Only your editable avatar settings are saved.</p>
   {cameraOn&&<button className="avatar-camera-off" type="button" onClick={()=>setCameraOn(false)}>Turn off webcam</button>}
   </section>
   <section ref={modelSection} className="avatar-model"><h2><span>02</span> {scanned?'Your personalized driver':'Style preview'}</h2><div className="avatar-model-stage"><DriverPreview profile={draft} style={style} close={close}/><div className="avatar-view-toggle"><button type="button" aria-pressed={close} onClick={()=>setClose(true)}>FACE</button><button type="button" aria-pressed={!close} onClick={()=>setClose(false)}>FULL KART</button></div><small>{draft.creator?.nickname??'PLAYER'} · DRAG TO ROTATE · FULL KART FOR RACE FIT</small></div></section>
   <section className="avatar-tuning"><h2><span>03</span> Mii-style creator</h2>{partsAvailable?<MiiCreator profile={draft} onChange={change} onStatus={setStatus}/>:<><p className="mii-install">Install the optional local creator artwork with scripts/prepare-mii-creator.py to unlock the complete part library.</p>
    <fieldset className="avatar-art-style"><legend>Avatar style</legend><div className="avatar-segments">{(['graphic','soft','portrait']as const).map(look=><button key={look} type="button" aria-pressed={draft.look===look} onClick={()=>change({look})}>{look}</button>)}</div></fieldset>
    <div className="avatar-color-row">{(['skin','hair','eyes','facialHairColor']as const).map(key=><label key={key}><input type="color" aria-label={`${key} colour`} value={draft[key]} onChange={e=>change({[key]:e.target.value})}/><span>{key==='facialHairColor'?'Beard':key}</span></label>)}</div>
    <fieldset><legend>Hair silhouette</legend><div className="avatar-segments">{(['swept','cropped','none']as const).map(hairStyle=><button key={hairStyle} type="button" aria-pressed={draft.hairStyle===hairStyle} onClick={()=>change({hairStyle})}>{hairStyle}</button>)}</div></fieldset>
    <div className="avatar-feature-selects"><label>Eye shape<select aria-label="Eye shape" value={draft.eyeShape} onChange={e=>change({eyeShape:e.target.value as FaceProfile['eyeShape']})}>{['almond','round','hooded','dot'].map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Facial hair<select aria-label="Facial hair" value={draft.facialHair} onChange={e=>change({facialHair:e.target.value as FaceProfile['facialHair']})}>{['none','stubble','moustache','goatee','beard'].map(value=><option key={value}>{value}</option>)}</select></label></div>
    <label className="avatar-glasses"><input type="checkbox" checked={draft.glasses} onChange={e=>change({glasses:e.target.checked})}/> Neon glasses</label>
    <details className="avatar-feature-details"><summary>Fine-tune facial features</summary><div className="avatar-sliders">{sliders.map(([key,label,min,max])=><label key={key}><span>{label}</span><input type="range" min={min} max={max} step="0.005" value={draft[key]} onChange={e=>change({[key]:Number(e.target.value)})}/></label>)}</div></details>
    </>}
    {(['helmet','suit']as const).map(part=><fieldset key={part}><legend>{part==='helmet'?'Helmet accent':'Race suit'}</legend><div className="avatar-swatches">{palette.map(color=><button key={color} type="button" aria-label={`${part} ${color}`} aria-pressed={style[part]===color} onClick={()=>setStyle(s=>({...s,[part]:color}))} style={{background:color}}/>)}</div></fieldset>)}
   </section>
  </div>
  <footer className="avatar-footer"><p role="status" aria-live="polite">{status}</p><div><button type="button" disabled={busy} onClick={()=>{request.current?.abort();onClear();setDraft({...DEFAULT_FACE,creator:partsAvailable?structuredClone(DEFAULT_PARTS):null});setScanned(false);setPhoto(null);setPreview(null);setPoints([]);setStatus('Saved face settings and the captured still have been cleared.')}}>Clear saved face</button><button className="primary" type="button" disabled={busy} onClick={()=>{const saved=onApply(draft,style);setStatus(saved?'Applied to your player. Saved on this device—return to the grid when ready.':'Applied to your player for this session. Browser storage is unavailable.')}}>APPLY TO PLAYER ↗</button></div></footer>
 </section>
}
