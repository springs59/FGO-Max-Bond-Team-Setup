import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { collectSharedPlans, libraryRevision, exportQueries, importQueries } from './query-library.js'
import { ensureAccountMatches, matchedCurveSeeds } from './account-plan-matches.js'
import { recommendTeam, createReuseEvaluator } from '../recommend.js'
import { emptyRosterFilter } from '../filter.js'
import { evaluateBondCurve } from './bond-curve.js'

const servants=[0,6,120,3].map((cost,i)=>({id:100+i,collectionNo:100+i,name:'S'+i,className:i===3?'archer':'saber',
  attribute:'man',rarity:1,cost,traitIds:[i===3?2:1]}))
const ce=(id,cost,rate,add=0)=>({id,cost,skills:[0,4].map(condLimitCount=>({condLimitCount,
  funcs:[{target:'ptFull',rate:condLimitCount?rate:rate/2,add}]}))})
const ces=[ce(10,5,0,50),ce(20,12,500)]
const physical=(members,equipment=[])=>({ok:true,slots:Array.from({length:6},(_,i)=>({position:i+1,
  filled:i<members.length||i===5,isSupport:i===5,svtId:i<members.length?members[i]:0,
  svtArtKey:'default',ceId:equipment[i]||0,ceMlb:true}))})
const sources=[physical([100]),physical([100],[10]),physical([100],[20]),physical([102],[20]),physical([101]),
  physical([100,101],[10,10]),physical([103],[10])]
await collectSharedPlans({plans:sources})
const account={region:'CN',servants:servants.map(s=>({id:s.id,bondLv:1,bondCap:10})),ces:ces.map(c=>({id:c.id,count:1,mlb:true}))}
const opts={servants,ces,region:'CN',account,mode:'account',accountProfileId:'A',base:1000,costLimit:20,
  useInventoryCurveSolver:true,allowSupport:true}
const [first,concurrent]=await Promise.all([ensureAccountMatches(opts),ensureAccountMatches(opts)])
assert.equal(first.generation,concurrent.generation,'concurrent windows share one committed projection')
assert.equal(first.matched,6,'copy inventory must reject the two-portrait plan')
assert.equal(first.maxCost,132,'the account projection is not limited to COST 95')
let key
for(const base of [1,1000])for(const costLimit of [0,5,20,95,132,200,null]) {
  const current={...opts,base,costLimit},fitted=await matchedCurveSeeds(current)
  key ||= fitted.info.contextKey
  assert.equal(fitted.info.contextKey,key,'base and COST changes reuse the same exact curve family')
  assert.ok(fitted.plans.every(p=>createReuseEvaluator(current)([p]).length===1))
  const cold=recommendTeam({...current,skipResultCache:true}),warm=recommendTeam({...current,reusePlans:fitted.plans,skipResultCache:true})
  assert.equal(warm.ok,cold.ok)
  if(cold.ok)assert.equal(warm.total,cold.total,`cold parity B=${base} COST=${costLimit}`)
  assert.equal(fitted.info.complete,false,'candidate coverage must never claim a search proof')
  const legal=createReuseEvaluator({...current,costLimit:null})(sources.filter((_,i)=>i!==5))
    .filter(p=>costLimit==null||p.costUsed<=costLimit)
  const seeded=createReuseEvaluator(current)(fitted.plans)
  assert.equal(Math.max(-1,...seeded.map(p=>p.total)),Math.max(-1,...legal.map(p=>evaluateBondCurve(p.curve,base).total)))
}
const other={...opts,accountProfileId:'B',account:{...account,servants:account.servants.filter(s=>s.id===101),ces:[]}}
assert.equal((await ensureAccountMatches(other)).matched,1)
assert.equal((await ensureAccountMatches(opts)).generation,first.generation,'profiles remain separate')
const filtered=emptyRosterFilter();filtered.svtClass.options=['archer']
const fit=await matchedCurveSeeds({...opts,filter:filtered})
assert.ok(fit.plans.every(p=>p.slots.filter(s=>s.filled&&!s.isSupport).every(s=>s.svtId===103)))
assert.notEqual(fit.info.contextKey,key)
const archive=await exportQueries(),revision=await libraryRevision()
await importQueries(archive.blob)
assert.equal(await libraryRevision(),revision,'duplicate imports do not invalidate matched profiles')
await collectSharedPlans({plans:[physical([100,101])]})
assert.ok(await libraryRevision()>revision)
assert.notEqual((await ensureAccountMatches(opts)).generation,first.generation,'new physical plans trigger rematching')
const updated={...opts,account:{...account,servants:account.servants.filter(s=>s.id!==102)}}
assert.ok((await ensureAccountMatches(updated)).maxCost<120,'account refresh invalidates the old high-cost membership')
console.log('Account curve projection: all COSTs, crossing bases, constrained cold parity, stock, multi-account isolation and invalidation passed')
