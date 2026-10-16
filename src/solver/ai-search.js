import { SEARCH_MODEL } from './ai-model.js'

// Learned priorities affect traversal only. They are never bounds, filters,
// feasibility checks, scores, or evidence that an answer is optimal.
export const AI_FEATURE_VERSION = 1
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
    model?.heads && validHead(model.heads.equipment) && validHead(model.heads.servant))
}
const modelKeys = new WeakMap()
export function searchPolicyKey(mode = 'auto', model = SEARCH_MODEL) {
  if (mode === 'off') return 'off'
  if (!model || typeof model !== 'object') return `${mode}:invalid`
  if (!modelKeys.has(model)) modelKeys.set(model, JSON.stringify(model))
  return `${mode}:${modelKeys.get(model)}`
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
export function createLearnedSearch({mode='auto',model=SEARCH_MODEL,size=0,minimum=4}={}) {
  const started=performance.now(),valid=mode!=='off'&&validSearchModel(model)
  const active=valid&&(mode==='on'||size>=minimum)
  const stats={enabled:active,modelVersion:valid?model.version:null,ranked:0,inferenceMs:0,
    seedAttempts:0,seedFeasible:0,seedMs:0,seedBestScore:null,
    reason:mode==='off'?'disabled':!valid?'invalid-model':!active?'small-domain':'verified-seed-and-order'}
  return {
    stats,
    score(kind,features) {
      if(!active)return null
      const t=performance.now(),value=predictPriority(model.heads[kind],features)
      stats.ranked++;stats.inferenceMs+=performance.now()-t
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
export function proposeEquipmentSeeds(groups, predictions, cap, budget, width=6) {
  let beam=[{counts:[],used:0,cost:0,loss:0}]
  for(const g of groups) {
    const prediction=predictions.get(g)
    if(!Number.isFinite(prediction))return []
    const target=prediction*Math.min(cap,g.items.length),next=[]
    for(const prev of beam) {
      let cost=prev.cost
      for(let k=0;k<=Math.min(cap-prev.used,g.items.length);k++) {
        if(k)cost+=g.items[k-1].cost||0
        if(budget!=null&&cost>budget)break
        next.push({counts:[...prev.counts,k],used:prev.used+k,cost,
          loss:prev.loss+(k-target)**2})
      }
    }
    beam=next.sort((a,b)=>a.loss-b.loss||a.cost-b.cost).slice(0,width)
  }
  return beam.slice(0,2).map(x=>x.counts)
}
