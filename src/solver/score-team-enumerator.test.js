import assert from 'node:assert/strict'
import {createScoreTeamSearch as search,servantBondForms} from '../recommend.js'
import {applyCraftEssences} from '../atlas.js'
import {calcParty} from '../bond.js'
import {servantCost} from '../servant-cost.js'
const createScoreTeamSearch=opts=>search({...opts,scoreTeamAudit:{...opts.scoreTeamAudit,compact:false}})
const servant=id=>({id,collectionNo:id,name:'S'+id,className:'saber',rarity:3,cost:id,traitIds:[10+id%2],forms:[{key:'c1',cost:id,traitIds:[10+id%2]}]})
const ce=(id,cost,rate,target='ptFull',trait=0,flat=0)=>({id,name:'CE'+id,cost,skills:[0,4].map(mlb=>({condLimitCount:mlb,funcs:[{target,rate:mlb?rate:Math.floor(rate/2),add:flat,eventId:0,tvals:trait?[{id:trait}]:[],andTvals:[]}]}))})
const key=p=>p.slots.map(s=>`${s.p}:${s.f}:${s.s}:${s.svt}:${s.art||'default'}:${s.ce}:${s.mlb!==false}:${s.reward||0}`).join('|')
// Independent physical-slot oracle. No production frontier, compression,
// upper-bound routine, keepTopPlans, or new enumerator is used here.
function brute(opts){
 const positions=[1,2,4],support=opts.allowSupport===false?0:6,slots=[1,2,3,4,5,6].map(p=>({p,f:0,s:0,svt:0,art:'',ce:0,mlb:true})),used=new Set(),ceUsed=new Set(),plans=new Map()
 if(support)slots[5]={...slots[5],f:1,s:1}
 const forms=opts.servants.flatMap(s=>servantBondForms(s).map(form=>({s,form})))
 function evaluate(){
  if(!slots.slice(0,3).some(s=>s.f)||!slots.some(s=>s.f&&!s.s))return
  const raw=slots.filter(s=>s.f).map(s=>({position:s.p,filled:true,isSupport:Boolean(s.s),svtId:s.svt,svtArtKey:s.art,
   traitIds:s.s?[]:forms.find(r=>r.s.id===s.svt&&r.form.key===(s.art||'default')).form.traitIds,
   ceId:s.ce,ceMlb:s.mlb}))
  applyCraftEssences(raw,opts.ces)
  const output=calcParty(opts.base,Boolean(opts.teapot),raw)
  if(!output.ok)return
  const own=raw.filter(s=>!s.isSupport),cost=own.reduce((n,s)=>n+servantCost(opts.servants.find(r=>r.id===s.svtId),servantBondForms(opts.servants.find(r=>r.id===s.svtId)).find(f=>f.key===(s.svtArtKey||'default')))+(opts.ces.find(c=>c.id===s.ceId)?.cost||0),0)
  if(opts.costLimit!=null&&cost>opts.costLimit)return
  const score=output.results.reduce((n,r)=>n+r.final,0)
  plans.set(key({slots}),{score,cost})
 }
 function equipment(j){
  if(j===positions.length){for(const c of support?[null,...opts.ces]:[null]){if(support)slots[5].ce=c?.id||0;evaluate()}return}
  const s=slots[positions[j]-1]
  s.ce=0;equipment(j+1)
  if(s.f)for(let i=0;i<opts.ces.length;i++)if(!ceUsed.has(i)){
   ceUsed.add(i);s.ce=opts.ces[i].id;equipment(j+1);ceUsed.delete(i)
  }
  s.ce=0
 }
 function members(j){
  if(j===positions.length){equipment(0);return}
  const slot=slots[positions[j]-1]
  for(const {s,form} of forms)if(!used.has(s.id)){
   used.add(s.id);Object.assign(slot,{f:1,svt:s.id,art:form.key==='default'?'':form.key});members(j+1);used.delete(s.id)
  }
  Object.assign(slot,{f:0,svt:0,art:''});members(j+1)
 }
 members(0)
 const best=Math.max(...[...plans.values()].map(p=>p.score))
 return {best,plans:new Set([...plans].filter(([,p])=>p.score===best).map(([k])=>k))}
}
let cases=0,teams=0
for(let seed=0;seed<14;seed++){
 const opts={servants:[servant(1),servant(2)],ces:[ce(101,1,100,'ptFull',seed%3===0?11:0),ce(102,2,seed%4===0?0:200,seed%5===0?'self':'ptFull',0,seed%4===0?50:0)],
  base:[0,1,9,100,815][seed%5],teapot:seed%3===0,allowSupport:seed%2===0,costLimit:seed%4===0?5:8,
  quest:seed%2===0?{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]}:null,
  slotPins:[{position:3,empty:true},{position:5,empty:true},...(seed%2?[{position:6,empty:true}]:[])],aiMode:seed%3?'on':'off'}
 const expected=brute(opts),query=createScoreTeamSearch(opts),byScore=new Map()
 assert.equal(query.ok,true,query.error)
 let collecting=false,previousImprovement=-Infinity
 for(const event of query.iterator){
  if(event.type==='phase'){
   assert.equal(collecting,false);collecting=true
   assert.equal(query.state.bestScore,expected.best,'All domains must be optimized before tie collection')
   assert.equal(query.state.maximumProven,true);assert.equal(query.state.complete,false)
  }
  if(event.type!=='team')continue
  if(!collecting){assert.ok(event.record.score>previousImprovement,'Optimization archives strict improvements only');previousImprovement=event.record.score}
  else assert.equal(event.record.score,expected.best,'Collection returns only the proven target')
  const r=event.record,plan=query.hydrate(r)
  assert.equal(plan.total,r.score)
  if(!byScore.has(r.score))byScore.set(r.score,new Set())
  const k=key(r.packed);assert.ok(!byScore.get(r.score).has(k),'No duplicate physical team')
  byScore.get(r.score).add(k)
 }
 assert.equal(collecting,true)
 assert.equal(query.state.bestScore,expected.best,`best score ${seed}`)
 assert.deepEqual(byScore.get(expected.best),expected.plans,`ALL tied physical teams ${seed}`)
 assert.equal(query.state.complete,true);assert.equal(query.state.maximumProven,true)
 teams+=expected.plans.size;cases++
}
// Non-MLB/MLB copies are distinguishable states, identical copies are not.
{
 const opts={servants:[servant(1)],ces:[ce(101,2,10)],mode:'account',account:{region:'CN',servants:[{id:1,bondLv:5,bondCap:10,limitCount:4}],ces:[{id:101,count:3,mlbCount:1}]},
  base:1,allowSupport:false,costLimit:4,slotPins:[2,3,4,5,6].map(position=>({position,empty:true})),aiMode:'off'}
 const q=createScoreTeamSearch(opts),best=new Map()
 for(const e of q.iterator)if(e.type==='team'){q.hydrate(e.record);if(!best.has(e.record.score))best.set(e.record.score,[]);best.get(e.record.score).push(e.record)}
 const tied=best.get(q.state.bestScore)
 assert.ok(tied.some(r=>r.packed.cost===1)&&tied.some(r=>r.packed.cost===3),'Keep higher-COST ties')
 assert.ok(tied.some(r=>r.packed.slots[0].ce===101&&r.packed.slots[0].mlb===false)&&tied.some(r=>r.packed.slots[0].ce===101&&r.packed.slots[0].mlb===true),'Keep both MLB states')
 assert.equal(new Set(tied.map(r=>key(r.packed))).size,tied.length)
}
console.log(JSON.stringify({passed:true,independentOracleCases:cases,tiedTeams:teams,coverage:'all identities/forms/positions, ties with different costs, self/party/conditional/flat CEs, rounding, tea, support, stock and MLB states'}))
// Reward equipment is free COST, not an excuse to discard dearer tied normal
// equipment. Both assignments of the same two owned cards must be retained.
{
 const q=createScoreTeamSearch({servants:[servant(1)],ces:[ce(101,1,100),ce(102,2,200)],base:100,
  allowSupport:false,questType:'grand',questClass:'saber',grandPosition:1,costLimit:3,
  slotPins:[2,3,4,5,6].map(position=>({position,empty:true})),aiMode:'off'})
 const records=[];for(const e of q.iterator)if(e.type==='team'){q.hydrate(e.record);records.push(e.record)}
 const best=records.filter(r=>r.score===q.state.bestScore)
 assert.equal(q.state.bestScore,156);assert.deepEqual(new Set(best.map(r=>r.packed.cost)),new Set([2,3]))
 assert.equal(best.length,servantBondForms(servant(1)).length*2)
}
// The support position itself is part of a physical team: an unpinned normal
// friend may occupy each of the six positions, even for a zero-base tie.
{
 const q=createScoreTeamSearch({servants:[servant(1)],ces:[],base:0,allowSupport:true,aiMode:'off'})
 const supportPositions=new Set();let n=0
 for(const e of q.iterator)if(e.type==='team'){q.hydrate(e.record);supportPositions.add(e.record.packed.slots.find(s=>s.s).p);n++}
 assert.deepEqual(supportPositions,new Set([1,2,3,4,5,6]));assert.ok(n>64)
}
console.log('Additional all-score checks: Grand reward/COST ties and all six friend-support positions passed')
{
 const fixed=ce(991,1,500),q=createScoreTeamSearch({servants:[servant(1)],ces:[],base:100,allowSupport:false,
  quest:{flags:['noSupportList'],npcSupportCount:1,partyMetadataComplete:true,restrictions:[{type:'fixedSupportPosition',targetVals:[1]}],
   supportServants:[{id:9,svtId:700100,name:'NPC',required:true,releaseConditions:[],equips:[{ceId:991,ceMlb:false,ce:fixed}]}]},
  slotPins:[3,4,5,6].map(position=>({position,empty:true})),aiMode:'off'})
 const best=[];for(const e of q.iterator)if(e.type==='team'){const p=q.hydrate(e.record);best.push(p);assert.equal(p.slots[0].svtId,700100);assert.equal(p.slots[0].ceMlb,false)}
 assert.equal(q.state.bestScore,155);assert.equal(best.length,4)
}
{
 const q=createScoreTeamSearch({servants:[servant(1),servant(2)],ces:[],base:100,allowSupport:false,mode:'account',
  account:{region:'CN',servants:[{id:1,bondLv:15,bondCap:15},{id:2,bondLv:5,bondCap:10}],ces:[]},
  slotPins:[3,5,6].map(position=>({position,empty:true})),aiMode:'off'})
 const best=[];for(const e of q.iterator)if(e.type==='team'){q.hydrate(e.record);if(e.record.score===150)best.push(e.record)}
 assert.equal(q.state.bestScore,150);assert.equal(best.length,36,'Capped aura carriers, with all unlocked forms and positions')
}
{
 const q=createScoreTeamSearch({servants:[servant(1),servant(2)],ces:[],base:100,allowSupport:false,preferSvtIds:[1],optimizeBy:'prefer',
  slotPins:[3,5,6].map(position=>({position,empty:true})),aiMode:'off'})
 const totals=new Set();for(const e of q.iterator)if(e.type==='team'){const p=q.hydrate(e.record);if(e.record.score===120)totals.add(p.total)}
 assert.equal(q.state.bestScore,120);assert.deepEqual(totals,new Set([120,220,240]),'Secondary total is not a reason to discard equal-primary-score teams')
}
console.log('Additional all-score checks: fixed non-MLB NPC, capped aura carrier, and equal-primary-score teams with different secondary totals passed')
{
 const base=100_000_000_000_833,opts={servants:[servant(1)],ces:[ce(101,1,1)],base,allowSupport:false,
  slotPins:[2,3,4,5,6].map(position=>({position,empty:true})),aiMode:'off'}
 const q=createScoreTeamSearch(opts)
 for(const e of q.iterator)if(e.type==='team')q.hydrate(e.record)
 const exact=Number((BigInt(base)*1200n/1000n)*1001n/1000n)
 assert.equal(q.state.bestScore,exact,'Large safe-integer bases retain both exact floors')
}
console.log('All-score large-base check: BigInt fallback preserves exact nested integer floors')
{
 const q=createScoreTeamSearch({servants:[servant(1)],ces:[],base:100,allowSupport:false,
  slotPins:[2,3,4,5,6].map(position=>({position,empty:true}))})
 assert.equal(q.initial,null,'Small automatic domains must not enter the legacy complete solver just to obtain a warm start')
 for(const e of q.iterator)if(e.type==='team')q.hydrate(e.record)
 assert.equal(q.state.bestScore,120);assert.equal(q.state.complete,true)
}
console.log('Automatic small domains: warm-start preparation never invokes the legacy full search')
{
 const servants=[1,2,3].map(id=>({id,collectionNo:id,name:'S'+id,className:'saber',rarity:3,cost:1,traitIds:[10]}))
 const q=createScoreTeamSearch({servants,ces:[],base:100,allowSupport:false,costLimit:1,
  slotPins:[2,3,4,5,6].map(position=>({position,empty:true})),aiMode:'off'})
 for(const e of q.iterator)if(e.type==='team'){
  const plan=q.hydrate(e.record),slot=plan.slots[0]
  assert.equal(slot.anySvt,true)
  assert.ok(slot.altSvtForms.every(x=>x.id!==slot.svtId))
  assert.equal(new Set(slot.altSvtForms.map(x=>x.id)).size,slot.altSvtForms.length)
 }
}
console.log('All-score UI metadata: interchangeable members remain available without collapsing the explicit physical-team result set')

