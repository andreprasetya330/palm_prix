import assert from 'node:assert/strict'
import {readFileSync,readdirSync,existsSync} from 'node:fs'
import {dirname,resolve,extname} from 'node:path'
import {OPTIONAL_CIRCUIT_MODEL,isRequiredAssetError} from '../src/game/assetErrors'
assert(!isRequiredAssetError(OPTIONAL_CIRCUIT_MODEL),'Missing optional local model must not block its procedural fallback')
assert(!isRequiredAssetError(`http://localhost:4173${OPTIONAL_CIRCUIT_MODEL}`))
assert(isRequiredAssetError('/assets/racers/Textures/colormap.png'),'Required texture failures must remain visible')
const base=resolve('public/assets')
let models=0,resources=0
function visit(directory:string){
 for(const entry of readdirSync(directory,{withFileTypes:true})){
  const file=resolve(directory,entry.name)
  if(entry.isDirectory()){if(entry.name!=='personal')visit(file);continue}
  if(extname(file)!=='.glb')continue
  models++
  const bytes=readFileSync(file)
  assert.equal(bytes.toString('ascii',0,4),'glTF')
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)))
  for(const resource of [...(json.images??[]),...(json.buffers??[])]){
    if(!resource.uri||resource.uri.startsWith('data:'))continue
    assert(!/^https?:/.test(resource.uri),'Race model resources must be locally hosted')
    const target=resolve(dirname(file),decodeURIComponent(resource.uri))
    assert(target.startsWith(base),'Model resource must stay within the asset pack')
    assert(existsSync(target),`Missing model resource: ${target}`)
    assert(readFileSync(target).length>0);resources++
  }
 }
}
visit(base)
assert.equal(models,15,'Ship five racers, two support vehicles, one scanned barrier and seven licensed scenic models')
assert(readFileSync(resolve(base,'festival/LICENSE.txt'),'utf8').includes('CC0'))
const license=readFileSync(resolve(base,'racers/LICENSE.txt'),'utf8')
assert(license.includes('CC0')&&license.includes('commercial'))
const credits=readFileSync(resolve(base,'ASSET-CREDITS.md'),'utf8')
for(const author of ['Kenney','Rob Tuytel','Amal Kumar'])assert(credits.includes(author))
assert(!readdirSync(resolve(base,'racers')).some(name=>/mario|luigi|source\.glb/.test(name)),'Extracted commercial-game models must not be shipped')
console.log(`Asset checks passed: ${models} licensed GLBs, ${resources} local dependencies, original license and named credits.`)

for(const name of ['cliff-diff.jpg','cliff-normal.jpg','cloud-panorama.png']) {
  const bytes=readFileSync(resolve(base,'cloud-carnival',name))
  assert(bytes.length>10000,`Invalid cloud artwork: ${name}`)
  assert(name.endsWith('.png') ? bytes.toString('ascii',1,4)==='PNG' : bytes[0]===255&&bytes[1]===216)
}
assert(readFileSync(resolve(base,'cloud-carnival/LICENSE.txt'),'utf8').includes('Jenelle van Heerden'))
assert(readFileSync(resolve(base,'cloud-carnival/ARTWORK.md'),'utf8').includes('AI-generated'))

const personalCredits=readFileSync(resolve(base,'personal/CREDITS.md'),'utf8')
assert(personalCredits.includes('not CC0')&&personalCredits.includes('Nintendo'))
for(const name of ['teddy-buggy','sweet-balloon','aqua-cups','circuit-special']){
 const path=resolve(base,'personal',`${name}.glb`)
 if(!existsSync(path))continue
 const bytes=readFileSync(path),json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)))
 assert.equal(bytes.toString('ascii',0,4),'glTF')
 assert(json.meshes?.length>0)
 assert((json.images??[]).every((image:{uri?:string})=>!image.uri||image.uri.startsWith('data:')),'Personal model textures must be embedded')
 if(name==='circuit-special'){
  const nodes=json.nodes.map((n:{name?:string})=>n.name)
  for(const node of ['body','driver','driver-face','wheel-front-left','wheel-front-right','wheel-rear-left','wheel-rear-right'])assert(nodes.includes(node),`Missing Circuit racer part ${node}`)
  assert.equal(nodes.filter((n:string)=>/^wheel-(front|rear)-(left|right)$/.test(n)).length,4)
  assert(!nodes.some((n:string)=>/LOD|Armature/.test(n)),'Overlapping LODs and skeletal runtime cost must be removed')
  const materials=json.materials.map((m:{name?:string})=>m.name)
  assert(materials.includes('TeamBody')&&materials.includes('TeamSuit'),'Preserve independently tintable kart and suit atlases')
  assert.equal(json.skins?.length??0,0,'Driver must be baked into seated pose')
  assert(bytes.length<2_000_000,'Shared racer with embedded maps should stay below 2MB')
  const primitives=json.meshes.flatMap((m:{primitives:unknown[]})=>m.primitives)
  assert(primitives.length<=10,'Each racer should need at most ten material draws')
  const triangles=primitives.reduce((sum:number,p:{indices:number})=>sum+json.accessors[p.indices].count/3,0)
  assert(triangles<20000,'Six racers must retain a modest geometry budget')
  assert(personalCredits.includes('BillyGaming964')&&personalCredits.includes('Centrixe the Dodo')&&personalCredits.includes('342345')&&personalCredits.includes('351442'))
  console.log(`Circuit racer checks passed: embedded atlases, posed driver, four wheel pivots, ${Math.round(triangles)} triangles, ${primitives.length} material draws.`)
 }
}
