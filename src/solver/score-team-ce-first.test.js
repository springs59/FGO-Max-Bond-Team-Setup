import assert from 'node:assert/strict'
import {createScoreTeamSearch,recommendTeam} from '../recommend.js'
import {literalScoreTeams,physicalTeamKey} from './score-team-oracle-fixture.js'
import {expandScoreTeamFamily} from './score-team-equivalence.js'
import {createScoreTeamController} from './score-team-worker.js'
import {SEARCH_MODEL} from './ai-model.js'
import {selectQueryModel} from './query-models.js'

const servant=(id,cost=1)=>({id,collectionNo:id,name:'S'+id,className:'saber',rarity:3,cost,traitIds:[10+id%2]})
const card=(id,rate=100,cost=1,trait=0)=>({id,cost,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate:condLimitCount?rate:Math.floor(rate/2),tvals:trait?[{id:trait}]:[]}]}))})
const servants=[servant(1),servant(2,2)],ces=[card(101),card(102,300,2,11)]
const account={region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4,isGrand:true,unlockedCostumes:[1]})),ces:[{id:101,count:2,mlbCount:1},{id:102,count:2,mlbCount:1}]}
const base={servants,ces,account,mode:'account',base:81,costLimit:7,allowSupport:false,aiMode:'off',slotPins:[3,4,5,6].map(position=>({position,empty:true}))}
const decode=key=>({slots:JSON.parse(key).map(([p,f,s,g,svt,art,ce,mlb,bond,reward,bondMlb,rewardMlb])=>({p,f,s,g,svt,art,ce,mlb,bond,reward,bondMlb,rewardMlb}))})
let cases=0,totalTies=0,fastProofs=0
function check(opts,{fallback}={}){
 let d
 const prepared=recommendTeam({...opts,scoreTeamPrepareOnly:true,onScoreTeamDomain:value=>d=value})
 if(!prepared.ok){const q=createScoreTeamSearch(opts);assert.equal(q.ok,false);assert.equal(q.error,prepared.error);cases++;return}
 if(opts.servants.some(s=>s.forms?.some(f=>f.key==='c1'))&&opts.spriteMode!=='strict_order')assert.ok(d.rows.some(r=>r.form.key==='c1'),'The form/identity oracle actually includes the alternate form')
 const expected=new Set();let maximum=-Infinity
 for(const key of literalScoreTeams(d)){
  const plan=d.hydrate(decode(key));assert.ok(plan?.ok)
  const value=opts.optimizeBy==='prefer'?plan.preferBond:plan.total
  if(value>maximum){maximum=value;expected.clear()}if(value===maximum)expected.add(key)
 }
 for(const compact of [false,true]){
  const q=createScoreTeamSearch({...opts,scoreTeamAudit:{compact,ceFirst:'force'}}),actual=new Set()
  for(const event of q.iterator)if(event.type==='team'){
   assert.notEqual(q.state.phase,'optimizing','CE-first improvements are previews, not duplicate family archive rows')
   q.hydrate(event.record)
   if(event.record.score!==maximum)continue
   const catalog=JSON.parse(JSON.stringify(q.equivalenceCatalogs[event.record.domain]||null))
   for(const record of expandScoreTeamFamily(event.record,catalog)){
    q.hydrate(record);const key=physicalTeamKey(record.packed)
    assert.ok(!actual.has(key),'A proof witness must not duplicate any collected physical team');actual.add(key)
   }
  }
  assert.equal(q.state.bestScore,maximum,JSON.stringify(opts));assert.deepEqual(actual,expected,JSON.stringify(opts))
  assert.equal(q.state.complete,true);assert.equal(q.state.maximumProven,expected.size>0);assert.equal(q.state.recoveries,0)
  if(fallback)assert.equal(q.state.stats.ceFirstFallback,fallback)
  else if(expected.size){assert.equal(q.state.stats.ceFirstProofs,1);assert.equal(q.state.stats.ceFirstFallback,undefined);fastProofs++}
 }
 cases++;totalTies+=expected.size
}

