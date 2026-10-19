import assert from 'node:assert/strict'
import { createLearnedSearch, searchFeatures, validSearchModel } from './ai-search.js'
import { SEARCH_MODEL } from './ai-model.js'
import { createQuerySession, QUERY_PROFILES, validQueryPolicy } from './query-ai.js'
import { solveInventoryCurves } from './inventory-curve-solver.js'
import { createFrameworkBound } from './framework-bound.js'
import { recommendTeam } from '../recommend.js'
import { makeSearchCase } from '../../scripts/ai-search-cases.mjs'

const querySession=createQuerySession(),features=searchFeatures({rates:[100,250],cost:3})
const first=createLearnedSearch({mode:'on',querySession,equipmentFeatures:[features],servantFeatures:[features]})
const frozen=querySession.decision
assert.equal(querySession.inferenceCalls,1)
for(let i=0;i<10000;i++)first.score(i%2?'equipment':'servant',features)
const fallback=createLearnedSearch({mode:'on',querySession,servantFeatures:[searchFeatures({cost:20})]})
assert.equal(querySession.inferenceCalls,1,'scoring and switching engines must reuse the one decision')
assert.equal(querySession.decision,frozen)
assert.ok(Object.isFrozen(frozen))
assert.equal(fallback.stats.inferenceCalls,1)
assert.equal(first.stats.ranked,10000,'rule evaluations are separate from model inference')

const old=structuredClone(SEARCH_MODEL);delete old.queryPolicy
assert.ok(validSearchModel(old),'old model envelopes remain readable')
assert.equal(createLearnedSearch({mode:'on',model:old}).stats.enabled,false,'never fall back to per-item neural inference')
for(const policy of [null,{}, {...SEARCH_MODEL.queryPolicy,tree:{profile:999}},
  {...SEARCH_MODEL.queryPolicy,tree:{feature:99,threshold:0,left:{profile:0},right:{profile:1}}}])
  assert.equal(validQueryPolicy(policy),false)
for(const mode of ['off','auto']){
  const session=createQuerySession(),s=createLearnedSearch({mode,querySession:session,size:0})
  for(let i=0;i<20;i++)s.score('equipment',features)
  assert.equal(session.inferenceCalls,0)
}

let feasible=0,checks=0
for(let i=0;i<80;i++){
  const {opts,id}=makeSearchCase(27000000+i,{real:i%3===0,larger:i>=60})
  opts.allSupportAlternatives=i%2===0
  const baseline=solveInventoryCurves({...opts,aiMode:'off'})
  for(const aiFramework of ['off','on']){
    const r=solveInventoryCurves({...opts,aiMode:'on',aiFramework})
    assert.equal(Boolean(r),Boolean(baseline),id)
    if(!r)continue
    feasible++;assert.deepEqual([r.score,r.cost],[baseline.score,baseline.cost],id)
    assert.equal(r.certificate.ai.inferenceCalls,1,id+' must perform exactly one model inference')
    assert.ok(r.certificate.ai.initialRange.upper>=baseline.score,id+' certified initial upper bound')
    if(r.certificate.ai.initialStart){
      assert.equal(r.certificate.ai.initialRange.lower,r.certificate.ai.initialStart.score)
      assert.ok(r.certificate.ai.initialStart.score<=baseline.score)
      assert.ok(opts.costLimit==null||r.certificate.ai.initialStart.cost<=opts.costLimit)
    }
    if(opts.allSupportAlternatives){
      const alternatives=x=>Object.fromEntries(x.plans.map(p=>{const s=p.slots.find(s=>s.s);return [(s?.ce||0)+':'+(s?.p||0),[p.score,p.cost]]}))
      assert.deepEqual(alternatives(r),alternatives(baseline),id+' equal scores/COST and support alternatives')
    }
    checks++
  }
}
assert.ok(feasible>80)

// An inventory engine can reject a domain AFTER the query decision. General
// fallback and other system-support alternatives still share that decision.
{
  const session=createQuerySession(),opts=makeSearchCase(9918001).opts
  assert.equal(solveInventoryCurves({...opts,supportCes:[],requireSupportEquipment:true,aiMode:'on',querySession:session}),null)
  assert.equal(session.inferenceCalls,1)
  createLearnedSearch({mode:'on',querySession:session,servantFeatures:[features]})
  assert.equal(session.inferenceCalls,1)
}

// The public entry point reports CURRENT query calls, including cache hits,
// rather than repeating the inference count stored with the cached result.
const servants=Array.from({length:7},(_,i)=>({id:100+i,collectionNo:100+i,name:'S'+i,className:'saber',rarity:3,cost:i?4:0,traitIds:[100]}))
const opts={servants,ces:[],base:815,costLimit:12,useInventoryCurveSolver:true,aiMode:'on',accountProfileId:'one-query-inference-test'}
const initial=recommendTeam(opts),cached=recommendTeam(opts)
assert.ok(initial.ok&&cached.ok)
assert.equal(initial.queryStats.aiInferenceCalls,1)
assert.equal(cached.queryStats.aiInferenceCalls,0)
assert.equal(cached.resultStatus.ai.inferenceCalls,0)
assert.equal(recommendTeam({...opts,aiMode:'off'}).queryStats.aiInferenceCalls,0)
assert.equal(recommendTeam({...opts,skipResultCache:true,useInventoryCurveSolver:false}).queryStats.aiInferenceCalls,1,'general search uses one query decision too')
const quest={supportPolicy:'either',supportServants:[9,10].map(id=>({id,svtId:id,name:'NPC'+id,traitIds:[100],equips:[]}))}
const multiple=recommendTeam({...opts,quest,skipResultCache:true})
assert.ok(multiple.ok,multiple.error)
assert.equal(multiple.queryStats.aiInferenceCalls,1,'friend and multiple system-support choices share ONE query inference')

// Independently enumerate every legal party/seat to check that each FIXED
// price selected by the query model remains a safe upper bound.
const vectors=[0,150,400,800].map((self,i)=>({self,aura:0,maxed:i===3}))
const rows=vectors.map((_,i)=>({vector:i,svt:{id:i+1},cost:[0,1,4,6][i]}))
const layout={position:6,positions:[1,2,4],front:[1,2],back:[4]}
for(const profile of QUERY_PROFILES)for(const budget of [0,1,3,7,12])for(const flat of [0,50]){
  const upper=createFrameworkBound({rows,vectors,seats:[layout],base:1000,cap:3,policy:{factor:profile.upperFactor}})
  const bound=upper({rate:[100,200,300,400],flat,aura:0,support:[0,0,0,0],budget,threshold:-Infinity})
  let exact=0
  function enumerate(i,f,b,cost,score){
    if(cost>budget)return
    exact=Math.max(exact,score)
    if(i===rows.length)return
    enumerate(i+1,f,b,cost,score)
    const second=1000+100*(i+1)+vectors[i].self
    const value=vectors[i].maxed?0:Math.floor(1200*second/1000)+flat
    if(f<2)enumerate(i+1,f+1,b,cost+rows[i].cost,score+value)
    if(b<1)enumerate(i+1,f,b+1,cost+rows[i].cost,score+(vectors[i].maxed?0:Math.floor(1000*second/1000)+flat))
  }
  enumerate(0,0,0,0,0)
  assert.ok(bound>=exact,JSON.stringify({profile:profile.name,budget,flat,bound,exact}))
}
console.log(JSON.stringify({singleQueryInference:true,exactComparisons:checks,cacheInferenceCalls:0,candidateRuleEvaluations:10000,passed:true}))
