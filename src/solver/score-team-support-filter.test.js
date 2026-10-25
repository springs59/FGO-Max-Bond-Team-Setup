import assert from 'node:assert/strict'
import {createScoreTeamController} from './score-team-worker.js'
import {createSupportIndex,supportCeIds} from './score-team-support-filter.js'
import {createScoreTeamStore} from './score-team-store.js'
import {createScoreTeamSearch} from '../recommend.js'
import {expandScoreTeamFamily} from './score-team-equivalence.js'
import {packedTeamOf,physicalVariantKey,memberCompositionKey} from './score-team-diversity.js'
const rec=(id,score=100)=>({score,domain:0,packed:{slots:[{p:1,f:1,s:0,svt:1,ce:0},{p:6,f:1,s:1,svt:2,ce:id,mlb:true}]}})
const index=createSupportIndex();index.add(rec(101),null);index.add(rec(102,90),null)
assert.deepEqual(index.summary(100),[{id:101,score:100,bestCount:1,otherCount:0},{id:102,score:90,bestCount:0,otherCount:1}])
assert.deepEqual(index.summary(120).map(r=>[r.id,r.bestCount,r.otherCount]),[[101,0,1],[102,0,1]],'A new maximum reclassifies earlier results')
{
  const events=[];let searches=0
  const query={ok:true,initial:null,equivalenceCatalogs:[null],state:{bestScore:100,compact:false,complete:false,maximumProven:true,stats:{nodes:123}},
    hydrate:r=>({ok:true,total:r.score,slots:r.packed.slots.map(s=>({position:s.p,filled:!!s.f,isSupport:!!s.s,svtId:s.svt,ceId:s.ce,ceMlb:s.mlb}))})}
  query.iterator=(function*(){for(let i=0;i<135;i++)yield {type:'team',record:rec(i<64?101:102)};yield {type:'team',record:rec(103,90)};query.state.complete=true})()
  const controller=createScoreTeamController({createSearch:()=>{searches++;return query},post:m=>events.push(m),yieldTask:async()=>{}})
  await controller.start(1,{})
  let result=events.at(-1).result.value
  assert.equal(result.plans.length,64);assert.ok(result.plans.every(p=>p.slots.find(s=>s.isSupport).ceId===101))
  assert.deepEqual(result.scoreTeamResults.supportCeOptions.map(r=>r.id),[101,102,103],'The collection includes unseen pages and the other-score archive')
  await controller.page({id:1,request:1,supportCeId:102})
  result=events.at(-1).result.value
  assert.equal(result.scoreTeamResults.matchingBestCount,71);assert.equal(result.plans.length,64)
  assert.equal(result.plans[0].scoreFamilyRef.offset,64,'Filtered refs still address the original archive')
  assert.ok(result.plans.every(p=>p.slots.find(s=>s.isSupport).ceId===102))
  await controller.page({id:1,request:2,offset:64})
  result=events.at(-1).result.value;assert.equal(result.plans.length,7);assert.equal(result.scoreTeamResults.total,71)
  assert.equal(result.plans[0].scoreFamilyRef.offset,128);assert.equal(result.plans[0].scoreFamilyRef.filteredOffset,64)
  await controller.exportTeams({id:1,selectedKey:physicalVariantKey(result.plans[0])})
  const exported=events.at(-1),lines=(await(await fetch(exported.url)).text()).trim().split('\n').map(JSON.parse);URL.revokeObjectURL(exported.url)
  assert.equal(lines.length,137,'The complete export retains all 136 collected teams when filtered')
  assert.equal(lines[0].selectedTeam.slots.find(s=>s.isSupport).ceId,102)
  await controller.page({id:1,request:3,supportCeId:103});result=events.at(-1).result.value
  assert.equal(result.scoreTeamResults.kind,'other');assert.equal(result.total,90);assert.equal(result.scoreTeamResults.bestScore,100)
  await controller.page({id:1,request:4,supportCeId:999});result=events.at(-1).result.value
  assert.equal(result.ok,false);assert.equal(result.scoreTeamResults.complete,true);assert.equal(result.scoreTeamResults.supportCeOptions.length,3)
  await controller.page({id:1,request:5,supportCeId:null});result=events.at(-1).result.value
  assert.equal(result.plans.length,64);assert.equal(result.scoreTeamResults.matchingBestCount,135);assert.equal(result.scoreTeamResults.matchingOtherCount,1)
  assert.equal(searches,1);assert.deepEqual(query.state.stats,{nodes:123},'Result filtering never invokes the solver or changes its proof/stats')
}
const ce=(id,rate)=>({id,name:'C'+id,cost:1,skills:[0,4].map(n=>({condLimitCount:n,funcs:[{target:'ptFull',rate,followerRate:rate,add:0,tvals:[],andTvals:[]}]}))})
const servants=[1,2,3].map(id=>({id,collectionNo:id,name:'S'+id,className:'saber',cost:1,rarity:3,traitIds:[]}))
const opts={servants,ces:[ce(101,100),ce(102,100),ce(103,50),ce(999,0)],base:100,allowSupport:true,costLimit:2,aiMode:'off',slotPins:[{position:2,empty:true},{position:3,empty:true},{position:4,empty:true},{position:5,empty:true},{position:6,support:true}]}
{
  const events=[],controller=createScoreTeamController({post:m=>events.push(m),yieldTask:async()=>{}})
  await controller.start(2,opts)
  const query=controller.current.query,stats=JSON.stringify(query.state.stats),store=controller.current.store,expected=new Set()
  for(const kind of ['best','other'])for(let offset=0;;offset+=64){
    const page=await store.page({bestScore:query.state.bestScore,kind,offset})
    for(const r of page.records)for(const physical of expandScoreTeamFamily(r,query.equivalenceCatalogs[r.domain]))for(const id of supportCeIds(physical,null))expected.add(id)
    if(offset+64>=page.total)break
  }
  let result=events.at(-1).result.value
  assert.deepEqual(new Set(result.scoreTeamResults.supportCeOptions.map(r=>r.id)),expected,'The summary matches an independent physical expansion of the collected archive')
  assert.ok(expected.has(102),'A non-representative equivalent CE is a real result option')
  assert.ok(!expected.has(999),'An unused encyclopedia CE is absent')
  await controller.page({id:2,request:1,supportCeId:102});result=events.at(-1).result.value
  assert.ok(result.plans.length);assert.ok(result.plans.every(p=>p.slots.find(s=>s.isSupport).ceId===102))
  const physical=new Map(),literal=createScoreTeamSearch({...opts,scoreTeamAudit:{compact:false}})
  for(const e of literal.iterator)if(e.type==='team')physical.set(physicalVariantKey(e.record.packed.slots),literal.hydrate(e.record))
  let plan=result.plans[0];const visited=new Set([physicalVariantKey(plan)])
  for(let n=0;n<1000;n++){
    await controller.variant({id:2,request:n,mode:'all',ref:plan.scoreFamilyRef,currentTeam:packedTeamOf(plan),currentMembers:memberCompositionKey(plan),page:{kind:'best',offset:0,length:result.plans.length}})
    const response=events.at(-1);assert.equal(response.ok,true,response.error)
    if(!response.plan)break
    plan=response.plan;assert.equal(plan.slots.find(s=>s.isSupport).ceId,102,'Variant browsing keeps the active support CE')
    assert.ok(physical.has(physicalVariantKey(plan)),'Every filtered replacement is independently legal')
    assert.ok(!visited.has(physicalVariantKey(plan)));visited.add(physicalVariantKey(plan))
    assert.ok(n<999,'Filtered browsing terminates')
  }
  assert.equal(JSON.stringify(query.state.stats),stats)
}
{
  let controller,filtered=false
  const events=[],query={ok:true,initial:null,equivalenceCatalogs:[null],state:{bestScore:100,complete:false,compact:false,maximumProven:true,stats:{}},hydrate:r=>({ok:true,total:r.score,slots:r.packed.slots.map(s=>({position:s.p,filled:!!s.f,isSupport:!!s.s,svtId:s.svt,ceId:s.ce,ceMlb:s.mlb}))})}
  query.iterator=(function*(){for(let i=0;i<70;i++)yield {type:'team',record:rec(i<2?101:102)};query.state.complete=true})()
  controller=createScoreTeamController({createSearch:()=>query,post:m=>events.push(m),now:()=>events.length*300,yieldTask:async()=>{
    if(!filtered&&controller.current.store.stats(100).bestCount>=2){filtered=true;await controller.page({id:3,request:1,supportCeId:101})}
  }})
  await controller.start(3,{})
  const result=events.at(-1).result.value
  assert.equal(result.scoreTeamResults.supportCeId,101);assert.equal(result.plans.length,2)
  assert.deepEqual(result.scoreTeamResults.supportCeOptions.map(r=>r.id),[101,102],'Partial results grow their collection even while a filter is active')
}
console.log('Result support filter: all pages/categories, compact CE alternatives, exact paging/refs, literal legality, live growth, no re-query, filter-preserving variants and full export passed')

