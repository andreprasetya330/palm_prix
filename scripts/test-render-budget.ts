import assert from 'node:assert/strict'
import {RenderBudget} from '../src/game/renderBudget'
const budget=new RenderBudget()
for(let i=0;i<600;i++)budget.sample(1/60)
assert.equal(budget.scale,1,'A stable 60fps must retain full resolution')
for(let i=0;i<160;i++)budget.sample(1/8)
assert.ok(Math.abs(budget.scale-.65)<1e-6,'Sustained 8fps must reduce resolution rather than be ignored')
for(let i=0;i<1800;i++)budget.sample(1/90)
assert.equal(budget.scale,1,'Resolution should recover gradually when rendering has headroom')
const suspended=new RenderBudget()
for(let i=0;i<30;i++){suspended.sample(1/8,true);suspended.sample(5)}
assert.equal(suspended.scale,1,'Hidden tabs and suspension cannot lower image quality')
assert.equal(suspended.sample(NaN),null)
console.log('Render budget passed: full-quality60fps, sustained8fps recovery, fast-device restoration and suspension.')
