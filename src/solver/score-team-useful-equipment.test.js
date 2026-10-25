import assert from 'node:assert/strict'
import {createScoreTeamSearch} from '../recommend.js'
import {expandScoreTeamFamily} from './score-team-equivalence.js'

const servants=[1,2].map(id=>({id,collectionNo:id,name:'S'+id,className:'saber',rarity:3,cost:1,traitIds:[10]}))
const card=(id,cost,rate=0,flat=0,trait=0)=>({id,cost,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate,add:flat,tvals:trait?[{id:trait}]:[]}]}))})
const ces=[card(101,9),card(102,2,200,0,99),card(103,1,0,50),card(104,3,0,50)]
const base={servants,ces,base:0,costLimit:8,allowSupport:false,aiMode:'off',spriteMode:'strict_order',
 account:{region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4,isGrand:s.id===1})),ces:ces.map(c=>({id:c.id,count:3,mlbCount:1}))},mode:'account',
 slotPins:[3,4,5,6].map(position=>({position,empty:true}))}
let cases=0,physical=0
function check(opts,verify){
 const q=createScoreTeamSearch(opts),records=[]
 assert.ok(q.ok,q.error)
 for(const event of q.iterator){
  if(event.type==='best')verify(q.hydrate(event.record),'preview')
  if(event.type!=='team')continue
  for(const record of expandScoreTeamFamily(event.record,q.equivalenceCatalogs[event.record.domain])){
   verify(q.hydrate(record),'collection');records.push(record);physical++
  }
 }
 assert.ok(q.state.maximumProven&&q.state.complete);assert.ok(records.length);cases++
 return {q,records}
}
for(const grand of [false,true])for(const extended of [false,true]){
 const opts={...base,base:100,questType:grand?'grand':'normal',questClass:'saber',grandPosition:grand?1:0,
  quest:extended?{noSupport:true,restrictions:[{type:'mySvtNum',rangeType:'equal',targetVals:[2]}]}:null}
 const {records}=check(opts,p=>{for(const s of p.slots){assert.notEqual(s.ceId,101);assert.notEqual(s.ceRewardId,101);assert.notEqual(s.ceId,102);assert.notEqual(s.ceRewardId,102);assert.equal(s.ceBondId||0,0)}})
 assert.ok(records.some(r=>r.packed.slots.some(s=>s.ce===103)),'A useful low-COST portrait is retained')
 assert.ok(records.some(r=>r.packed.slots.some(s=>s.ce===104)),'A different useful identity with greater COST is also retained')
}
for(const pinCes of [[{ceId:101}],[{svtId:1,ceId:101}],[{svtId:1,ceId:101},{ceId:101}]]){
 check({...base,costLimit:15,pinCes},p=>assert.equal(p.slots.filter(s=>s.ceId===101).length,1,'Only the explicitly required zero-gain copy is equipped'))
}
for(const reward of [false,true]){
 const opts={...base,base:100,allowSupport:true,questType:'grand',questClass:'saber',grandPosition:1,
  slotPins:[...[3,4,5].map(position=>({position,empty:true})),{position:6,...(reward?{ceRewardId:101}:{ceId:101})}],scoreTeamAudit:{ceFirst:'force'}}
 const {q}=check(opts,p=>{
  const friend=p.slots.find(s=>s.isSupport)
  assert.equal(friend.position,6,'Reward-only locks also reserve the actual friend seat')
  assert.equal(friend[reward?'ceRewardId':'ceId'],101)
  assert.equal(p.slots.filter(s=>!s.isSupport&&s.ceId===101).length,0)
 })
 assert.equal(q.state.stats.ceFirstProofs,1,'Friend equipment locks do not force literal fallback')
}
check({...base,ces:[...ces,{id:105,cost:1,bondEquipOwner:1,skills:[]}],costLimit:8,questType:'grand',questClass:'saber',grandPosition:1,
 account:{...base.account,ces:[...base.account.ces,{id:105,count:1,mlbCount:1}]},slotPins:[{position:1,svtId:1,ceBondId:105},...[3,4,5,6].map(position=>({position,empty:true}))],scoreTeamAudit:{ceFirst:'force'}},p=>assert.equal(p.slots[0].ceBondId,105))
console.log(JSON.stringify({passed:true,cases,physicalTeams:physical,scope:'Optional zero-gain equipment stays empty; conditional misses, useful portraits, higher-COST meaningful ties, explicit normal/reward/bond pins, no duplicate unbound demands, ordinary and extended Grand domains'}))
