import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { pickCeSkill } from '../src/atlas.js'
import { applyRate } from '../src/bond.js'
import { ceMilliLive } from '../src/solver/solver-index.js'
import { servantCost } from '../src/servant-cost.js'
const url=new URL('../src/solver/inventory-curve-solver.js',import.meta.url)
let source=readFileSync(url,'utf8')
const marker='  walk(0,cap,0,0);if(!best)return null'
if(!source.includes(marker))throw Error('Exact completion instrumentation marker changed')
source=source.replace(marker,`
  if(globalThis.__conditionedProposals) {
    for(const [index,counts] of globalThis.__conditionedProposals.entries()) {
      if(counts.length!==equipment.length || counts.some((k,i)=>!Number.isInteger(k)||k<0||k>equipment[i].items.length) || counts.reduce((a,b)=>a+b,0)>cap)throw Error('Invalid proposal counts')
      let flat=0,cost=0
      counts.forEach((k,i)=>{
        const g=equipment[i],picks=g.items.slice(0,k);selected.push(...picks)
        flat+=g.flat*k;cost+=picks.reduce((n,c)=>n+(c.cost||0),0)
        vectors.forEach((_,j)=>rate[j]+=g.rates[j]*k)
      })
      if(costLimit==null||cost<=costLimit)evaluate(flat,cost)
      globalThis.__conditionedProgress?.(index,best?packPlan(best):null)
      selected.length=0;rate.fill(0)
    }
  } else walk(0,cap,0,0)
  if(!best)return null`)
source=source.replace('complete:allSupportAlternatives||p.score===best.score','complete:!globalThis.__conditionedProposals&&(allSupportAlternatives||p.score===best.score),approximate:Boolean(globalThis.__conditionedProposals)')
source=source.replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(new URL(p,url).href))
const dir=join(tmpdir(),'fgo-conditioned-settler');mkdirSync(dir,{recursive:true})
const path=join(dir,`inventory-${process.pid}.mjs`);writeFileSync(path,source)
const { solveInventoryCurves:complete }=await import(pathToFileURL(path))
export function settleProposals(opts,counts,onProgress) {
  if(globalThis.__conditionedProposals)throw Error('Nested completion is unsupported')
  globalThis.__conditionedProposals=counts;globalThis.__conditionedProgress=onProgress
  try { return complete({...opts,aiMode:'off'}) }
  finally { delete globalThis.__conditionedProposals;delete globalThis.__conditionedProgress }
}
export function verifyConfigPlan(opts,plan) {
  if(!plan)return {valid:true,empty:true}
  const slots=plan.slots,own=slots.filter(s=>s.f&&!s.s),support=slots.find(s=>s.f&&s.s)
  const ids=own.map(s=>s.svt),used=new Map();let cost=0,flat=0
  const assert=(ok,message)=>{if(!ok)throw Error('Independent plan verification: '+message)}
  assert(new Set(ids).size===ids.length,'duplicate identity')
  assert((opts.layouts||[6,3]).includes(support?.p||0),'support position')
  assert(own.length>=(opts.minimumOwn||1),'minimum own')
  for(const id of opts.requiredIds||[])assert(ids.includes(id),'required identity')
  for(const p of opts.emptyPositions||[])assert(!slots[p-1].f,'empty position')
  const rows=own.map(slot=>{
    const svt=opts.servants.find(s=>s.id===slot.svt);assert(svt,'inventory identity')
    const form=opts.formsOf(svt).find(f=>f.key===(slot.art||'default'));assert(form,'form')
    const seat=opts.requiredSeats?.[svt.id]
    assert(!seat||(seat==='front'?slot.p<=3:slot.p>3),'seat')
    assert(!opts.fixedPositions?.[svt.id]||slot.p===opts.fixedPositions[svt.id],'fixed position')
    cost+=servantCost(svt,form)
    if(slot.ce){const key=slot.ce+':'+(slot.mlb!==false);used.set(key,(used.get(key)||0)+1)}
    return {slot,svt,form,state:opts.stateOf(svt),bonus:opts.bonuses?.[svt.id]||{}}
  })
  const equipment=[]
  for(const [key,n] of used){const matches=opts.ownCes.filter(c=>c.id+':'+(c.accountMlb!==false)===key);assert(matches.length>=n,'equipment inventory');equipment.push(...matches.slice(0,n))}
  for(const ce of equipment){cost+=ce.cost;flat+=pickCeSkill(ce,ce.accountMlb!==false).funcs[0].add||0}
  const supCe=support?.ce?opts.supportCes.find(c=>c.id===support.ce):null
  assert(!support?.ce||supCe,'support equipment')
  if(supCe){const fn=pickCeSkill(supCe,true).funcs[0];flat+=fn.applySupport===0?0:fn.add||0}
  const aura=rows.reduce((n,r)=>n+(r.state.aura||0)+Math.round((r.bonus.party||0)*1000),0)
  const score=rows.reduce((n,r)=>{
    if(r.state.maxed)return n
    const front=(r.slot.p<=3?200:0)+(support&&support.p<=3?40:0)
    const second=equipment.reduce((a,c)=>a+ceMilliLive(c,r.form,false,c.accountMlb!==false),0)+(supCe?ceMilliLive(supCe,r.form,true,true):0)+Math.round((r.bonus.totalSecondLayer||0)*1000)+aura-(r.state.aura||0)
    return n+applyRate(applyRate(opts.base,front),second)+flat
  },0)
  assert(cost===plan.cost,'COST mismatch');assert(score===plan.score,'score mismatch')
  assert(opts.costLimit==null||cost<=opts.costLimit,'COST limit')
  assert(plan.certificate?.complete===false && plan.certificate?.approximate===true,'approximate status')
  return {valid:true,score,cost}
}
