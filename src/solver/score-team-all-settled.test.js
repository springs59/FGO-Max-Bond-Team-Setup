import assert from 'node:assert/strict'
import {createScoreTeamSearch} from '../recommend.js'
import {createScoreTeamController} from './score-team-worker.js'
import {createScoreTeamStore} from './score-team-store.js'
import {expandScoreTeamFamily} from './score-team-equivalence.js'
import {physicalVariantKey} from './score-team-diversity.js'
import {wideFixture} from '../../scripts/all-score-teams-wide-fixtures.mjs'
const ce=(id,rate)=>({id,name:'C'+id,cost:1,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate,followerRate:rate,add:0,tvals:[],andTvals:[]}]}))})
const servants=[1,2,3].map(id=>({id,collectionNo:id,name:'S'+id,className:'saber',cost:1,rarity:3,traitIds:[]}))
const small={servants,ces:[ce(101,100),ce(102,50)],mode:'account',account:{region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4})),ces:[]},base:100,allowSupport:true,costLimit:3,aiMode:'off',slotPins:[2,3,4,5].map(position=>({position,empty:true})).concat({position:6,support:true})}
for(const options of [small,{...small,optimizeBy:'prefer',preferSvtIds:[1]},...['conditional','grand','fixed-npc','pins-stock-aura','active-event'].map(id=>({...wideFixture(id).opts,aiMode:'off'}))]){
 const opts={...options,retainAllSettled:true},settled=[],events=[]
 const controller=createScoreTeamController({post:m=>events.push(m),yieldTask:async()=>{},createSearch:opts=>{
  const q=createScoreTeamSearch(opts),iterator=q.iterator
  return {...q,get equivalenceCatalogs(){return q.equivalenceCatalogs},iterator:(function*(){for(const e of iterator){if((e.type==='settled'||e.type==='best')&&e.record)settled.push({record:structuredClone(e.record),key:physicalVariantKey(e.record.packed.slots)});yield e}})()}
 }})
 await controller.start(1,opts)
 assert.equal(events.at(-1).type,'score-complete',events.at(-1).error)
 const result=events.at(-1).result.value,info=result.scoreTeamResults
 assert.equal(info.kind,'all');assert.equal(info.allComputed,true);assert.equal(info.allCount,info.bestCount+info.otherCount)
 const actual=new Set(),records=[]
 for(let offset=0;offset<info.allCount;offset+=64){
  await controller.page({id:1,kind:'all',offset});const page=events.at(-1).result.value
  const source=await controller.current.store.page({bestScore:info.bestScore,kind:'all',offset})
  assert.equal(page.plans.length,source.records.length)
  for(const record of source.records){
   records.push(record)
   for(const expanded of expandScoreTeamFamily(record,controller.current.query.equivalenceCatalogs[record.domain])){
    controller.current.query.hydrate(expanded)
    const key=physicalVariantKey(expanded.packed.slots)
    assert.ok(!actual.has(key),'Phase/probe/DP/collector overlap must not duplicate a physical team');actual.add(key)
   }
  }
 }
 for(const s of settled)assert.ok(actual.has(s.key),'Every fully settled candidate remains visible, including losing and first feasible witnesses')
 const reference=createScoreTeamSearch({...options,retainAllSettled:false});for(const e of reference.iterator){}
 assert.equal(info.bestScore,reference.state.bestScore,'Retaining computed candidates preserves the exact optimum')
 if(options===small){assert.ok(info.otherCount>0);assert.ok(records.some(r=>r.score<info.bestScore))}
 await controller.exportTeams({id:1});const file=events.at(-1);assert.equal(file.ok,true)
 const lines=(await(await fetch(file.url)).text()).trim().split('\n').map(JSON.parse);URL.revokeObjectURL(file.url)
 assert.equal(lines[0].recordScope,'all-fully-settled');assert.equal(lines.length-1,info.allCount)
 await controller.start(2,opts);assert.equal(events.at(-1).result.value.scoreTeamResults.cacheHit,true)
}
{
 const events=[];let controller
 controller=createScoreTeamController({post:m=>{events.push(m);if(m.type==='score-progress'&&m.progress.allCount>0)controller.cancel(3)},yieldTask:async()=>{}})
 await controller.start(3,{...small,retainAllSettled:true})
 const result=events.at(-1).result.value;assert.equal(result.scoreTeamResults.stopped,true);assert.ok(result.scoreTeamResults.allCount>0)
 await controller.page({id:3,kind:'all'});assert.equal(events.at(-1).result.value.ok,true)
 await controller.exportTeams({id:3});assert.equal(events.at(-1).ok,true);URL.revokeObjectURL(events.at(-1).url)
}
{
 const events=[],query={ok:true,initial:null,equivalenceCatalogs:[null],state:{bestScore:200,complete:false,compact:false,maximumProven:true,stats:{}},hydrate:r=>({ok:true,total:r.score,slots:r.packed.slots.map(s=>({position:s.p,filled:!!s.f,svtId:s.svt,isSupport:!!s.s,ceId:s.ce}))})}
 query.iterator=(function*(){for(let i=0;i<145;i++)yield {type:'settled',record:{domain:0,score:i<70?100:200,packed:{slots:[{p:1,f:1,svt:i+1},{p:6,f:1,s:1,ce:i%2?101:102}]}}};query.state.complete=true})()
 const controller=createScoreTeamController({post:m=>events.push(m),createSearch:()=>query,yieldTask:async()=>{}})
 await controller.start(4,{retainAllSettled:true});assert.equal(events.at(-1).result.value.scoreTeamResults.allCount,145)
 const scores=[];for(let offset=0;offset<145;offset+=64){await controller.page({id:4,kind:'all',offset});scores.push(...events.at(-1).result.value.plans.map(p=>p.total))}
 assert.deepEqual(scores,[...Array(75).fill(200),...Array(70).fill(100)],'All scores are paged in descending order across the best/other boundary')
 await controller.page({id:4,supportCeId:102});const info=events.at(-1).result.value.scoreTeamResults;assert.equal(info.kind,'all');assert.equal(info.matchingAllCount,73)
 await controller.page({id:4,kind:'all',offset:64});assert.equal(events.at(-1).result.value.plans.length,9)
}
console.log('All settled teams: every exact candidate preserved without duplicate physical teams; optimum unchanged; ordinary/Grand/NPC/events/prefer/stock, stop/cache/export and 145-row cross-score filtered paging passed')

{
 let controller
 const events=[],options={...small,servants:Array.from({length:12},(_,i)=>({...servants[0],id:i+1,collectionNo:i+1})),mode:'free',account:null,aiMode:'on',retainAllSettled:true}
 controller=createScoreTeamController({post:m=>{events.push(m);if(m.type==='score-start')controller.cancel(5)},yieldTask:async()=>{}})
 await controller.start(5,options)
 const result=events.at(-1).result.value
 assert.equal(result.scoreTeamResults.stopped,true);assert.ok(result.scoreTeamResults.allCount>0,'An already settled AI seed remains a real archived result even when stopped at startup')
 assert.ok((result.resultStatus.ai?.inferenceCalls||0)<=1)
 await controller.exportTeams({id:5});const exported=events.at(-1);assert.equal(exported.ok,true)
 const lines=(await(await fetch(exported.url)).text()).trim().split('\n').map(JSON.parse);URL.revokeObjectURL(exported.url)
 assert.ok(lines.length>1)
}
