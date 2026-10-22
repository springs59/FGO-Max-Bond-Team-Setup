import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {servantBondForms,formUnlocked,ceCostOf} from '../src/recommend.js'
import {servantCost} from '../src/servant-cost.js'
import {applyCraftEssences} from '../src/atlas.js'
import {calcParty} from '../src/bond.js'
import {resolveSlotEventPassives} from '../src/bond/bonus.js'
import {isBond15,isBondMaxed} from '../src/account.js'
import {questPartyRules,minimumOwnCount,availableSystemSupports} from '../src/quest-party-rules.js'

// Reconstruct traits, ownership, CE effects and current event settlement from
// the shared input. Do not trust fields or totals returned by an old solver.
export function validatePlan(o,plan){
 assert.equal(plan?.ok,true,'solver did not return a legal plan')
 const slots=structuredClone(plan.slots),rules=questPartyRules(o.quest||{}),systems=availableSystemSupports(o.quest||{},o.account)
 assert.equal(slots.length,6);assert.deepEqual(slots.map(s=>s.position).sort((a,b)=>a-b),[1,2,3,4,5,6])
 const filled=slots.filter(s=>s.filled),own=filled.filter(s=>!s.isSupport),support=filled.filter(s=>s.isSupport)
 assert.ok(own.length>=Math.max(1,minimumOwnCount(rules,support.length>0)));assert.ok(own.some(s=>s.position<=3),'own front row required')
 assert.equal(new Set(own.map(s=>s.svtId)).size,own.length,'duplicate own servant')
 assert.ok(support.length<=1)
 if((o.allowSupport===false&&!systems.length)||rules.noSupport)assert.equal(support.length,0)
 if(rules.requiresSupport)assert.equal(support.length,1)
 const fixedSupport=(o.quest?.restrictions||[]).some(r=>(r.restriction||r).type==='fixedSupportPosition')
 if(support.length&&fixedSupport)assert.equal(support[0].position,rules.supportPosition)
 const extraCes=systems.flatMap(s=>(s.equips||[]).map(e=>e.ce).filter(Boolean)),ces=[...o.ces,...extraCes]
 const usage=new Map();let cost=0
 for(const s of filled){
  if(s.isSupport){
   if(s.svtId){const sys=systems.find(x=>x.svtId===s.svtId);assert.ok(sys,'unknown system support');assert.equal(s.ceId,sys.equips?.[0]?.ceId||0);assert.equal(s.ceMlb!==false,sys.equips?.[0]?.ceMlb!==false)}
   else assert.notEqual(rules.supportPolicy,'system')
   if(o.lockSupportCeId)assert.equal(s.ceId,o.lockSupportCeId)
   continue
  }
  const svt=o.servants.find(x=>x.id===s.svtId);assert.ok(svt,'servant outside input')
  const rec=o.mode==='account'?o.account.servants.find(x=>x.id===s.svtId):null
  if(o.mode==='account')assert.ok(rec,'unowned servant')
  const form=servantBondForms(svt).find(f=>f.key===(s.svtArtKey||'default'));assert.ok(form,'unknown form');assert.ok(formUnlocked(form,rec,o.mode))
  s.traitIds=form.traitIds||svt.traitIds||[];s.bond15=!!rec&&isBond15(rec);s.bondMaxed=!!rec&&isBondMaxed(rec)
  cost+=servantCost(svt,form)
  for(const field of ['ceId','ceBondId','ceRewardId'])if(s[field]){
   const ce=ces.find(c=>c.id===s[field]);assert.ok(ce,'CE outside input')
   if(field==='ceId')cost+=ceCostOf(ce)
   const mlb=field==='ceId'?s.ceMlb!==false:s[field==='ceBondId'?'ceBondMlb':'ceRewardMlb']!==false
   const u=usage.get(ce.id)||{total:0,mlb:0};u.total++;u.mlb+=Number(mlb);usage.set(ce.id,u)
  }
 }
 assert.equal(cost,plan.costUsed,'independent COST mismatch');if(o.costLimit!=null)assert.ok(cost<=o.costLimit)
 if(o.mode==='account')for(const [id,u] of usage){const r=o.account.ces.find(c=>c.id===id);assert.ok(r,'unowned CE');assert.ok(u.total<=r.count,'CE copies exceeded');assert.ok(u.mlb<=(r.mlbCount||0),'MLB copies exceeded');assert.ok(u.total-u.mlb<=r.count-(r.mlbCount||0),'non-MLB copies exceeded')}
 for(const id of [...o.lockSvtIds||[],...o.preferSvtIds||[]])assert.ok(own.some(s=>s.svtId===id),'required identity missing')
 for(const pin of o.slotPins||[]){const s=slots.find(s=>s.position===pin.position);if(pin.empty)assert.equal(s.filled,false);if(pin.svtId)assert.equal(s.svtId,pin.svtId);if(pin.ceId)assert.equal(s.ceId,pin.ceId);if(pin.formKey&&s.filled)assert.equal(s.svtArtKey||'default',pin.formKey);if(pin.ceBondId)assert.equal(s.ceBondId,pin.ceBondId);if(pin.ceRewardId)assert.equal(s.ceRewardId,pin.ceRewardId)}
 applyCraftEssences(slots,ces);resolveSlotEventPassives(slots,{catalog:o.bondBonuses,quest:o.quest})
 const settled=calcParty(o.base,o.teapot,slots,{bond15Aura:o.bond15Aura});assert.equal(settled.ok,true)
 const primaryIds=new Set([...(o.preferSvtIds||[]),...(o.lockSvtIds||[])]),requestedIds=new Set(o.preferSvtIds||[])
 const total=settled.results.reduce((n,r)=>n+(r.eligible?r.final:0),0),prefer=settled.results.reduce((n,r)=>n+(r.eligible&&primaryIds.has(slots.find(s=>s.position===r.position)?.svtId)?r.final:0),0)
 assert.equal(total,plan.total,'current exact settlement differs')
 const requestedPrefer=settled.results.reduce((n,r)=>n+(r.eligible&&requestedIds.has(slots.find(s=>s.position===r.position)?.svtId)?r.final:0),0)
 assert.ok([prefer,requestedPrefer].includes(plan.preferBond||0),'unrecognized preferred settlement')
 return {score:o.optimizeBy==='prefer'?prefer:total,total,prefer,cost,validated:true,reportedPrefer:plan.preferBond||0,
  objectiveSemanticsMatch:o.optimizeBy!=='prefer'||prefer===(plan.preferBond||0),
  teamSha256:createHash('sha256').update(JSON.stringify(slots.map(s=>[s.position,!!s.filled,!!s.isSupport,s.svtId,s.svtArtKey||'default',s.ceId,s.ceMlb!==false,s.ceBondId||0,s.ceRewardId||0]))).digest('hex')}
}

