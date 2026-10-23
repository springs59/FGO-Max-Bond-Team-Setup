import assert from 'node:assert/strict'
import {createScoreTeamSearch,recommendTeam} from '../recommend.js'
import {questPartyRules,availableSystemSupports} from '../quest-party-rules.js'
import {QUEST_RESTRICTION_TYPES} from '../quest-party-constraints.js'
const svt=(id,traits=[id],className='saber')=>({id,collectionNo:id,name:'S'+id,className,rarity:3,cost:1,traitIds:traits})
const servants=[svt(1,[1,10]),svt(2,[2,20],'archer')]
const ce=(id,rate=100)=>({id,name:'CE'+id,cost:1,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate,eventId:0}]}))})
const r=(type,values,rangeType='equal',targetVals2=[])=>({type,targetVals:values,rangeType,targetVals2})
const npc=(id,p,traits=[id],extra={})=>({id,svtId:id,name:'NPC'+id,traitIds:traits,detailTraits:traits,required:true,followerFlags:['fixedNpc'],script:p?{eventDeckIndex:p}:{},equips:[],...extra})
const base={servants,ces:[],base:0,allowSupport:false,aiMode:'off',mode:'account',account:{region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,maxAscension:0,isGrand:true})),ces:[]}}
const physical=slots=>JSON.stringify(slots.map(s=>[s.p,s.f,s.s,s.svt,s.g,s.art||'']))
let cases=0,teams=0
// Independent literal occupancy oracle. Raw, explicit fixture predicates are
// provided by the tests; no production rule compiler or prune is used here.
function occupancyOracle(o,externals,predicate){
 const answers=new Set(),slots=Array.from({length:6},(_,i)=>({p:i+1,f:0,s:0,svt:0,g:0,art:''})),used=new Set()
 for(const e of externals)Object.assign(slots[e.position-1],{f:1,s:1,svt:e.svtId})
 function visit(p){
  if(p===7){const own=slots.filter(s=>s.f&&!s.s),filled=slots.filter(s=>s.f);if(!filled.some(s=>s.p<=3)||!predicate(own,filled))return;answers.add(physical(slots));return}
  const s=slots[p-1];if(s.s){visit(p+1);return}
  visit(p+1)
  for(const v of o.servants)if(!used.has(v.id)){used.add(v.id);Object.assign(s,{f:1,svt:v.id});visit(p+1);Object.assign(s,{f:0,svt:0});used.delete(v.id)}
 }
 visit(1);return answers
}
function check(opts,expected,label){
 const q=createScoreTeamSearch(opts),actual=new Set();assert.ok(q.ok,label+': '+q.error)
 for(const e of q.iterator){assert.ok(q.state.stats.nodes<200000,label+' runaway');if(e.type==='team'){const p=q.hydrate(e.record);assert.equal(p.total,0);actual.add(physical(e.record.packed.slots))}}
 assert.deepEqual(actual,expected,label);assert.equal(q.state.maximumProven,expected.size>0);cases++;teams+=actual.size
}
for(const type of ['svtNum','mySvtNum'])for(const range of ['equal','notEqual','below','above','between'])for(let n=0;n<=6;n++){
 const values=range==='between'?[Math.max(0,n-1),n]:[n],opts={...base,quest:{noSupport:true,restrictions:[r(type,values,range)]}}
 // equal six is the pre-existing ordinary domain; include it in the oracle.
 const expected=occupancyOracle(opts,[],own=>{const x=own.length;return x>0&&(range==='equal'?x===n:range==='notEqual'?x!==n:range==='below'?x<=n:range==='above'?x>=n:x>=values[0]&&x<=n)})
 check(opts,expected,type+'/'+range+'/'+n)
}
for(const [rule,predicate] of [
 [r('individuality',[1],'notEqual'),own=>own.every(s=>s.svt!==1)],
 [r('individuality',[10],'equal',[1,2,3]),own=>own.filter(s=>s.p<=3).every(s=>s.svt===1)],
 [r('fixedMySvtIndividualitySingle',[1],'none'),own=>own.every(s=>s.svt===1)],
 [r('fixedMySvtIndividualityPositionMain',[1],'equal',[1]),own=>own.some(s=>s.svt===1&&s.p<=3)],
 [r('fixedMySvtIndividualityPositionMain',[1],'equal',[1,2,3]),own=>own.some(s=>s.svt===1&&s.p<=3)],
 [r('fixedMySvtIndividualityPositionMain',[1,2],'none'),own=>[1,2].every(id=>own.some(s=>s.svt===id&&s.p<=3))],
 [r('fixedSvtIndividualityPositionMain',[1],'below'),own=>own.some(s=>s.svt===1&&s.p<=3)&&!own.some(s=>s.svt===1&&s.p>3)],
 [r('mySvtOrNpc',[1],'equal',[2]),own=>own.some(s=>s.svt===1&&s.p===2)],
 [r('mySvtOrSupport',[1],'equal',[2]),own=>own.some(s=>s.svt===1&&s.p===2)],
 ]){
 const opts={...base,quest:{noSupport:true,restrictions:[rule]}}
 check(opts,occupancyOracle(opts,[],(own,filled)=>own.length>0&&predicate(own,filled)),JSON.stringify(rule))
}
// A fixed NPC and account servant of the same trait may coexist unless the
// phase explicitly declares that trait unique; unrelated traits stay legal.
for(const unique of [[],[1],[1,2]]){
 const n=npc(99,2,[1]),opts={...base,quest:{flags:['noSupportList','supportSvtMultipleSet'],supportServants:[n],restrictions:[r('uniqueIndividuality',unique)]}}
 const expected=occupancyOracle(opts,[{position:2,svtId:99}],own=>own.length>0&&!(unique.includes(1)&&own.some(s=>s.svt===1)))
 check(opts,expected,'NPC uniqueness '+unique)
}
// Two mandatory non-indexed guests are simultaneous, with all legal seats.
{
 const opts={...base,quest:{flags:['noSupportList','supportSvtMultipleSet'],supportServants:[npc(90),npc(91)],restrictions:[r('svtNum',[3])]}}
 const expected=new Set()
 for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(a!==b)for(const k of occupancyOracle(opts,[{position:a,svtId:90},{position:b,svtId:91}],own=>own.length===1))expected.add(k)
 check(opts,expected,'simultaneous mandatory NPCs')
}
// Mandatory NPC can replace the owned identity in its required seat.
{
 const n=npc(99,2,[1]),opts={...base,quest:{flags:['noSupportList','supportSvtMultipleSet'],supportServants:[n],restrictions:[r('mySvtOrNpc',[1],'equal',[2])]}}
 check(opts,occupancyOracle(opts,[{position:2,svtId:99}],own=>own.length>0),'NPC satisfies owned-or-NPC rule')
}
// Guest-only parties are legal zero-bond answers, including an empty account.
for(const count of [1,3,6]){
 const guests=Array.from({length:count},(_,i)=>npc(90+i,i+1)),opts={...base,servants:[],pinSprites:[],quest:{flags:['supportOnlyBattle'],supportServants:guests}}
 check(opts,occupancyOracle(opts,guests.map((s,i)=>({position:i+1,svtId:s.svtId})),()=>true),'all fixed NPC '+count)
}
// Support-only can also select an ordinary friend; only front placements
// can form a one-person battle, and the answer remains a legal zero score.
{
 const opts={...base,servants:[],allowSupport:true,quest:{restrictions:[r('supportOnly',[],'none')]}}
 const expected=new Set()
 for(let p=1;p<=3;p++)for(const key of occupancyOracle(opts,[{position:p,svtId:0}],()=>true))expected.add(key)
 check(opts,expected,'friend-only')
}
// Optional NPCs in a multi-select phase can be selected simultaneously.
{
 const guests=[npc(90,0,[90],{required:false,followerFlags:[]}),npc(91,0,[91],{required:false,followerFlags:[]})]
 const opts={...base,quest:{flags:['noSupportList','supportSvtMultipleSet'],supportServants:guests,restrictions:[r('mySvtNum',[1]),r('svtNum',[3])]}}
 const expected=new Set()
 for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(a!==b)for(const key of occupancyOracle(opts,[{position:a,svtId:90},{position:b,svtId:91}],own=>own.length===1))expected.add(key)
 check(opts,expected,'multi-select optional guests')
}
// A fixed guest owns its physical seat; an owned starting-member requirement
// may use either remaining front seat. No character/quest IDs are special.
for(const vals2 of [[],[1],[1,2,3]])for(const fixed of [1,2,3]){
 const n=npc(90,fixed),quest={flags:['noSupportList','supportSvtMultipleSet'],supportServants:[n],restrictions:[r('fixedMySvtIndividualityPositionMain',[1],'equal',vals2)]},opts={...base,quest}
 check(opts,occupancyOracle(opts,[{position:fixed,svtId:90}],own=>own.some(s=>s.svt===1&&s.p<=3)),'fixed NPC + required owned starting member '+fixed+'/'+vals2)
}
// User pins are still exact seats; back-row-only pins cannot meet a starting
// member requirement. The guest's matching identity cannot replace ownership.
for(const p of [2,3,4,5,6]){
 const opts={...base,quest:{flags:['noSupportList','supportSvtMultipleSet'],supportServants:[npc(90,1,[1])],restrictions:[r('fixedMySvtIndividualityPositionMain',[1],'equal',[1])]},slotPins:[{position:p,svtId:1}]}
 check(opts,occupancyOracle(opts,[{position:1,svtId:90}],own=>own.some(s=>s.svt===1&&s.p===p)&&p<=3),'owned front pin '+p)
}
{
 const opts={...base,servants:[servants[1]],quest:{flags:['noSupportList'],supportServants:[npc(90,1,[1])],restrictions:[r('fixedMySvtIndividualityPositionMain',[1],'equal',[1])]}}
 check(opts,new Set(),'matching NPC cannot fulfill required owned member')
 const ordinary={...base,quest:{noSupport:true,restrictions:[r('mySvtNum',[1],'above')]}}
 check(ordinary,occupancyOracle(ordinary,[],own=>own.length>0),'changing quest removes its deployment requirements')
 const q=createScoreTeamSearch({...base,quest:{restrictions:[r('fixedMySvtIndividualityPositionMain',[1],'equal',[4])]}})
 assert.equal(q.ok,false);assert.match(q.error,/未核验的必选首发参数/);cases++
}
// Both front supports contribute +4%; both fixed CEs are settled, and their
// COST never consumes the account's budget.
{
 const guests=[npc(90,2,[90],{equips:[{ceId:101,ceMlb:true,ce:ce(101,100)},{ceId:102,ceMlb:true,ce:ce(102,200)}]}),npc(91,3)]
 const q=createScoreTeamSearch({...base,base:100,servants:[servants[0]],costLimit:1,
  slotPins:[{position:1,svtId:1},...[4,5,6].map(position=>({position,empty:true}))],quest:{flags:['noSupportList','supportSvtMultipleSet'],supportServants:guests}})
 for(const e of q.iterator)if(e.type==='team'){const p=q.hydrate(e.record);assert.equal(p.total,166);assert.equal(p.costUsed,1);assert.equal(p.slots[1].fixedEquips.length,2)}
 assert.equal(q.state.bestScore,166);cases++
}
// Phase costume overrides are temporarily usable even when not unlocked in
// the account. Form traits and COST must come from that actual forced form.
{
 const s={...svt(1),forms:[{key:'c123',costumeId:19,name:'Forced',traitIds:[20],cost:5}]},account={region:'CN',servants:[{id:1,bondLv:5,bondCap:10,unlockedCostumes:[]}],ces:[]},before=JSON.stringify(account)
 const opts={servants:[s],ces:[],base:100,mode:'account',account,allowSupport:false,costLimit:5,aiMode:'off',quest:{noSupport:true,restrictions:[r('fixedCostume',[1])],partyScript:{overwriteLimitCountSvtIds:[1],overwriteLimitCounts:[19]}}}
 const q=createScoreTeamSearch(opts)
 for(const e of q.iterator)if(e.type==='team'){const p=q.hydrate(e.record);assert.equal(p.slots.find(s=>s.filled).svtArtKey,'c123');assert.equal(p.costUsed,5)}
 assert.equal(q.state.bestScore,120);assert.equal(JSON.stringify(account),before);cases++
}
// Every subset of the allowed Grand seats remains available. Members of
// different classes can be Grand together; inactive seats have no extras.
{
 const opts={...base,quest:{noSupport:true,restrictions:[r('activeGrandBoard',[1,2])]},slotPins:[{position:1,svtId:1},{position:2,svtId:2},...[3,4,5,6].map(position=>({position,empty:true}))]}
 const q=createScoreTeamSearch(opts),flags=new Set()
 for(const e of q.iterator)if(e.type==='team'){q.hydrate(e.record);flags.add(e.record.packed.slots.slice(0,2).map(s=>s.g).join(''))}
 assert.deepEqual(flags,new Set(['00','01','10','11']));cases++
}
// Independent free/normal Grand equipment assignment: compare every physical
// zero-score loadout, preserving scarce copies across two active Grands.
for(const mixedMlb of [false,true]){
 const cards=[ce(101),ce(102)],opts={...base,ces:cards,account:{...base.account,ces:cards.map(c=>({id:c.id,count:mixedMlb?2:1,mlbCount:1}))},costLimit:4,
  quest:{noSupport:true,restrictions:[r('activeGrandBoard',[1,2])]},slotPins:[{position:1,svtId:1},{position:2,svtId:2},...[3,4,5,6].map(position=>({position,empty:true}))]}
 const key=ss=>JSON.stringify(ss.slice(0,2).map(s=>[s.g,s.ce,s.ce?s.mlb!==false:true,s.reward||0,s.reward?s.rewardMlb!==false:true,s.bond||0])),expected=new Set(),actual=new Set()
 for(const a of [0,1])for(const b of [0,1]){
  const slots=[{g:a,ce:0,reward:0},{g:b,ce:0,reward:0}],fields=[{at:0,f:'ce'},{at:1,f:'ce'},...(a?[{at:0,f:'reward'}]:[]),...(b?[{at:1,f:'reward'}]:[])],used=new Set()
  function visit(j){if(j===fields.length){expected.add(key(slots));return}const {at,f}=fields[j];slots[at][f]=0;visit(j+1)
   for(const c of cards)for(const mlb of mixedMlb?[true,false]:[true]){const copy=c.id+':'+mlb;if(!used.has(copy)){used.add(copy);slots[at][f]=c.id;slots[at][f==='ce'?'mlb':'rewardMlb']=mlb;visit(j+1);used.delete(copy)}}slots[at][f]=0
  }visit(0)
 }
 const q=createScoreTeamSearch(opts);let records=0
 for(const e of q.iterator)if(e.type==='team'){q.hydrate(e.record);actual.add(key(e.record.packed.slots));records++}
 assert.deepEqual(actual,expected);assert.equal(actual.size,mixedMlb?376:54);assert.equal(records,actual.size);cases++;teams+=actual.size
}

