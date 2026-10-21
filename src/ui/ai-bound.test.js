import assert from 'node:assert/strict'
import {aiBoundText} from './ai-bound.js'
assert.equal(aiBoundText(null),'')
assert.equal(aiBoundText({enabled:false,initialLowerBound:100}),'')
assert.equal(aiBoundText({enabled:true,initialLowerBound:null}),'')
assert.equal(aiBoundText({enabled:true,initialLowerBound:Infinity}),'')
assert.match(aiBoundText({enabled:true,initialLowerBound:100,lowerBoundPruned:5,seedReused:2}),/下界 100 · 下界剪枝 5 · 已核实起点复用 2 次/)
assert.match(aiBoundText({enabled:true,initialLowerBound:100,scoreMultiplier:2}),/下界 200/)
assert.match(aiBoundText({enabled:true,initialLowerBound:0}),/下界 0/)
assert.match(aiBoundText({enabled:true,initialLowerBound:100,initialUpperBound:250,dpStatePruned:12,scoreMultiplier:2}),/安全上界 500 · DP 状态跳过 12/)
assert.match(aiBoundText({enabled:true,initialLowerBound:100,inferenceCalls:1}),/本次 AI 调用 1 次/)
assert.match(aiBoundText({enabled:true,initialLowerBound:100,inferenceCalls:0}),/本次 AI 调用 0 次/)
console.log('AI bound display: verified-only values, zero, missing results and teapot units passed')
