import * as THREE from 'three'
import type {FaceProfile} from './faceProfile'
export const HEAD_CENTER_Z=-.045
export type HeadOutline=number[]
type Profile=Pick<FaceProfile,'faceWidth'|'faceHeight'>&{creator?:{face:number}|null}
/** Horizontal cross-sections of the chosen creator silhouette, bottom to top. */
export function outlineFromPoints(points:{x:number;y:number}[]):HeadOutline{
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y))
 const result:number[]=[]
 for(let row=0;row<=64;row++){
  if(row===0||row===64){result.push(0);continue}
  const y=maxY-(maxY-minY)*row/64,crossings:number[]=[]
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length]
   if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y))crossings.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y))
  }
  result.push(crossings.length?Math.min(1,(Math.max(...crossings)-Math.min(...crossings))/(maxX-minX)):0)
 }
 return result
}
function widthAt(y:number,outline?:HeadOutline){
 if(!outline)return Math.sqrt(Math.max(0,1-y*y))
 const t=Math.max(0,Math.min(64,(y+1)*32)),i=Math.min(63,Math.floor(t))
 return outline[i]+(outline[i+1]-outline[i])*(t-i)
}
export function headSurfaceZ(x:number,y:number,p:Profile,outline?:HeadOutline){
 const ny=y/(.165*p.faceHeight),rx=.165*p.faceWidth*widthAt(ny,outline),depth=.165*Math.sqrt(p.faceWidth*p.faceHeight)*Math.sqrt(Math.max(0,1-ny*ny))
 return HEAD_CENTER_Z+depth*Math.sqrt(Math.max(0,1-(x/Math.max(.0001,rx))**2))
}
/** Full rounded depth, with the selected outline controlling cheeks and chin. */
export function buildRoundHead(p:Profile,outline?:HeadOutline){
 const head=new THREE.SphereGeometry(1,48,32),v=head.attributes.position
 for(let i=0;i<v.count;i++){
  const y=v.getY(i),ring=Math.sqrt(Math.max(0,1-y*y)),x=ring>1e-6?v.getX(i)/ring:0
  v.setXYZ(i,x*.165*p.faceWidth*widthAt(y,outline),y*.165*p.faceHeight,v.getZ(i)*.165*Math.sqrt(p.faceWidth*p.faceHeight))
 }
 head.computeVertexNormals()
 const patch=head.clone(),position=patch.attributes.position,uv=patch.attributes.uv
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i)
  uv.setXY(i,z>=-1e-6?.5+x/.52:0,z>=-1e-6?.5+y/.60:0)
 }
 patch.scale(1.004,1.004,1.004)
 head.translate(0,0,HEAD_CENTER_Z);patch.translate(0,0,HEAD_CENTER_Z)
 head.computeBoundingBox();patch.computeBoundingBox()
 return {head,patch}
}