for(const grand of [false,true])for(const support of [false,true])for(const prefer of [false,true]){
 check({...base,questType:grand?'grand':'normal',questClass:'saber',grandPosition:grand?1:0,allowSupport:support,
  quest:support?{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]}:null,slotPins:base.slotPins.filter(p=>!support||p.position!==6),
  optimizeBy:prefer?'prefer':'total',preferSvtIds:prefer?[1]:[]})
}
// A capped provider still contributes its aura. A required low-scoring ID
// cannot be discarded by top-F reduction, and separate forms share one ID.
for(const capped of [false,true])for(const teapot of [false,true]){
 const a={...account,servants:account.servants.map(s=>({...s,bondLv:s.id===1?15:5,bondCap:s.id===1?(capped?15:20):10}))}
 check({...base,account:a,bond15Aura:true,teapot,lockSvtIds:[1],servants:[{...servants[0],forms:[{key:'c1',cost:3,traitIds:[10]}]},servants[1]]})
}
check({...base,slotPins:[{position:2,svtId:2},...[3,4,5,6].map(position=>({position,empty:true}))]})
check({...base,questType:'grand',questClass:'saber',grandPosition:4,slotPins:[{position:4,svtId:1},...[2,3,5,6].map(position=>({position,empty:true}))]})
check({...base,servants:[servant(1)],account:{...account,servants:[account.servants[0]],ces:[{id:101,count:1,mlbCount:1}]},ces:[card(101,800,100)],costLimit:1,questType:'grand',questClass:'saber',grandPosition:1,
 slotPins:[2,3,4,5,6].map(position=>({position,empty:true}))})
// All concrete IDs/forms and zero-effect CEs remain in the collector, even
// though the proof can use one top-F subset and leave optional CEs empty.
for(const value of [0,1,1000000000])check({...base,mode:'free',account:null,servants:[1,2,3,4].map(id=>servant(id)),ces:[card(101,0,0)],base:value,costLimit:6})

for(const grand of [false,true])for(const prefer of [false,true]){
 const svts=[1,2,3,4].map(id=>servant(id,id===1?1:2))
 svts[1].forms=[{key:'c1',cost:1,traitIds:[11]}]
 const a={...account,servants:svts.map(s=>({id:s.id,bondLv:s.id===1?15:5,bondCap:15,isGrand:s.id===1,unlockedCostumes:[1]})),ces:[{id:101,count:2,mlbCount:1}]}
 check({...base,servants:svts,ces:[card(101,200,1,11)],account:a,costLimit:9,
  questType:grand?'grand':'normal',questClass:'saber',grandPosition:grand?4:0,
  optimizeBy:prefer?'prefer':'total',preferSvtIds:prefer?[2,3]:[],lockSvtIds:[1],
  slotPins:[{position:4,svtId:1},...[3,5,6].map(position=>({position,empty:true}))]})
}
{
 const svts=[1,2,3,4,5,6].map(id=>servant(id))
 svts[0].forms=[{key:'c1',cost:1,traitIds:[10]}]
 // Exercise every position bit without multiplying this case by equivalent
 // cosmetic forms; the cases above independently cover form/ID interactions.
 check({...base,servants:svts,ces:[],account:{...account,servants:svts.map(s=>({id:s.id,bondLv:s.id===1?15:5,bondCap:15})),ces:[]},costLimit:10,slotPins:[],spriteMode:'strict_order'})
}

let seed=2026102502
const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>8)%n}
for(let i=0;i<72;i++){
 const grand=rand(2)===0,support=rand(2)===0
 const svts=[servant(1,rand(4)),servant(2,rand(4))]
 const cards=[card(101,rand(4)*100,rand(4),rand(2)?11:0),card(102,rand(4)*100,rand(4),rand(2)?10:0)]
 const a={...account,servants:account.servants.map(s=>({...s,bondLv:rand(4)?5:15,bondCap:15})),ces:cards.map(c=>({id:c.id,count:1+rand(2),mlbCount:rand(2)}))}
 check({...base,servants:svts,ces:cards,account:a,base:[0,1,81,815][rand(4)],costLimit:i%5?rand(11):null,teapot:rand(2)===0,
  questType:grand?'grand':'normal',questClass:'saber',grandPosition:grand?[0,1,2][rand(3)]:0,allowSupport:support,
  optimizeBy:i%3?'total':'prefer',preferSvtIds:i%3?[]:[1],lockSvtIds:i%5?[]:[2],
  quest:support?{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]}:null,slotPins:base.slotPins.filter(p=>!support||p.position!==6)})
}

