import assert from 'node:assert/strict'
import {recommendTeam,createScoreTeamSearch} from '../recommend.js'
import {expandScoreTeamFamily} from './score-team-equivalence.js'
import {literalScoreTeams,physicalTeamKey} from './score-team-oracle-fixture.js'
import {availableEffectUpper,createScoreEffects} from './score-team-effects.js'
import {SEARCH_MODEL} from './ai-model.js'
import {selectQueryModel} from './query-models.js'

let seed=2026102501
const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>8)%n}
const svt=(id)=>({id,collectionNo:id,name:'S'+id,className:'saber',cost:1,rarity:3,traitIds:[10+id%2]})
const card=(id,rate=100,cost=1,target='ptFull',flat=0,trait=0)=>({id,cost,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target,rate:condLimitCount?rate:Math.floor(rate/2),followerRate:condLimitCount?rate*2:rate,add:flat,tvals:trait?[{id:trait}]:[]}]}))})
const decode=key=>({slots:JSON.parse(key).map(([p,f,s,g,svt,art,ce,mlb,bond,reward,bondMlb,rewardMlb])=>({p,f,s,g,svt,art,ce,mlb,bond,reward,bondMlb,rewardMlb}))})
function check(opts){
 let domain;const prepared=recommendTeam({...opts,scoreTeamPrepareOnly:true,onScoreTeamDomain:d=>domain=d})
 if(!prepared.ok)return
 // Independent physical construction, with no score bounds or equivalence
 // grouping. The trusted live settlement evaluates every literal candidate.
 // Expansion uses a JSON catalog round trip, as archived/exported families do.
 const expected=new Set();let best=-Infinity
 for(const key of literalScoreTeams(domain)){
  const plan=domain.hydrate(decode(key));assert.ok(plan?.ok)
  const score=opts.optimizeBy==='prefer'?plan.preferBond:plan.total
  if(score>best){best=score;expected.clear()}if(score===best)expected.add(key)
 }
 for(const compact of [false,true]){
  const q=createScoreTeamSearch({...opts,scoreTeamAudit:{compact}}),actual=new Set();let found=-Infinity
  for(const e of q.iterator)if(e.type==='team'){
   const r=e.record
   if(q.state.phase==='optimizing')assert.ok(r.packed.slots.every(s=>!s.bond),'Optional bond choices are restored in collection, not needed for the proof')
   if(r.score>found){found=r.score;actual.clear()}
   if(r.score===found)for(const p of expandScoreTeamFamily(r,JSON.parse(JSON.stringify(q.equivalenceCatalogs[r.domain]||null)))){
    q.hydrate(p);const key=physicalTeamKey(p.packed)
    assert.ok(!actual.has(key),'Duplicate physical Grand team');actual.add(key)
   }
  }
  assert.equal(q.state.complete,true);assert.equal(q.state.recoveries,0)
  assert.equal(found,best,JSON.stringify({seed,compact,opts}))
  assert.deepEqual(actual,expected,JSON.stringify({seed,compact,opts}))
 }
 return expected.size
}
const base={servants:[svt(1),svt(2)],ces:[card(101),card(102,200)],base:815,costLimit:7,allowSupport:false,
 questType:'grand',questClass:'saber',grandPosition:0,slotPins:[3,5,6].map(position=>({position,empty:true})),aiMode:'off'}
