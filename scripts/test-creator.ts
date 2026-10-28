import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'
import {DEFAULT_PARTS,PARTS,partUrl,validateCreatorParts} from '../src/avatar/creatorParts'
import {DEFAULT_FACE,validateFaceProfile} from '../src/avatar/faceProfile'
assert.equal(Object.values(PARTS).reduce((sum,v)=>sum+v.count,0),347)
const good=validateCreatorParts(DEFAULT_PARTS)!
assert(good);assert.deepEqual(good,DEFAULT_PARTS)
assert.notEqual(good.placement,DEFAULT_PARTS.placement,'Imported profiles must not alias mutable defaults')
for(const [category,info]of Object.entries(PARTS)){
 assert.equal(validateCreatorParts({...DEFAULT_PARTS,[category]:info.start+info.count}),null)
 for(let id=info.start;id<info.start+info.count;id++){
  const url=partUrl(category as keyof typeof PARTS,id)
  assert(!url.includes('..'));if(existsSync('public'+url)){
   const svg=readFileSync('public'+url,'utf8');assert(svg.includes('<svg'));assert(!/<script|<foreignObject|https?:\/\//i.test(svg.replace(/xmlns="[^"]*"/g,'')))
  }
 }
}
for(const bad of [{nickname:'x'.repeat(17)},{glassesColor:'url(evil)'},{moleX:Infinity},{eyes:1.5},{placement:{...DEFAULT_PARTS.placement,eyes:{x:0,y:0,scale:999,aspect:1,rotation:0}}}])assert.equal(validateCreatorParts({...DEFAULT_PARTS,...bad}),null)
const face=validateFaceProfile({...DEFAULT_FACE,creator:DEFAULT_PARTS})!
assert(face?.creator);assert.deepEqual(validateFaceProfile(JSON.parse(JSON.stringify(face))),face)
assert.equal(validateFaceProfile({...DEFAULT_FACE,creator:{eyes:1}}),null)
assert.equal(validateFaceProfile({...DEFAULT_FACE,creator:null})?.creator,null)
console.log('Creator passed: 347 parts, safe local paths, validated IDs/placement/colours, old avatars and editable photo-free round trips.')

// A face silhouette must never be extruded into a flat-ended barrel again.
const {buildRoundHead,HEAD_CENTER_Z}=await import('../src/avatar/roundHeadGeometry')
for(const [faceWidth,faceHeight]of [[1,1],[.85,1.12],[1.12,.88]]){
 const {head,patch}=buildRoundHead({faceWidth,faceHeight})
 const p=head.attributes.position,uv=patch.attributes.uv,rx=.165*faceWidth,ry=.165*faceHeight,rz=.165*Math.sqrt(faceWidth*faceHeight)
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i)-HEAD_CENTER_Z
  assert(Math.abs((x/rx)**2+(y/ry)**2+(z/rz)**2-1)<1e-5,'Every head vertex must lie on the rounded surface')
  if(z< -1e-6)assert(uv.getX(i)===0&&uv.getY(i)===0,'No facial features on the back of the head')
 }
 const box=head.boundingBox!,depth=box.max.z-box.min.z,width=box.max.x-box.min.x
 assert(depth/width>.85&&depth/width<1.2,'Head depth must be round rather than an extrusion')
 assert(p.count<2000,'Round head stays lightweight')
 head.dispose();patch.dispose()
}
console.log('Round head passed: closed ellipsoid, full depth, curved feature projection, empty back UVs and bounded geometry.')

const {outlineFromPoints}=await import('../src/avatar/roundHeadGeometry')
const {buildCreatorHair}=await import('../src/avatar/creatorHairGeometry')
const THREE=await import('three')
const {eyeIsMirrored}=await import('../src/avatar/creatorParts')
assert(eyeIsMirrored(-1)&&!eyeIsMirrored(1),'Default eyes must mirror the source on the left, not the right')
assert(!eyeIsMirrored(-1,true)&&eyeIsMirrored(1,true),'Flip control reverses the eye pair')
assert.equal(validateCreatorParts({...DEFAULT_PARTS,mirrorEyes:'bad'}),null)
const oldParts={...DEFAULT_PARTS} as Record<string,unknown>;delete oldParts.mirrorEyes
assert.equal(validateCreatorParts(oldParts)?.mirrorEyes,false,'Older avatar saves acquire the corrected eye orientation')
const circle=Array.from({length:96},(_,i)=>({x:Math.cos(i/96*Math.PI*2),y:Math.sin(i/96*Math.PI*2)}))
const angular=[{x:0,y:-1},{x:1,y:-.6},{x:.95,y:.8},{x:.6,y:1},{x:-.6,y:1},{x:-.95,y:.8},{x:-1,y:-.6}]
const roundOutline=outlineFromPoints(circle),jawOutline=outlineFromPoints(angular)
const a=buildRoundHead(DEFAULT_FACE,roundOutline),b=buildRoundHead(DEFAULT_FACE,jawOutline)
assert.notDeepEqual(a.head.attributes.position.array,b.head.attributes.position.array,'Face outlines must visibly change the head mesh')
assert(jawOutline[8]-roundOutline[8]>.15,'Distinct jaw silhouettes must retain their width differences')
const fringe=new THREE.Shape();fringe.moveTo(13,22);fringe.lineTo(26,9);fringe.lineTo(39,22);fringe.lineTo(33,26);fringe.lineTo(26,20);fringe.lineTo(19,26);fringe.closePath()
const hair=buildCreatorHair([fringe],{...DEFAULT_FACE,creator:DEFAULT_PARTS},a.head,roundOutline)!
assert(hair);assert([...hair.attributes.position.array].every(Number.isFinite))
assert(hair.boundingBox!.min.z<HEAD_CENTER_Z-.1,'Hair must include a real rounded rear volume')
assert(hair.attributes.position.count<20000,'Hair geometry must stay within the avatar budget')
const rearOnly=buildCreatorHair([],{...DEFAULT_FACE,creator:DEFAULT_PARTS},a.head,roundOutline,[fringe])!
assert(rearOnly&&rearOnly.attributes.position.count>0,'A rear-only hairstyle must retain its volume without a face-shaped ring')
assert.equal(buildCreatorHair([],{...DEFAULT_FACE,creator:DEFAULT_PARTS},a.head,roundOutline,[]),null,'Bald styles do not acquire a generic hair cap')
rearOnly.dispose();a.head.dispose();a.patch.dispose();b.head.dispose();b.patch.dispose();hair.dispose()
console.log('Head and hair passed: distinct jaw/cheek outlines, shaded 3D hair volume, corrected eye mirroring, flip control and saved-avatar migration.')
