import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'
import {observeHair,matchHair,creatorFromScan,HAIR_COLS,HAIR_ROWS,type HairIndex} from '../src/avatar/hairMatching'
import {DEFAULT_FACE,validateFaceProfile} from '../src/avatar/faceProfile'
import {nativeEyeHeight,nativeY,NATIVE_HEAD_CENTER_Y} from '../src/avatar/tomodachiAssets'
const width=160,height=160,mask=new Float32Array(width*height),pixels=new Uint8ClampedArray(width*height*4)
const points=Array.from({length:478},()=>({x:.5,y:.5}));points[10]={x:.5,y:.35};points[152]={x:.5,y:.8};points[234]={x:.3,y:.55};points[454]={x:.7,y:.55}
function photo(colour:number[]){for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const hair=x>42&&x<118&&(y>22&&y<57||y>=57&&y<135&&(x<53||x>107))
 mask[y*width+x]=hair?.97:0
 pixels.set([...(hair?colour:[5,10,20]),255],(y*width+x)*4)
}}
photo([68,42,24]);const dark=observeHair(mask,width,height,pixels,width,height,points)
assert.equal(dark.colour,'#442a18','Hair colour must come from the actual mask, excluding a darker background')
assert(dark.coverage>.1&&dark.long&&dark.confidence>.9)
photo([230,215,160]);const fair=observeHair(mask,width,height,pixels,width,height,points)
assert.equal(fair.colour,'#e6d7a0','Fair hair must not become dark because the background is dark')
mask.fill(0);const bald=observeHair(mask,width,height,pixels,width,height,points);assert.equal(bald.coverage,0);assert.equal(bald.colour,null)
const simple:HairIndex={version:1,cols:HAIR_COLS,rows:HAIR_ROWS,styles:[{id:0,mask:'0'.repeat(672)},{id:1,mask:dark.mask},{id:2,mask:'0'.repeat(672)}]}
assert.equal(matchHair(dark,simple)[0].id,1);assert.equal(matchHair(bald,simple)[0].id,0)
const asymmetric=Array.from({length:672},(_,i)=>i%24<6&&Math.floor(i/24)<19?'1':'0').join('')
const mirrored=Array.from({length:28},(_,y)=>asymmetric.slice(y*24,(y+1)*24).split('').reverse().join('')).join('')
assert(matchHair({...dark,mask:mirrored},{...simple,styles:[{id:14,mask:asymmetric}]})[0].mirror,'Side parting must survive matching rather than forcing a fixed direction')
const native=creatorFromScan({...DEFAULT_FACE,hair:'#e6d7a0',eyeShape:'round'},[{id:60,mirror:true,score:.8}])
assert.equal(native.hair,60);assert(native.mirrorHair);assert.equal(native.browsColor,'#e6d7a0');assert.equal(native.eyes,4)
assert(validateFaceProfile({...DEFAULT_FACE,creator:native}))
assert(nativeEyeHeight(DEFAULT_FACE.eyeHeight)<.01,'Native eyes must sit below their old upper-face baseline')
for(const faceHeight of [.88,1,1.12]){
 const y=(nativeY(nativeEyeHeight(DEFAULT_FACE.eyeHeight),faceHeight)-NATIVE_HEAD_CENTER_Y)*(.5*faceHeight)
 assert(Math.abs(y-.005)<1e-9,'Eye and glasses anchors must retain calibrated height across head shapes')
}
const indexPath='public/assets/personal/tomodachi/hair-match.json'
if(existsSync(indexPath)){
 const index:HairIndex=JSON.parse(readFileSync(indexPath,'utf8'))
 assert.equal(index.styles.length,245);assert(index.styles.every(s=>/^[01]{672}$/.test(s.mask)))
 assert(new Set(index.styles.map(s=>s.mask)).size>100,'The local index must represent different hair silhouettes')
 const unique=index.styles.find(s=>s.id>0&&index.styles.filter(o=>o.mask===s.mask).length===1)!
 assert.equal(matchHair({...dark,mask:unique.mask},index)[0].id,unique.id,'A real native silhouette must recover its own catalogue choice')
}
console.log('PASS segmented hair colour, background rejection, fair/long/bald hair, silhouette selection, mirrored parts, native scan choices and lower eye calibration')
