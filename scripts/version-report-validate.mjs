import assert from 'node:assert/strict'
import {calcParty} from '../src/bond.js'
import {applyCraftEssences} from '../src/atlas.js'
import {servantCost} from '../src/servant-cost.js'
const normalize=(slots,core)=>slots.map(s=>core?{position:s.p,filled:!!s.f,isSupport:!!s.s,svtId:s.svt,
 svtArtKey:s.art||'default',ceId:s.ce,ceMlb:s.mlb!==false}:{position:s.position,filled:!!s.filled,
 isSupport:!!s.isSupport,svtId:s.svtId,svtArtKey:s.svtArtKey||'default',ceId:s.ceId,ceMlb:s.ceMlb!==false})
export function validatePlan(opts,plan,core){
 const slots=normalize(plan.slots,core),own=slots.filter(s=>s.filled&&!s.isSupport),ids=own.map(s=>s.svtId)
 assert.equal(new Set(ids).size,ids.length,'duplicate servant identities')
 let cost=0,aura=0
 const ces=core?opts.ownCes:opts.ces,owned=core?opts.ownCes.map(c=>({id:c.id,mlb:c.accountMlb!==false})):
  opts.mode==='account'?structuredClone(opts.account.ces):null
 for(const s of own){
  const servant=opts.servants.find(x=>x.id===s.svtId);assert.ok(servant,'servant outside query')
  const form=(core?opts.forms[servant.id]:opts.validationForms[servant.id]).find(f=>f.key===s.svtArtKey)
  assert.ok(form,'unknown form');cost+=servantCost(servant,form)
  if(s.ceId){
   const ce=ces.find(c=>c.id===s.ceId);assert.ok(ce,'unknown CE');cost+=ce.cost||0
   if(owned){const i=owned.findIndex(c=>c.id===s.ceId&&!!c.mlb===s.ceMlb);assert.ok(i>=0,'CE inventory/MLB exceeded');owned.splice(i,1)}
  }
  if(core)aura+=(opts.states[servant.id]?.aura||0)+Math.round((opts.bonuses[servant.id]?.party||0)*1000)
 }
 assert.equal(cost,core?plan.cost:plan.costUsed,'independent COST settlement')
 assert.ok(opts.costLimit==null||cost<=opts.costLimit,'COST limit')
 for(const id of core?opts.requiredIds||[]:opts.lockSvtIds||[])assert.ok(ids.includes(id),'required servant missing')
 for(const s of own){
  if(core){
   const seat=opts.requiredSeats?.[s.svtId]
   if(seat)assert.equal(s.position<=3?'front':'back',seat)
   if(opts.fixedPositions?.[s.svtId])assert.equal(s.position,opts.fixedPositions[s.svtId])
  }
 }
 for(const position of core?opts.emptyPositions||[]:(opts.slotPins||[]).filter(p=>p.empty).map(p=>p.position))
  assert.equal(slots.find(s=>s.position===position)?.filled,false,'locked empty slot')
 if(!core)for(const pin of opts.slotPins||[])if(pin.svtId)assert.equal(slots.find(s=>s.position===pin.position)?.svtId,pin.svtId)
 if(!core&&opts.allowSupport===false)assert.ok(!slots.some(s=>s.filled&&s.isSupport),'no-support rule')
 const supportPosition=opts.quest?.restrictions?.find(r=>r.type==='fixedSupportPosition')?.targetVals?.[0]
 if(!core&&supportPosition)assert.equal(slots.find(s=>s.isSupport&&s.filled)?.position,supportPosition,'fixed support position')
 if(core){
  assert.ok(own.length>=Math.max(1,opts.minimumOwn||1));assert.ok(own.some(s=>s.position<=3))
  const party=slots.filter(s=>s.filled).map(s=>{
   if(s.isSupport)return {...s,ceMlb:true}
   const state=opts.states[s.svtId]||{},form=opts.forms[s.svtId].find(f=>f.key===s.svtArtKey)
   return {...s,traitIds:form.traitIds,bondMaxed:state.maxed,bond15:false,
    eventPassive:(opts.bonuses[s.svtId]?.totalSecondLayer||0)+(aura-(state.aura||0))/1000}
  })
  applyCraftEssences(party,[...opts.ownCes,...opts.supportCes])
  const settled=calcParty(opts.base,false,party,{bond15Aura:false})
  assert.equal(settled.ok,true);assert.equal(settled.results.reduce((n,x)=>n+x.final,0),plan.score,'independent rounded bond score')
 }
 return slots
}
