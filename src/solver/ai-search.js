import { SEARCH_MODEL } from './ai-model.js'
import { validUpperBoundPolicy } from './upper-bound-policy.js'
import { createQuerySession, queryFeatures, validQueryPolicy, inferQueryPolicy, fixedQueryPriority } from './query-ai.js'

// Learned priorities affect traversal only. They are never bounds, filters,
// feasibility checks, scores, or evidence that an answer is optimal.
export const AI_FEATURE_VERSION = 1
export const AI_SEARCH_REVISION = 7
export const AI_FEATURES = ['meanRate','maxRate','topRate','hitFraction','cost','costShare',
  'ratePerCost','flatRelative','availability','liveFraction','selfBonus','partyBonus',
  'base','budget','capacity','preferred']
const mean = xs => xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length)
export function searchFeatures({rates=[],cost=0,flat=0,count=1,live=1,self=0,party=0,
  base=1000,budget=null,cap=5,preferred=false}={}) {
  const sorted=[...rates].sort((a,b)=>b-a), avg=mean(rates)
  return [avg/1000,(sorted[0]||0)/1000,mean(sorted.slice(0,cap))/1000,
    rates.filter(x=>x>0).length/Math.max(1,rates.length),cost/20,
    budget==null?0:cost/Math.max(1,budget),avg/1000/Math.max(1,cost),
    flat/Math.max(1,base),Math.min(cap,count)/cap,live,self/1000,party/1000,
    Math.log1p(base)/10,budget==null?2:Math.log1p(Math.max(0,budget))/5,cap/6,Number(preferred)]
}
function validHead(head) {
  return head && Array.isArray(head.w1) && head.w1.length>0 && head.w1.length<=64 &&
    head.w1.every(r=>Array.isArray(r)&&r.length===AI_FEATURES.length&&r.every(Number.isFinite)) &&
    Array.isArray(head.b1) && head.b1.length===head.w1.length && head.b1.every(Number.isFinite) &&
    Array.isArray(head.w2) && head.w2.length===head.w1.length && head.w2.every(Number.isFinite) && Number.isFinite(head.b2)
}
export function validSearchModel(model) {
  return Boolean(model?.featureVersion===AI_FEATURE_VERSION && Array.isArray(model.features) && model.features.join('|')===AI_FEATURES.join('|') &&
    model?.heads && validHead(model.heads.equipment) && validHead(model.heads.servant) &&
    (model.upperBoundPolicy==null||validUpperBoundPolicy(model.upperBoundPolicy))&&
    (model.queryPolicy==null||validQueryPolicy(model.queryPolicy)))
}
const modelKeys = new WeakMap()
export function searchPolicyKey(mode = 'auto', model = SEARCH_MODEL) {
  if (mode === 'off') return 'off'
  if (!model || typeof model !== 'object') return `${mode}:invalid`
  if (!modelKeys.has(model)) modelKeys.set(model, JSON.stringify(model))
  return `search-r${AI_SEARCH_REVISION}:${mode}:${modelKeys.get(model)}`
}
export function predictPriority(head,features) {
  let z=head.b2
  for(let j=0;j<head.w1.length;j++) {
    let h=head.b1[j]
    for(let k=0;k<features.length;k++)h+=head.w1[j][k]*features[k]
    z+=head.w2[j]*Math.tanh(h)
  }
  return 1/(1+Math.exp(-Math.max(-30,Math.min(30,z))))
}
export function createLearnedSearch({mode='auto',model=SEARCH_MODEL,size=0,minimum=4,
  querySession=createQuerySession(),equipmentFeatures=[],servantFeatures=[]}={}) {
  const started=performance.now(),valid=mode!=='off'&&validSearchModel(model)
  const compatible=valid&&validQueryPolicy(model.queryPolicy)
  const active=compatible&&(mode==='on'||size>=minimum)
  if(active&&!querySession.decision){
    const began=performance.now()
    querySession.decision=inferQueryPolicy(model.queryPolicy,queryFeatures(equipmentFeatures,servantFeatures))
    querySession.inferenceCalls++
    querySession.inferenceMs+=performance.now()-began
  }
  const decision=active?querySession.decision:null
  const stats={enabled:active,modelVersion:valid?model.version:null,ranked:0,
    inferenceCalls:querySession.inferenceCalls,inferenceMs:querySession.inferenceMs,
    queryProfile:decision?.name||null,
    seedAttempts:0,seedFeasible:0,seedMs:0,seedBestScore:null,seedReused:0,seedCertifiedStops:0,seedPendingRechecks:0,budgetPruned:0,lowerBoundPruned:0,dpStatePruned:0,
    reason:mode==='off'?'disabled':!valid?'invalid-model':!compatible?'requires-query-model':!active?'small-domain':'single-query-decision'}
  return {
    stats,
    upperBoundPolicy: active ? Object.freeze({factor:decision.upperFactor}) : null,
    score(kind,features) {
      if(!active)return null
      const value=fixedQueryPriority(decision,kind,features)
      stats.ranked++
      return Number.isFinite(value)?value:null
    },
    order(items,featuresOf,kind='equipment') {
      if(!active)return items
      return items.map((item,index)=>({item,index,score:this.score(kind,featuresOf(item))??-Infinity}))
        .sort((a,b)=>b.score-a.score||a.index-b.index).map(r=>r.item)
    },
    finish(){return {...stats,setupMs:performance.now()-started-stats.inferenceMs}},
  }
}

