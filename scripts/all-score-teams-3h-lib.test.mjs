import assert from 'node:assert/strict'
import {validateRows} from './all-score-teams-3h-lib.mjs'
const partial={model:'off',status:'timeout',complete:false,maximumProven:true,best:100}
const complete={...partial,status:'complete',complete:true,tiedTeams:2,tiedTeamsSha256:'a'.repeat(64),resultUnit:'equivalence-group'}
assert.deepEqual(validateRows([partial]),[])
assert.deepEqual(validateRows([{...partial,maximumProven:false}]),[])
assert.deepEqual(validateRows([complete,partial]),[])
assert.ok(validateRows([{...partial,complete:true}]).length)
assert.ok(validateRows([{...complete,maximumProven:false}]).length)
assert.ok(validateRows([partial,{...partial,model:'baseline',best:101}]).length)
assert.ok(validateRows([partial,{...partial,model:'baseline',maximumProven:false,best:101}]).length)
assert.ok(validateRows([complete,{...complete,model:'baseline',tiedTeams:3}]).length)
assert.ok(validateRows([complete,{...complete,model:'baseline',resultUnit:'physical-teams'}]).length)
console.log('Pressure result validation: objective proof remains valid during incomplete tie collection; contradictory scores, false completion and mixed output units are rejected')
