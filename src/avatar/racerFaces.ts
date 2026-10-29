import {DEFAULT_FACE,type FaceProfile} from './faceProfile'
import {DEFAULT_PARTS} from './creatorParts'
export const DEFAULT_PLAYER_FACE:FaceProfile={...DEFAULT_FACE,creator:structuredClone(DEFAULT_PARTS)}
const presets=[
 {skin:'#e6b08b',hair:'#402a42',face:3,style:60,eyes:8,brows:4,nose:4,mouth:15},
 {skin:'#b97858',hair:'#e8c976',face:8,style:2,eyes:4,brows:9,nose:2,mouth:4},
 {skin:'#d6a079',hair:'#192a4a',face:1,style:21,eyes:12,brows:15,nose:7,mouth:22},
 {skin:'#845544',hair:'#27202f',face:11,style:109,eyes:17,brows:2,nose:3,mouth:29},
 {skin:'#e5c5ab',hair:'#d8ccdd',face:5,style:150,eyes:1,brows:21,nose:10,mouth:8},
]
export const RIVAL_FACES:FaceProfile[]=presets.map((p,i)=>({...DEFAULT_FACE,skin:p.skin,hair:p.hair,facialHairColor:p.hair,eyes:['#73514b','#435c4d','#38517f','#61463b','#746394'][i],eyeSize:.94+i*.025,creator:{...structuredClone(DEFAULT_PARTS),face:p.face,hair:p.style,eyes:p.eyes,eyebrows:p.brows,nose:p.nose,mouth:p.mouth,browsColor:p.hair,glasses:i===2?2:0,goatee:i===3?1:0,mustache:i===3?2:0}}))
