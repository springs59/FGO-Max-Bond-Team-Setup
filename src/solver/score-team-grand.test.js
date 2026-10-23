import assert from 'node:assert/strict'
import {recommendTeam,createScoreTeamSearch} from '../recommend.js'
import {createScoreTeamController} from './score-team-worker.js'

const svt=(id,cost=1)=>({id,collectionNo:id,name:'Assassin '+id,className:'assassin',rarity:3,cost,traitIds:[]})
const card={id:101,cost:1,name:'CE',skills:[{condLimitCount:0,funcs:[]},{condLimitCount:4,funcs:[]}]}
const blank=p=>({p,f:0,s:0,g:0,svt:0,art:'',ce:0,mlb:true,bond:0,reward:0})
const key=packed=>JSON.stringify(packed.slots.map(s=>[s.p,s.f,s.s,s.f?s.g:0,s.svt,s.art||'',s.ce,s.ce?s.mlb!==false:true,s.bond||0,s.reward||0,s.bond?s.bondMlb!==false:true,s.reward?s.rewardMlb!==false:true]))

// Independent literal construction: assign physical members first and check
// every final seat constraint, then all stock-valid equipment. No production
// bounds, Grand-seat pruning or equivalence compiler is used by this oracle.
function literal(d){
 const result=new Set(),slots=Array.from({length:6},(_,i)=>blank(i+1)),used=new Set()
 const copies=new Map();for(const c of d.ownCes){const k=c.id+':'+(c.accountMlb!==false);if(!copies.has(k))copies.set(k,{c,n:0});copies.get(k).n++}
 for(const support of d.layouts){
  for(let i=0;i<6;i++)slots[i]=blank(i+1)
  if(support)Object.assign(slots[support-1],{f:1,s:1,g:1})
  const positions=[1,2,3,4,5,6].filter(p=>p!==support)
  function members(at){
   if(at<positions.length){
    const p=positions[at]
    slots[p-1]=blank(p);members(at+1)
    if(d.pins.some(pin=>pin.position===p&&pin.empty&&!pin.reserved))return
    for(const r of d.rows)if(!used.has(r.svt.id)){
     used.add(r.svt.id);slots[p-1]={...blank(p),f:1,svt:r.svt.id,art:r.form.key==='default'?'':r.form.key};members(at+1);used.delete(r.svt.id)
    }
    slots[p-1]=blank(p);return
   }
   const own=slots.filter(s=>s.f&&!s.s)
   if(own.length<d.minimumOwn||!own.length||!slots.slice(0,3).some(s=>s.f)||d.requiredIds.some(id=>!own.some(s=>s.svt===id)))return
   if(d.pins.some(pin=>pin.position===support&&(pin.svtId||pin.empty&&!pin.reserved&&!pin.support)))return
   if(own.some(s=>d.fixedPositions[s.svt]&&d.fixedPositions[s.svt]!==s.p))return
   if(d.pins.some(pin=>!pin.support&&(pin.svtId&&slots[pin.position-1].svt!==pin.svtId||pin.formKey&&slots[pin.position-1].art!==(pin.formKey==='default'?'':pin.formKey))))return
   for(const g of own){
    if(d.grandPosition?g.p!==d.grandPosition:g.p>3)continue
    if(d.grandIds.length&&!d.grandIds.includes(g.svt))continue
    for(const s of own)s.g=Number(s===g)
    if(d.pins.some(pin=>pin.position!==support&&(pin.ceBondId||pin.ceRewardId)&&pin.position!==g.p))continue
    const fields=own.map(s=>({s,f:'ce'})).concat([{s:g,f:'reward'},{s:g,f:'bond'}])
    function equipment(j,cost){
     if(d.costLimit!=null&&cost>d.costLimit)return
     if(j===fields.length){
      const normal=support?(d.lockSupportCeId?d.supportCes.filter(c=>c.id===d.lockSupportCeId):[null,...d.supportCes]):[null]
      for(const ce of normal)for(const reward of support?[null,...d.supportCes]:[null]){
       if(ce&&reward&&ce.id===reward.id&&d.supportCes.filter(c=>c.id===ce.id).length<2)continue
       if(support)Object.assign(slots[support-1],{ce:ce?.id||0,mlb:ce?.supportMlb!==false,reward:reward?.id||0,rewardMlb:true})
       if(d.pins.some(pin=>{const s=slots[pin.position-1];return pin.ceId&&s.ce!==pin.ceId||pin.ceBondId&&s.bond!==pin.ceBondId||pin.ceRewardId&&s.reward!==pin.ceRewardId}))continue
       if(d.pinCes.some(pin=>!own.some(s=>s.ce===pin.ceId&&(!pin.svtId||s.svt===pin.svtId))))continue
       result.add(key({slots}))
      }
      return
     }
     const {s,f}=fields[j],pin=d.pins.find(p=>p.position===s.p),forced=f==='ce'?(pin?.ceId||d.pinCes.find(p=>p.svtId===s.svt)?.ceId||0):f==='bond'?pin?.ceBondId||0:pin?.ceRewardId||0
     s[f]=0;if(!forced)equipment(j+1,cost)
     for(const v of copies.values())if(v.n&&(!forced||v.c.id===forced)&&(f!=='bond'||forced||Number(v.c.bondEquipOwner)===s.svt)){
      v.n--;s[f]=v.c.id;s[f==='ce'?'mlb':f+'Mlb']=v.c.accountMlb!==false
      equipment(j+1,cost+(f==='ce'?v.c.cost||0:0));v.n++
     }
     s[f]=0
    }
    equipment(0,own.reduce((n,s)=>n+d.rows.find(r=>r.svt.id===s.svt&&r.form.key===(s.art||'default')).cost,0))
   }
  }
  members(0)
 }
 return result
}

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
