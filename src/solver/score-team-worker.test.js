import assert from 'node:assert/strict'
import {createScoreTeamController} from './score-team-worker.js'
import {createScoreTeamStore} from './score-team-store.js'
import {createScoreTeamSearch} from '../recommend.js'
const servants=[1,2].map(id=>({id,collectionNo:id,name:'S'+id,className:'saber',rarity:3,cost:id,traitIds:[]}))
const opts={scoreTeamAudit:{compact:false},servants,ces:[],base:0,allowSupport:false,slotPins:[{position:3,empty:true},{position:5,empty:true},{position:6,empty:true}],aiMode:'off'}
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
{
 const events=[],controller=createScoreTeamController({post:m=>events.push(m),createStore:async()=>{
  const real=await createScoreTeamStore()
  return {...real,append:async record=>{await real.append(record);await new Promise(resolve=>setTimeout(resolve,5))}}
 }})
 await controller.start(20,opts)
 const first=events.findIndex(m=>m.type==='score-window'),done=events.findIndex(m=>m.type==='score-complete')
 assert.ok(first>=0&&first<done,'The first real equal-score page appears before slow enumeration finishes')
 assert.ok(events[first].result.value.plans.length>=2)
 assert.equal(events[first].result.value.scoreTeamResults.complete,false)
}
console.log('Score-team worker: slow-disk search streams a real equal-score page before completion')
{
 const events=[],controller=createScoreTeamController({post:m=>events.push(m),yieldTask:async()=>{}})
 await controller.start(30,opts)
 const original=controller.current.query,total=controller.current.store.stats(0).bestCount
 await controller.start(31,structuredClone(opts))
 assert.equal(controller.current.query,original,'The same completed physical result set is reused')
 assert.equal(events.at(-1).result.value.scoreTeamResults.cacheHit,true)
 assert.equal(events.at(-1).result.value.scoreTeamResults.bestCount,total)
 assert.equal(events.at(-1).result.value.queryStats.aiInferenceCalls,0)
 await controller.start(32,{...opts,base:1})
 assert.notEqual(controller.current.query,original,'Changed inputs cannot reuse a complete result set')
}
console.log('Score-team cache: only identical complete queries reuse all pages; changed inputs search again with no stale inference counts')
{
 const events=[];let created=0
 const controller=createScoreTeamController({post:m=>events.push(m),yieldTask:async()=>{},createStore:async()=>{
  created++;const real=await createScoreTeamStore()
  return {...real,seal:async()=>{throw Error('simulated final flush failure')}}
 }})
 await controller.start(40,opts)
 assert.equal(controller.current.query.state.complete,false)
 await controller.start(41,opts)
 assert.equal(created,2,'A failed final flush must never become a complete-query cache hit')
 assert.ok(events.filter(m=>m.type==='error').every(m=>m.scoreTeamResults.complete===false))
}
console.log('Score-team cache: final-flush failures invalidate completeness before any reuse')

{
 const originalNow=Date.now;let now=1760000050000
 const timed={...opts,bondBonuses:{extraPassives:[],questFriendships:[{eventId:0,allQuests:true,targetIds:[999999],rate:0.2,startedAt:1760000000,endedAt:1760000100}]}}
 try{
  Date.now=()=>now
  const controller=createScoreTeamController({post:()=>{},yieldTask:async()=>{}})
  await controller.start(50,timed);const original=controller.current.query
  now+=1000;await controller.start(51,timed);assert.equal(controller.current.query,original)
  now=1760000200000;await controller.start(52,timed)
  assert.notEqual(controller.current.query,original,'An activity-window transition invalidates identical-input cache reuse')
 }finally{Date.now=originalNow}
}
console.log('Score-team cache: activity-window changes invalidate completed archives even with identical input objects')

{
 const controller=createScoreTeamController({post:()=>{},yieldTask:async()=>{}})
 await controller.start(60,opts);const original=controller.current.query
 const normalized={...opts,slotPins:opts.slotPins.map(pin=>({ceRewardId:0,formKey:'default',svtId:0,ceId:0,ceBondId:0,...pin}))}
 await controller.start(61,normalized)
 assert.equal(controller.current.query,original,'Result display filling defaults into empty pins must not invalidate an identical physical query')
}
console.log('Score-team cache: equivalent empty-slot pin defaults reuse the complete physical archive')

{
 let release,iterations=0
 const events=[],controller=createScoreTeamController({post:m=>events.push(m),yieldTask:async()=>{},
  createSearch:o=>{const q=createScoreTeamSearch(o);return {...q,iterator:(function*(){iterations++;yield* q.iterator})()}},
  createStore:async()=>{await new Promise(resolve=>{release=resolve});return createScoreTeamStore()}})
 const running=controller.start(70,opts)
 controller.cancel(70);release();await running
 const value=events.find(m=>m.type==='score-stopped').result.value
 assert.equal(iterations,0,'Cancel during store initialization must not start enumeration')
 assert.equal(value.ok,false);assert.equal(value.scoreTeamResults.stopped,true)
 assert.equal(value.scoreTeamResults.complete,false);assert.match(value.error,/尚未计算出.*不表示.*无解/)
}
{
 const preview=done.result.value.plans[0]
 let controller,iterations=0
 const events=[]
 controller=createScoreTeamController({post:m=>{events.push(m);if(m.type==='score-start')controller.cancel(71)},yieldTask:async()=>{},
  createSearch:o=>{const q=createScoreTeamSearch(o);q.state.bestScore=preview.total;return {...q,initial:preview,iterator:(function*(){iterations++;yield* q.iterator})()}}})
 await controller.start(71,opts)
 const value=events.find(m=>m.type==='score-stopped').result.value
 assert.equal(value.ok,true);assert.equal(value.plans.length,1);assert.equal(value.allPlans.length,1)
 assert.equal(value.scoreTeamResults.previewOnly,true);assert.equal(value.scoreTeamResults.bestCount,0)
 assert.equal(value.scoreTeamResults.stopped,true);assert.equal(iterations,0)
 await controller.page({id:71,offset:0})
 assert.equal(events.at(-1).result.value.plans.length,1);assert.equal(events.at(-1).result.value.scoreTeamResults.stopped,true)
 await controller.exportTeams({id:71})
 const file=events.at(-1);assert.equal(file.type,'score-export');assert.equal(file.ok,true)
 const header=JSON.parse((await(await fetch(file.url)).text()).trim());URL.revokeObjectURL(file.url)
 assert.equal(header.complete,false);assert.equal(header.stopped,true);assert.equal(header.feasiblePreview.total,preview.total)
}
{
 let controller
 const events=[]
 controller=createScoreTeamController({post:m=>{events.push(m);if(m.type==='score-progress')controller.cancel(72)},yieldTask:async()=>{}})
 await controller.start(72,opts)
 const value=events.find(m=>m.type==='score-stopped').result.value
 assert.equal(value.ok,true);assert.equal(value.plans.length,1)
 assert.equal(value.plans[0].total,value.scoreTeamResults.bestScore)
 assert.equal(value.scoreTeamResults.maximumProven,false)
 assert.equal(value.scoreTeamResults.stopped,true)
 assert.equal(value.scoreTeamResults.bestCount,0,'A just-found best stays visible even before its record reaches the archive')
}
console.log('Stopped queries: startup cancellation, initial-only preview, paging/export and the best-before-record checkpoint preserve results without claiming optimality')

