import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildCombinationFactors } from './combination-factors.js'
import { buildJoinedEffectIndex, lookupJoinedEffects } from './joined-effects.js'
import { getEffectiveBondBonus } from '../bond/bonus.js'
import { regionCacheKey, projectAccountDomain, accountProjectionKey } from '../../native/shared/precompute.js'
import { estimatePrecompute, formatEstimate } from '../../native/shared/precompute-plan.js'
import { solverCacheKey } from './cache.js'
import { recommendTeam, servantBondForms } from '../recommend.js'
const catalog=JSON.parse(readFileSync(new URL('../data/bond-bonuses.json',import.meta.url)))
const event=catalog.events.find(e=>e.id===80520), now=(event.startedAt+3600)*1000
const servants=JSON.parse(readFileSync(new URL('../data/servants.json',import.meta.url))).filter(s=>[100100,100700,200100].includes(s.id))
const ces=[{id:101,cost:2,skills:[{condLimitCount:4,funcs:[{target:'ptFull',rate:200,add:0,tvals:[],andTvals:[]}]}]}]
const formsOf=s=>[{key:'default',cost:s.cost,traitIds:s.traitIds||[]}]
const factors=buildCombinationFactors({servants,ces,formsOf,version:{baseDataVersion:'fixture'}})
const quests=[{id:9001,phase:1,eventId:event.id,bond:100,type:'event'},{id:9002,phase:1,bond:200,type:'free'}]
const bundle={region:'CN',version:{region:'CN',baseDataVersion:'fixture'},servants,ces,quests,bondBonuses:catalog}
const index=buildJoinedEffectIndex({bundle,factorIndex:factors,now})
for(const q of quests){
 const found=lookupJoinedEffects(index,{region:'CN',version:bundle.version,quest:q,bondBonuses:catalog,now})
 assert.ok(found)
 const members=found.scenario.groups.flatMap(g=>g.members).sort((a,b)=>a-b)
 assert.deepEqual(members,factors.members.map((_,i)=>i),'every identity is present exactly once')
 for(const s of servants){const expected=getEffectiveBondBonus({servantId:s.id,catalog,quest:q,now});assert.equal(found.scores[s.id]?.totalSecondLayer||0,expected.totalSecondLayer||0)}
}
assert.equal(buildJoinedEffectIndex({bundle,factorIndex:factors,now,previous:index}),index,'unchanged update does not rebuild')
assert.equal(lookupJoinedEffects(index,{region:'JP',version:bundle.version,quest:quests[0],bondBonuses:catalog,now}),null)
assert.equal(lookupJoinedEffects(index,{region:'CN',version:bundle.version,quest:{...quests[0],flags:['eventDeckNoSupport']},bondBonuses:catalog,now}),null)
assert.equal(lookupJoinedEffects(index,{region:'CN',version:bundle.version,quest:quests[0],bondBonuses:catalog,now:(event.endedAt+1)*1000}),null)
const altered=structuredClone(catalog);altered.questFriendships.push({type:'questFriendship',calcType:'multiplication',rate:.5,allQuests:true,targetIds:[100100],startedAt:1,endedAt:2145888000,name:'新增全局羁绊'})
assert.notEqual(await regionCacheKey(bundle,'CN',now),await regionCacheKey({...bundle,bondBonuses:altered},'CN',now),'activity changes invalidate public cache')
const next=buildJoinedEffectIndex({bundle:{...bundle,bondBonuses:altered},factorIndex:factors,now,previous:index})
assert.notEqual(next.inputSignature,index.inputSignature)
const accountA={id:'a',region:'CN',account:{ok:true,region:'CN',servants:[{id:100100,bondLv:5,maxAscension:4}],ces:[]}}
const accountB={id:'b',region:'CN',account:{ok:true,region:'CN',servants:[{id:100700,bondLv:5,maxAscension:4}],ces:[]}}
const computed={factorIndex:factors,joinedEffectIndex:index}
for(const p of [accountA,accountB]){const projection=projectAccountDomain(computed,bundle,p);assert.ok(projection.members.length);assert.deepEqual(new Set(projection.members.map(i=>factors.members[i].svt)),new Set(p.account.servants.map(s=>s.id)))}
assert.notEqual(await accountProjectionKey('public',accountA),await accountProjectionKey('public',accountB))
assert.notEqual(solverCacheKey({accountProfileId:'a'}),solverCacheKey({accountProfileId:'b'}))
const actualFactors=buildCombinationFactors({servants,ces,formsOf:servantBondForms,version:bundle.version})
const actualJoint=buildJoinedEffectIndex({bundle,factorIndex:actualFactors,now})
const clock=Date.now
Date.now=()=>now
try {
 for(const p of [accountA,accountB]) {
  const opts={base:815,servants,ces,mode:'account',account:p.account,region:'CN',game:{version:bundle.version,quests},quest:quests[0],bondBonuses:catalog,costLimit:113,useInventoryCurveSolver:true,solverAudit:{memo:false}}
  const expected=recommendTeam(opts)
  const projection=projectAccountDomain({factorIndex:actualFactors,joinedEffectIndex:actualJoint},bundle,p)
  const actual=recommendTeam({...opts,factorIndex:actualFactors,joinedEffectIndex:actualJoint,accountProjection:projection,accountProfileId:p.id})
  assert.equal(expected.ok,true,expected.error)
  assert.equal(actual.ok,true,actual.error)
  assert.equal(actual.total,expected.total,'update-time union and account projection must match the original exact scorer')
  assert.ok(actual.slots.filter(s=>s.filled&&!s.isSupport).every(s=>p.account.servants.some(r=>r.id===s.svtId)))
 }
} finally { Date.now=clock }
assert.equal(estimatePrecompute(0).highMs,0)
assert.match(formatEstimate(estimatePrecompute(100000)),/初步估算/)
assert.match(formatEstimate(estimatePrecompute(100000,[{units:50000,durationMs:1200}])),/本机历史/)
console.log('Joint effects: full identity coverage, direct activity oracle, no-op reuse, rule/time/region invalidation, account projection isolation and estimates passed')
