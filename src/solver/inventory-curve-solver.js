import { pickCeSkill } from '../atlas.js'
import { applyRate } from '../bond.js'
import { ceMilliLive } from './solver-index.js'
import { servantCost } from '../servant-cost.js'

// Enumerate equipment effect vectors, then solve an identity-aware COST DP.
// This domain includes inventory copies, unMLB, capped servants, auras and
// both support positions. Unsupported equipment returns null to the general solver.
export function solveInventoryCurves({ servants, ownCes, supportCes, formsOf, base,
  costLimit = null, stateOf = () => ({}), bonuses = {}, onProgress = null } = {}) {
  if (!Number.isSafeInteger(base) || base < 0) return null
  const valid = (ce, mlb) => {
    const fs = pickCeSkill(ce, mlb)?.funcs || []
    return fs.length === 1 && !fs[0].eventId &&
      ((fs[0].target === 'ptFull' && !fs[0].add && fs[0].rate >= 0) ||
       (fs[0].add === 50 && !fs[0].rate && !fs[0].tvals?.length && !fs[0].andTvals?.length))
  }
  if (ownCes.some(ce => !valid(ce, ce.accountMlb !== false)) ||
      supportCes.some(ce => !valid(ce, true))) return null
  const states = new Map(servants.map(s => [s.id, stateOf(s)]))
  const auraIds = servants.filter(s => bonuses[s.id]?.party || states.get(s.id).aura).map(s => s.id)
  if (auraIds.length > 10) return null
  const rows = [], vectors = [], vectorMap = new Map()
  for (const svt of servants) for (const form of formsOf(svt)) {
    const state = states.get(svt.id), bonus = bonuses[svt.id] || {}
    const own = ownCes.map(c => ceMilliLive(c, form, false, c.accountMlb !== false))
    const support = supportCes.map(c => ceMilliLive(c, form, true, true))
    const self = Math.round((bonus.totalSecondLayer || 0) * 1000)
    const sig = JSON.stringify([own, support, self, Boolean(state.maxed), state.aura || 0])
    if (!vectorMap.has(sig)) { vectorMap.set(sig, vectors.length); vectors.push({ own, support, self,
      maxed: Boolean(state.maxed), aura: state.aura || 0 }) }
    rows.push({ svt, form, vector: vectorMap.get(sig), cost: servantCost(svt, form) })
  }
  if (!rows.length) return null
  const groups = new Map()
  ownCes.forEach((ce, i) => {
    const fn = pickCeSkill(ce, ce.accountMlb !== false).funcs[0]
    const rates = vectors.map(v => v.own[i]), flat = fn.add || 0
    const sig = JSON.stringify([rates, flat])
    if (!groups.has(sig)) groups.set(sig, { rates, flat, items: [] })
    groups.get(sig).items.push(ce)
  })
  const equipment = [...groups.values()]
  for (const g of equipment) g.items.sort((a,b) => a.cost-b.cost || a.id-b.id)
  equipment.sort((a,b) => b.rates.reduce((s,r)=>s+r,0)-a.rates.reduce((s,r)=>s+r,0) || b.flat-a.flat)
  const supports = [{ ce: null, rates: vectors.map(()=>0) }], seenSupport = new Set()
  supportCes.forEach((ce,i) => {
    const rates = vectors.map(v=>v.support[i]), sig=JSON.stringify(rates)
    if (!rates.some(Boolean) || seenSupport.has(sig)) return
    seenSupport.add(sig); supports.push({ ce, rates })
  })
  supports.sort((a,b)=>b.rates.reduce((s,r)=>s+r,0)-a.rates.reduce((s,r)=>s+r,0))
  const supportMax = vectors.map((_,i)=>Math.max(...supports.map(s=>s.rates[i])))
  const remainingMax = Array.from({length:equipment.length+1},()=>vectors.map(()=>0))
  for(let i=equipment.length-1;i>=0;i--) vectors.forEach((_,j)=>{
    remainingMax[i][j]=Math.max(equipment[i].rates[j],remainingMax[i+1][j])
  })
  const auraMax = servants.reduce((sum,s)=>sum+Math.round((bonuses[s.id]?.party || 0)*1000)+(states.get(s.id).aura || 0),0)
  const auraVariants = Array.from({length:2**auraIds.length},(_,mask)=>{
    const required=new Set(auraIds.filter((_,i)=>mask&(1<<i)))
    return { required, aura:[...required].reduce((sum,id)=>sum+Math.round((bonuses[id]?.party||0)*1000)+(states.get(id).aura||0),0) }
  }).filter(v=>v.required.size<=5)
  const rate = vectors.map(()=>0), selected=[]
  let best=null, nodes=0, evaluated=0, pruned=0, lastReport=0
  const started=Date.now()
  const upper = (extra, flat, aura=auraMax, sup=supportMax, required=null) => {
    // Independent positions and identities are a relaxation, hence a safe bound.
    const options=new Map()
    for(const r of boundRows){ const v=vectors[r.vector];
      if(required && auraIds.includes(r.svt.id) && !required.has(r.svt.id))continue
      const second=rate[r.vector]+extra[r.vector]+sup[r.vector]+v.self+aura-v.aura
      const old=options.get(r.svt.id)||{id:r.svt.id,f:0,b:0}
      old.f=Math.max(old.f,v.maxed?0:applyRate(applyRate(base,240),second))
      old.b=Math.max(old.b,v.maxed?0:applyRate(applyRate(base,40),second))
      options.set(r.svt.id,old)
    }
    const all=[...options.values()], keep=new Map()
    for(const id of required||[])if(options.has(id))keep.set(id,options.get(id));else return -Infinity
    for(const seat of ['f','b'])for(const r of [...all].sort((a,b)=>b[seat]-a[seat]).slice(0,5))keep.set(r.id,r)
    // Three +24% fronts and two +4% backs relax both real support layouts.
    let dp=Array(12).fill(-Infinity);dp[0]=0
    for(const r of keep.values()){
      const next=required?.has(r.id)?Array(12).fill(-Infinity):dp.slice()
      for(let f=0;f<=3;f++)for(let b=0;b<=2;b++){
        const at=f*3+b
        if(f<3)next[at+3]=Math.max(next[at+3],dp[at]+r.f)
        if(b<2)next[at+1]=Math.max(next[at+1],dp[at]+r.b)
      }
      dp=next
    }
    return Math.max(...dp)+flat
  }
  // Identical vectors are exchangeable only for non-aura identities. Keep n
  // cheapest distinct identities per vector; at most n-1 can be occupied elsewhere.
  const compressed=[]
  const byVector=new Map()
  for(const r of rows){
    if(auraIds.includes(r.svt.id)){compressed.push(r);continue}
    if(!byVector.has(r.vector))byVector.set(r.vector,new Map())
    const map=byVector.get(r.vector), old=map.get(r.svt.id)
    if(!old || r.cost<old.cost)map.set(r.svt.id,r)
  }
  for(const map of byVector.values())compressed.push(...[...map.values()].sort((a,b)=>a.cost-b.cost||a.svt.id-b.svt.id).slice(0,5))
  const boundRows=compressed
  const zero=vectors.map(()=>0)
  function evaluate(flat,ceCost){
    for(const sup of supports)for(let mask=0;mask<2**auraIds.length;mask++){
      const required=new Set(auraIds.filter((_,i)=>mask&(1<<i)))
      if(required.size>5)continue
      const aura=[...required].reduce((sum,id)=>sum+Math.round((bonuses[id]?.party||0)*1000)+(states.get(id).aura||0),0)
      if(best && upper(zero,flat,aura,sup.rates,required)<=best.score){pruned++;continue}
      for(const supportFront of [false,true]){
        const frontCap=supportFront?2:3, backCap=5-frontCap
        const options=new Map()
        for(const r of compressed){
          if(auraIds.includes(r.svt.id) && !required.has(r.svt.id))continue
          const v=vectors[r.vector], second=rate[r.vector]+sup.rates[r.vector]+v.self+aura-v.aura
          const f=v.maxed?0:applyRate(applyRate(base,supportFront?240:200),second)
          const b=v.maxed?0:applyRate(applyRate(base,supportFront?40:0),second)
          if(!options.has(r.svt.id))options.set(r.svt.id,[])
          const list=options.get(r.svt.id)
          if(list.some(x=>x.cost<=r.cost&&x.f>=f&&x.b>=b))continue
          options.set(r.svt.id,list.filter(x=>!(r.cost<=x.cost&&f>=x.f&&b>=x.b)).concat({row:r,cost:r.cost,f,b}))
        }
        // Retain the five best alternatives for every cost ceiling and seat.
        const keep=new Set(required)
        const all=[...options.entries()].flatMap(([id,list])=>list.map(x=>({...x,id})))
        const costs=[...new Set(all.map(x=>x.cost))]
        for(const seat of ['f','b'])for(const cost of costs){
          const ranked=all.filter(x=>x.cost<=cost).sort((a,b)=>b[seat]-a[seat]||a.cost-b.cost)
          const ids=new Set();for(const x of ranked){ids.add(x.id);keep.add(x.id);if(ids.size===5)break}
        }
        const budget=costLimit==null?Infinity:costLimit-ceCost
        if(budget<0)continue
        const at=(f,b)=>f*(backCap+1)+b
        let dp=Array.from({length:(frontCap+1)*(backCap+1)},()=>[])
        dp[0]=[{score:0,cost:0,front:[],back:[],live:0}]
        for(const [id,choices] of options){
          if(!keep.has(id))continue
          const next=required.has(id)?dp.map(()=>[]):dp.map(xs=>xs.slice())
          for(let f=0;f<=frontCap;f++)for(let b=0;b<=backCap;b++)for(const prev of dp[at(f,b)]){
            if(f+b===5)continue
            for(const x of choices)for(const seat of ['front','back']){
              if(seat==='front'?f===frontCap:b===backCap)continue
              const cost=prev.cost+x.cost;if(cost>budget)continue
              const score=prev.score+x[seat==='front'?'f':'b']
              const live=prev.live+(vectors[x.row.vector].maxed?0:1)
              const index=at(f+(seat==='front'?1:0),b+(seat==='back'?1:0)), list=next[index]
              if(list.some(p=>p.cost<=cost&&p.score>=score&&p.live>=live))continue
              next[index]=list.filter(p=>!(cost<=p.cost&&score>=p.score&&live>=p.live)).concat({score,cost,live,
                front:seat==='front'?[...prev.front,x.row]:prev.front,
                back:seat==='back'?[...prev.back,x.row]:prev.back})
            }
          }
          dp=next
        }
        evaluated++
        for(let f=0;f<=frontCap;f++)for(let b=0;b<=backCap;b++)for(const p of dp[at(f,b)]){
          const n=f+b;if(!n || n<selected.length)continue
          // Portraits must be equipped on eligible own servants to award +50.
          const score=p.score+Math.min(flat,p.live*50), cost=p.cost+ceCost
          if(!best || score>best.score || score===best.score&&cost<best.cost)
            best={...p,score,cost,supportFront,ownCes:selected.slice(),supportCe:sup.ce}
        }
      }
    }
  }
  function walk(i,remaining,flat,cost){
    nodes++
    if(onProgress&&Date.now()-lastReport>250){lastReport=Date.now();onProgress({nodes,pruned,bestScore:best?.score||0,elapsed:Date.now()-started})}
    if(costLimit!=null&&cost>costLimit){pruned++;return}
    const extra=remainingMax[i].map(x=>x*remaining)
    if(best&&upper(extra,flat+remaining*50)<=best.score){pruned++;return}
    if(best && i>=3 && auraVariants.length>2 && !auraVariants.some(v=>
      upper(extra,flat+remaining*50,v.aura,supportMax,v.required)>best.score)){pruned++;return}
    if(i===equipment.length||!remaining){evaluate(flat,cost);return}
    const g=equipment[i]
    for(let k=Math.min(remaining,g.items.length);k>=0;k--){
      const picks=g.items.slice(0,k);selected.push(...picks)
      vectors.forEach((_,j)=>rate[j]+=g.rates[j]*k)
      walk(i+1,remaining-k,flat+g.flat*k,cost+picks.reduce((s,c)=>s+(c.cost||0),0))
      vectors.forEach((_,j)=>rate[j]-=g.rates[j]*k)
      selected.splice(selected.length-k,k)
    }
  }
  walk(0,5,0,0)
  if(!best)return null
  const slots=Array.from({length:6},(_,i)=>({p:i+1,f:0,s:0,g:0,svt:0,art:'',ce:0,bond:0,reward:0}))
  const supportPos=best.supportFront?3:6
  const ownPositions=[1,2,3,4,5,6].filter(p=>p!==supportPos)
  const frontPositions=ownPositions.filter(p=>p<=3),backPositions=ownPositions.filter(p=>p>3)
  const team=[...best.front.map((r,i)=>({r,p:frontPositions[i]})),...best.back.map((r,i)=>({r,p:backPositions[i]}))]
  for(const {r,p} of team)slots[p-1]={...slots[p-1],f:1,svt:r.svt.id,art:r.form.key==='default'?'':r.form.key}
  // Put all portraits on eligible members before distributing percentage CEs.
  const equipmentOrder=[...best.ownCes].sort((a,b)=>(pickCeSkill(b,b.accountMlb!==false).funcs[0].add||0)-(pickCeSkill(a,a.accountMlb!==false).funcs[0].add||0))
  const wearers=[...team].sort((a,b)=>Number(vectors[a.r.vector].maxed)-Number(vectors[b.r.vector].maxed))
  equipmentOrder.forEach((c,i)=>{slots[wearers[i].p-1].ce=c.id;slots[wearers[i].p-1].mlb=c.accountMlb!==false})
  slots[supportPos-1]={...slots[supportPos-1],f:1,s:1,ce:best.supportCe?.id||0,mlb:true}
  return {slots,cost:best.cost,score:best.score,certificate:{method:'inventory-ce-vector-cost-dp',complete:true,
    nodes,evaluated,pruned,identities:servants.length,forms:rows.length,vectors:vectors.length,
    ceGroups:equipment.length,supportVectors:supports.length,scope:'normal-party-inventory-cost-both-support-positions'}}
}
