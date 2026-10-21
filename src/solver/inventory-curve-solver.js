import { createLearnedSearch, searchFeatures, proposeEquipmentSeeds, proposeEquipmentFrameworks } from './ai-search.js'
import { pickCeSkill } from '../atlas.js'
import { applyRate } from '../bond.js'
import { ceMilliLive } from './solver-index.js'
import { servantCost } from '../servant-cost.js'
import { scoreCompletionBounds } from './score-interval.js'
import { createFrameworkBound } from './framework-bound.js'
import { proposePartyFrameworks } from './party-framework.js'
import { completionFilterBounds } from './completion-filter.js'
import { solveInventoryCurves as solveLegacyInventoryCurves } from './inventory-curve-legacy.js'
import { seatCostBounds } from './seat-cost-bound.js'

// Offline teacher/diagnostics only. A verified feasible start is returned with
// complete:false; this must never be cached or presented as an exact optimum.
export function probeInventoryStart(options={}) {
  return solveInventoryCurves({...options,aiMode:'on',warmStartOnly:true})
}

export function solveInventoryCurves(options={}) {
  const mode=options.aiFramework??'auto'
  const legacy=options.aiMode==='off'||mode==='off'||mode===false||options.onEvaluatedPlan||
    mode==='auto'&&options.aiMode!=='on'&&(options.servants?.length||0)<10&&(options.ownCes?.length||0)<10
  if(legacy){
    if(options.aiDiagnostics&&options.aiMode!=='off')return solveInventoryCurvesEnhanced({...options,aiFramework:'off'})
    return solveLegacyInventoryCurves(options)
  }
  return solveInventoryCurvesEnhanced(options)
}

