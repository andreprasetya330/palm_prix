import assert from 'node:assert/strict'
import {DEFAULT_FACE,profileFromLandmarks,validateFaceProfile,saveFaceProfile,loadFaceProfile,clearFaceProfile} from '../src/avatar/faceProfile'
import {buildFaceGeometry} from '../src/avatar/faceGeometry'
const points=Array.from({length:478},()=>({x:.5,y:.5,z:0}))
for(const [index,x,y]of [[234,.34,.5],[454,.66,.5],[10,.5,.28],[152,.5,.72],[172,.37,.65],[397,.63,.65],[33,.39,.47],[133,.45,.47],[362,.55,.47],[263,.61,.47],[1,.5,.54],[98,.47,.56],[327,.53,.56],[61,.44,.63],[291,.56,.63]])points[index]={x,y,z:0}
const colors={skin:'#a27563',hair:'#282333'},profile=profileFromLandmarks(points,512,512,colors)
assert(validateFaceProfile(profile))
const transformed=points.map(p=>({x:.5+(p.x-.5)*1.1+.01,y:.5+(p.y-.5)*1.1-.02,z:0}))
const larger=profileFromLandmarks(transformed,512,512,colors)
for(const key of ['faceWidth','faceHeight','jaw','eyeSpacing','eyeSize','noseWidth','mouthWidth']as const)assert(Math.abs(profile[key]-larger[key])<1e-9,'Likeness proportions must be independent of crop scale and position')
assert.throws(()=>profileFromLandmarks([],512,512,colors),/incomplete/)
assert.throws(()=>profileFromLandmarks(points.map(()=>({x:.5,y:.5,z:0})),512,512,colors),/closer/)
assert.equal(validateFaceProfile({...DEFAULT_FACE,skin:'javascript:bad'}),null)
assert.equal(validateFaceProfile({...DEFAULT_FACE,jaw:999}),null)
assert.equal(validateFaceProfile({...DEFAULT_FACE,eyeSize:NaN}),null)
assert.equal(validateFaceProfile({...DEFAULT_FACE,version:4}),null)
const storage=new Map<string,string>()
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)}})
assert(saveFaceProfile(profile));assert.deepEqual(loadFaceProfile(),profile)
const saved=[...storage.values()][0]
assert(saved.length<600&&!saved.includes('landmarks')&&!saved.includes('data:image'),'Save only stylized settings, never the photo or raw face landmarks')
clearFaceProfile();assert.equal(loadFaceProfile(),null)
const face=buildFaceGeometry(profile),different=buildFaceGeometry({...profile,jaw:.8,eyeSpacing:1.2,glasses:true})
assert(face.attributes.position.count<8000,'Personalized face should stay lightweight')
assert([...face.attributes.position.array].every(Number.isFinite))
assert(face.boundingBox!.max.x<.21&&face.boundingBox!.max.y<.23&&face.boundingBox!.min.y>-.26,'The face must fit the helmet aperture and collar')
assert.notDeepEqual(face.attributes.position.array,different.attributes.position.array,'Avatar settings must actually change the 3D mesh')
face.dispose();different.dispose()
console.log('Face customizer passed: scale-independent scan measurements, validation, local save/clear, no stored photos and bounded personalized 3D geometry.')
