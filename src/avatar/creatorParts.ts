export const TOMODACHI_BASE='/assets/personal/tomodachi'
export const PARTS={face:{label:'Face',count:16,start:0,pad:0},hair:{label:'Hair',count:245,start:0,pad:0},eyes:{label:'Eyes',count:81,start:0,pad:0},eyebrows:{label:'Brows',count:43,start:0,pad:0},nose:{label:'Nose',count:32,start:0,pad:0},mouth:{label:'Mouth',count:56,start:0,pad:0},glasses:{label:'Glasses',count:20,start:0,pad:0},mustache:{label:'Moustache',count:16,start:0,pad:0},goatee:{label:'Beard',count:14,start:0,pad:0},ear:{label:'Ears',count:5,start:0,pad:0},makeup:{label:'Makeup',count:8,start:0,pad:0},wrinkles:{label:'Wrinkles',count:15,start:0,pad:0},hairFront:{label:'Front hair',count:84,start:0,pad:0},hairBack:{label:'Back hair',count:59,start:0,pad:0},beardShort:{label:'Stubble',count:15,start:0,pad:0},makeupUpper:{label:'Eye makeup',count:4,start:0,pad:0},wrinklesUpper:{label:'Brow lines',count:9,start:0,pad:0},eyelashUpper:{label:'Top lashes',count:6,start:0,pad:0},eyelashLower:{label:'Lower lashes',count:2,start:0,pad:0},eyelidUpper:{label:'Top lids',count:3,start:0,pad:0},eyelidLower:{label:'Lower lids',count:3,start:0,pad:0},highlight:{label:'Highlights',count:10,start:0,pad:0}} as const
export type PartCategory=keyof typeof PARTS
export const MOVABLE=['eyes','eyebrows','nose','mouth','glasses','mustache']as const
export type MovablePart=typeof MOVABLE[number]
export type Placement={x:number;y:number;scale:number;aspect:number;rotation:number}
export type CreatorParts=Record<PartCategory,number>&{library:2;mirrorHair:boolean;mirrorEyes:boolean;lensOpacity:number;mole:boolean;moleX:number;moleY:number;nickname:string;browsColor:string;glassesColor:string;lipColor:string;placement:Record<MovablePart,Placement>}
export const DEFAULT_PARTS:CreatorParts={...Object.fromEntries(Object.keys(PARTS).map(k=>[k,0])),library:2,face:0,hair:13,eyes:1,eyebrows:1,nose:4,mouth:15,ear:1,mirrorHair:false,mirrorEyes:false,lensOpacity:.14,mole:false,moleX:.055,moleY:-.055,nickname:'PLAYER',browsColor:'#342c35',glassesColor:'#292d40',lipColor:'#ad625e',placement:Object.fromEntries(MOVABLE.map(k=>[k,{x:0,y:0,scale:1,aspect:1,rotation:0}]))} as CreatorParts
export function partUrl(category:PartCategory,id:number){return `${TOMODACHI_BASE}/icons/${category}-${id}${id===0&&category!=='face'?'.svg':'.png'}`}
export function validateCreatorParts(value:unknown):CreatorParts|null{
 if(!value||typeof value!=='object')return null
 const raw=value as Record<string,unknown>
 if(raw.library!==undefined&&raw.library!==2)return null
 let p={mirrorEyes:false,lensOpacity:.14,...raw} as CreatorParts
 if(raw.library===undefined){
  // Earlier SVG creator IDs are migrated to close native choices; colours and proportions survive.
  p={...structuredClone(DEFAULT_PARTS),...raw,library:2,face:Math.max(0,Number(raw.face)-1),hair:Math.min(129,Number(raw.hair)+1),nose:Number(raw.nose),glasses:Number(raw.glasses),mustache:Math.max(0,Number(raw.mustache)-1),goatee:Math.max(0,Number(raw.goatee)-1),makeup:Math.max(0,Number(raw.makeup)-1),wrinkles:Math.max(0,Number(raw.wrinkles)-1)} as CreatorParts
 }
 for(const [key,info]of Object.entries(PARTS)){const v=p[key as PartCategory];if(!Number.isInteger(v)||v<0||v>=info.count)return null}
 if(typeof p.mirrorEyes!=='boolean'||typeof p.mirrorHair!=='boolean'||typeof p.mole!=='boolean'||typeof p.nickname!=='string'||p.nickname.length>16)return null
 if(!Number.isFinite(p.lensOpacity)||p.lensOpacity<0||p.lensOpacity>1)return null
 for(const k of ['browsColor','glassesColor','lipColor']as const)if(!/^#[\da-f]{6}$/i.test(p[k]))return null
 if(!Number.isFinite(p.moleX)||Math.abs(p.moleX)>.12||!Number.isFinite(p.moleY)||Math.abs(p.moleY)>.12)return null
 const placement={} as CreatorParts['placement']
 for(const key of MOVABLE){const a=p.placement?.[key];if(!a)return null
  for(const [name,min,max]of [['x',-.035,.035],['y',-.04,.04],['scale',.5,1.5],['aspect',.5,1.5],['rotation',-.65,.65]]as const)if(!Number.isFinite(a[name])||a[name]<min||a[name]>max)return null
  placement[key]={x:a.x,y:a.y,scale:a.scale,aspect:a.aspect,rotation:a.rotation}
 }
 return {...Object.fromEntries(Object.keys(PARTS).map(k=>[k,p[k as PartCategory]])),library:2,mirrorHair:p.mirrorHair,mirrorEyes:p.mirrorEyes,lensOpacity:p.lensOpacity,mole:p.mole,moleX:p.moleX,moleY:p.moleY,nickname:p.nickname,browsColor:p.browsColor,glassesColor:p.glassesColor,lipColor:p.lipColor,placement} as CreatorParts
}
/** Native PNGs are authored for the eye on canvas-left; the opposite side is mirrored. */
export function eyeIsMirrored(side:number,flip=false){return (side===1)!==flip}
