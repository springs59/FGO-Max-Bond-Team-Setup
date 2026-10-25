import assert from 'node:assert/strict'
import {createScoreTeamSearch} from '../recommend.js'
import {createScoreTeamController} from './score-team-worker.js'
import {expandScoreTeamFamily} from './score-team-equivalence.js'
import {packedTeamOf,physicalVariantKey,memberPlacementKey,memberCompositionKey} from './score-team-diversity.js'
import {createScoreTeamStore} from './score-team-store.js'
import {createVariantCursor} from './score-team-variant-browser.js'
import {createTeamReport} from '../ui/team-report.js'
const svt=id=>({id,collectionNo:id,name:'S'+id,className:'saber',cost:1,rarity:3,traitIds:[10]})
const ce=(id,rate=100)=>({id,name:'C'+id,cost:1,skills:[0,4].map(n=>({condLimitCount:n,funcs:[{target:'ptFull',rate:n?rate:rate/2,followerRate:n?rate:rate/2,add:0,tvals:[],andTvals:[]}]}))})
const base={servants:[1,2,3].map(svt),ces:[ce(101),ce(102)],base:100,costLimit:4,allowSupport:false,slotPins:[3,4,5,6].map(position=>({position,empty:true})),aiMode:'off'}
const account={region:'CN',servants:base.servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4,isGrand:s.id===1})),ces:[{id:101,count:2,mlbCount:1}]}
const grand={...base,mode:'account',account:{...account,ces:[101,102,103].map(id=>({id,count:1,mlbCount:1}))},ces:[ce(101),ce(102),ce(103)],questType:'grand',questClass:'saber',grandPosition:4,allowSupport:true,
  slotPins:[2,3,5].map(position=>({position,empty:true})).concat({position:6,support:true})}
const cases=[base,{...base,mode:'account',account},{...base,optimizeBy:'prefer',preferSvtIds:[1]},
  {...base,slotPins:base.slotPins.concat({position:1,svtId:1,ceId:101})},grand,
  {...grand,ces:[...grand.ces,{...ce(201,0),bondEquipOwner:1,cost:9}],account:{...grand.account,ces:[...grand.account.ces,{id:201,count:1,mlbCount:1}]},slotPins:grand.slotPins.concat({position:4,svtId:1,ceBondId:201})}]
