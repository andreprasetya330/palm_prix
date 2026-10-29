import type {FaceProfile} from './faceProfile'
const luminance=(hex:string)=>[.2126,.7152,.0722].reduce((sum,weight,i)=>sum+parseInt(hex.slice(1+i*2,3+i*2),16)*weight,0)
/** Conservative visible-hair estimate. Lighting and very fair hair may need manual correction. */
export function inferFacialHair(skin:string,upperLip:string[],jaw:string[]):Pick<FaceProfile,'facialHair'|'facialHairColor'>{
 const baseline=Math.max(20,luminance(skin))
 const dark=(samples:string[],threshold:number)=>samples.filter(c=>luminance(c)/baseline<threshold)
 const upper=dark(upperLip,.45),lower=dark(jaw,.6)
 const facialHair=lower.length>=3?'beard':upper.length>=3?'moustache':'none'
 const samples=[...upper,...lower].sort((a,b)=>luminance(a)-luminance(b))
 return {facialHair,facialHairColor:samples[Math.floor(samples.length/2)]??'#38303a'}
}