for(const sameClass of [false,true]){
 const cards=[ce(101),ce(102)],opts={...base,servants:servants.map(s=>({...s,className:sameClass?'saber':s.className})),ces:cards,
  account:{...base.account,ces:cards.map(c=>({id:c.id,count:1,mlbCount:1}))},costLimit:2,
  quest:{noSupport:true,restrictions:[r('activeGrandBoard',[1,2])]},slotPins:[{position:1,svtId:1,ceRewardId:101},{position:2,svtId:2,ceRewardId:102},...[3,4,5,6].map(position=>({position,empty:true}))]}
 const q=createScoreTeamSearch(opts);let count=0
 for(const e of q.iterator)if(e.type==='team'){const plan=q.hydrate(e.record);assert.equal(plan.costUsed,2);assert.ok(plan.slots.slice(0,2).every(s=>s.isGrand));count++}
 assert.equal(count,sameClass?0:1);if(sameClass)assert.equal(q.state.stats.nodes,0);cases++;teams+=count
}

{
 const quest={supportServants:[npc(99,1,[],{releaseConditions:[{type:'questNotClear',targetId:1}]})]}
 assert.equal(availableSystemSupports(quest,{questClears:[]}).length,1)
 assert.equal(availableSystemSupports(quest,{questClears:[{id:1,clearNum:1}]}).length,0)
 assert.equal(availableSystemSupports(quest,null).length,0)
 assert.equal(questPartyRules({restrictions:[r('unknown',[1])]}).supported,false)
}
console.log(JSON.stringify({passed:true,cases,physicalTeams:teams,registeredRuleTypes:QUEST_RESTRICTION_TYPES.length}))
