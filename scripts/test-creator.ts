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
