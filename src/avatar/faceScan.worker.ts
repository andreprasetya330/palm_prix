import {FilesetResolver,FaceLandmarker} from '@mediapipe/tasks-vision'
import {profileFromLandmarks} from './faceProfile'
const scope=self as unknown as {import?:(url:string)=>Promise<void>;dbg?:(message:string)=>void;onmessage:((event:MessageEvent<{bitmap:ImageBitmap}>)=>void)|null;postMessage:(data:unknown)=>void}
scope.dbg=message=>console.debug(message)
scope.import=async(url:string)=>{
 const response=await fetch(url);if(!response.ok)throw new Error('The face detector could not download. Check your connection and retry.')
 const source=await response.text(),moduleUrl=URL.createObjectURL(new Blob([source,'\nself.ModuleFactory = ModuleFactory;'],{type:'text/javascript'}))
 try{await import(/* @vite-ignore */moduleUrl)}finally{URL.revokeObjectURL(moduleUrl)}
}
function sampleColor(data:Uint8ClampedArray,width:number,height:number,x:number,y:number,radius:number){
 const channels:number[][]=[[],[],[]]
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  const px=Math.max(0,Math.min(width-1,Math.round(x)+dx)),py=Math.max(0,Math.min(height-1,Math.round(y)+dy)),i=(py*width+px)*4
  for(let c=0;c<3;c++)channels[c].push(data[i+c])
 }
 return '#'+channels.map(values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)].toString(16).padStart(2,'0')).join('')
}
scope.onmessage=async({data:{bitmap}})=>{
 let detector:FaceLandmarker|null=null
 try{
  scope.postMessage({type:'stage',message:'Loading the on-device face model…'})
  const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm')
  detector=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'CPU'},runningMode:'IMAGE',numFaces:2,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5})
  scope.postMessage({type:'stage',message:'Measuring your face and building your racer…'})
  const result=detector.detect(bitmap)
  if(result.faceLandmarks.length!==1)throw new Error(result.faceLandmarks.length?'Keep just one face in the frame and try again.':'No face found. Face the camera, move closer and use even lighting.')
  const points=result.faceLandmarks[0],canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d')!
  ctx.drawImage(bitmap,0,0);const pixels=ctx.getImageData(0,0,bitmap.width,bitmap.height).data
  const forehead=points[10],chin=points[152],radius=Math.max(2,Math.round(Math.abs(points[234].x-points[454].x)*bitmap.width*.025))
  const skinSamples=[50,280,101,330].map(i=>sampleColor(pixels,bitmap.width,bitmap.height,points[i].x*bitmap.width,points[i].y*bitmap.height,radius))
  const skin='#'+[1,3,5].map(offset=>skinSamples.map(c=>parseInt(c.slice(offset,offset+2),16)).sort((a,b)=>a-b)[1].toString(16).padStart(2,'0')).join('')
  // The face-oval forehead point is below the hairline. Sample several small
  // crown patches so a forehead highlight isn't mistaken for the hair colour.
  const hairSamples=[.12,.18,.24,.28].flatMap(rise=>[-.06,0,.06].map(side=>sampleColor(pixels,bitmap.width,bitmap.height,(forehead.x+side*Math.abs(points[234].x-points[454].x))*bitmap.width,(forehead.y-(chin.y-forehead.y)*rise)*bitmap.height,radius)))
  const brightness=(color:string)=>parseInt(color.slice(1,3),16)*.21+parseInt(color.slice(3,5),16)*.72+parseInt(color.slice(5,7),16)*.07
  const hair=hairSamples.sort((a,b)=>brightness(a)-brightness(b))[3]
  const profile={...profileFromLandmarks(points,bitmap.width,bitmap.height,{skin,hair}),hairStyle:'cropped'}
  scope.postMessage({type:'result',profile,landmarks:points.map(p=>({x:p.x,y:p.y}))})
 }catch(e){scope.postMessage({type:'error',message:e instanceof Error?e.message:'Face scan failed. Please retry.'})}
 finally{bitmap.close();detector?.close()}
}