// Enumerate equipment effects, not parties. Each fixed effect is settled by an
// identity/COST/seat DP. Aura amounts are DP states, never identity subsets.
function solveInventoryCurvesEnhanced({ servants, ownCes, supportCes, formsOf, base,
  costLimit = null, stateOf = () => ({}), bonuses = {}, onProgress = null,
  requiredIds = [], requiredSeats = {}, fixedPositions = {}, emptyPositions = [],
  layouts = [6, 3], minimumOwn = 1, allSupportAlternatives = true, requireSupportEquipment = false,
  onEvaluatedPlan = null, onAiDomain = null, onCheckpointPlan = null, aiMode = 'auto', aiModel, querySession,
  aiSeedMode = 'certified', aiFramework = 'auto', aiDiagnostics = false, warmStartOnly=false } = {}) {
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
    // An optional CE with no effect on any eligible member cannot improve
    // a team. Remove it before constructing the start; keep full audit mode.
    if(aiMode!=='off'&&!onEvaluatedPlan&&!rates.some((r,j)=>r>0&&!vectors[j].maxed)&&
      !(flat>0&&vectors.some(v=>!v.maxed)))return
    const sig = JSON.stringify([rates,flat])
    if (!groups.has(sig)) groups.set(sig,{rates,flat,items:[]})
    groups.get(sig).items.push(ce)
  })
  const equipment = [...groups.values()]
  for (const g of equipment) g.items.sort((a,b)=>a.cost-b.cost||a.id-b.id)
  equipment.sort((a,b)=>b.rates.reduce((s,r)=>s+r,0)-a.rates.reduce((s,r)=>s+r,0)||b.flat-a.flat)
  const equipmentFeatures = g => searchFeatures({rates:g.rates.filter((_,i)=>!vectors[i].maxed),
    cost:g.items[0]?.cost||0,flat:g.flat,count:g.items.length,
    live:vectors.filter(v=>!v.maxed).length/vectors.length,
    self:Math.max(0,...vectors.map(v=>v.self)),party:Math.max(0,...contributions.values()),
    base,budget:costLimit,cap})
  const rowFeatures = r => {const v=vectors[r.vector];return searchFeatures({rates:[...v.own,...v.support],
    cost:r.cost,live:Number(!v.maxed),self:v.self,party:r.contribution,base,budget:costLimit,cap,
    preferred:required.has(r.svt.id)})}
  const learned=createLearnedSearch({mode:aiMode,model:aiModel,size:equipment.length,querySession,
    queryContext:{costLimit,requiredIds,requiredSeats,fixedPositions,emptyPositions,layouts,minimumOwn,allSupportAlternatives,requireSupportEquipment,identitiesCount:servants.length},
    equipmentFeatures:aiMode==='off'?[]:equipment.map(equipmentFeatures),
    servantFeatures:aiMode==='off'?[]:rows.map(rowFeatures)})
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
  let frameworkWork=0
  if(learned.stats.enabled&&aiFramework==='auto'&&!onEvaluatedPlan){
    let counts=new Float64Array(cap+1);counts[0]=1
    for(const g of equipment){const next=new Float64Array(cap+1)
      for(let n=0;n<=cap;n++)for(let k=0;k<=Math.min(n,g.items.length);k++)next[n]=Math.min(100000,next[n]+counts[n-k])
      counts=next
    }
    frameworkWork=Math.min(100000,counts.reduce((n,x)=>n+x,0))*compressed.length*auraTotals.length*
      seats.reduce((n,l)=>n+(l.position?supports.length:1),0)
  }
  const frameworkActive=learned.stats.enabled&&!onEvaluatedPlan&&aiFramework!=='off'&&aiFramework!==false&&
    (aiFramework==='on'||aiFramework===true||aiFramework&&typeof aiFramework==='object'||aiMode==='on'||compressed.length>=8&&frameworkWork>=2000)
  const useFrameworks=frameworkActive&&aiFramework?.seeds!==false
  const usePrefilter=frameworkActive&&aiFramework?.prefilter!==false
  const seatCosts=learned.stats.enabled?seatCostBounds(rows,seats,required,requiredSeats,fixedPositions,minimumOwn):null
  const quickUpper=usePrefilter?createFrameworkBound({rows:compressed,vectors,seats,base,cap,
    policy:learned.upperBoundPolicy,stats:learned.stats}):null
  Object.assign(learned.stats,{frameworkEnabled:frameworkActive,frameworkWork,compressedRows:compressed.length,
    frameworkCounts:0,frameworkWitnesses:0,frameworkImprovements:0,
    frameworkMs:0,prefilterChecks:0,prefilterRejected:0,prefilterWalkRejected:0,prefilterAuraRejected:0,
    exactUpperCalls:0,dpPasses:0,dpLayers:0,resourceStatePruned:0,auraCompletionPruned:0,
    costCompletionPruned:0,seatCostPruned:0,completionBoundPeakBytes:0,...(aiDiagnostics?{dpStatesVisited:0}:{})})
  const rate=vectors.map(()=>0),selected=[],zero=vectors.map(()=>0),alternatives=new Map()
  // At most two short equipment lists, not a journal or an unbounded memo.
  // A seed has already run the same exact DP across every requested stratum.
  const verifiedSeeds=[]
  // Relax seats, aura and score, but retain distinct identities and required
  // members. The cheapest possible party is a safe resource lower bound.
  // AI-off retains its original traversal and does not build these arrays.
  let partyCosts=null
  if(learned.stats.enabled&&(costLimit!=null||aiSeedMode!=='full')){
    const cheapest=new Map()
    for(const r of rows)cheapest.set(r.svt.id,Math.min(cheapest.get(r.svt.id)??Infinity,r.cost))
    const requiredCost=[...required].reduce((n,id)=>n+cheapest.get(id),0)
    const optional=[...cheapest].filter(([id])=>!required.has(id)).map(([,cost])=>cost).sort((a,b)=>a-b)
    const prefix=[0];for(const cost of optional)prefix.push(prefix.at(-1)+cost)
    partyCosts=Array.from({length:cap+1},(_,n)=>requiredCost+(prefix[Math.max(0,Math.max(n,minimumOwn)-required.size)]??Infinity))
    if(seatCosts)partyCosts=partyCosts.map((cost,n)=>Math.max(cost,Math.min(...seatCosts.map(xs=>xs[n]))))
  }
  const started=Date.now();let best=null,nodes=0,evaluated=0,pruned=0,lastReport=0,lastCheckpoint=null
  const targetCount=seats.reduce((n,l)=>n+(l.position?supports.length:1),0)
  const cutoff=()=>allSupportAlternatives
    ? alternatives.size===targetCount?Math.min(...[...alternatives.values()].map(p=>p.score)):-Infinity : best?.score??-Infinity
  function upper(extra,flat,aura=auraMax,sup=supportMax,layout=null,supportFlat=supportFlatMax){
    if(learned.stats.enabled)learned.stats.exactUpperCalls++
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
  function evaluate(flat,ceCost,seed=false){
    if(!seed&&verifiedSeeds.length&&verifiedSeeds.some(picks=>picks.length===selected.length&&picks.every((ce,i)=>ce===selected[i]))){
      learned.stats.seedReused++
      return {feasible:0,complete:true}
    }
    let feasible=0,complete=true
    // The old exact seed pass remains the quality floor. A shortcut is allowed
    // only with a feasible witness attaining BOTH a score upper bound and a
    // resource cost lower bound. Merely improving the incumbent is insufficient.
    const seedCostFloor=seed&&aiSeedMode!=='full'&&!onEvaluatedPlan
      ? ceCost+partyCosts[Math.max(1,minimumOwn,selected.length)] : -Infinity
    for(const [supportIndex,sup] of supports.entries())for(const layout of seats){
      if(!layout.position&&supportIndex)continue
      const floor=seatCosts?.[seats.indexOf(layout)][selected.length]
      if(seatCosts&&(!Number.isFinite(floor)||floor>(costLimit==null?Infinity:costLimit-ceCost))){
        pruned++;learned.stats.seatCostPruned++;continue
      }
      const key=`${supportIndex}:${layout.position}`,frontCap=layout.front.length,backCap=layout.back.length
      auraSearch: for(const aura of auraTotals){
        const previous=alternatives.get(key),threshold=allSupportAlternatives?previous?.score??-Infinity:cutoff()
        if(quickUpper&&Number.isFinite(threshold)){
          learned.stats.prefilterChecks++
          if(quickUpper({rate,flat,aura,support:sup.rates,supportFlat:sup.flat,layout,
            budget:costLimit==null?Infinity:costLimit-ceCost,threshold})<threshold){
            pruned++;learned.stats.lowerBoundPruned++;learned.stats.prefilterRejected++;learned.stats.prefilterAuraRejected++;continue
          }
        }
        const bound=upper(zero,flat,aura,sup.rates,layout,sup.flat)
        if(bound<(allSupportAlternatives?previous?.score??-Infinity:cutoff())){pruned++;if(learned.stats.enabled)learned.stats.lowerBoundPruned++;continue}
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
        const entries=[...options].filter(([id])=>keep.has(id))
        const lastRequired=seed?entries.reduce((last,[id],i)=>required.has(id)?i:last,-1):Infinity
        // Primary-only queries start at the best VERIFIED query score, not at
        // each support's weaker score. Explicit per-support requests retain
        // their own thresholds. Strict inequality preserves equal-score ties.
        const lower=allSupportAlternatives?previous?.score??-Infinity:cutoff()
        const flatTotal=flat+(layout.position?sup.flat:0)
        // The threshold constrains COMPLETED scores, not partial sums. A state
        // is removed before expansion/allocation only if every completion is
        // below the verified feasible threshold. Equality must survive.
        const suffix=learned.stats.enabled&&Number.isFinite(lower)
          ? scoreCompletionBounds(entries,frontCap,backCap,flatTotal,r=>!vectors[r.vector].maxed,requiredSeats):null
        const resources=usePrefilter?completionFilterBounds(entries,frontCap,backCap,flatTotal,
          r=>!vectors[r.vector].maxed,requiredSeats,required,{budget,base,aura}):null
        if(resources)learned.stats.completionBoundPeakBytes=Math.max(learned.stats.completionBoundPeakBytes,
          resources.requiredCost.byteLength+(entries.length+1)*(frontCap+1)*(backCap+1)*8*
          (resources.priced.length+Number(Boolean(resources.aura))))
        const impossible=(score,cost,live,haveAura,f,b,step)=>{
          if(!resources)return false
          const index=at(frontCap-f,backCap-b)
          const auraBound=haveAura+(resources.aura?.[step][index]??Infinity)
          if(Number.isSafeInteger(auraBound)&&auraBound<aura){
            learned.stats.resourceStatePruned++;learned.stats.auraCompletionPruned++;return true
          }
          if(cost+resources.requiredCost[step]>budget){
            learned.stats.resourceStatePruned++;learned.stats.costCompletionPruned++;return true
          }
          for(let j=0;j<resources.prices.length;j++){
            const bound=score+flatTotal*live+resources.priced[j][step][index]+resources.prices[j]*(budget-cost)
            if(Number.isSafeInteger(bound)&&bound<lower){
              learned.stats.resourceStatePruned++;learned.stats.costCompletionPruned++;return true
            }
          }
          return false
        }
        const below=(p,f,b,rest)=>p.score+flatTotal*p.live+rest[at(frontCap-f,backCap-b)]<lower
        let dp=Array.from({length:(frontCap+1)*(backCap+1)},()=>[])
        dp[0]=[{score:0,cost:0,front:[],back:[],live:0,aura:0}]
        if(learned.stats.enabled)learned.stats.dpPasses++
        for(let step=0;step<entries.length;step++){
          if(learned.stats.enabled){learned.stats.dpLayers++;if(aiDiagnostics)learned.stats.dpStatesVisited+=dp.reduce((n,xs)=>n+xs.length,0)}
          const [id,choices]=entries[step],rest=suffix?.[step+1]
          const next=required.has(id)||suffix||resources?dp.map(()=>[]):dp.map(xs=>xs.slice())
          for(let f=0;f<=frontCap;f++)for(let b=0;b<=backCap;b++)for(const prev of dp[at(f,b)]){
            if(resources&&impossible(prev.score,prev.cost,prev.live,prev.aura,f,b,step))continue
            if(suffix&&below(prev,f,b,suffix[step])){learned.stats.dpStatePruned++;continue}
            if((suffix||resources)&&!required.has(id)){
              if(resources&&impossible(prev.score,prev.cost,prev.live,prev.aura,f,b,step+1)){}
              else if(rest&&below(prev,f,b,rest))learned.stats.dpStatePruned++
              else next[at(f,b)].push(prev)
            }
            for(const x of choices)for(const seat of ['front','back']){
              if(seat==='front'?f===frontCap||requiredSeats[id]==='back':b===backCap||requiredSeats[id]==='front')continue
              const cost=prev.cost+x.cost,nextAura=prev.aura+x.row.contribution;if(cost>budget||nextAura>aura)continue
              const score=prev.score+x[seat==='front'?'f':'b'],live=prev.live+(vectors[x.row.vector].maxed?0:1)
              if(resources&&impossible(score,cost,live,nextAura,f+(seat==='front'?1:0),b+(seat==='back'?1:0),step+1))continue
              if(rest&&score+flatTotal*live+rest[at(frontCap-f-(seat==='front'?1:0),backCap-b-(seat==='back'?1:0))]<lower){learned.stats.dpStatePruned++;continue}
              const index=at(f+(seat==='front'?1:0),b+(seat==='back'?1:0)),list=next[index]
              if(list.some(p=>p.aura===nextAura&&p.cost<=cost&&p.score>=score&&p.live>=live))continue
              next[index]=list.filter(p=>!(p.aura===nextAura&&cost<=p.cost&&score>=p.score&&live>=p.live)).concat({score,cost,live,aura:nextAura,
                front:seat==='front'?[...prev.front,x.row]:prev.front,back:seat==='back'?[...prev.back,x.row]:prev.back})
            }
          }
          dp=next
          // Inspect the compact frontier only during seed probing. The normal
          // transition hot loop retains its previous operations unchanged.
          if(seedCostFloor!==-Infinity&&step>=lastRequired){
            for(let f=1;f<=frontCap;f++)for(let b=0;b<=backCap;b++)for(const p of dp[at(f,b)]){
              if(f+b<Math.max(1,minimumOwn,selected.length)||p.aura!==aura||
                  p.cost+ceCost!==seedCostFloor||p.score+flatTotal*p.live!==bound)continue
              // All required identities are present. Future aura values are
              // smaller, so their relaxed score bounds cannot exceed bound.
              // A partial seed never enters the exhaustive-seed memo.
              const witness={...p,score:p.score+flatTotal*p.live,cost:p.cost+ceCost,
                layout,ownCes:selected.slice(),supportCe:layout.position?sup.ce:null}
              const old=alternatives.get(key)
              if(!old||witness.score>old.score||witness.score===old.score&&witness.cost<old.cost)alternatives.set(key,witness)
              if(!best||witness.score>best.score||witness.score===best.score&&witness.cost<best.cost)best=witness
              feasible++;evaluated++;complete=false;learned.stats.seedCertifiedStops++
              break auraSearch
            }
          }
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
    return {feasible,complete}
  }
  function walk(i,remaining,flat,cost){
    nodes++
    if((onProgress||onCheckpointPlan)&&Date.now()-lastReport>250){
      lastReport=Date.now();onProgress?.({nodes,pruned,bestScore:best?.score||0,elapsed:Date.now()-started,phase:'curve-effects',
        ...(learned.stats.enabled?{initialLowerBound:learned.stats.initialLowerBound}: {})})
      if(best&&best!==lastCheckpoint){lastCheckpoint=best;onCheckpointPlan?.(packPlan(best))}
    }
    if(costLimit!=null&&cost>costLimit){pruned++;return}
    if(partyCosts&&costLimit!=null&&cost+partyCosts[selected.length]>costLimit){pruned++;learned.stats.budgetPruned++;return}
    const extra=remainingMax[i].map(x=>x*remaining),futureFlat=Math.max(0,...equipment.slice(i).map(g=>g.flat))*remaining
    if(best){
      if(quickUpper&&Number.isFinite(cutoff())){
        learned.stats.prefilterChecks++
        if(quickUpper({rate,extra,flat:flat+futureFlat,aura:auraMax,support:supportMax,supportFlat:supportFlatMax,
          budget:costLimit==null?Infinity:costLimit-cost,threshold:cutoff()})<cutoff()){
          pruned++;learned.stats.lowerBoundPruned++;learned.stats.prefilterRejected++;learned.stats.prefilterWalkRejected++;return
        }
      }
      const bound=i===0&&learned.stats.enabled?learned.stats.initialUpperBound:upper(extra,flat+futureFlat)
      if(bound<cutoff()){pruned++;if(learned.stats.enabled)learned.stats.lowerBoundPruned++;return}
    }
    if(allSupportAlternatives&&i>=2&&alternatives.size===targetCount&&seats.every(l=>supports.every((sup,si)=>{
      if(!l.position&&si)return true
      return upper(extra,flat+futureFlat,auraMax,sup.rates,l,sup.flat)<alternatives.get(`${si}:${l.position}`).score
    }))){pruned++;if(learned.stats.enabled)learned.stats.lowerBoundPruned++;return}
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
    // Fix one certified root range before exact enumeration; branch bounds
    // subsequently use only arithmetic with the same query decision.
    const rootExtra=remainingMax[0].map(x=>x*cap),rootFlat=Math.max(0,...equipment.map(g=>g.flat))*cap
    learned.stats.initialUpperBound=upper(rootExtra,rootFlat)
    if(quickUpper)learned.stats.initialUpperBound=Math.min(learned.stats.initialUpperBound,quickUpper({
      rate,extra:rootExtra,flat:rootFlat,aura:auraMax,support:supportMax,supportFlat:supportFlatMax,
      budget:costLimit==null?Infinity:costLimit}))
    const seedStarted=performance.now()
    const originalSeeds=proposeEquipmentSeeds(equipment,equipmentPriorities,cap,costLimit,6,partyCosts)
    if(useFrameworks){
      const frameworkStarted=performance.now(),priorities=new Map()
      for(const r of compressed)priorities.set(r,learned.score('servant',rowFeatures(r)))
      for(const counts of proposeEquipmentFrameworks(equipment,equipmentPriorities,cap,costLimit,partyCosts)){
        let flat=0,cost=0
        counts.forEach((k,i)=>{const g=equipment[i],picks=g.items.slice(0,k);selected.push(...picks)
          flat+=g.flat*k;cost+=picks.reduce((n,c)=>n+(c.cost||0),0);vectors.forEach((_,j)=>rate[j]+=g.rates[j]*k)})
        learned.stats.frameworkCounts++
        for(const [supportIndex,support] of supports.entries())for(const layout of seats){
          if(!layout.position&&supportIndex)continue
          for(const witness of proposePartyFrameworks({rows:compressed,vectors,rate,flat,ceCost:cost,selected,support,layout,
            base,costLimit,required,requiredSeats,fixedPositions,minimumOwn,priorities,auraMax})){
            learned.stats.frameworkWitnesses++
            const key=`${supportIndex}:${layout.position}`,old=alternatives.get(key)
            if(!old||witness.score>old.score||witness.score===old.score&&witness.cost<old.cost){
              alternatives.set(key,witness);learned.stats.frameworkImprovements++
            }
            if(!best||witness.score>best.score||witness.score===best.score&&witness.cost<best.cost)best=witness
          }
        }
        selected.length=0;rate.fill(0)
      }
      learned.stats.frameworkMs=performance.now()-frameworkStarted
    }
    learned.stats.frameworkInitialLowerBound=best?.score??null
    for(const counts of originalSeeds) {
      let flat=0,cost=0
      counts.forEach((k,i)=>{
        const g=equipment[i],picks=g.items.slice(0,k)
        selected.push(...picks);flat+=g.flat*k;cost+=picks.reduce((n,c)=>n+(c.cost||0),0)
        vectors.forEach((_,j)=>rate[j]+=g.rates[j]*k)
      })
      learned.stats.seedAttempts++
      const probe=evaluate(flat,cost,true)
      if(probe.feasible>0)learned.stats.seedFeasible++
      if(probe.complete)verifiedSeeds.push(selected.slice())
      else learned.stats.seedPendingRechecks++
      selected.length=0;rate.fill(0)
    }
    // A legal no-own-CE party is a reliable fallback when the learned recipe
    // spends too much on equipment. It is a solver check, not another AI call.
    if(!best){learned.stats.seedAttempts++;evaluate(0,0,true)}
    learned.stats.seedBestScore=best?.score??null
    learned.stats.initialLowerBound=best?.score??null
    learned.stats.initialLowerBoundCost=best?.cost??null
    learned.stats.initialStart=best?packPlan(best,false):null
    learned.stats.initialRange={lower:best?.score??null,upper:learned.stats.initialUpperBound}
    learned.stats.initialBoundCoverage=alternatives.size
    learned.stats.boundTargets=targetCount
    learned.stats.seedMs=performance.now()-seedStarted
  }
  if(warmStartOnly)return best?{...packPlan(best,false),ai:learned.stats,complete:false}:null
  // No model-derived bound, early return, or removed branch: finish the same
  // exact search even if the warm start has already found the final answer.
  walk(0,cap,0,0);if(!best)return null
  if(learned.stats.enabled){learned.stats.finalLowerBound=best.score;learned.stats.finalUpperBound=best.score}
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