// A fixed, small beam proposes counts only. The exact solver must reconstruct
// and settle each proposal before it can affect its incumbent or any cutoff.
export function proposeEquipmentSeeds(groups, predictions, cap, budget, width=6, partyCosts=null) {
  const original=equipmentBeamSeeds(groups,predictions,cap,budget,width,null)
  if(!partyCosts)return original
  const possible=counts=>{
    let cost=0,used=0
    counts.forEach((k,i)=>{used+=k;for(let j=0;j<k;j++)cost+=groups[i].items[j].cost||0})
    return budget==null||cost+partyCosts[used]<=budget
  }
  // Preserve every original proposal that could still be feasible. Only a
  // mathematically impossible start may be replaced; at most two exact probes
  // are made, so stronger starts do not add another speculative DP pass.
  const kept=original.filter(possible)
  if(kept.length===original.length)return original
  const replacements=equipmentBeamSeeds(groups,predictions,cap,budget,width,partyCosts)
  for(const counts of replacements){
    if(!kept.some(xs=>xs.every((x,i)=>x===counts[i])))kept.push(counts)
    if(kept.length===2)break
  }
  return kept
}
export function proposeEquipmentFrameworks(groups,predictions,cap,budget,partyCosts) {
  const beam=equipmentBeamSeeds(groups,predictions,cap,budget,12,partyCosts,6)
  for(const g of groups.slice(0,4)){
    const counts=groups.map(()=>0),at=groups.indexOf(g)
    let cost=0
    for(let k=0;k<Math.min(cap,g.items.length);k++){
      cost+=g.items[k].cost||0
      if(budget!=null&&cost+(partyCosts?.[k+1]??0)>budget)break
      counts[at]=k+1
    }
    if(!beam.some(xs=>xs.every((x,i)=>x===counts[i])))beam.push(counts)
    if(beam.length>=8)break
  }
  return beam.slice(0,8)
}
function equipmentBeamSeeds(groups, predictions, cap, budget, width, partyCosts, limit=2) {
  let beam=[{counts:[],used:0,cost:0,loss:0}]
  for(const g of groups) {
    const prediction=predictions.get(g)
    if(!Number.isFinite(prediction))return []
    const target=prediction*Math.min(cap,g.items.length),next=[]
    for(const prev of beam) {
      let cost=prev.cost
      for(let k=0;k<=Math.min(cap-prev.used,g.items.length);k++) {
        if(k)cost+=g.items[k-1].cost||0
        // Reserve a proven minimum servant cost rather than proposing CE
        // counts which consume the budget before any legal party can exist.
        if(budget!=null&&cost+(partyCosts?.[prev.used+k]??0)>budget)break
        next.push({counts:[...prev.counts,k],used:prev.used+k,cost,
          loss:prev.loss+(k-target)**2})
      }
    }
    beam=next.sort((a,b)=>a.loss-b.loss||a.cost-b.cost).slice(0,width)
  }
  return beam.slice(0,limit).map(x=>x.counts)
}
