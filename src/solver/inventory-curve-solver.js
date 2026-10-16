import { createLearnedSearch, searchFeatures, proposeEquipmentSeeds } from './ai-search.js'
import { pickCeSkill } from '../atlas.js'
import { applyRate } from '../bond.js'
import { ceMilliLive } from './solver-index.js'
import { servantCost } from '../servant-cost.js'

// Enumerate equipment effects, not parties. Each fixed effect is settled by an
// identity/COST/seat DP. Aura amounts are DP states, never identity subsets.
export function solveInventoryCurves({ servants, ownCes, supportCes, formsOf, base,
  costLimit = null, stateOf = () => ({}), bonuses = {}, onProgress = null,
  requiredIds = [], requiredSeats = {}, fixedPositions = {}, emptyPositions = [],
  layouts = [6, 3], minimumOwn = 1, allSupportAlternatives = true, requireSupportEquipment = false,
  onEvaluatedPlan = null, onAiDomain = null, onCheckpointPlan = null, aiMode = 'auto', aiModel } = {}) {
  if (!Number.isSafeInteger(base) || base < 0) return null
  const valid = (ce, mlb) => {
    const fs = pickCeSkill(ce, mlb)?.funcs || []
    return fs.length === 1 && !fs[0].eventId &&
      ((fs[0].target === 'ptFull' && !fs[0].add && fs[0].rate >= 0) ||
       (fs[0].target === 'ptFull' && fs[0].add === 50 && !fs[0].rate && !fs[0].tvals?.length && !fs[0].andTvals?.length))
  }
  if (ownCes.some(ce => !valid(ce, ce.accountMlb !== false)) || supportCes.some(ce => !valid(ce, true))) return null
  const required = new Set(requiredIds), states = new Map(servants.map(s => [s.id, stateOf(s)]))
  const empty = new Set(emptyPositions)
  const seats = layouts.map(position => {
    const positions = [1,2,3,4,5,6].filter(p => p !== position && !empty.has(p))
    return { position, positions, front: positions.filter(p => p <= 3), back: positions.filter(p => p > 3) }
  }).filter(l => l.front.length && required.size <= l.positions.length &&
    Object.values(fixedPositions).every(p => l.positions.includes(p)))
  if (!seats.length) return null
  const cap = Math.max(...seats.map(l => l.positions.length))
  const contributions = new Map(servants.map(s => [s.id,
    Math.round((bonuses[s.id]?.party || 0)*1000) + (states.get(s.id).aura || 0)]))
  const rows = [], vectors = [], vectorMap = new Map()
  for (const svt of servants) for (const form of formsOf(svt)) {
    const state = states.get(svt.id), bonus = bonuses[svt.id] || {}
    const own = ownCes.map(c => ceMilliLive(c, form, false, c.accountMlb !== false))
    const support = supportCes.map(c => ceMilliLive(c, form, true, true))
    const self = Math.round((bonus.totalSecondLayer || 0)*1000), contribution = contributions.get(svt.id)
    const sig = JSON.stringify([own,support,self,Boolean(state.maxed),state.aura||0,contribution])
    if (!vectorMap.has(sig)) { vectorMap.set(sig,vectors.length); vectors.push({own,support,self,maxed:Boolean(state.maxed),aura:state.aura||0}) }
    rows.push({svt,form,vector:vectorMap.get(sig),cost:servantCost(svt,form),contribution})
  }
  if (!rows.length || [...required].some(id => !rows.some(r => r.svt.id === id))) return null
  const groups = new Map()
  ownCes.forEach((ce,i) => {
    const fn = pickCeSkill(ce,ce.accountMlb!==false).funcs[0], rates = vectors.map(v=>v.own[i]), flat = fn.add||0
    const sig = JSON.stringify([rates,flat])
    if (!groups.has(sig)) groups.set(sig,{rates,flat,items:[]})
    groups.get(sig).items.push(ce)
  })
  const equipment = [...groups.values()]
  for (const g of equipment) g.items.sort((a,b)=>a.cost-b.cost||a.id-b.id)
  equipment.sort((a,b)=>b.rates.reduce((s,r)=>s+r,0)-a.rates.reduce((s,r)=>s+r,0)||b.flat-a.flat)
  const learned=createLearnedSearch({mode:aiMode,model:aiModel,size:equipment.length})
  const equipmentFeatures = g => searchFeatures({rates:g.rates.filter((_,i)=>!vectors[i].maxed),
    cost:g.items[0]?.cost||0,flat:g.flat,count:g.items.length,
    live:vectors.filter(v=>!v.maxed).length/vectors.length,
    self:Math.max(0,...vectors.map(v=>v.self)),party:Math.max(0,...contributions.values()),
    base,budget:costLimit,cap})
  const rowFeatures = r => {const v=vectors[r.vector];return searchFeatures({rates:[...v.own,...v.support],
    cost:r.cost,live:Number(!v.maxed),self:v.self,party:r.contribution,base,budget:costLimit,cap,
    preferred:required.has(r.svt.id)})}
  // Training observes one bounded domain per query, never every search node.
  onAiDomain?.({equipment:equipment.map(g=>({features:equipmentFeatures(g),ids:g.items.map(c=>c.id),
    mlb:g.items.map(c=>c.accountMlb!==false)})),
    servants:rows.map(r=>({features:rowFeatures(r),id:r.svt.id,form:r.form.key}))})
  const equipmentPriorities=new Map()
  if(learned.stats.enabled)for(const g of equipment)equipmentPriorities.set(g,learned.score('equipment',equipmentFeatures(g)))
  if(learned.stats.enabled)equipment.sort((a,b)=>(equipmentPriorities.get(b)??0)-(equipmentPriorities.get(a)??0))
  const supports = requireSupportEquipment ? [] : [{ce:null,rates:vectors.map(()=>0),flat:0}], seenSupport = new Set()
  supportCes.forEach((ce,i)=>{
    const fn=pickCeSkill(ce,true).funcs[0],rates=vectors.map(v=>v.support[i]),flat=fn.applySupport===0?0:fn.add||0,sig=JSON.stringify([rates,flat])
    if ((!requireSupportEquipment&&!rates.some(Boolean)&&!flat)||seenSupport.has(sig)) return
    seenSupport.add(sig);supports.push({ce,rates,flat})
  })
  if (!supports.length) return null
  supports.sort((a,b)=>b.rates.reduce((s,r)=>s+r,0)-a.rates.reduce((s,r)=>s+r,0))
  const supportFlatMax=Math.max(...supports.map(s=>s.flat)),supportMax=vectors.map((_,i)=>Math.max(...supports.map(s=>s.rates[i])))
  const remainingMax=Array.from({length:equipment.length+1},()=>vectors.map(()=>0))
  for(let i=equipment.length-1;i>=0;i--)vectors.forEach((_,j)=>{remainingMax[i][j]=Math.max(equipment[i].rates[j],remainingMax[i+1][j])})
  // At most cap distinct identities contribute. Equal amounts merge; hundreds
  // of event members sharing 5% produce six amounts, rather than 2^N subsets.
  const sums=Array.from({length:cap+1},()=>new Set());sums[0].add(0)
  for(const id of new Set(rows.map(r=>r.svt.id)))for(let n=cap;n>0;n--)for(const x of sums[n-1]){
    sums[n].add(x+contributions.get(id));if(sums[n].size>4096)return null
  }
  const auraTotals=[...new Set(sums.flatMap(s=>[...s]))].sort((a,b)=>b-a),auraMax=auraTotals[0]
  const compressed=[],byVector=new Map()
  for(const r of rows){
    if(required.has(r.svt.id)){compressed.push(r);continue}
    if(!byVector.has(r.vector))byVector.set(r.vector,new Map())
    const map=byVector.get(r.vector),old=map.get(r.svt.id)
    if(!old||r.cost<old.cost)map.set(r.svt.id,r)
  }
  for(const map of byVector.values())compressed.push(...[...map.values()].sort((a,b)=>a.cost-b.cost||a.svt.id-b.svt.id).slice(0,cap))
  const rate=vectors.map(()=>0),selected=[],zero=vectors.map(()=>0),alternatives=new Map()
  const started=Date.now();let best=null,nodes=0,evaluated=0,pruned=0,lastReport=0,lastCheckpoint=null
  const targetCount=seats.reduce((n,l)=>n+(l.position?supports.length:1),0)
  const cutoff=()=>allSupportAlternatives
    ? alternatives.size===targetCount?Math.min(...[...alternatives.values()].map(p=>p.score)):-Infinity : best?.score??-Infinity
  function upper(extra,flat,aura=auraMax,sup=supportMax,layout=null,supportFlat=supportFlatMax){
    return Math.max(...(layout?[layout]:seats).map(l=>{
      const frontMilli=l.position>0&&l.position<=3?240:200,backMilli=l.position>0&&l.position<=3?40:0
      const options=new Map()
      for(const r of compressed){const v=vectors[r.vector],second=rate[r.vector]+extra[r.vector]+(l.position?sup[r.vector]:0)+v.self+aura-v.aura
        const old=options.get(r.svt.id)||{id:r.svt.id,f:-Infinity,b:-Infinity}
        if(requiredSeats[r.svt.id]!=='back')old.f=Math.max(old.f,v.maxed?0:applyRate(applyRate(base,frontMilli),second))
        if(requiredSeats[r.svt.id]!=='front')old.b=Math.max(old.b,v.maxed?0:applyRate(applyRate(base,backMilli),second))
        options.set(r.svt.id,old)
      }
      const all=[...options.values()],keep=new Map()
      for(const id of required)keep.set(id,options.get(id))
      for(const seat of ['f','b'])for(const r of [...all].sort((a,b)=>b[seat]-a[seat]).slice(0,cap))keep.set(r.id,r)
      const width=l.back.length+1,size=(l.front.length+1)*width
      let dp=Array(size).fill(-Infinity);dp[0]=0
      for(const r of keep.values()){
        const next=required.has(r.id)?Array(size).fill(-Infinity):dp.slice()
        for(let f=0;f<=l.front.length;f++)for(let b=0;b<=l.back.length;b++){
          const at=f*width+b
          if(f<l.front.length)next[at+width]=Math.max(next[at+width],dp[at]+r.f)
          if(b<l.back.length)next[at+1]=Math.max(next[at+1],dp[at]+r.b)
        }
        dp=next
      }
      return Math.max(...dp)+(flat+(l.position?supportFlat:0))*l.positions.length
    }))
  }
  function evaluate(flat,ceCost){
    let feasible=0
    for(const [supportIndex,sup] of supports.entries())for(const layout of seats){
      if(!layout.position&&supportIndex)continue
      const key=`${supportIndex}:${layout.position}`,frontCap=layout.front.length,backCap=layout.back.length
      for(const aura of auraTotals){
        const previous=alternatives.get(key),bound=upper(zero,flat,aura,sup.rates,layout,sup.flat)
        if(bound<(allSupportAlternatives?previous?.score??-Infinity:cutoff())){pruned++;continue}
        const options=new Map(),frontMilli=layout.position>0&&layout.position<=3?240:200,backMilli=layout.position>0&&layout.position<=3?40:0
        for(const r of compressed){
          if(r.contribution>aura)continue
          const v=vectors[r.vector],second=rate[r.vector]+(layout.position?sup.rates[r.vector]:0)+v.self+aura-v.aura
          const f=v.maxed?0:applyRate(applyRate(base,frontMilli),second),b=v.maxed?0:applyRate(applyRate(base,backMilli),second)
          const list=options.get(r.svt.id)||[]
          if(list.some(x=>x.cost<=r.cost&&x.f>=f&&x.b>=b))continue
          options.set(r.svt.id,list.filter(x=>!(r.cost<=x.cost&&f>=x.f&&b>=x.b)).concat({row:r,cost:r.cost,f,b}))
        }
        if([...required].some(id=>!options.has(id)))continue
        const keep=new Set(required),all=[...options.entries()].flatMap(([id,list])=>list.map(x=>({...x,id})))
        for(const contribution of new Set(all.map(x=>x.row.contribution))){
          const bucket=all.filter(x=>x.row.contribution===contribution)
          for(const cost of new Set(bucket.map(x=>x.cost)))for(const seat of ['f','b']){
            const ranked=bucket.filter(x=>x.cost<=cost).sort((a,b)=>b[seat]-a[seat]||a.cost-b.cost),ids=new Set()
            for(const x of ranked){ids.add(x.id);keep.add(x.id);if(ids.size===cap)break}
          }
        }
        const budget=costLimit==null?Infinity:costLimit-ceCost;if(budget<0)continue
        const at=(f,b)=>f*(backCap+1)+b
        let dp=Array.from({length:(frontCap+1)*(backCap+1)},()=>[])
        dp[0]=[{score:0,cost:0,front:[],back:[],live:0,aura:0}]
        for(const [id,choices] of options){
          if(!keep.has(id))continue
          const next=required.has(id)?dp.map(()=>[]):dp.map(xs=>xs.slice())
          for(let f=0;f<=frontCap;f++)for(let b=0;b<=backCap;b++)for(const prev of dp[at(f,b)]){
            for(const x of choices)for(const seat of ['front','back']){
              if(seat==='front'?f===frontCap||requiredSeats[id]==='back':b===backCap||requiredSeats[id]==='front')continue
              const cost=prev.cost+x.cost,nextAura=prev.aura+x.row.contribution;if(cost>budget||nextAura>aura)continue
              const score=prev.score+x[seat==='front'?'f':'b'],live=prev.live+(vectors[x.row.vector].maxed?0:1)
              const index=at(f+(seat==='front'?1:0),b+(seat==='back'?1:0)),list=next[index]
              if(list.some(p=>p.aura===nextAura&&p.cost<=cost&&p.score>=score&&p.live>=live))continue
              next[index]=list.filter(p=>!(p.aura===nextAura&&cost<=p.cost&&score>=p.score&&live>=p.live)).concat({score,cost,live,aura:nextAura,
                front:seat==='front'?[...prev.front,x.row]:prev.front,back:seat==='back'?[...prev.back,x.row]:prev.back})
            }
          }
          dp=next
        }
        evaluated++
        for(let f=1;f<=frontCap;f++)for(let b=0;b<=backCap;b++)for(const p of dp[at(f,b)]){
          const n=f+b;if(n<Math.max(minimumOwn,selected.length)||p.aura!==aura)continue
          const score=p.score+(flat+(layout.position?sup.flat:0))*p.live,cost=p.cost+ceCost
          feasible++
          const candidate={...p,score,cost,layout,ownCes:selected.slice(),supportCe:layout.position?sup.ce:null}
          if (onEvaluatedPlan) {
            const packed = packPlan(candidate, false)
            const terms = [...p.front, ...p.back].map((r,i) => {
              const v = vectors[r.vector]
              return { position:packed.slots.find(s=>s.f&&!s.s&&s.svt===r.svt.id).p, svtId:r.svt.id, eligible:!v.maxed, front:1000+(i<p.front.length?frontMilli:backMilli),
                second:1000+rate[r.vector]+(layout.position?sup.rates[r.vector]:0)+v.self+aura-v.aura,
                flat:flat+(layout.position?sup.flat:0) }
            })
            onEvaluatedPlan({ ...packed, curve:{terms} })
          }
          const previous=alternatives.get(key)
          if(!previous||score>previous.score||score===previous.score&&cost<previous.cost)alternatives.set(key,candidate)
          if(!best||score>best.score||score===best.score&&cost<best.cost)best=candidate
        }
      }
    }
    return feasible
  }
  function walk(i,remaining,flat,cost){
    nodes++
    if((onProgress||onCheckpointPlan)&&Date.now()-lastReport>250){
      lastReport=Date.now();onProgress?.({nodes,pruned,bestScore:best?.score||0,elapsed:Date.now()-started,phase:'curve-effects'})
      if(best&&best!==lastCheckpoint){lastCheckpoint=best;onCheckpointPlan?.(packPlan(best))}
    }
    if(costLimit!=null&&cost>costLimit){pruned++;return}
    const extra=remainingMax[i].map(x=>x*remaining),futureFlat=Math.max(0,...equipment.slice(i).map(g=>g.flat))*remaining
    if(best&&upper(extra,flat+futureFlat)<cutoff()){pruned++;return}
    if(allSupportAlternatives&&i>=2&&alternatives.size===targetCount&&seats.every(l=>supports.every((sup,si)=>{
      if(!l.position&&si)return true
      return upper(extra,flat+futureFlat,auraMax,sup.rates,l,sup.flat)<alternatives.get(`${si}:${l.position}`).score
    }))){pruned++;return}
    if(i===equipment.length||!remaining){evaluate(flat,cost);return}
    const g=equipment[i]
    const maxCount=Math.min(remaining,g.items.length),prediction=equipmentPriorities.get(g)
    const counts=prediction==null?null:Array.from({length:maxCount+1},(_,j)=>maxCount-j)
    if(counts){const target=prediction*Math.min(cap,g.items.length);counts.sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)||b-a)}
    for(let j=0;j<=maxCount;j++){
      const k=counts?counts[j]:maxCount-j
      const picks=g.items.slice(0,k);selected.push(...picks);vectors.forEach((_,j)=>rate[j]+=g.rates[j]*k)
      walk(i+1,remaining-k,flat+g.flat*k,cost+picks.reduce((s,c)=>s+(c.cost||0),0))
      vectors.forEach((_,j)=>rate[j]-=g.rates[j]*k);selected.splice(selected.length-k,k)
    }
  }
  if(learned.stats.enabled) {
    const seedStarted=performance.now()
    for(const counts of proposeEquipmentSeeds(equipment,equipmentPriorities,cap,costLimit)) {
      let flat=0,cost=0
      counts.forEach((k,i)=>{
        const g=equipment[i],picks=g.items.slice(0,k)
        selected.push(...picks);flat+=g.flat*k;cost+=picks.reduce((n,c)=>n+(c.cost||0),0)
        vectors.forEach((_,j)=>rate[j]+=g.rates[j]*k)
      })
      learned.stats.seedAttempts++
      if(evaluate(flat,cost)>0)learned.stats.seedFeasible++
      selected.length=0;rate.fill(0)
    }
    learned.stats.seedBestScore=best?.score??null
    learned.stats.seedMs=performance.now()-seedStarted
  }
  // No model-derived bound, early return, or removed branch: finish the same
  // exact search even if the warm start has already found the final answer.
  walk(0,cap,0,0);if(!best)return null
  function packPlan(p, includeCertificate = true){
    const slots=Array.from({length:6},(_,i)=>({p:i+1,f:0,s:0,g:0,svt:0,art:'',ce:0,bond:0,reward:0})),team=[]
    for(const [members,positions] of [[p.front,p.layout.front],[p.back,p.layout.back]]){
      const occupied=new Set(members.map(r=>fixedPositions[r.svt.id]).filter(Boolean)),free=positions.filter(pos=>!occupied.has(pos))
      for(const r of members){const pos=fixedPositions[r.svt.id]||free.shift();team.push({r,p:pos});slots[pos-1]={...slots[pos-1],f:1,svt:r.svt.id,art:r.form.key==='default'?'':r.form.key}}
    }
    const equipmentOrder=[...p.ownCes].sort((a,b)=>(pickCeSkill(b,b.accountMlb!==false).funcs[0].add||0)-(pickCeSkill(a,a.accountMlb!==false).funcs[0].add||0))
    const wearers=[...team].sort((a,b)=>Number(vectors[a.r.vector].maxed)-Number(vectors[b.r.vector].maxed))
    equipmentOrder.forEach((c,i)=>{slots[wearers[i].p-1].ce=c.id;slots[wearers[i].p-1].mlb=c.accountMlb!==false})
    if(p.layout.position)slots[p.layout.position-1]={...slots[p.layout.position-1],f:1,s:1,ce:p.supportCe?.id||0,mlb:true}
    if (!includeCertificate) return {slots,cost:p.cost,score:p.score}
    return {slots,cost:p.cost,score:p.score,certificate:{method:'inventory-ce-vector-cost-dp',complete:allSupportAlternatives||p.score===best.score,nodes,evaluated,pruned,
      identities:servants.length,forms:rows.length,vectors:vectors.length,ceGroups:equipment.length,supportVectors:supports.length,auraAmounts:auraTotals.length,
      scope:layouts.length===2&&layouts.includes(3)&&layouts.includes(6)&&!required.size&&!empty.size&&minimumOwn===1
        ? 'normal-party-inventory-cost-both-support-positions':'constrained-query-effects',
      constraints:{layouts,requiredIds:[...required],requiredSeats,fixedPositions,emptyPositions,minimumOwn},
      ai:learned.stats,
      alternativeCoverage:allSupportAlternatives?'best-per-support-effect-and-position':'feasible-candidates'}}
  }
  const plans=[...alternatives.values()].sort((a,b)=>b.score-a.score||a.cost-b.cost).map(p=>packPlan(p))
  return {...plans[0],plans}
}
