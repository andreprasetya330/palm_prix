import assert from 'node:assert/strict'
import {BOOST_PADS,RACE_TOKENS,createCourseRewards,crossedPad,updateCourseRewards} from '../src/game/courseFeatures'
import {nearestTrack,ROAD_HALF_WIDTH} from '../src/game/trackLayout'
for(const feature of [...BOOST_PADS,...RACE_TOKENS])assert(nearestTrack(feature.x,feature.z).distance<ROAD_HALF_WIDTH-1,'Pickups must be inside the driveable road')
const pad=BOOST_PADS[0],from={x:pad.x-pad.tx*12,z:pad.z-pad.tz*12},to={x:pad.x+pad.tx*12,z:pad.z+pad.tz*12}
assert(crossedPad(pad,from.x,from.z,to.x,to.z),'Fast driving must not skip a boost strip')
assert(!crossedPad(pad,from.x+pad.nx*8,from.z+pad.nz*8,to.x+pad.nx*8,to.z+pad.nz*8),'Parallel lanes outside a pad must not trigger it')
const rewards=createCourseRewards()
assert(updateCourseRewards(rewards,0,from.x,from.z,to.x,to.z,30,.05))
assert(!updateCourseRewards(rewards,0,from.x,from.z,to.x,to.z,30,.05),'A single strip cannot repeatedly retrigger before cooldown')
assert(!updateCourseRewards(createCourseRewards(),0,pad.x,pad.z,pad.x,pad.z,0,.05),'Parking on a strip cannot farm a boost')
const token=RACE_TOKENS[0],tokens=createCourseRewards()
updateCourseRewards(tokens,0,token.x,token.z,token.x,token.z,0,.02)
assert.equal(tokens.coins,1)
updateCourseRewards(tokens,0,token.x,token.z,token.x,token.z,0,.02)
assert.equal(tokens.coins,1,'A token only counts once per lap')
updateCourseRewards(tokens,1,token.x,token.z,token.x,token.z,0,.02)
assert.equal(tokens.coins,2,'Tokens return for the next lap')
console.log('Course feature checks passed: road placement, swept boost collision, cooldown, lane selection and once-per-lap rewards.')
