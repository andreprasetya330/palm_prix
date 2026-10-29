import type {CreatorParts} from './creatorParts'
import {DEFAULT_PARTS} from './creatorParts'
import type {FaceProfile} from './faceProfile'
export const HAIR_COLS=24,HAIR_ROWS=28
export type HairMatch={id:number;mirror:boolean;score:number}
export type HairIndex={version:1;cols:number;rows:number;styles:{id:number;mask:string}[]}
type Point={x:number;y:number}
export type HairObservation={mask:string;colour:string|null;coverage:number;confidence:number;long:boolean}
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x))
/** Keep only segmented hair connected to the crown/temples, in a roll-normalized face frame. */
export function observeHair(confidence:Float32Array,mw:number,mh:number,pixels:Uint8ClampedArray,width:number,height:number,points:Point[]):HairObservation{
 const top=points[10],chin=points[152],vx=(chin.x-top.x)*width,vy=(chin.y-top.y)*height,h=Math.hypot(vx,vy),w=Math.hypot((points[454].x-points[234].x)*width,(points[454].y-points[234].y)*height),ux=vy/h,uy=-vx/h
 const raw=new Uint8Array(HAIR_COLS*HAIR_ROWS),strength=new Float32Array(raw.length),samples:{hex:string;light:number}[]=[]
 const location=(gx:number,gy:number)=>{const x=(-.85+(gx+.5)/HAIR_COLS*1.7)*w,y=(-.55+(gy+.5)/HAIR_ROWS*1.95)*h;return {x:top.x*width+ux*x+vx/h*y,y:top.y*height+uy*x+vy/h*y}}
 for(let y=0;y<HAIR_ROWS;y++)for(let x=0;x<HAIR_COLS;x++){
  const p=location(x,y),mx=Math.round(p.x/width*mw),my=Math.round(p.y/height*mh),i=y*HAIR_COLS+x
  if(mx>=0&&my>=0&&mx<mw&&my<mh){strength[i]=confidence[my*mw+mx];raw[i]=strength[i]>.6?1:0}
 }
 const keep=new Uint8Array(raw.length),queue:number[]=[]
 for(let y=0;y<15;y++)for(let x=3;x<HAIR_COLS-3;x++){const i=y*HAIR_COLS+x;if(raw[i]){keep[i]=1;queue.push(i)}}
 for(let at=0;at<queue.length;at++){const i=queue[at],x=i%HAIR_COLS,y=Math.floor(i/HAIR_COLS);for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=x+dx,yy=y+dy,j=yy*HAIR_COLS+xx;if(xx>=0&&yy>=0&&xx<HAIR_COLS&&yy<HAIR_ROWS&&raw[j]&&!keep[j]){keep[j]=1;queue.push(j)}}}
 let total=0,strong=0,lower=0
 for(let i=0;i<keep.length;i++)if(keep[i]){
  total++;strong+=strength[i];if(Math.floor(i/HAIR_COLS)>20)lower++
  if(strength[i]>.85){const p=location(i%HAIR_COLS,Math.floor(i/HAIR_COLS)),x=clamp(Math.round(p.x),0,width-1),y=clamp(Math.round(p.y),0,height-1),at=(y*width+x)*4,r=pixels[at],g=pixels[at+1],b=pixels[at+2];samples.push({hex:'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''),light:.2126*r+.7152*g+.0722*b})}
 }
 samples.sort((a,b)=>a.light-b.light)
 const middle=samples.slice(Math.floor(samples.length*.2),Math.max(1,Math.ceil(samples.length*.8)))
 const colour=middle.length>=6?'#'+[1,3,5].map(offset=>middle.map(p=>parseInt(p.hex.slice(offset,offset+2),16)).sort((a,b)=>a-b)[Math.floor(middle.length/2)].toString(16).padStart(2,'0')).join(''):null
 return {mask:[...keep].join(''),colour,coverage:total/keep.length,confidence:total?strong/total:0,long:lower>8}
}
export function matchHair(observation:HairObservation,index:HairIndex):HairMatch[]{
 if(index.version!==1||index.cols!==HAIR_COLS||index.rows!==HAIR_ROWS||!Array.isArray(index.styles))throw new Error('Hair matching index is unavailable')
 if(observation.coverage<.012)return [{id:0,mirror:false,score:1}]
 const score=(mask:string,mirror:boolean)=>{
  let intersection=0,union=0
  for(let y=0;y<HAIR_ROWS;y++)for(let x=0;x<HAIR_COLS;x++){
   const i=y*HAIR_COLS+x,a=observation.mask[i]==='1',b=mask[y*HAIR_COLS+(mirror?HAIR_COLS-1-x:x)]==='1',weight=y>8&&y<19?1.8:1
   if(a&&b)intersection+=weight;if(a||b)union+=weight
  }
  return union?intersection/union:0
 }
 return index.styles.filter(s=>Number.isInteger(s.id)&&s.id>0&&s.id<245&&/^[01]{672}$/.test(s.mask)).map(style=>{const normal=score(style.mask,false),mirror=score(style.mask,true);return {id:style.id,mirror:mirror>normal+.015,score:Math.max(normal,mirror)}}).sort((a,b)=>b.score-a.score||a.id-b.id).slice(0,4)
}
/** Native feature choices and measured proportions both participate in the scan result. */
export function creatorFromScan(profile:FaceProfile,matches:HairMatch[]=[]):CreatorParts{
 const best=matches[0]
 return {...structuredClone(DEFAULT_PARTS),hair:best?.id??(profile.hairStyle==='none'?0:59),mirrorHair:best?.mirror??false,
  eyes:profile.eyeShape==='round'?4:profile.eyeShape==='hooded'?8:1,
  mouth:profile.smile>.38?15:3,browsColor:profile.hair,
  mustache:profile.facialHair==='moustache'||profile.facialHair==='goatee'?2:0,
  goatee:profile.facialHair==='beard'?3:profile.facialHair==='goatee'?1:0,
  beardShort:profile.facialHair==='stubble'?1:0}
}
