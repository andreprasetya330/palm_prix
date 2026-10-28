export type FaceProfile={version:1;look:'graphic'|'soft'|'portrait';eyeHeight:number;noseHeight:number;mouthHeight:number;eyeShape:'almond'|'round'|'hooded'|'dot';eyeAspect:number;eyeTilt:number;noseLength:number;noseProjection:number;lipFullness:number;browWeight:number;facialHair:'none'|'stubble'|'moustache'|'goatee'|'beard';facialHairColor:string;faceWidth:number;faceHeight:number;jaw:number;eyeSpacing:number;eyeSize:number;noseWidth:number;mouthWidth:number;smile:number;browTilt:number;skin:string;hair:string;eyes:string;hairStyle:'swept'|'cropped'|'none';glasses:boolean}
export const DEFAULT_FACE:FaceProfile={version:1,look:'graphic',eyeHeight:.027,noseHeight:-.011,mouthHeight:-.07,eyeShape:'almond',eyeAspect:.65,eyeTilt:0,noseLength:1,noseProjection:1,lipFullness:1,browWeight:1,facialHair:'none',facialHairColor:'#282333',faceWidth:1,faceHeight:1,jaw:1,eyeSpacing:1,eyeSize:1,noseWidth:1,mouthWidth:1,smile:.25,browTilt:0,skin:'#c78d70',hair:'#282333',eyes:'#403048',hairStyle:'swept',glasses:false}
const KEY='palm-prix-face-profile-v1'
const ranges={eyeHeight:[.005,.075],noseHeight:[-.04,.02],mouthHeight:[-.10,-.035],eyeAspect:[.3,1.2],eyeTilt:[-.3,.3],noseLength:[.65,1.5],noseProjection:[.65,1.5],lipFullness:[.5,1.6],browWeight:[.5,1.6],faceWidth:[.85,1.12],faceHeight:[.88,1.12],jaw:[.78,1.12],eyeSpacing:[.8,1.2],eyeSize:[.85,1.2],noseWidth:[.65,1.6],mouthWidth:[.7,1.5],smile:[0,1],browTilt:[-.25,.25]} as const
export function validateFaceProfile(value:unknown):FaceProfile|null{
 if(!value||typeof value!=='object')return null
 const raw=value as Record<string,unknown>
 // Additive migration keeps earlier locally saved drivers usable.
 const p={...raw} as Record<string,unknown>
 for(const key of ['look','eyeHeight','noseHeight','mouthHeight','eyeShape','eyeAspect','eyeTilt','noseLength','noseProjection','lipFullness','browWeight','facialHair','facialHairColor']as const)if(!(key in raw))p[key]=DEFAULT_FACE[key]
 if(!['graphic','soft','portrait'].includes(String(p.look))||!['almond','round','hooded','dot'].includes(String(p.eyeShape))||!['none','stubble','moustache','goatee','beard'].includes(String(p.facialHair)))return null
 if(p.version!==1||!['swept','cropped','none'].includes(String(p.hairStyle))||typeof p.glasses!=='boolean')return null
 for(const name of ['skin','hair','eyes','facialHairColor'])if(typeof p[name]!=='string'||!/^#[\da-f]{6}$/i.test(p[name] as string))return null
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
 const aperture=(distance(159,145)+distance(386,374))/Math.max(1,distance(33,133)+distance(362,263))
 const eyeAspect=clamp(aperture*2,.3,1.2)
 // Use the eye-corner axis so head roll doesn't become a permanent eye slant.
 const axis={x:points[263].x-points[33].x,y:points[263].y-points[33].y}
 const angle=(a:number,b:number)=>Math.atan2((points[b].y-points[a].y)*height,(points[b].x-points[a].x)*width)
 const roll=Math.atan2(axis.y*height,axis.x*width)
 return {...DEFAULT_FACE,...colors,facialHairColor:colors.hair,
  eyeHeight:clamp((.5-((points[33].y+points[263].y)*.5-points[10].y)*height/h)*.34,.005,.075),
  noseHeight:clamp((.5-(points[1].y-points[10].y)*height/h)*.34,-.04,.02),
  mouthHeight:clamp((.5-((points[61].y+points[291].y)*.5-points[10].y)*height/h)*.34,-.10,-.035),
  eyeAspect,eyeShape:eyeAspect<.48?'hooded':eyeAspect>.85?'round':'almond',
  eyeTilt:clamp(((angle(33,133)-roll)-(angle(362,263)-roll))*.5,-.3,.3),
  noseLength:clamp(distance(168,2)/h/.28,.65,1.5),
  noseProjection:clamp(Math.abs(points[1].z-points[168].z)*width/w/.12,.65,1.5),
  lipFullness:clamp((distance(0,13)+distance(14,17))/Math.max(1,distance(61,291))/.22,.5,1.6),
  browWeight:clamp((distance(70,46)+distance(300,276))/w/.08,.5,1.6),
  faceWidth:clamp(w/h/.76,.85,1.12),faceHeight:clamp(h/w*.76,.88,1.12),
  jaw:clamp(distance(172,397)/w/.82,.78,1.12),
  eyeSpacing:clamp(distance(133,362)/w/.24,.8,1.2),
  eyeSize:clamp((distance(33,133)+distance(362,263))/w/.43,.85,1.2),
  noseWidth:clamp(distance(98,327)/w/.22,.65,1.6),mouthWidth:clamp(distance(61,291)/w/.37,.7,1.5),
  smile:clamp(distance(13,14)/Math.max(1,distance(61,291))/.28,0,1),
  browTilt:clamp(((points[70].y-points[107].y)+(points[300].y-points[336].y))*height/w*.8,-.25,.25),
 }
}
