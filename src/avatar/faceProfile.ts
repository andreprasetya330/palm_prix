export type FaceProfile={version:1;faceWidth:number;faceHeight:number;jaw:number;eyeSpacing:number;eyeSize:number;noseWidth:number;mouthWidth:number;smile:number;browTilt:number;skin:string;hair:string;eyes:string;hairStyle:'swept'|'cropped'|'none';glasses:boolean}
export const DEFAULT_FACE:FaceProfile={version:1,faceWidth:1,faceHeight:1,jaw:1,eyeSpacing:1,eyeSize:1,noseWidth:1,mouthWidth:1,smile:.25,browTilt:0,skin:'#c78d70',hair:'#282333',eyes:'#403048',hairStyle:'swept',glasses:false}
const KEY='palm-prix-face-profile-v1'
const ranges={faceWidth:[.85,1.12],faceHeight:[.88,1.12],jaw:[.78,1.12],eyeSpacing:[.8,1.2],eyeSize:[.85,1.2],noseWidth:[.75,1.3],mouthWidth:[.75,1.3],smile:[0,1],browTilt:[-.25,.25]} as const
export function validateFaceProfile(value:unknown):FaceProfile|null{
 if(!value||typeof value!=='object')return null
 const p=value as Record<string,unknown>
 if(p.version!==1||!['swept','cropped','none'].includes(String(p.hairStyle))||typeof p.glasses!=='boolean')return null
 for(const name of ['skin','hair','eyes'])if(typeof p[name]!=='string'||!/^#[\da-f]{6}$/i.test(p[name] as string))return null
 for(const [name,[min,max]]of Object.entries(ranges))if(typeof p[name]!=='number'||!Number.isFinite(p[name])||(p[name] as number)<min||(p[name] as number)>max)return null
 return Object.fromEntries(Object.keys(DEFAULT_FACE).map(key=>[key,p[key]])) as FaceProfile
}
export function loadFaceProfile():FaceProfile|null{try{return validateFaceProfile(JSON.parse(localStorage.getItem(KEY)??'null'))}catch{return null}}
export function saveFaceProfile(p:FaceProfile):boolean{if(!validateFaceProfile(p))return false;try{localStorage.setItem(KEY,JSON.stringify(p));return true}catch{return false}}
export function clearFaceProfile(){try{localStorage.removeItem(KEY)}catch{/* Session-only storage. */}}
type Point={x:number;y:number;z:number}
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x))
/** Relative face measurements, never identity recognition or demographic inference. */
export function profileFromLandmarks(points:Point[],width:number,height:number,colors:{skin:string;hair:string}):FaceProfile{
 if(points.length<468||points.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))throw new Error('The face scan was incomplete. Face the camera and try again.')
 const distance=(a:number,b:number)=>Math.hypot((points[a].x-points[b].x)*width,(points[a].y-points[b].y)*height)
 const w=distance(234,454),h=distance(10,152)
 if(w<width*.12||h<height*.15)throw new Error('Move closer so your face fills the guide, then scan again.')
 const left=distance(33,1),right=distance(263,1)
 if(Math.min(left,right)/Math.max(left,right)<.58)throw new Error('Look straight at the camera so both sides of your face are visible.')
 return {...DEFAULT_FACE,...colors,
  faceWidth:clamp(w/h/.76,.85,1.12),faceHeight:clamp(h/w*.76,.88,1.12),
  jaw:clamp(distance(172,397)/w/.82,.78,1.12),
  eyeSpacing:clamp(distance(133,362)/w/.24,.8,1.2),
  eyeSize:clamp((distance(33,133)+distance(362,263))/w/.43,.85,1.2),
  noseWidth:clamp(distance(98,327)/w/.22,.75,1.3),mouthWidth:clamp(distance(61,291)/w/.37,.75,1.3),
  smile:clamp(distance(13,14)/Math.max(1,distance(61,291))/.28,0,1),
  browTilt:clamp(((points[70].y-points[107].y)+(points[300].y-points[336].y))*height/w*.8,-.25,.25),
 }
}
