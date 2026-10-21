import assert from 'node:assert/strict'
import {createScoreTeamController} from './score-team-worker.js'
import {createScoreTeamStore} from './score-team-store.js'
const servants=[1,2].map(id=>({id,collectionNo:id,name:'S'+id,className:'saber',rarity:3,cost:id,traitIds:[]}))
const opts={servants,ces:[],base:0,allowSupport:false,slotPins:[{position:3,empty:true},{position:5,empty:true},{position:6,empty:true}],aiMode:'off'}
const messages=[],controller=createScoreTeamController({post:m=>messages.push(m),yieldTask:async()=>{}})
await controller.start(1,opts)
const done=messages.find(m=>m.type==='score-complete')
assert.equal(done.ok,true);assert.equal(done.result.value.scoreTeamResults.complete,true)
assert.ok(done.result.value.scoreTeamResults.bestCount>64,'All-score results exceed one UI page without a top-N cutoff')
const total=done.result.value.scoreTeamResults.bestCount,keys=new Set()
for(let offset=0;offset<total;offset+=64){
 await controller.page({id:1,request:offset,offset})
 const page=messages.at(-1)
 assert.equal(page.type,'score-page');assert.equal(page.ok,true)
 for(const p of page.result.value.plans){assert.equal(p.total,0);keys.add(JSON.stringify(p.slots.map(s=>[s.position,s.svtId,s.svtArtKey,s.ceId])))}
}
assert.equal(keys.size,total,'Every tied team can be retrieved')
let cancelling
const stopped=[],cancel=createScoreTeamController({post:m=>{stopped.push(m);if(m.type==='score-progress')cancelling.cancel(2)},yieldTask:async()=>{}});cancelling=cancel
await cancel.start(2,opts)
const partial=stopped.find(m=>m.type==='score-stopped')
assert.ok(partial);assert.equal(partial.result.value.scoreTeamResults.complete,false)
assert.equal(partial.result.value.scoreTeamResults.maximumProven,false)
await cancel.page({id:2,offset:0});assert.equal(stopped.at(-1).type,'score-page')
const errors=[],broken=createScoreTeamController({post:m=>errors.push(m),yieldTask:async()=>{},createStore:async()=>{
 const real=await createScoreTeamStore();let n=0
 return {...real,append:async r=>{if(++n===5)throw Error('simulated disk full');await real.append(r)}}
}})
await broken.start(3,opts)
assert.ok(errors.some(m=>m.type==='error'&&m.partial&&m.scoreTeamResults.complete===false))
assert.ok(!errors.some(m=>m.type==='score-complete'))
console.log(JSON.stringify({passed:true,allTiedTeams:total,pageSize:64,coverage:'worker paging beyond top-N, cancellation with readable partial results, disk failure never claims completeness'}))
{
 const messages=[];let release,creates=0
 const controller=createScoreTeamController({post:m=>messages.push(m),yieldTask:async()=>{},createStore:async()=>{
  if(++creates===1)await new Promise(resolve=>{release=resolve})
  return createScoreTeamStore()
 }})
 const old=controller.start(10,opts)
 await Promise.resolve()
 await controller.start(11,{...opts,base:1})
 release();await old
 assert.equal(controller.current.id,11,'Delayed initialization cannot replace the newest query')
 assert.ok(!messages.some(m=>m.id===10&&m.type==='score-complete'))
}
console.log('Score-team worker: overlapping initialization keeps the newest query and discards stale startup')
