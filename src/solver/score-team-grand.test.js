import assert from 'node:assert/strict'
import {recommendTeam,createScoreTeamSearch} from '../recommend.js'
import {createScoreTeamController} from './score-team-worker.js'

const svt=(id,cost=1)=>({id,collectionNo:id,name:'Assassin '+id,className:'assassin',rarity:3,cost,traitIds:[]})
const card={id:101,cost:1,name:'CE',skills:[{condLimitCount:0,funcs:[]},{condLimitCount:4,funcs:[]}]}
import {literalScoreTeams as literal,physicalTeamKey as key} from './score-team-oracle-fixture.js'

const servants=[svt(1),svt(2)],account={region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4,isGrand:s.id===2})),ces:[{id:101,count:1,mlbCount:1}]}
const base={servants,ces:[card],mode:'account',account,base:0,costLimit:3,questType:'grand',questClass:'assassin',slotPins:[4,5].map(position=>({position,empty:true})),aiMode:'off',scoreTeamAudit:{compact:false}}
let cases=0,teams=0
for(const allowSupport of [false,true])for(const grandPosition of [0,1,2,3,4,5])for(const variant of [0,1,2,3,4,5]){
 const opts={...base,allowSupport,grandPosition,
  account:variant===4?{...account,ces:[{id:101,count:2,mlbCount:1}]}:variant===5?{...account,servants:account.servants.map(s=>({...s,isGrand:true}))}:account,
  slotPins:[...base.slotPins,...(variant===1?[{position:1,svtId:2,ceRewardId:101}]:variant===2?[{position:1,svtId:2,ceId:101},{position:2,svtId:1,ceId:101}]:variant===3||variant===4?[{position:1,svtId:2,ceId:101,ceRewardId:101}]:[])]}
 let domain;const prepared=recommendTeam({...opts,scoreTeamPrepareOnly:true,onScoreTeamDomain:d=>{domain=d}})
 if(!prepared.ok)continue
 const expected=literal(domain),q=createScoreTeamSearch(opts),actual=new Set()
 for(const e of q.iterator)if(e.type==='team'){assert.equal(e.record.score,0);q.hydrate(e.record);actual.add(key(e.record.packed))}
 assert.deepEqual(actual,expected,JSON.stringify({allowSupport,grandPosition,variant}))
 assert.equal(q.state.maximumProven,expected.size>0)
 cases++;teams+=actual.size
}

// The screenshot's failure shape: one real Grand among many identities,
// fixed own Grand seat 1, unrestricted friend seat and no COST pruning.
const large=Array.from({length:24},(_,i)=>svt(i+1)),largeOpts={...base,servants:large,ces:[],base:4748,costLimit:116,slotPins:[],allowSupport:true,grandPosition:1,
 account:{region:'CN',servants:large.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4,isGrand:s.id===24})),ces:[]}}
for(const extra of [{},{frontIds:[0,24,0],grandPosition:2},{slotPins:[{position:1,svtId:24}]},{allowSupport:false},{grandPosition:0}]){
 const q=createScoreTeamSearch({...largeOpts,...extra});let found=false
 for(const e of q.iterator){assert.ok(q.state.stats.nodes<256,'A legal checkpoint must precede blind expansion of impossible layouts');if(e.type==='best'){found=true;assert.ok(q.hydrate(e.record).ok);break}}
 assert.equal(found,true)
}
const events=[];let controller
controller=createScoreTeamController({post:m=>{events.push(m);if(m.type==='score-progress'&&m.preview)controller.cancel(1)},yieldTask:async()=>{}})
await controller.start(1,largeOpts)
const stopped=events.find(m=>m.type==='score-stopped').result.value
assert.equal(stopped.ok,true);assert.equal(stopped.plans.length,1);assert.equal(stopped.scoreTeamResults.maximumProven,false)
assert.equal(stopped.slots.find(s=>s.isGrand&&!s.isSupport).position,1)
assert.notEqual(stopped.slots.find(s=>s.isSupport).position,1)
{
 const opts={...base,base:4748,allowSupport:true,grandPosition:1,ces:[card,{...card,id:102}],
  slotPins:[{position:6,ceId:101,ceRewardId:102},...[3,4,5].map(position=>({position,empty:true}))]}
 let domain;recommendTeam({...opts,scoreTeamPrepareOnly:true,onScoreTeamDomain:d=>{domain=d}})
 const q=createScoreTeamSearch(opts),actual=new Set();let found=false
 for(const e of q.iterator){if(e.type==='team'){
  const p=q.hydrate(e.record),support=p.slots.find(s=>s.isSupport)
  assert.equal(support.ceId,101);assert.equal(support.ceRewardId,102);found=true;actual.add(key(e.record.packed))
 }}
 assert.equal(found,true,'Locking a normal friend CE must not remove a different reward CE from the Grand domain')
 assert.deepEqual(actual,literal(domain),'All physical friend normal/reward assignments remain present')
}
for(const extra of [
 {quest:{restrictions:[{type:'fixedSupportPosition',targetVals:[1]}]}},
 {slotPins:[{position:1,empty:true}]},
 {ces:[card],account:{...largeOpts.account,ces:[{id:101,count:1,mlbCount:1}]},slotPins:[{position:1,svtId:24,ceId:101},{position:2,svtId:1,ceId:101}]},
 {slotPins:[{position:1,svtId:1}]},
]){
 const events=[];let c
 c=createScoreTeamController({post:m=>{events.push(m);if(m.type==='score-progress'&&m.progress.stats.nodes>256)c.cancel(2)},yieldTask:async()=>{}})
 await c.start(2,{...largeOpts,...extra})
 const result=events.find(m=>m.type==='score-complete')?.result.value
 assert.equal(result?.ok,false)
 assert.equal(result.scoreTeamResults.infeasible,true)
 assert.equal(result.scoreTeamResults.maximumProven,false)
 assert.ok(result.scoreTeamResults.stats.nodes<64,'Directly conflicting Grand/stock constraints finish without expanding teams')
 assert.match(result.error,/没有合法配队/)
}
console.log(JSON.stringify({passed:true,grandOracleCases:cases,allTiedPhysicalTeams:teams,coverage:'all Grand seats, movable/no friend, empty seats, reward pins, impossible shared stock, member pins, large-roster first checkpoint and stopped result'}))
