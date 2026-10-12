import assert from 'node:assert/strict'
import {canonical,describeQuery,sharedPlanOf} from './query-library.js'
import {recommendTeam} from '../recommend.js'
import {solverCacheKey} from './cache.js'
assert.equal(canonical({b:2,a:{z:1,a:3},ignore:undefined}),canonical({a:{a:3,z:1},b:2}))
const slots=Array.from({length:6},(_,i)=>({position:i+1,filled:i<3||i===5,isSupport:i===5,svtId:i<3?100+i:0,ceId:0,ceMlb:true,bondLv:15,bondCap:16}))
const clean=sharedPlanOf({ok:true,total:99999,accountProfileId:'owner',slots})
assert.equal(clean.total,undefined);assert.equal(clean.slots[0].bondLv,undefined)
const a=await describeQuery('shared-plan',clean)
const b=await describeQuery('shared-plan',sharedPlanOf({ok:true,total:1,slots:slots.map(s=>({...s,bondLv:1,bondCap:10}))}))
assert.equal(a.queryId,b.queryId,'physical schemes must be account-independent')
assert.notEqual(solverCacheKey({priorities:[{kind:'cost'}]}),solverCacheKey({priorities:[]}))
assert.notEqual(solverCacheKey({spriteMode:'strict_order'}),solverCacheKey({spriteMode:'bond_first'}))
const servants=Array.from({length:7},(_,i)=>({id:100+i,collectionNo:100+i,name:'S'+i,className:'saber',rarity:5,cost:i===6?1:i?16:3,traitIds:[100]}))
const account={servants:servants.map(s=>({id:s.id,bondLv:1,bondCap:10})),ces:[]}
const opts={servants,ces:[],account,mode:'account',base:1000,costLimit:20,useInventoryCurveSolver:true}
const first=recommendTeam({...opts,account:{...account,servants:account.servants.slice(0,6)}})
const seeds=(first.plans||[first]).map(sharedPlanOf)
for(const costLimit of [1,3,19,20,35,100])for(const teapot of [false,true]) {
  const conditions={...opts,costLimit,teapot,solverAudit:{defaultDp:true}}
  const cold=recommendTeam(conditions),seeded=recommendTeam({...conditions,reusePlans:seeds})
  assert.equal(seeded.ok,cold.ok)
  if(cold.ok){assert.equal(seeded.total,cold.total);assert.equal(seeded.costUsed,cold.costUsed)}
}
const legal=recommendTeam({...opts,reuseOnly:true,reusePlans:seeds})
assert.equal(legal.ok,true);assert.equal(legal.resultStatus.optimality,'candidate')
for(const extra of [{costLimit:1},{allowSupport:false},{slotPins:[{position:1,empty:true}]},{lockSvtIds:[106]}]) {
  assert.equal(recommendTeam({...opts,...extra,reuseOnly:true,reusePlans:seeds}).ok,false)
}
const refreshed=await describeQuery('bond',{...opts,accountProfileId:'a'})
assert.equal(refreshed.queryId,(await describeQuery('bond',{...opts,accountProfileId:'b',account:{...account,QP:1,updatedAt:123}})).queryId)
assert.notEqual(refreshed.queryId,(await describeQuery('bond',{...opts,account:{...account,questClears:[{id:1,clearNum:1}]}})).queryId)
console.log('Shared library: account-free identity, query invalidation, legal candidate calls and 12 seeded/cold exact comparisons passed')
