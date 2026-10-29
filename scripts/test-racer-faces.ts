import assert from 'node:assert/strict'
import {DEFAULT_PLAYER_FACE,RIVAL_FACES} from '../src/avatar/racerFaces'
import {validateFaceProfile} from '../src/avatar/faceProfile'
assert(DEFAULT_PLAYER_FACE.creator&&validateFaceProfile(DEFAULT_PLAYER_FACE))
assert.equal(RIVAL_FACES.length,5)
assert(RIVAL_FACES.every(face=>face.creator&&validateFaceProfile(face)))
assert.equal(new Set(RIVAL_FACES.map(p=>JSON.stringify(p))).size,5)
for(const key of ['face','hair','eyes','mouth']as const)assert(new Set(RIVAL_FACES.map(p=>p.creator![key])).size>=4,`${key} must vary across CPU faces`)
assert(RIVAL_FACES.every(p=>p.creator!==DEFAULT_PLAYER_FACE.creator))
console.log('PASS native default player and five unique validated Mii-style CPU face presets')