// A live campaign for unrelated identities must not turn an ordinary owned
// roster into an unbounded activity search. Applicable sources still settle
// every leaf through the live scorer.
{
 const opts={servants:[servant(1),servant(2)],ces:[ce(101,1,200)],base:815,costLimit:8,allowSupport:false,aiMode:'off',
  slotPins:[3,4,5,6].map(position=>({position,empty:true}))}
 const campaign=targetIds=>({extraPassives:[],questFriendships:[{eventId:0,allQuests:true,targetIds,rate:0.2,startedAt:1,endedAt:4102444800}]})
 const run=bonus=>{const q=createScoreTeamSearch({...opts,bondBonuses:bonus}),records=[];for(const e of q.iterator)if(e.type==='team'){q.hydrate(e.record);records.push(e.record)}return {state:q.state,keys:records.filter(r=>r.score===q.state.bestScore).map(r=>key(r.packed)).sort()}}
 const plain=run(null),unrelated=run(campaign([999999])),applicable=run(campaign([1]))
 assert.deepEqual(unrelated.keys,plain.keys);assert.equal(unrelated.state.bestScore,plain.state.bestScore)
 assert.ok(unrelated.state.stats.scorePruned>0,'Unrelated campaigns preserve ordinary score pruning')
 assert.equal(applicable.state.stats.scorePruned,0,'Relevant campaign uses the exact fallback')
 assert.ok(applicable.state.bestScore>plain.state.bestScore)
}
console.log('Live campaign isolation: unrelated identities retain safe bounds; applicable bonuses retain exact settlement')

