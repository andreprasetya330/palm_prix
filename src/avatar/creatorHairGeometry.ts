import * as THREE from 'three'
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js'
import {HEAD_CENTER_Z,headSurfaceZ,type HeadOutline} from './roundHeadGeometry'
import type {FaceProfile} from './faceProfile'
/** Turn the selected SVG hair paths into a shaded fringe and a rounded rear volume. */
export function buildCreatorHair(shapes:THREE.Shape[],p:FaceProfile,head:THREE.BufferGeometry,outline:HeadOutline,silhouettes=shapes){
 if(!silhouettes.length)return null
 const vertices:number[]=[]
 const map=(v:THREE.Vector2)=>new THREE.Vector2((v.x-26)/52*.64*p.faceWidth*(p.creator?.mirrorHair?-1:1),.025+(26-v.y)/52*.62*p.faceHeight)
 const emit=(a:THREE.Vector2,b:THREE.Vector2,c:THREE.Vector2,depth=0)=>{
  const ab=a.distanceTo(b),bc=b.distanceTo(c),ca=c.distanceTo(a)
  if(Math.max(ab,bc,ca)>.012&&depth<9){
   if(ab>=bc&&ab>=ca){const m=a.clone().add(b).multiplyScalar(.5);emit(a,m,c,depth+1);emit(m,b,c,depth+1)}
   else if(bc>=ca){const m=b.clone().add(c).multiplyScalar(.5);emit(a,b,m,depth+1);emit(a,m,c,depth+1)}
   else{const m=c.clone().add(a).multiplyScalar(.5);emit(a,b,m,depth+1);emit(m,b,c,depth+1)}
   return
  }
  for(const v of [a,b,c])vertices.push(v.x,v.y,headSurfaceZ(v.x,v.y,p,outline)+.018)
 }
 for(const shape of shapes){const g=new THREE.ShapeGeometry(shape,10),pos=g.attributes.position,indices=g.index!
  for(let i=0;i<indices.count;i+=3){const points=[0,1,2].map(j=>{const k=indices.getX(i+j);return map(new THREE.Vector2(pos.getX(k),pos.getY(k)))})
   // SVG Y reflection reverses winding, with an additional reflection for flipped hair.
   emit(points[0],points[p.creator?.mirrorHair?1:2],points[p.creator?.mirrorHair?2:1])
  }g.dispose()
 }
 const b=new THREE.Box2()
 for(const shape of silhouettes)for(const v of shape.getPoints(32))b.expandByPoint(map(v))
 let fringe:THREE.BufferGeometry|null=null
 if(vertices.length){const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));fringe=mergeVertices(raw,.00001);raw.dispose();fringe.computeVertexNormals()}
 const rear=head.clone();rear.deleteAttribute('uv');const rv=rear.attributes.position
 const top=Math.max(.175*p.faceHeight,b.max.y),bottom=Math.min(-.085*p.faceHeight,b.min.y),wide=Math.max(1.035,Math.min(1.4,(b.max.x-b.min.x)/(.33*p.faceWidth)))
 for(let i=0;i<rv.count;i++)rv.setXYZ(i,rv.getX(i)*wide,rv.getY(i)*top/(.165*p.faceHeight),(rv.getZ(i)-HEAD_CENTER_Z)*1.065+HEAD_CENTER_Z)
 const original=rear.index!,indices:number[]=[]
 for(let i=0;i<original.count;i+=3){const ids=[original.getX(i),original.getX(i+1),original.getX(i+2)],z=ids.reduce((sum,k)=>sum+rv.getZ(k),0)/3,y=ids.reduce((sum,k)=>sum+rv.getY(k),0)/3
  if(z<=HEAD_CENTER_Z+.002&&y>=bottom)indices.push(...ids)
 }
 rear.setIndex(indices);rear.computeVertexNormals()
 const hair=fringe?mergeGeometries([fringe,rear])!:rear
 if(fringe){fringe.dispose();rear.dispose()}hair.computeBoundingBox();return hair
}