assert.deepEqual(supportCeIds({packed:{slots:[{f:1,s:1,ce:101,reward:999}]}},null),[101],'Grand reward equipment never pollutes the normal-CE collection')
assert.deepEqual(supportCeIds({packed:{slots:[{f:1,s:1,ce:0}]}},null),[0],'A real empty normal-CE slot can be filtered separately from all results')
{
 let release,block=false
 const events=[],controller=createScoreTeamController({post:m=>events.push(m),yieldTask:async()=>{},createStore:async()=>{
  const store=await createScoreTeamStore()
  return {...store,page:async opts=>{const page=await store.page(opts);if(block&&opts.filter?.counts.has(controller.current.query.state.bestScore)){block=false;await new Promise(resolve=>release=resolve)}return page}}
 }})
 await controller.start(4,opts)
 block=true;const old=controller.page({id:4,request:1,supportCeId:102})
 while(!release)await new Promise(r=>setTimeout(r,0))
 await controller.page({id:4,request:2,supportCeId:101})
 const selected=events.at(-1).result.value.plans[0]
 release();await old
 assert.equal(events.at(-1).request,2,'A late filtered page cannot overwrite a newer selection')
 assert.ok(controller.current.visibleRecords.has(physicalVariantKey(selected)),'A late reply cannot replace the visible export snapshot')
 await controller.page({id:4,request:3,offset:-1});assert.equal(events.at(-1).ok,false)
 await controller.page({id:4,request:4,offset:0});assert.equal(events.at(-1).ok,true,'Invalid paging does not poison the live filter')
}