// Fallback preserves the original legal domain instead of silently removing
// wearer/flat/event effects or fixed equipment from automatic candidates.
for(const own of ['self','conditional-flat','negative']){
 const c=card(101)
 for(const s of c.skills){if(own==='self')s.funcs[0].target='self';if(own==='conditional-flat'){s.funcs[0].add=50;s.funcs[0].tvals=[{id:11}]}if(own==='negative')s.funcs[0].rate=-100}
 const opts={...base,ces:[c],slotPins:base.slotPins}
 // The general search is independently checked too; its improvements are
 // legitimately archived, so do not apply the proof-preview assertion here.
 const reference=createScoreTeamSearch({...opts,scoreTeamAudit:{ceFirst:false}}),q=createScoreTeamSearch(opts)
 const collect=x=>{const keys=new Set();for(const e of x.iterator)if(e.type==='team')for(const r of expandScoreTeamFamily(e.record,x.equivalenceCatalogs[e.record.domain]))keys.add(e.record.score+'|'+physicalTeamKey(r.packed));return keys}
 const expected=collect(reference),actual=collect(q)
 assert.equal(q.state.stats.ceFirstFallback,'wearer-or-conditional-flat');assert.deepEqual(actual,expected)
}
for(const [opts,reason] of [
 [{...base,pinCes:[{svtId:1,ceId:101}]},'equipment-pins'],
 [{...base,quest:{eventId:999},bondBonuses:{extraPassives:[{servantId:1,eventId:999,skillId:1,target:'self',rate:0.5,startedAt:1,endedAt:4102444800}],questFriendships:[]}},'live-effects'],
 [{...base,quest:{noSupport:true,restrictions:[{type:'mySvtNum',rangeType:'equal',targetVals:[2]}]}},'quest-rules'],
 [{...base,servants:[servant(1,100000),servant(2,100000)],costLimit:200000},'state-limit'],
]){
 const q=createScoreTeamSearch({...opts,scoreTeamAudit:{ceFirst:'force'}});for(const _ of q.iterator){}
 assert.equal(q.state.stats.ceFirstFallback,reason);assert.equal(q.state.complete,true)
}

for(const large of [false,true]){
 const opts=large?{...base,mode:'free',account:null,servants:Array.from({length:16},(_,i)=>servant(i+1))}:base
 function finalTeams(audit){
  const q=createScoreTeamSearch({...opts,scoreTeamAudit:audit}),keys=new Set();let best=-Infinity
  for(const event of q.iterator)if(event.type==='team'){
   if(event.record.score>best){best=event.record.score;keys.clear()}
   if(event.record.score===best)for(const r of expandScoreTeamFamily(event.record,q.equivalenceCatalogs[event.record.domain]))keys.add(physicalTeamKey(r.packed))
  }
  return {q,keys}
 }
 const auto=finalTeams({}),reference=finalTeams({ceFirst:false})
 assert.deepEqual(auto.keys,reference.keys);assert.equal(auto.q.state.bestScore,reference.q.state.bestScore)
 if(large)assert.equal(auto.q.state.stats.ceFirstProofs,1)
 else assert.equal(auto.q.state.stats.ceFirstFallback,'small-domain')
}

for(const model of ['baseline','teacher','neural-large']){
 const q=createScoreTeamSearch({...base,questType:'grand',questClass:'saber',grandPosition:1,aiMode:'on',aiModel:selectQueryModel(SEARCH_MODEL,model),scoreTeamAudit:{ceFirst:'force'}})
 for(const _ of q.iterator){}
 assert.equal(q.state.ai.inferenceCalls,1);assert.ok(q.state.stats.ceFirstAIRanked>0);assert.equal(q.state.stats.ceFirstProofs,1)
}

// Stop after a DP improvement, before any archived family, and at the proof
// boundary. Both states retain a usable preview and honest proof/export flags.
for(const atProof of [false,true]){
 const events=[];let controller,first
 controller=createScoreTeamController({yieldTask:async()=>{},post:m=>{
  events.push(m)
  if(m.type!=='score-progress')return
  if(m.preview)first??=m.preview.total
  if(atProof?m.progress.phase==='collecting':m.preview&&m.preview.total>first)controller.cancel(99)
 }})
 await controller.start(99,{...base,scoreTeamAudit:{ceFirst:'force'}})
 const stopped=events.find(e=>e.type==='score-stopped')?.result.value
 assert.ok(stopped?.ok);assert.equal(stopped.scoreTeamResults.complete,false);assert.equal(stopped.scoreTeamResults.maximumProven,atProof)
 assert.equal(stopped.scoreTeamResults.bestCount,0);assert.equal(stopped.scoreTeamResults.previewOnly,true)
 await controller.exportTeams({id:99})
 const exported=events.at(-1);assert.equal(exported.ok,true)
 const header=JSON.parse((await(await fetch(exported.url)).text()).trim());URL.revokeObjectURL(exported.url)
 assert.equal(header.maximumProven,atProof);assert.equal(header.feasiblePreview.total,stopped.total)
}
console.log(JSON.stringify({passed:true,cases,fastProofs,physicalOptimalTeams:totalTies,seed:2026102502,scope:'CE-first proof versus independent literal enumeration; full collected ties and JSON catalogs; ordinary/Grand, shared CE stock/MLB, optional slots, forms, required identities, preferred objective, aura totals, exact floors, safe fallbacks, one AI inference, stop and export'}))
