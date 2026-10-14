import assert from 'node:assert/strict'
import {globalCandidate} from './query-global-candidate.js'
import {globalCurveValue} from './global-envelope.js'
import {evaluateBondCurve} from './bond-curve.js'
for(const frontShare of [0,40,80])for(const flat of [0,100]){
  const r=[2,0,1,4,2,0,0,60,1380,1510,0,1250,1000,0],meta={supports:[{frontShare,flat}]}
  const candidate=globalCandidate(r,meta,{kind:'effects',queryId:'key'})
  for(const base of [0,1,799,800,801,1000,1e9])assert.equal(evaluateBondCurve(candidate.curve,base).total,globalCurveValue(r,meta,base))
}
console.log('Formation journal observations: exact curve settlement across front shares, flat bonuses and seven bases passed')
