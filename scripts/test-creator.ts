import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {DEFAULT_PARTS,PARTS,partUrl,validateCreatorParts,eyeIsMirrored} from '../src/avatar/creatorParts'
import {DEFAULT_FACE,validateFaceProfile} from '../src/avatar/faceProfile'
import {assetUrl,nativeRoots,validateCatalog,nativeY,NATIVE_HEAD_CENTER_Y} from '../src/avatar/tomodachiAssets'
import {tintNativePixels,orientNativePixels} from '../src/avatar/tomodachiPixels'
assert.equal(PARTS.face.count,16);assert.equal(PARTS.hair.count,245)
assert.equal(PARTS.eyes.count,81);assert.equal(PARTS.ear.count,5)
const good=validateCreatorParts(DEFAULT_PARTS)!
assert(good);assert.deepEqual(good,DEFAULT_PARTS);assert.notEqual(good.placement,DEFAULT_PARTS.placement)
for(const [category,info]of Object.entries(PARTS)){
 assert.equal(validateCreatorParts({...DEFAULT_PARTS,[category]:info.count}),null)
 assert(!partUrl(category as keyof typeof PARTS,0).includes('..'))
}
for(const bad of [{library:3},{nickname:'x'.repeat(17)},{glassesColor:'url(evil)'},{moleX:Infinity},{lensOpacity:9},{eyes:1.5},{placement:{...DEFAULT_PARTS.placement,eyes:{x:0,y:0,scale:999,aspect:1,rotation:0}}}])assert.equal(validateCreatorParts({...DEFAULT_PARTS,...bad}),null)
const legacy={...DEFAULT_PARTS,face:4,hair:33,mustache:1,goatee:1,makeup:1,wrinkles:1} as Record<string,unknown>;delete legacy.library;delete legacy.lensOpacity
const migrated=validateCreatorParts(legacy)!
assert(migrated?.library===2&&migrated.face===3&&migrated.hair===34)
assert.equal(migrated.nickname,DEFAULT_PARTS.nickname)
assert.equal(migrated.lensOpacity,.14)
const profile=validateFaceProfile({...DEFAULT_FACE,creator:DEFAULT_PARTS})!
assert.deepEqual(validateFaceProfile(JSON.parse(JSON.stringify(profile))),profile)
assert.equal(validateFaceProfile({...DEFAULT_FACE,creator:{eyes:1}}),null)
assert.equal(validateFaceProfile({...DEFAULT_FACE,creator:null})?.creator,null)
assert(!eyeIsMirrored(-1)&&eyeIsMirrored(1),'Native sprites must mirror on canvas-right')
assert(eyeIsMirrored(-1,true)&&!eyeIsMirrored(1,true),'Manual flip must reverse both eye orientations')
assert.throws(()=>assetUrl('../private'));assert.throws(()=>assetUrl('https://example.com/file'))
assert.deepEqual(nativeRoots(['MiiHair000','MiiHairHat000','MiiHair000_Flip','MiiHairHat000_Flip'],false),{names:['MiiHair000'],mirror:false})
assert.deepEqual(nativeRoots(['MiiHair000','MiiHairHat000','MiiHair000_Flip'],true),{names:['MiiHair000_Flip'],mirror:false})
assert.deepEqual(nativeRoots(['MiiHair000','MiiHairHat000'],true),{names:['MiiHair000'],mirror:true})
assert.deepEqual(nativeRoots(['MiiHair000','MiiHairHat000','MiiHairHat000_Flip'],false,true),{names:['MiiHairHat000'],mirror:false},'Racing uses exactly one compressed hat-compatible hairstyle')
for(const height of [.88,1,1.12])assert(Math.abs((nativeY(.027,height)-NATIVE_HEAD_CENTER_Y)*(.5*height)-.027)<1e-9,'Eye and eyewear anchors must preserve world height across head scaling')
const eye=tintNativePixels(new Uint8ClampedArray([0,0,255,255,0,255,0,255,0,0,0,255]),'Eye','#336699')
assert.deepEqual([...eye],[51,102,153,255,255,255,255,255,0,0,0,255],'Native eye masks must preserve iris colour, white sclera and dark outlines')
assert.equal(tintNativePixels(new Uint8ClampedArray([0,255,0,0]),'BeardShort','#123456')[3],255,'Stubble coverage can be in the green channel')
assert.equal(tintNativePixels(new Uint8ClampedArray([0,0,0,255]),'Eyebrow','#123456')[3],0,'Empty mask pixels must stay transparent')
const strand=tintNativePixels(new Uint8ClampedArray([255,255,0,255]),'Hair','#303030');assert(strand[0]===strand[1]&&strand[1]===strand[2]&&strand[3]===255,'Packed red/green hair masks must become neutral strands, never red or green hair')
const row=new Uint8ClampedArray([1,2,3,4,5,6,7,8]);assert.deepEqual([...orientNativePixels(row,2,1,'Highlight')],[5,6,7,8,1,2,3,4]);assert.equal(orientNativePixels(row,2,1,'Eye'),row)
const catalogPath='public/assets/personal/tomodachi/catalog.json'
if(existsSync(catalogPath)){
 const catalog=validateCatalog(JSON.parse(readFileSync(catalogPath,'utf8'))),base='public/assets/personal/tomodachi/'
 for(const items of Object.values(catalog.categories))for(const item of items)for(const path of [item.model,item.sprite,item.icon,item.texture])if(path)assert(existsSync(base+path),`Missing native asset ${path}`)
 const hashes=new Set<string>()
 for(const item of catalog.categories.face){
  const bytes=readFileSync(base+item.model!),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length).toString()),bin=bytes.subarray(28+length)
  const head=doc.meshes.find((m:{name:string})=>m.name.startsWith('Head')),mask=doc.meshes.find((m:{name:string})=>m.name.startsWith('Mask'))
  assert(head&&mask,'Every native head must retain its authored head and face-mask geometry')
  const a=doc.accessors[head.primitives[0].attributes.POSITION],view=doc.bufferViews[a.bufferView],start=(view.byteOffset??0)+(a.byteOffset??0)
  hashes.add(createHash('sha256').update(bin.subarray(start,start+a.count*12)).digest('hex'))
  assert(doc.nodes.some((n:{name:string})=>n.name==='set_hair')&&doc.nodes.some((n:{name:string})=>n.name==='set_nose'),'Native attachment sockets must survive conversion')
 }
 assert.equal(hashes.size,16,'All sixteen choices must use different real head meshes')
}
console.log('Tomodachi creator passed: native catalogue, all head meshes/sockets, single hair variants, RGB mask tinting, eye orientation, migration and photo-free settings.')
