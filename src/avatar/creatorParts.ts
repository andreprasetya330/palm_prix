export const PARTS={face:{label:'Face',count:12,start:1,pad:2},hair:{label:'Hair',count:132,start:0,pad:0},eyebrows:{label:'Brows',count:24,start:1,pad:2},eyes:{label:'Eyes',count:60,start:1,pad:2},nose:{label:'Nose',count:18,start:1,pad:2},mouth:{label:'Mouth',count:36,start:1,pad:2},glasses:{label:'Glasses',count:20,start:0,pad:0},mustache:{label:'Moustache',count:6,start:1,pad:0},goatee:{label:'Beard',count:6,start:1,pad:0},makeup:{label:'Makeup',count:12,start:1,pad:2},wrinkles:{label:'Wrinkles',count:12,start:1,pad:2},hat:{label:'Headwear',count:9,start:1,pad:2}} as const
export type PartCategory=keyof typeof PARTS
export const MOVABLE=['eyes','eyebrows','nose','mouth','glasses','mustache']as const
export type MovablePart=typeof MOVABLE[number]
export type Placement={x:number;y:number;scale:number;aspect:number;rotation:number}
export type CreatorParts=Record<PartCategory,number>&{mirrorHair:boolean;mirrorEyes:boolean;mole:boolean;moleX:number;moleY:number;nickname:string;browsColor:string;glassesColor:string;lipColor:string;placement:Record<MovablePart,Placement>}
export const DEFAULT_PARTS:CreatorParts={face:2,hair:33,eyes:1,eyebrows:1,nose:1,mouth:23,glasses:0,mustache:1,goatee:1,makeup:1,wrinkles:1,hat:0,mirrorHair:false,mirrorEyes:false,mole:false,moleX:.055,moleY:-.055,nickname:'PLAYER',browsColor:'#342c35',glassesColor:'#292d40',lipColor:'#ad625e',placement:Object.fromEntries(MOVABLE.map(k=>[k,{x:0,y:0,scale:1,aspect:1,rotation:0}])) as CreatorParts['placement']}
export function partUrl(category:PartCategory,id:number){const p=PARTS[category];return `/assets/personal/mii-maker/${category}-${String(id).padStart(p.pad,'0')}.svg`}
export function validateCreatorParts(value:unknown):CreatorParts|null{
 if(!value||typeof value!=='object')return null
 const p={mirrorEyes:false,...value} as CreatorParts
 for(const [key,info]of Object.entries(PARTS)){
  const v=p[key as PartCategory],min=key==='hat'?0:info.start
  if(!Number.isInteger(v)||v<min||v>=info.start+info.count)return null
 }
 if(typeof p.mirrorEyes!=='boolean'||typeof p.mirrorHair!=='boolean'||typeof p.mole!=='boolean'||typeof p.nickname!=='string'||p.nickname.length>16)return null
 for(const k of ['browsColor','glassesColor','lipColor']as const)if(!/^#[\da-f]{6}$/i.test(p[k]))return null
 if(!Number.isFinite(p.moleX)||Math.abs(p.moleX)>.12||!Number.isFinite(p.moleY)||Math.abs(p.moleY)>.12)return null
 const placement={} as CreatorParts['placement']
 for(const key of MOVABLE){const a=p.placement?.[key];if(!a)return null
  for(const [name,min,max]of [['x',-.035,.035],['y',-.04,.04],['scale',.5,1.5],['aspect',.5,1.5],['rotation',-.65,.65]]as const)if(!Number.isFinite(a[name])||a[name]<min||a[name]>max)return null
  placement[key]={x:a.x,y:a.y,scale:a.scale,aspect:a.aspect,rotation:a.rotation}
 }
 return {...Object.fromEntries(Object.keys(PARTS).map(k=>[k,p[k as PartCategory]])),mirrorHair:p.mirrorHair,mirrorEyes:p.mirrorEyes,mole:p.mole,moleX:p.moleX,moleY:p.moleY,nickname:p.nickname,browsColor:p.browsColor,glassesColor:p.glassesColor,lipColor:p.lipColor,placement} as CreatorParts
}

export function eyeIsMirrored(side:number,flip=false){return (side===-1)!==flip}
