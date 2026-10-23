import assert from 'node:assert/strict'
import {recommendTeam,createScoreTeamSearch} from '../recommend.js'
import {expandScoreTeamFamily} from './score-team-equivalence.js'
import {literalScoreTeams,physicalTeamKey} from './score-team-oracle-fixture.js'
const svt=id=>({id,collectionNo:id,name:'S'+id,className:'saber',rarity:3,cost:1,traitIds:[]})
const ce=(id,cost=1)=>({id,name:'CE'+id,cost,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[]}))})
const restriction=(type,n=6)=>({type,rangeType:'equal',targetVals:[n]})
const fixed=n=>restriction('fixedSupportPosition',n)
const campaign={extraPassives:[],questFriendships:[{eventId:0,allQuests:true,targetIds:[1],rate:0.2,startedAt:1,endedAt:4102444800}]}
const eventBonus=target=>({extraPassives:[{type:'extraPassive',servantId:1,skillId:1,eventId:999999,rate:0.5,add:0,target,startedAt:1,endedAt:4102444800,applySupportSvt:1}],questFriendships:[]})
const npc={id:9,svtId:700100,name:'NPC',required:true,releaseConditions:[],equips:[]}
const kinds=[
 ['event-self',{quest:{eventId:999999},bondBonuses:eventBonus('self')}],
 ['event-party',{quest:{eventId:999999},bondBonuses:eventBonus('ptFull')}],
 ['ordinary',{}],['live-campaign',{bondBonuses:campaign}],
 ['no-support',{quest:{flags:['eventDeckNoSupport']}}],
 ['fixed-friend-front',{quest:{restrictions:[fixed(1)]}}],
 ['fixed-friend-back',{quest:{restrictions:[fixed(6)]}}],
 ['system-npc',{quest:{flags:['noSupportList'],supportServants:[npc],restrictions:[fixed(1)]}}],
 ['system-npc-equipment',{quest:{flags:['noSupportList'],supportServants:[{...npc,equips:[{ceId:901,ceMlb:false,ce:ce(901)}]}],restrictions:[fixed(6)]}}],
 ['six-own',{quest:{restrictions:[restriction('mySvtNum')]}}],
 ['six-total',{quest:{restrictions:[restriction('svtNum')]}}],
 ['grand',{questType:'grand',questClass:'saber',grandPosition:1}],
]
const servants=[svt(1),svt(2)],account={region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4,isGrand:s.id===2})),ces:[{id:101,count:2,mlbCount:1},{id:102,count:1,mlbCount:1}]}
const base={servants,ces:[ce(101),ce(102)],mode:'account',account,base:0,costLimit:6,aiMode:'off',slotPins:[3,4,5].map(position=>({position,empty:true}))}
const variants=[{},
 {pinCes:[{svtId:1,ceId:101}]},
 {pinCes:[{ceId:101}]},
 {pinCes:[{svtId:1,ceId:101},{svtId:1,ceId:101},{ceId:101}]},
 {pinCes:[{svtId:1,ceId:101},{svtId:2,ceId:101}]},
 {pinCes:[{svtId:1,ceId:101},{svtId:2,ceId:101}],account:{...account,ces:[{id:101,count:1,mlbCount:1}]}},
 {pinCes:[{svtId:1,ceId:101}],account:{...account,ces:[]}},
 {pinCes:[{svtId:1,ceId:101},{svtId:1,ceId:102}]},
 {pinCes:[{ceId:101},{ceId:102}]},
 {pinCes:[{ceId:101},{ceId:102}],costLimit:3},
 {slotPins:[...base.slotPins,{position:2,svtId:1,ceId:101}],pinCes:[{svtId:1,ceId:102}]},
 {pinCes:[{svtId:1,ceId:101}],ces:[ce(101,20),ce(102)]},
]
let oracleCases=0,physicalTeams=0
for(const [kind,extra] of kinds)for(let variant=0;variant<variants.length;variant++)for(const compact of [false,true]){
 const opts={...base,...extra,...variants[variant],scoreTeamAudit:{compact}},domains=[]
 const prepared=recommendTeam({...opts,scoreTeamPrepareOnly:true,onScoreTeamDomain:d=>domains.push(d)})
 const q=createScoreTeamSearch(opts)
 assert.equal(q.ok,prepared.ok)
 if(!prepared.ok)continue
 const expected=new Set(domains.flatMap(d=>[...literalScoreTeams(d)])),actual=new Set()
 for(const e of q.iterator){
  assert.ok(q.state.stats.nodes<200000,`${kind}/${variant}/${compact} runaway small domain`)
  if(e.type!=='team')continue
  q.hydrate(e.record)
  for(const r of expandScoreTeamFamily(e.record,q.equivalenceCatalogs[e.record.domain])){
   const key=physicalTeamKey(r.packed);assert.ok(!actual.has(key),`${kind}/${variant}/${compact} duplicate physical team`);actual.add(key)
  }
 }
 assert.deepEqual(actual,expected,`${kind}/${variant}/${compact}: all legal zero-score physical teams`)
 assert.equal(q.state.maximumProven,expected.size>0)
 oracleCases++;physicalTeams+=actual.size
}
// Large rosters make late-only checks impractical. Every impossible fixture
// below must finish, not merely stop at a node/time limit.
const large=Array.from({length:24},(_,i)=>svt(i+1))
const largeBase={...base,servants:large,slotPins:[],base:4748,costLimit:116,account:{...account,servants:large.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4,isGrand:s.id===24}))}}
const conflicts=[
 ['missing-stock',{pinCes:[{svtId:24,ceId:101}],account:{...largeBase.account,ces:[]}}],
 ['shared-one-copy',{pinCes:[{svtId:23,ceId:101},{svtId:24,ceId:101}],account:{...largeBase.account,ces:[{id:101,count:1,mlbCount:1}]}}],
 ['same-wearer-two-ces',{pinCes:[{svtId:24,ceId:101},{svtId:24,ceId:102}]}],
 ['required-cost',{pinCes:[{svtId:24,ceId:101}],ces:[ce(101,200)]}],
 ['late-slot-cost',{allowSupport:false,slotPins:[{position:6,svtId:24,ceId:101}],ces:[ce(101,200)]}],
]
let conflictsChecked=0
for(const [kind,extra] of kinds)for(const [name,conflict] of conflicts){
 const q=createScoreTeamSearch({...largeBase,...extra,...conflict})
 if(!q.ok)continue
 for(const e of q.iterator){assert.ok(q.state.stats.nodes<64,`${kind}/${name} must reject before broad expansion`);assert.notEqual(e.type,'best');assert.notEqual(e.type,'team')}
 assert.equal(q.state.complete,true);assert.equal(q.state.maximumProven,false);conflictsChecked++
}
for(const [kind,extra] of kinds.filter(([kind])=>['six-own','six-total','system-npc'].includes(kind))){
 const q=createScoreTeamSearch({...largeBase,...extra,servants:large.slice(0,kind==='six-own'?5:4),quest:{...extra.quest,restrictions:[...(extra.quest.restrictions||[]),restriction(kind==='six-own'?'mySvtNum':'svtNum')]}})
 assert.equal(q.ok,true)
 for(const e of q.iterator)assert.ok(q.state.stats.nodes<64,`${kind} must count identities, not forms`)
 assert.equal(q.state.complete,true);assert.equal(q.state.maximumProven,false);conflictsChecked++
}
// Scarce forced equipment at the final seat remains available after optional
// early fields, and its COST is reserved before expanding those prefixes.
for(const copies of [1,2]){
 const opts={...largeBase,allowSupport:false,ces:[ce(101,10),ce(102,1)],account:{...largeBase.account,ces:[{id:101,count:copies,mlbCount:1},{id:102,count:6,mlbCount:1}]},slotPins:[{position:6,svtId:24,ceId:101}]}
 const q=createScoreTeamSearch(opts);let found=false
 for(const e of q.iterator){assert.ok(q.state.stats.nodes<128);if(e.type==='best'){assert.equal(q.hydrate(e.record).slots[5].ceId,101);found=true;break}}
 assert.equal(found,true)
}
// Unsupported quest restrictions are rejected explicitly during preparation.
for(const quest of [{flags:['supportOnlyBattle']},{restrictions:[restriction('mySvtNum',3)]},{restrictions:[{type:'unknown-rule'}]},{flags:['noSupportList'],npcSupportCount:1},{flags:['noSupportList'],supportServants:[npc,{...npc,id:10}]},{flags:['noSupportList'],supportServants:[{...npc,releaseConditions:[{type:'unknown'}]}]}]){
 const q=createScoreTeamSearch({...largeBase,quest});assert.equal(q.ok,false);assert.match(q.error,/尚未支持|缺少|固定/)
}
console.log(JSON.stringify({passed:true,questKinds:kinds.map(([kind])=>kind),oracleCases,physicalTeams,largeConflicts:conflictsChecked}))
