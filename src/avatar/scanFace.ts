import type {HairMatch} from './hairMatching'
import {validateFaceProfile,type FaceProfile} from './faceProfile'
export type FaceScan={profile:FaceProfile;landmarks:{x:number;y:number}[];hairMatches:HairMatch[];hairNote:string}
/** One local still goes to a short-lived local worker. No photo upload. */
export async function scanFace(blob:Blob,onStage:(stage:string)=>void,signal?:AbortSignal):Promise<FaceScan>{
 const bitmap=await createImageBitmap(blob)
 if(signal?.aborted){bitmap.close();throw new Error('Scan cancelled.')}
 return new Promise((resolve,reject)=>{
  let worker:Worker
  try{worker=new Worker(new URL('./faceScan.worker.ts',import.meta.url),{type:'module'})}catch(e){bitmap.close();reject(e);return}
  const finish=()=>{clearTimeout(timer);worker.terminate();signal?.removeEventListener('abort',abort)}
  const abort=()=>{finish();reject(new Error('Scan cancelled.'))}
  const timer=window.setTimeout(()=>{finish();reject(new Error('The face scan timed out. Check your connection and retry.'))},120000)
  signal?.addEventListener('abort',abort,{once:true})
  worker.onerror=()=>{finish();reject(new Error('The face detector could not start. Try a current browser and retry.'))}
  worker.onmessage=({data})=>{
   if(data.type==='stage'){onStage(data.message);return}
   const profile=validateFaceProfile(data.profile)
   finish()
   if(data.type==='result'&&profile)resolve({profile,landmarks:data.landmarks,hairMatches:Array.isArray(data.hairMatches)?data.hairMatches.filter((m:HairMatch)=>Number.isInteger(m.id)&&m.id>=0&&m.id<245&&typeof m.mirror==='boolean'&&Number.isFinite(m.score)).slice(0,4):[],hairNote:typeof data.hairNote==='string'?data.hairNote:''})
   else reject(new Error(data.message??'The face scan was incomplete. Please retry.'))
  }
  worker.postMessage({bitmap},[bitmap])
 })
}
