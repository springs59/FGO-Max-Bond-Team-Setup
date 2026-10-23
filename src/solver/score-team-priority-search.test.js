import assert from 'node:assert/strict'
import {prioritizeScoreTeamDomain} from './score-team-priority-search.js'
import {enumerateScoreTeamPhases} from './score-team-phases.js'
import {recommendTeam,createScoreTeamSearch} from '../recommend.js'
import {literalScoreTeams,physicalTeamKey} from './score-team-oracle-fixture.js'
import {createScoreTeamController} from './score-team-worker.js'
import {scorePressureFixture} from '../../scripts/score-first-pressure-fixtures.mjs'

// A bounded sample must not be mistaken for objective proof, including an
// empty sample. A winner omitted by sampling remains reachable in exact search.
for(const emptySample of [false,true])for(const enabled of [false,true]){
 const state={bestScore:-Infinity,phase:'optimizing',recoveries:0,stats:{nodes:0,evaluated:0}},visits=[]
 const d={grand:true,rows:Array(13).fill({}),ownCes:[],supportCes:[],optimizeBy:'total',
  ownTypes:[{left:2}],hydrate:p=>({ok:true,total:p.value})}
 function* enumerate(domain,s){
  visits.push({sample:!!s.guidanceOnly,phase:s.phase})
  if(s.guidanceOnly){
   assert.equal(domain.ownTypes,undefined)
   if(emptySample)return
   for(let i=0;i<200;i++){s.stats.nodes++;s.stats.evaluated++;yield {type:'team',score:10,packed:{id:'sample'+i,value:10}}}
  }else for(const id of ['winner-a','winner-b']){s.stats.nodes++;s.stats.evaluated++;yield {type:'team',score:30,packed:{id,value:30}}}
 }
 const records=[]
 for(const e of enumerateScoreTeamPhases({domains:[d],state,enumerateDomain:(d,s)=>prioritizeScoreTeamDomain(d,s,enumerate,{enabled,now:()=>0})})){
  if(e.type==='phase'){assert.ok(visits.some(v=>!v.sample&&v.phase==='optimizing'));assert.equal(state.bestScore,30)}
  if(e.type==='team')records.push(e.record)
 }
 assert.equal(state.maximumProven,true);assert.equal(state.complete,true)
 assert.deepEqual(records.filter(r=>r.score===30).map(r=>r.packed.id).sort(),['winner-a','winner-b'])
 assert.equal(new Set(records.map(r=>r.packed.id)).size,records.length)
 assert.ok((state.stats.guidanceEvaluated||0)<=64)
 assert.equal(d.ownTypes[0].left,2)
 assert.equal(visits.some(v=>v.sample),enabled)
}

const ce=(id,rate,trait=0)=>({id,name:'CE'+id,cost:1,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate,tvals:trait?[{id:trait}]:[]}]}))})
const servants=[1,2].map(id=>({id,collectionNo:id,name:'S'+id,className:'saber',rarity:1,cost:1,traitIds:[10+id]}))
const base={servants,ces:[ce(101,100),ce(102,300,11),ce(103,200)],mode:'account',
 account:{region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4})),ces:[101,102,103].map(id=>({id,count:2,mlbCount:1}))},
 base:81,costLimit:5,allowSupport:true,questType:'grand',questClass:'saber',grandPosition:1,
 quest:{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]},slotPins:[3,4,5].map(position=>({position,empty:true})),aiMode:'off',scoreTeamAudit:{compact:false}}
let cases=0,ties=0
for(const extra of [{},{optimizeBy:'prefer',preferSvtIds:[1]},{slotPins:[...base.slotPins,{position:1,svtId:1,ceId:101,ceRewardId:101}]},
 {allowSupport:false,quest:{noSupport:true,restrictions:[{type:'mySvtNum',rangeType:'equal',targetVals:[2]}]},
  account:{...base.account,servants:base.account.servants.map(s=>({...s,isGrand:s.id===1}))}},
 {account:{...base.account,servants:base.account.servants.map(s=>({...s,bondLv:s.id===1?15:5,bondCap:s.id===1?15:10}))}}]){
 const opts={...base,...extra};let d
 recommendTeam({...opts,scoreTeamPrepareOnly:true,onScoreTeamDomain:value=>{d=value}})
 const legal=literalScoreTeams(d),expected=new Set();let best=-Infinity
 for(const key of legal){
  const slots=JSON.parse(key).map(([p,f,s,g,svt,art,ce,mlb,bond,reward,bondMlb,rewardMlb])=>({p,f,s,g,svt,art,ce,mlb,bond,reward,bondMlb,rewardMlb}))
  const plan=d.hydrate({slots}),score=opts.optimizeBy==='prefer'?plan.preferBond:plan.total
  if(score>best){best=score;expected.clear()}if(score===best)expected.add(key)
 }
 for(const guidance of [false,true]){
  const q=createScoreTeamSearch({...opts,scoreTeamAudit:{...opts.scoreTeamAudit,guidance}}),actual=new Set(),all=new Set()
  for(const e of q.iterator)if(e.type==='team'){
   q.hydrate(e.record);const key=physicalTeamKey(e.record.packed)
   assert.ok(legal.has(key));assert.ok(!all.has(key),'Sampling must not duplicate archived or collected teams');all.add(key)
   if(e.record.score===best)actual.add(key)
  }
  assert.equal(q.state.bestScore,best);assert.deepEqual(actual,expected)
  assert.equal(q.state.complete,true);assert.equal(q.state.maximumProven,true);assert.equal(q.state.recoveries,0)
  assert.equal((q.state.stats.guidanceEvaluated||0)>0,guidance)
 }
 ties+=expected.size;cases++
}

// Stopping on a sampled improvement before its archive write still exposes
// the exact preview and never claims that sampling proved the maximum.
const messages=[];let controller,firstScore
controller=createScoreTeamController({yieldTask:async()=>{},post:m=>{
 messages.push(m)
 if(m.type==='score-progress'&&m.preview){
  firstScore??=m.preview.total
  if(m.preview.total>firstScore)controller.cancel(7)
 }
}})
await controller.start(7,base)
const stopped=messages.find(m=>m.type==='score-stopped')?.result.value
assert.equal(stopped?.ok,true);assert.ok(stopped.total>firstScore)
assert.equal(stopped.scoreTeamResults.maximumProven,false);assert.equal(stopped.scoreTeamResults.complete,false)
// Deterministic work budget, not a machine-dependent millisecond threshold:
// cheap members that miss the CE traits must not monopolize early search.
{
 const q=createScoreTeamSearch(scorePressureFixture('grand-conditional'))
 for(const e of q.iterator){
  if(e.type==='best'&&e.score>=50131)break
  assert.ok(q.state.stats.nodes<100,'Reach the known legal 50131-point witness before exploring hundreds of low-yield branches')
 }
 assert.ok(q.state.bestScore>=50131)
 assert.equal(q.state.maximumProven,false)
}
console.log(JSON.stringify({passed:true,guidedOracleCases:cases,optimalPhysicalTeams:ties,coverage:'sample budget, late winner, empty sample, stock restoration, COST, Grand fields, pins, MLB, capped recipients, prefer, no duplicates and stop before archive'}))
