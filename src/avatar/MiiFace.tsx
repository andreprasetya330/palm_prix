import {useEffect,useMemo,useState} from 'react'
import {useThree} from '@react-three/fiber'
import * as THREE from 'three'
import {buildFaceGeometry} from './faceGeometry'
import {buildRoundHead,outlineFromPoints} from './roundHeadGeometry'
import {buildCreatorHair} from './creatorHairGeometry'
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js'
import {eyeIsMirrored,partUrl,type PartCategory,type MovablePart} from './creatorParts'
import type {FaceProfile} from './faceProfile'
const sourceCache=new Map<string,Promise<string>>()
function source(category:PartCategory,id:number){const url=partUrl(category,id);let result=sourceCache.get(url);if(!result){result=fetch(url).then(r=>{if(!r.ok)throw new Error('Local Mii Creator parts are not installed.');return r.text()});sourceCache.set(url,result);result.catch(()=>sourceCache.delete(url))}return result}
const rasterCache=new Map<string,Promise<HTMLCanvasElement>>()
function raster(svg:string,category:PartCategory,p:FaceProfile){
 const c=p.creator!,key=JSON.stringify([category,svg,p.skin,p.hair,p.eyes,p.facialHairColor,c.browsColor,c.glassesColor,c.lipColor])
 let result=rasterCache.get(key);if(result)return result
 result=(async()=>{
  const doc=new DOMParser().parseFromString(svg,'image/svg+xml'),root=doc.documentElement
  const graphics=Array.from(root.querySelectorAll('path,circle,ellipse,rect,polygon,polyline,line'))
  const backdrop=['hair','glasses','mustache','goatee','makeup','wrinkles','hat'].includes(category)
  for(const [i,node]of graphics.entries()){
   const fill=node.getAttribute('fill')?.toLowerCase()
   if(backdrop&&(fill==='white'||fill==='#ffffff')){
    if(category==='hair'){
     const ns='http://www.w3.org/2000/svg',defs=doc.createElementNS(ns,'defs'),mask=doc.createElementNS(ns,'mask'),rect=doc.createElementNS(ns,'rect'),hole=node.cloneNode(true) as Element
     mask.id='hair-cutout';rect.setAttribute('width','52');rect.setAttribute('height','52');rect.setAttribute('fill','white');hole.setAttribute('fill','black');hole.removeAttribute('stroke');mask.append(rect,hole);defs.append(mask);root.prepend(defs)
     for(const earlier of graphics.slice(0,i))earlier.setAttribute('mask','url(#hair-cutout)')
    }
    node.remove();continue
   }
   for(const attribute of ['fill','stroke']){
    const color=node.getAttribute(attribute);if(!color||color==='none'||color.startsWith('url('))continue
    let replacement=color
    if(category==='hair')replacement=p.hair
    if(category==='eyebrows')replacement=c.browsColor
    if(category==='eyes')replacement=color.toLowerCase()==='#0010bf'?p.eyes:color.toLowerCase()==='#6c7070'?'#241f2b':color
    if(category==='nose')replacement='#'+new THREE.Color(p.skin).multiplyScalar(.50).getHexString()
    if(category==='mouth')replacement=color.toLowerCase()==='#0055ff'?'#fff4e4':color.toLowerCase()==='#712a04'?'#54283a':c.lipColor
    if(category==='glasses')replacement=c.glassesColor
    if(category==='mustache'||category==='goatee')replacement=p.facialHairColor
    if(category==='hat')replacement=color.includes('face')?p.skin:p.hair
    node.setAttribute(attribute,replacement)
   }
  }
  root.setAttribute('width','512');root.setAttribute('height','512')
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml'})),image=new Image()
  try{await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Could not read a creator part'));image.src=url})
   const canvas=document.createElement('canvas');canvas.width=canvas.height=512;canvas.getContext('2d')!.drawImage(image,0,0,512,512);return canvas
  }finally{URL.revokeObjectURL(url)}
 })()
 if(rasterCache.size>32)rasterCache.clear();rasterCache.set(key,result);result.catch(()=>rasterCache.delete(key));return result
}
const boundsCache=new WeakMap<HTMLCanvasElement,{x:number;y:number;w:number;h:number}|null>()
function bounds(canvas:HTMLCanvasElement){if(boundsCache.has(canvas))return boundsCache.get(canvas)!
 const data=canvas.getContext('2d')!.getImageData(0,0,512,512).data;let x0=512,y0=512,x1=0,y1=0
 for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(data[(y*512+x)*4+3]>12){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
 const result=x1>=x0&&y1>=y0?{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1}:null;boundsCache.set(canvas,result);return result
}
async function build(p:FaceProfile){
 const c=p.creator!,categories=Object.keys({face:1,hair:1,eyes:1,eyebrows:1,nose:1,mouth:1,glasses:1,mustache:1,goatee:1,makeup:1,wrinkles:1,hat:1}) as PartCategory[]
 const raw=Object.fromEntries(await Promise.all(categories.filter(k=>k!=='hat'||c.hat>0).map(async k=>[k,await source(k,c[k])]))) as Record<PartCategory,string>
 const loader=new SVGLoader(),facePath=loader.parse(raw.face).paths.find(path=>(path.userData?.style as {fill?:string})?.fill==='white')
 if(!facePath)throw new Error('Creator face outline missing')
 const outline=outlineFromPoints(facePath.toShapes()[0].getPoints(48)),{head,patch}=buildRoundHead(p,outline)
 const hairPaths=loader.parse(raw.hair).paths,faceIndex=hairPaths.findIndex(path=>(path.userData?.style as {fill?:string})?.fill==='white')
 const hairShapes:THREE.Shape[]=[],allHairShapes:THREE.Shape[]=[]
 for(const [index,path]of hairPaths.entries()){
  const fill=(path.userData?.style as {fill?:string})?.fill
  if(!fill||fill==='none'||fill==='white')continue
  const shapes=path.toShapes();allHairShapes.push(...shapes)
  // Back-of-head thumbnail silhouettes become rear volume, never face-shaped rings.
  if(index>faceIndex||faceIndex<0)hairShapes.push(...shapes)
 }
 const hair=buildCreatorHair(hairShapes,p,head,outline,allHairShapes)
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d')!
 const draw=async(k:PartCategory,x:number,y:number,w:number,h?:number,mirror=false,adjust?:MovablePart)=>{
  const img=await raster(raw[k],k,p),ink=bounds(img);if(!ink)return
  const b=['hair','goatee','makeup','wrinkles','hat'].includes(k)?{x:0,y:0,w:512,h:512}:ink
  const a=adjust?c.placement[adjust]:{x:0,y:0,scale:1,aspect:1,rotation:0}
  const width=w*a.scale,height=(h??w*b.h/b.w)*a.scale*a.aspect
  ctx.save();ctx.translate((.5+(x+a.x)/.52)*1024,(.5-(y+a.y)/.60)*1024);ctx.rotate(a.rotation);ctx.scale(mirror?-1:1,1)
  ctx.drawImage(img,b.x,b.y,b.w,b.h,-width/.52*512,-height/.60*512,width/.52*1024,height/.60*1024);ctx.restore()
 }
 await draw('makeup',0,0,.51,.55);await draw('wrinkles',0,0,.51,.55)
 await draw('goatee',0,.010,.54,.58)
 for(const side of [-1,1]){
  await draw('eyes',side*.061*p.eyeSpacing,p.eyeHeight,.062*p.eyeSize,undefined,eyeIsMirrored(side,c.mirrorEyes),'eyes')
  await draw('eyebrows',side*.061*p.eyeSpacing,p.eyeHeight+.039,.069,undefined,side===1,'eyebrows')
 }
 await draw('nose',0,p.noseHeight,.043*p.noseWidth,.052*p.noseLength,false,'nose')
 await draw('mouth',0,p.mouthHeight,.093*p.mouthWidth,undefined,false,'mouth')
 await draw('mustache',0,p.mouthHeight+.022,.115,undefined,false,'mustache')
 await draw('glasses',0,p.eyeHeight,.21,undefined,false,'glasses')
 if(c.hat>0)await draw('hat',0,.025,.64,.62)
 if(c.mole){ctx.fillStyle='#4a3035';ctx.beginPath();ctx.arc((.5+c.moleX/.52)*1024,(.5-c.moleY/.60)*1024,5,0,Math.PI*2);ctx.fill()}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4
 return {head,patch,texture,hair}
}
type Built=Awaited<ReturnType<typeof build>>
const dispose=(v:Built)=>{v.head.dispose();v.patch.dispose();v.texture.dispose();v.hair?.dispose()}
export function MiiFace({profile}:{profile:FaceProfile}){
 const [failed,setFailed]=useState(false)
 const fallback=useMemo(()=>buildFaceGeometry(profile),[profile])
 useEffect(()=>()=>fallback.dispose(),[fallback])
 const [model,setModel]=useState<Built|null>(null),{invalidate}=useThree()
 useEffect(()=>{let cancelled=false,owned:Built|null=null
  void build(profile).then(result=>{if(cancelled){dispose(result);return}owned=result;setModel(result);invalidate()}).catch(e=>{if(!cancelled){setFailed(true);console.warn('Mii Creator:',e.message);invalidate()}})
  return()=>{cancelled=true;if(owned)dispose(owned)}
 },[profile,invalidate])
 if(failed)return <mesh geometry={fallback}><meshToonMaterial vertexColors/></mesh>
 return <group name="mii-creator-face">{model&&<><mesh geometry={model.head} castShadow><meshToonMaterial color={profile.skin}/></mesh><mesh geometry={model.patch} renderOrder={2}><meshBasicMaterial map={model.texture} transparent alphaTest={.025} depthWrite={false}/></mesh>{model.hair&&<mesh geometry={model.hair} castShadow><meshToonMaterial color={profile.hair} side={THREE.DoubleSide}/></mesh>}</>}<mesh position={[0,-.17,-.055]} scale={[.055,.075,.055]}><sphereGeometry args={[1,12,8]}/><meshToonMaterial color={profile.skin}/></mesh></group>
}
