import {PARTS,TOMODACHI_BASE,type PartCategory} from './creatorParts'
export type NativePart={name:string;model:string|null;sprite:string|null;icon:string;rotation:number;texture?:string}
export type TomodachiCatalog={version:2;revision:string;categories:Record<PartCategory,NativePart[]>}
export function assetUrl(path:string){if(!/^[a-zA-Z0-9_./-]+$/.test(path)||path.includes('..')||path.startsWith('/'))throw new Error('Invalid local avatar asset path');return TOMODACHI_BASE+'/'+path}
export function validateCatalog(raw:unknown):TomodachiCatalog{
 const d=raw as TomodachiCatalog
 if(d?.version!==2||typeof d.revision!=='string')throw new Error('Tomodachi asset catalog is not installed')
 for(const [key,info]of Object.entries(PARTS)){
  const items=d.categories?.[key as PartCategory];if(!Array.isArray(items)||items.length!==info.count)throw new Error('Tomodachi asset catalog does not match this creator')
  for(const item of items){if(typeof item.name!=='string'||!Number.isFinite(item.rotation))throw new Error('Invalid avatar part');for(const file of [item.icon,item.model,item.sprite,item.texture])if(file)assetUrl(file)}
 }
 return d
}
let pending:Promise<TomodachiCatalog>|null=null
export function loadTomodachiCatalog(){if(!pending){pending=fetch(TOMODACHI_BASE+'/catalog.json').then(r=>{if(!r.ok)throw new Error('Install the local Tomodachi Life assets first');return r.json()}).then(validateCatalog);pending.catch(()=>{pending=null})}return pending}
/** A GLB can contain base, hat and baked-flipped trees. Render exactly one authored tree. */
export function nativeRoots(names:string[],mirror=false,helmeted=false){const hats=names.filter(n=>n.includes('Hat')),base=helmeted&&hats.length?hats:names.filter(n=>!n.includes('Hat')),flipped=base.filter(n=>n.endsWith('_Flip'));return mirror&&flipped.length?{names:flipped,mirror:false}:{names:base.filter(n=>!n.endsWith('_Flip')),mirror}}

export const NATIVE_HEAD_CENTER_Y=.3375736773
export function nativeY(worldY:number,faceHeight:number){return NATIVE_HEAD_CENTER_Y+worldY/(.5*faceHeight)}