// A large tie set must not delay the proof of the objective. The independent
// oracle cases above still verify that phase 2 preserves every optimal team.
{
 const query=createScoreTeamSearch({servants:Array.from({length:5},(_,i)=>servant(i+1)),ces:[],base:0,allowSupport:false,
  slotPins:[3,5,6].map(position=>({position,empty:true})),aiMode:'off'})
 let phaseSeen=false,archivedBeforeProof=0,ties=0,proofEvaluations=Infinity
 for(const event of query.iterator){
  if(event.type==='phase'){
   assert.equal(event.phase,'collecting');assert.equal(query.state.maximumProven,true);assert.equal(query.state.complete,false)
   assert.equal(phaseSeen,false);phaseSeen=true;proofEvaluations=query.state.stats.evaluated
  }
  if(event.type==='team'){
   if(!phaseSeen)archivedBeforeProof++
   else{assert.equal(event.record.score,0);ties++}
  }
 }
 assert.equal(phaseSeen,true);assert.equal(archivedBeforeProof,0)
 assert.equal(proofEvaluations,1,'A feasible zero-score witness proves the optimum without traversing equal-score teams')
 assert.ok(ties>64,'Collection still retains the complete multi-page tie set')
 assert.equal(query.state.complete,true)
}
console.log('Objective first: maximum proven before archiving a multi-page tie set; exact tie collection follows')
