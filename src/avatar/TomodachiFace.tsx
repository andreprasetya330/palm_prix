import {useEffect,useMemo,useState} from 'react'
import {useThree} from '@react-three/fiber'
import * as THREE from 'three'
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js'
import {buildFaceGeometry} from './faceGeometry'
import {assetUrl,loadTomodachiCatalog,nativeRoots,nativeY,type NativePart} from './tomodachiAssets'
import {eyeIsMirrored,type PartCategory,type MovablePart} from './creatorParts'
import {tintNativePixels,orientNativePixels} from './tomodachiPixels'
import type {FaceProfile} from './faceProfile'
const modelCache=new Map<string,Promise<GLTF>>(),imageCache=new Map<string,Promise<HTMLImageElement>>()
const gltfLoader=new GLTFLoader()
function model(path:string){let p=modelCache.get(path);if(!p){p=gltfLoader.loadAsync(assetUrl(path));modelCache.set(path,p);p.catch(()=>modelCache.delete(path))}return p}
function image(path:string){let p=imageCache.get(path);if(!p){p=new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Missing Tomodachi face texture'));img.src=assetUrl(path)});imageCache.set(path,p);p.catch(()=>imageCache.delete(path))}return p}
async function strands(path:string,colour:string){const img=await image(path),canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight
 const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);pixels.data.set(tintNativePixels(pixels.data,'Hair',colour));ctx.putImageData(pixels,0,0);return canvasTexture(canvas)}
const canvasTexture=(canvas:HTMLCanvasElement)=>{const t=new THREE.CanvasTexture(canvas);t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
function uvAtXY(g:THREE.BufferGeometry,x:number,y:number){
 const p=g.attributes.position,uv=g.attributes.uv,index=g.index
 for(let i=0;i<(index?.count??p.count);i+=3){const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),[a,b,c]=ids.map(k=>new THREE.Vector2(p.getX(k),p.getY(k)))
  const denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(denominator)<1e-10)continue
  const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/denominator,v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/denominator,w=1-u-v
  if(u>=-.001&&v>=-.001&&w>=-.001)return new THREE.Vector2(u*uv.getX(ids[0])+v*uv.getX(ids[1])+w*uv.getX(ids[2]),u*uv.getY(ids[0])+v*uv.getY(ids[1])+w*uv.getY(ids[2]))
 }
 return new THREE.Vector2(.5+x/1,.5-y)
}
async function sprite(item:NativePart,colour:string){
 if(!item.sprite)return null
 const img=await image(item.sprite),canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight
 const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),kind=item.name.replace(/\d+$/,'')
 pixels.data.set(orientNativePixels(tintNativePixels(pixels.data,kind,colour),canvas.width,canvas.height,kind));ctx.putImageData(pixels,0,0);return canvas
}
function newCanvas(){const c=document.createElement('canvas');c.width=c.height=600;return c}
async function assemble(p:FaceProfile,helmeted:boolean){
 const c=p.creator!,catalog=await loadTomodachiCatalog(),part=(k:PartCategory)=>catalog.categories[k][c[k]],group=new THREE.Group()
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>()
 const ownMaterial=<T extends THREE.Material>(m:T)=>{materials.add(m);return m}
 const ownGeometry=(g:THREE.BufferGeometry)=>{geometries.add(g);return g}
 const ownTexture=(t:THREE.Texture)=>{textures.add(t);return t}
 const skin=ownMaterial(new THREE.MeshToonMaterial({color:p.skin})),hairMat=ownMaterial(new THREE.MeshToonMaterial({color:p.hair,side:THREE.DoubleSide})),beardMat=ownMaterial(new THREE.MeshToonMaterial({color:p.facialHairColor,side:THREE.DoubleSide}))
 const release=()=>{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose())}
 try{
  const headSource=await model(part('face').model!);headSource.scene.updateMatrixWorld(true)
  const sockets=Object.fromEntries(['nose','ear','hair','beard'].map(key=>[key,headSource.scene.getObjectByName('set_'+key)?.getWorldPosition(new THREE.Vector3())??new THREE.Vector3()]))
  const earRotation=headSource.scene.getObjectByName('set_ear')?.getWorldQuaternion(new THREE.Quaternion())??new THREE.Quaternion()
  const importMeshes=async(item:NativePart,mat:THREE.Material,mode='normal',flip=false)=>{
   const result=new THREE.Group();if(!item.model)return result
   const source=await model(item.model);source.scene.updateMatrixWorld(true)
   const roots=mode==='hair'?nativeRoots(source.scene.children.map(n=>n.name),flip,helmeted):{names:source.scene.children.map(n=>n.name),mirror:false}
   for(const root of source.scene.children){if(!roots.names.includes(root.name))continue
    root.traverse(node=>{if(!(node instanceof THREE.Mesh))return
     const geo=ownGeometry(node.geometry.clone());geo.applyMatrix4(node.matrixWorld);geo.deleteAttribute('skinIndex');geo.deleteAttribute('skinWeight')
     const mesh=new THREE.Mesh(geo,mat);mesh.name=node.name;mesh.castShadow=true;result.add(mesh)
    })
   }
   if(roots.mirror)result.scale.x=-1
   return result
  }
  const head=await importMeshes(part('face'),skin)
  let mask:THREE.Mesh|undefined
  head.traverse(node=>{if(node instanceof THREE.Mesh&&node.name.startsWith('Mask'))mask=node})
  if(!mask)throw new Error('Native head is missing its face mask')
  const maskMesh=mask as THREE.Mesh<THREE.BufferGeometry>,maskGeo=maskMesh.geometry,faceCanvas=newCanvas(),headCanvas=newCanvas(),ctx=faceCanvas.getContext('2d')!,headCtx=headCanvas.getContext('2d')!
  const sx=.55*p.faceWidth,sy=.5*p.faceHeight,sz=.5
  const anchor=(x:number,y:number)=>uvAtXY(maskGeo,x/sx,nativeY(y,p.faceHeight)).multiplyScalar(600)
  const paint=async(category:PartCategory,x:number,y:number,scale:number,colour:string,side=0,adjust?:MovablePart,extraY=1)=>{
   const item=part(category),img=await sprite(item,colour);if(!img)return
   const a=adjust?c.placement[adjust]:{x:0,y:0,scale:1,aspect:1,rotation:0},uv=anchor(x+a.x,y+a.y)
   const mirror=side!==0&&eyeIsMirrored(side,category==='eyes'?c.mirrorEyes:false)
   ctx.save();ctx.translate(uv.x,uv.y);ctx.rotate((item.rotation*Math.PI/180+a.rotation)*(side===1?-1:1));ctx.scale(mirror?-1:1,1)
   const w=img.width*scale*a.scale,h=img.height*scale*a.scale*a.aspect*extraY
   ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore()
  }
  const paintWhole=async(category:PartCategory,colour:string,target:CanvasRenderingContext2D,lower=false)=>{
   const img=await sprite(part(category),colour);if(!img)return
   const kind=part(category).name,shift=kind.startsWith('WrinkleUpper')?-.06:kind.startsWith('WrinkleLower')?.06:kind.startsWith('MakeLower')?-.005:.04
   const uv=anchor(0,shift),w=img.width*.58,h=img.height*.58
   for(const side of [-1,1]){target.save();target.translate(uv.x+side*22,uv.y+(lower?65:0));target.scale(side,1);target.drawImage(img,-w/2,-h/2,w,h);target.restore()}
  }
  await paintWhole('makeup',c.lipColor,ctx);await paintWhole('makeupUpper',c.lipColor,ctx)
  await paintWhole('wrinkles','#745348',headCtx);await paintWhole('wrinklesUpper','#745348',headCtx);await paintWhole('beardShort',p.facialHairColor,headCtx,true)
  for(const side of [-1,1]){
   const x=side*.061*p.eyeSpacing,y=p.eyeHeight
   await paint('eyes',x,y,.75*p.eyeSize,p.eyes,side,'eyes')
   await paint('eyebrows',x,y+.039,.75,c.browsColor,side,'eyebrows')
   await paint('eyelidUpper',x,y+.013,.8,p.skin,side);await paint('eyelidLower',x,y-.012,.8,p.skin,side)
   await paint('eyelashUpper',x,y+.016,.8,'#211c29',side);await paint('eyelashLower',x,y-.016,.8,'#211c29',side)
   await paint('highlight',x-.005*side,y+.006,.5,'#ffffff',side)
  }
  await paint('mouth',0,p.mouthHeight,.75*p.mouthWidth,c.lipColor,0,'mouth')
  await paint('mustache',0,p.mouthHeight+.026,.40,p.facialHairColor,0,'mustache')
  if(c.mole){const uv=anchor(c.moleX,c.moleY);ctx.fillStyle='#392329';ctx.beginPath();ctx.arc(uv.x,uv.y,4,0,Math.PI*2);ctx.fill()}
  const faceTexture=ownTexture(canvasTexture(faceCanvas));maskMesh.material=ownMaterial(new THREE.MeshBasicMaterial({map:faceTexture,transparent:true,alphaTest:.02,depthWrite:false,side:THREE.DoubleSide}));maskMesh.renderOrder=3;maskMesh.castShadow=false
  if(c.wrinkles||c.wrinklesUpper||c.beardShort){
   const paintTexture=ownTexture(canvasTexture(headCanvas))
   for(const node of [...head.children])if(node instanceof THREE.Mesh&&node.name.startsWith('Head')){
    const geo=ownGeometry(node.geometry.clone()),uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,(uv.getX(i)+.5)%1)
    geo.scale(1.001,1.001,1.001);const overlay=new THREE.Mesh(geo,ownMaterial(new THREE.MeshBasicMaterial({map:paintTexture,transparent:true,depthWrite:false,alphaTest:.01})));overlay.renderOrder=2;head.add(overlay)
   }
  }
  group.add(head)
  for(const key of ['hair','hairFront','hairBack']as const){const item=part(key);if(!item.model)continue
   const mat=hairMat.clone();materials.add(mat);if(item.texture){mat.map=ownTexture(await strands(item.texture,p.hair));mat.color.set('#ffffff')}
   const hair=await importMeshes(item,mat,'hair',c.mirrorHair);hair.position.copy(sockets.hair);group.add(hair)
  }
  if(part('goatee').model){let mat=beardMat;if(part('goatee').texture){mat=beardMat.clone();materials.add(mat);mat.map=ownTexture(await strands(part('goatee').texture!,p.facialHairColor));mat.color.set('#ffffff')}const beard=await importMeshes(part('goatee'),mat);beard.position.copy(sockets.beard);group.add(beard)}
  if(part('nose').model){
   const nose=await importMeshes(part('nose'),skin)
   for(const node of [...nose.children])if(node instanceof THREE.Mesh&&node.name.startsWith('NoseLine')){
    // Native nose-line quads need artwork; their extracted grey placeholder is not skin.
    const img=await image(part('nose').icon),canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight
    const nc=canvas.getContext('2d')!;nc.drawImage(img,0,0);const data=nc.getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,y0=canvas.height,x1=0,y1=0
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
    const crop=document.createElement('canvas');crop.width=Math.max(1,x1-x0+1);crop.height=Math.max(1,y1-y0+1);crop.getContext('2d')!.drawImage(canvas,x0,y0,crop.width,crop.height,0,0,crop.width,crop.height)
    const geo=node.geometry,box=new THREE.Box3().setFromBufferAttribute(geo.attributes.position as THREE.BufferAttribute),pos=geo.attributes.position,uv=geo.attributes.uv??new THREE.BufferAttribute(new Float32Array(pos.count*2),2)
    for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)-box.min.x)/Math.max(.00001,box.max.x-box.min.x),1-(pos.getY(i)-box.min.y)/Math.max(.00001,box.max.y-box.min.y))
    geo.setAttribute('uv',uv);node.material=ownMaterial(new THREE.MeshBasicMaterial({map:ownTexture(canvasTexture(crop)),color:new THREE.Color(p.skin).multiplyScalar(.65),transparent:true,alphaTest:.03,depthWrite:false,side:THREE.DoubleSide}));node.castShadow=false
   }
   const a=c.placement.nose;nose.scale.set(p.noseWidth*a.scale,p.noseLength*a.scale*a.aspect,p.noseProjection*a.scale);nose.position.copy(sockets.nose).add(new THREE.Vector3(a.x/sx,(p.noseHeight+.035+a.y)/sy,0));nose.rotation.z=a.rotation;group.add(nose)
  }
  if(part('ear').model){for(const side of [-1,1]){
   const ear=await importMeshes(part('ear'),skin)
   ear.rotation.y=-Math.PI/2;const oriented=new THREE.Group();oriented.add(ear);oriented.quaternion.copy(earRotation)
   const holder=new THREE.Group();holder.add(oriented);holder.scale.x=side;holder.position.copy(sockets.ear);holder.position.x*=side;group.add(holder)
  }}
  if(part('glasses').model){
   const frame=ownMaterial(new THREE.MeshToonMaterial({color:c.glassesColor})),glass=await importMeshes(part('glasses'),frame),hasTransparent=glass.children.some(n=>n.name.startsWith('Trs'))
   for(const node of [...glass.children])if(node instanceof THREE.Mesh){
    if(node.name.startsWith('Opa')&&hasTransparent){node.visible=false;continue}
    if(node.name.startsWith('Opa')||node.name.startsWith('Trs'))node.material=ownMaterial(new THREE.MeshBasicMaterial({color:c.glassesColor,transparent:true,opacity:c.lensOpacity,depthWrite:false,side:THREE.DoubleSide}))
   }
   const a=c.placement.glasses;glass.scale.set(a.scale,a.scale*a.aspect,a.scale);glass.position.set(sockets.nose.x+a.x/sx,nativeY(p.eyeHeight+a.y,p.faceHeight),sockets.nose.z+.015);glass.rotation.z=a.rotation;group.add(glass)
  }
  group.scale.set(sx,sy,sz);group.position.set(0,-.3375736773*sy,-.045+.0427802913*sz)
  return {group,release}
 }catch(error){release();throw error}
}
type Built=Awaited<ReturnType<typeof assemble>>
export function TomodachiFace({profile,helmeted=true}:{profile:FaceProfile;helmeted?:boolean}){
 const [built,setBuilt]=useState<Built|null>(null),[failed,setFailed]=useState(false),{invalidate}=useThree(),fallback=useMemo(()=>failed?buildFaceGeometry(profile):null,[failed,profile])
 useEffect(()=>()=>fallback?.dispose(),[fallback])
 useEffect(()=>()=>built?.release(),[built])
 useEffect(()=>{let cancelled=false
  void assemble(profile,helmeted).then(result=>{if(cancelled){result.release();return}setFailed(false);setBuilt(result);invalidate()}).catch(error=>{if(!cancelled){setFailed(true);setBuilt(null);console.warn('Tomodachi creator:',error.message);invalidate()}})
  return()=>{cancelled=true}
 },[profile,helmeted,invalidate])
 if(failed&&fallback)return <mesh geometry={fallback}><meshToonMaterial vertexColors/></mesh>
 return <group name="tomodachi-driver-head">{built&&<primitive object={built.group}/>}<mesh position={[0,-.17,-.055]} scale={[.055,.075,.055]}><sphereGeometry args={[1,12,8]}/><meshToonMaterial color={profile.skin}/></mesh></group>
}