let checked=0
for(const opts of cases){
  // The independent reference uses literal enumeration, no grouping/browser.
  const reference=createScoreTeamSearch({...opts,scoreTeamAudit:{compact:false}}),physical=new Map()
  for(const event of reference.iterator)if(event.type==='team'){
    if(event.record.score===reference.state.bestScore)physical.set(physicalVariantKey(event.record.packed.slots),reference.hydrate(event.record))
  }
  for(const [k,p] of physical)if((opts.optimizeBy==='prefer'?p.preferBond:p.total)!==reference.state.bestScore)physical.delete(k)
  const messages=[],controller=createScoreTeamController({post:m=>messages.push(m),yieldTask:async()=>{}})
  await controller.start(1,opts)
  const initial=messages.find(m=>m.type==='score-complete').result.value,original=initial.plans[0]
  const stats=JSON.stringify(controller.current.query.state.stats)
  for(const mode of ['all','equipment']){
    let plan=original;const found=new Set([physicalVariantKey(plan)]),placement=memberPlacementKey(plan)
    for(let n=0;;n++){
      assert.ok(n<=physical.size+1,'Browser must finish rather than repeat representatives')
      await controller.variant({id:1,request:n,mode,ref:plan.scoreFamilyRef,currentTeam:packedTeamOf(plan),currentMembers:memberCompositionKey(plan)})
      const response=messages.at(-1);assert.equal(response.ok,true,response.error)
      if(!response.plan){assert.equal(response.pending,false);break}
      plan=response.plan
      if(mode==='equipment')assert.equal(memberPlacementKey(plan),placement,'Fixed-member mode retains identity, form, seat and Grand role')
      const key=physicalVariantKey(plan);assert.ok(!found.has(key),'No duplicate physical CE copies or whole-team variants')
      found.add(key);assert.ok(physical.has(key),'Every displayed team is independently legal and optimal')
      const report=createTeamReport([plan],opts);assert.deepEqual(report.teams[0].slots.map(s=>s.equipment.map(e=>[e.id,e.mlb])),plan.slots.map(s=>['ceId','ceBondId','ceRewardId'].filter(k=>s.filled&&s[k]).map(k=>[s[k],s[k==='ceId'?'ceMlb':k==='ceBondId'?'ceBondMlb':'ceRewardMlb']!==false])))
    }
    const expected=new Set([...physical].filter(([,p])=>mode==='all'||memberPlacementKey(p)===placement).map(([k])=>k))
    assert.deepEqual(found,expected,`No tied equipment/team variants omitted (${mode})`);checked+=found.size
  }
  assert.equal(JSON.stringify(controller.current.query.state.stats),stats,'Browsing does not change the proof, search stats or inference count')
  if(controller.current.selectedVariant){
    const selected=controller.current.selectedVariant
    await controller.exportTeams({id:1,selectedKey:physicalVariantKey(selected)})
    const exported=messages.at(-1);assert.equal(exported.ok,true)
    const header=JSON.parse((await(await fetch(exported.url)).text()).split('\n')[0]);URL.revokeObjectURL(exported.url)
    assert.equal(physicalVariantKey(header.selectedTeam.slots),physicalVariantKey(selected))
    assert.equal(header.selectedTeam.slots.reduce((n,s)=>n+(s.gain||0),0),selected.total)
  }
  // Stop with only a proved witness, before the archive has a single group.
  // Warm swaps/replacements are checked against the same literal oracle.
  let early
  const partialMessages=[]
  early=createScoreTeamController({post:m=>{partialMessages.push(m);if(m.type==='score-progress'&&m.progress.maximumProven)early.cancel(2)},yieldTask:async()=>{},createSearch:o=>{
    const q=createScoreTeamSearch(o);let witness
    for(const e of q.iterator){if(e.type==='best')witness=e.record;if(e.type==='phase'&&q.state.maximumProven)break}
    assert.ok(witness)
    return {...q,initial:q.hydrate(witness),iterator:(function*(){yield {type:'best',record:witness}})()}
  }})
  await early.start(2,opts)
  let warm=partialMessages.find(m=>m.type==='score-stopped').result.value
  assert.equal(warm.scoreTeamResults.bestCount,0)
  const fixed=memberPlacementKey(warm),warmKeys=new Set([physicalVariantKey(warm)])
  for(let n=0;;n++){
    assert.ok(n<physical.size+2)
    await early.variant({id:2,request:n,mode:'equipment',ref:warm.scoreFamilyRef,currentTeam:packedTeamOf(warm)})
    const result=partialMessages.at(-1);assert.equal(result.ok,true,result.error)
    if(!result.plan)break
    warm=result.plan;const key=physicalVariantKey(warm)
    assert.equal(memberPlacementKey(warm),fixed);assert.ok(physical.has(key));assert.ok(!warmKeys.has(key),'Warm neighbourhood never repeats variants already represented by its family')
    warmKeys.add(key)
  }
}
// Fixing IDs is applied before large identity pools expand, not by enumerating
// all other members first. Cooperative mode retains the same physical set.
{
 const q=createScoreTeamSearch(base);let family
 for(const event of q.iterator)if(event.type==='team')family=event.record
 const catalog=q.equivalenceCatalogs[family.domain],all=[...expandScoreTeamFamily(family,catalog)],fixed=all[0].packed.slots
 const narrowed=[...expandScoreTeamFamily(family,catalog,{fixedMembers:fixed,cooperative:true})].filter(r=>r.type!=='tick')
 assert.deepEqual(new Set(narrowed.map(r=>physicalVariantKey(r.packed.slots))),new Set(all.filter(r=>memberPlacementKey(r.packed.slots)===memberPlacementKey(fixed)).map(r=>physicalVariantKey(r.packed.slots))))
  const store=await createScoreTeamStore(),cursor=createVariantCursor({query:q,previewRecord:family,store},{mode:'all',score:q.state.bestScore,kind:'best',asFamily:r=>r})
  let previews=0
  for(;;){const n=await cursor.next();if(n.done)break;if(n.value.type!=='tick')previews++}
  assert.ok(previews>=all.length)
  await store.append(family)
  for(;;){const n=await cursor.next();if(n.done)break;assert.equal(n.value.type,'tick','An archived family already fully previewed must not repeat its variants')}
  await store.dispose()
}
// A cursor crosses the 64-family disk page and resumes an appended partial
// tail. It stores neither all expanded teams nor an unbounded seen-key set.
{
 const store=await createScoreTeamStore(),record=i=>({score:100,domain:0,packed:{slots:[{p:1,f:1,s:0,g:0,svt:1,ce:101+i,mlb:true}]}})
 for(let i=0;i<130;i++)await store.append(record(i))
 const job={query:{state:{bestScore:100},equivalenceCatalogs:[null]},store},cursor=createVariantCursor(job,{mode:'all',score:100,kind:'best',asFamily:r=>r})
 let found=0;for(;;){const n=await cursor.next();if(n.done)break;if(n.value.type!=='tick')found++}
 assert.equal(found,130);await store.append(record(130))
 let tail;for(;;){const n=await cursor.next();if(n.done)break;if(n.value.type!=='tick')tail=n.value}
 assert.equal(tail.record.packed.slots[0].ce,231);assert.equal(cursor.offset,131)
 await store.dispose()
}
// A superseded/cancelled request cannot overwrite the selected team. Resume
// keeps its unread iterator result, and reset starts again without solving.
{
 let release,gate=false;const messages=[]
 const c=createScoreTeamController({post:m=>messages.push(m),yieldTask:async()=>{if(gate){gate=false;await new Promise(r=>{release=r})}}})
 await c.start(1,base);const plan=messages.find(m=>m.type==='score-complete').result.value.plans[0]
 const request={id:1,mode:'all',ref:plan.scoreFamilyRef,currentTeam:packedTeamOf(plan)}
 gate=true;const pending=c.variant({...request,request:1})
 while(!release)await new Promise(r=>setTimeout(r,0))
 c.cancelVariant(1,1);release();await pending
 assert.ok(!messages.some(m=>m.type==='score-variant'&&m.request===1))
 await c.variant({...request,request:2});assert.ok(messages.at(-1).plan)
 c.cancelVariant(1,null,true);await c.variant({...request,request:3})
 assert.equal(physicalVariantKey(messages.at(-1).plan),physicalVariantKey(messages.find(m=>m.type==='score-variant'&&m.request===2).plan))
}
// Selecting a family outside the loaded page returns that page and its
// correct selected index, rather than replacing an unrelated first-page row.
{
 const records=Array.from({length:130},(_,i)=>({domain:0,score:100,packed:{slots:[{p:1,f:1,s:0,g:0,svt:1,ce:101+i,mlb:true}],cost:1}}))
 const state={bestScore:100,complete:false,maximumProven:false,compact:false,stats:{nodes:0,evaluated:0}},messages=[]
 const hydrate=r=>({ok:true,total:100,costUsed:1,slots:r.packed.slots.map(s=>({position:s.p,filled:!!s.f,isSupport:!!s.s,isGrand:!!s.g,svtId:s.svt,ceId:s.ce,ceMlb:s.mlb}))})
 const c=createScoreTeamController({post:m=>messages.push(m),yieldTask:async()=>{},createSearch:()=>({ok:true,state,equivalenceCatalogs:[null],initial:hydrate(records[0]),hydrate,
  iterator:(function*(){for(const record of records)yield {type:'team',record};state.complete=true;state.maximumProven=true})()})})
 await c.start(3,{})
 let plan=messages.find(m=>m.type==='score-complete').result.value.plans[0],pageResult
 for(let i=0;i<64;i++){
  await c.variant({id:3,request:i,mode:'all',ref:plan.scoreFamilyRef,currentTeam:packedTeamOf(plan),page:{kind:'best',offset:0,length:64}})
  const result=messages.at(-1);assert.equal(result.ok,true,result.error);plan=result.plan;if(result.pageResult)pageResult=result.pageResult
 }
 assert.equal(plan.slots[0].ceId,165);assert.equal(pageResult.scoreTeamResults.offset,64);assert.equal(pageResult.chosen,0)
 assert.equal(physicalVariantKey(pageResult.plans[pageResult.chosen]),physicalVariantKey(plan))
}
console.log(JSON.stringify({passed:true,cases:cases.length,checkedPhysicalVariants:checked,coverage:'all ties vs literal oracle; fixed members, CE IDs/MLB/stock, support and Grand rewards/bond pins, export snapshots, cross-page/resumable cursor and cancel/reset without query'}))