let cases=0,teams=0
for(let i=0;i<96;i++){
 const support=rand(2)===0,servants=[svt(1),svt(2)],ces=Array.from({length:rand(4)},(_,j)=>card(101+j,[0,10,100,300,-100][rand(5)],rand(4),rand(4)?'ptFull':'self',[0,0,1,50][rand(4)],rand(3)?0:11))
 if(i%4===0)ces.push({...card(201,500,0),bondEquipOwner:1})
 if(i%7===0)servants[0].forms=[{key:'c1',cost:2,traitIds:[10]}]
 const accountMode=rand(2)===0,opts={...base,servants,ces,base:[0,1,9,815,1000000000][rand(5)],costLimit:i%5?rand(11):null,
  teapot:rand(2)===0,allowSupport:support,grandPosition:[0,1,2,4][rand(4)],
  quest:support?{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]}:null,
  slotPins:[3,5,...(support?[]:[6])].map(position=>({position,empty:true})),mode:accountMode?'account':'free',
  account:accountMode?{region:'CN',servants:servants.map((s,j)=>({id:s.id,bondLv:j&&rand(4)===0?15:5,bondCap:15,limitCount:4,isGrand:rand(2)===0,unlockedCostumes:[1]})),ces:ces.map(c=>({id:c.id,count:1+rand(2),mlbCount:rand(2)}))}:null}
 if(i%5===0){opts.optimizeBy='prefer';opts.preferSvtIds=[1]}
 if(i%6===0){
  opts.quest={...opts.quest,eventId:999}
  opts.bondBonuses={extraPassives:[
   {servantId:1,eventId:999,skillId:1,target:'self',rate:0.5,startedAt:1,endedAt:4102444800},
   {servantId:2,eventId:999,skillId:2,target:'ptFull',rate:0.3,applySupportSvt:1,startedAt:1,endedAt:4102444800},
   {servantId:2,eventId:999,skillId:3,target:'ptFull',rate:-0.1,applySupportSvt:1,startedAt:1,endedAt:4102444800},
  ],questFriendships:[{eventId:0,allQuests:true,targetIds:[1],rate:0.2,startedAt:1,endedAt:4102444800}]}
 }
 teams+=check(opts)||0;cases++
}
for(const grandPosition of [0,1,2,4])for(const support of [false,true]){
 teams+=check({...base,grandPosition,allowSupport:support,slotPins:[3,5,...(support?[]:[6])].map(position=>({position,empty:true})),
  quest:support?{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]}:null});cases++
}
// Free reward equipment must not be excluded by an exhausted normal budget.
teams+=check({...base,servants:[svt(1)],ces:[card(101,800,100)],base:100,costLimit:1,grandPosition:1,slotPins:[2,3,4,5,6].map(position=>({position,empty:true}))});cases++
assert.equal(availableEffectUpper([{left:1,v:10},{left:3,v:2}],3,c=>c.v),14)
assert.equal(availableEffectUpper([{left:0,v:100},{left:2,v:2}],3,c=>c.v),4)
function collect(opts,audit={}){
 const q=createScoreTeamSearch({...opts,scoreTeamAudit:audit}),keys=new Set();let best=-Infinity
 assert.ok(q.ok,q.error)
 for(const e of q.iterator)if(e.type==='team'){
  if(e.record.score>best){best=e.record.score;keys.clear()}
  if(e.record.score===best)for(const r of expandScoreTeamFamily(e.record,JSON.parse(JSON.stringify(q.equivalenceCatalogs[e.record.domain]||null)))){
   q.hydrate(r);const key=physicalTeamKey(r.packed)+'|'+JSON.stringify(r.packed.external||[])
   assert.ok(!keys.has(key),'No duplicate expanded family');keys.add(key)
  }
 }
 assert.equal(q.state.complete,true);assert.equal(q.state.recoveries,0)
 return {q,best,keys}
}
// Quest-rule domains: fixed guests, multi-CE guests, multiple active Grand
// seats and active self/party/campaign effects use their actual final scorer.
const account={region:'CN',servants:base.servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4,isGrand:true})),ces:[101,102].map(id=>({id,count:2,mlbCount:1}))}
const guest={id:9,svtId:900,name:'NPC',required:true,releaseConditions:[],script:{eventDeckIndex:3},equips:[{ceId:101,ceMlb:false,ce:card(101)},{ceId:102,ceMlb:true,ce:card(102,200)}]}
let extendedCases=0
for(const live of [false,true])for(const guests of [false,true])for(const multiGrand of [false,true]){
 const opts={...base,mode:'account',account,questType:multiGrand?'normal':'grand',grandPosition:0,
  quest:{eventId:999,flags:guests?['noSupportList']:[],supportServants:guests?[guest]:[],
   restrictions:[{type:'mySvtNum',rangeType:'equal',targetVals:[2]},...(multiGrand?[{type:'activeGrandBoard',targetVals:[1,2]}]:[])]},
  slotPins:[4,5,6].map(position=>({position,empty:true})),
  bondBonuses:live?{extraPassives:[{servantId:1,eventId:999,skillId:1,target:'self',rate:0.5,startedAt:1,endedAt:4102444800},
   {servantId:900,eventId:999,skillId:2,target:'ptFull',rate:0.3,applySupportSvt:1,startedAt:1,endedAt:4102444800}],questFriendships:[]}:null}
 const reference=collect(opts,{bounds:false,guidance:false,compact:false}),bounded=collect(opts)
 assert.equal(bounded.best,reference.best);assert.deepEqual(bounded.keys,reference.keys);extendedCases++
}
// Each selected model makes one decision across probing and both passes;
// turning AI off makes none. Scores and every recoverable physical tie agree.
let aiCases=0
for(const extended of [false,true]){
 const opts={...base,servants:base.servants.map((s,i)=>({...s,cost:1+i})),mode:'account',account,grandPosition:1,slotPins:[3,4,5,6].map(position=>({position,empty:true})),
  quest:extended?{noSupport:true,restrictions:[{type:'mySvtNum',rangeType:'equal',targetVals:[2]}]}:{}}
 const reference=collect(opts)
 assert.equal(reference.q.state.ai?.inferenceCalls||0,0)
 for(const model of ['baseline','teacher','neural-large']){
  const r=collect({...opts,aiMode:'on',aiModel:selectQueryModel(SEARCH_MODEL,model)})
  assert.equal(r.q.state.ai?.inferenceCalls,1,model+' single-query inference');assert.ok(r.q.state.ai.ranked>0,model+' policy actually ranks candidates');assert.equal(r.best,reference.best);assert.deepEqual(r.keys,reference.keys);aiCases++
 }
}
{
 const row={svt:svt(1),form:{key:'default',traitIds:[11]}}
 const d={rows:[row]},c=card(101,200),a=createScoreEffects(d)(c)
 // Cached table contents are reused across passes and projected correctly
 // when rows are compressed. Stocks are deliberately not in this cache.
 Object.defineProperty(c,'skills',{get(){throw Error('A second pass must reuse the effect table')}})
 const b=createScoreEffects({...d,guidanceSource:d})(c)
 assert.deepEqual(a,b);assert.equal(a.rates[0],200)
}
console.log(JSON.stringify({passed:true,cases,extendedCases,aiCases,physicalOptimalTeams:teams,seed:2026102501,scope:'Independent literal Grand construction; bounds plus reversible member/seat groups, stock/MLB, self/conditional/negative effects, ignored bond slot, free costly rewards, support rewards, aura, preferred objective and exact floors'}))
