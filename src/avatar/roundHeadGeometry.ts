import * as THREE from 'three'
import type {FaceProfile} from './faceProfile'
export const HEAD_CENTER_Z=-.045
/** A closed ellipsoid, with a face decal projected onto its front hemisphere. */
export function buildRoundHead(p:Pick<FaceProfile,'faceWidth'|'faceHeight'>&{creator?:{face:number}|null}){
 const head=new THREE.SphereGeometry(1,48,32)
 const aspect=[1.02,1,.95,1.06,1.025,1.035,1.015,1.04,.97,.985,1.01,.99][(p.creator?.face??2)-1]??1
 const rx=.165*p.faceWidth*aspect,ry=.165*p.faceHeight/aspect,rz=.165*Math.sqrt(p.faceWidth*p.faceHeight)
 head.scale(rx,ry,rz)
 const patch=head.clone(),position=patch.attributes.position,uv=patch.attributes.uv
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i)
  // Back vertices sample an empty texture corner; features never repeat behind the head.
  uv.setXY(i,z>=-1e-6?.5+x/.52:0,z>=-1e-6?.5+y/.60:0)
 }
 patch.scale(1.004,1.004,1.004)
 // Preserve the existing face/helmet alignment while adding volume behind it.
 head.translate(0,0,HEAD_CENTER_Z);patch.translate(0,0,HEAD_CENTER_Z)
 head.computeBoundingBox();patch.computeBoundingBox()
 return {head,patch}
}
