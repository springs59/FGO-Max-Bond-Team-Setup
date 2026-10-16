// Offline v2: query/prefix-conditioned count policy, then constrained exact
// completion of the proposed equipment configurations. No product replacement.
import { solveInventoryCurves } from '../src/solver/inventory-curve-solver.js'
import { ceMilliLive } from '../src/solver/solver-index.js'
import { servantCost } from '../src/servant-cost.js'
import { predictPriority } from '../src/solver/ai-search.js'

const mean = xs => xs.reduce((a,b) => a+b,0) / Math.max(1,xs.length)
const max = xs => xs.length ? Math.max(...xs) : 0
const ordered = xs => [...xs].sort((a,b) => a-b)
const q = (xs,p) => xs.length ? ordered(xs)[Math.min(xs.length-1,Math.floor(xs.length*p))] : 0
const keyOf = c => c.id + ':' + (c.accountMlb !== false)
export function prepareConfig(opts) {
  let domain
  const sentinel = {}
  try { solveInventoryCurves({ ...opts, aiMode:'off', onAiDomain:d => { domain=d; throw sentinel } }) }
  catch (e) { if(e!==sentinel)throw e }
  if(!domain)throw Error('Unsupported or infeasible inventory domain')
  const groups = domain.equipment.map(g => ({ ...g, items:g.ids.map((id,i) => opts.ownCes.find(c => c.id===id && (c.accountMlb!==false)===g.mlb[i])) }))
  const required = new Set(opts.requiredIds || []), empty = new Set(opts.emptyPositions || [])
  const layouts = (opts.layouts || [6,3]).map(p => ({p,positions:[1,2,3,4,5,6].filter(x => x!==p && !empty.has(x))}))
  const cap = max(layouts.map(l=>l.positions.length))
  const rows=[]
  for(const s of opts.servants)for(const form of opts.formsOf(s)) {
    const state=opts.stateOf(s),bonus=opts.bonuses?.[s.id]||{}
    rows.push({index:rows.length,id:s.id,cost:servantCost(s,form),live:!state.maxed,self:Math.round((bonus.totalSecondLayer||0)*1000),
      aura:(state.aura||0)+Math.round((bonus.party||0)*1000),required:required.has(s.id),
      support:max(opts.supportCes.map(c=>ceMilliLive(c,form,true,true))),
      rates:groups.map(g=>ceMilliLive(g.items[0],form,false,g.items[0].accountMlb!==false))})
  }
  const cheapest=new Map()
  for(const r of rows)cheapest.set(r.id,Math.min(cheapest.get(r.id)??Infinity,r.cost))
  const requiredCost=[...required].reduce((n,id)=>n+cheapest.get(id),0)
  const optionalCosts=[...cheapest].filter(([id])=>!required.has(id)).map(([,v])=>v).sort((a,b)=>a-b)
  const reserve=n=>requiredCost+optionalCosts.slice(0,Math.max(0,Math.max(n,opts.minimumOwn||1)-required.size)).reduce((a,b)=>a+b,0)
  return { opts,groups,rows,required,layouts,cap,reserve,budget:opts.costLimit??Infinity,
    liveRows:rows.filter(r=>r.live), identities:cheapest.size }
}
function prefixState(ctx,counts) {
  let used=0,cost=0,flat=0
  const effects=ctx.rows.map(()=>0)
  counts.forEach((k,i)=>{
    used+=k; cost+=ctx.groups[i].items.slice(0,k).reduce((n,c)=>n+c.cost,0)
    flat+=(ctx.groups[i].features[7]*Math.max(1,ctx.opts.base))*k
    ctx.rows.forEach((r,j)=>effects[j]+=r.rates[i]*k)
  })
  return {used,cost,flat,effects}
}
export function configFeatures(ctx,i,counts) {
  const {groups,rows,cap,budget,opts}=ctx,g=groups[i],s=prefixState(ctx,counts)
  const remaining=Number.isFinite(budget)?Math.max(0,budget-s.cost):150
  const live=rows.filter(r=>r.live), cheap=live.filter(r=>r.cost<=remaining), req=rows.filter(r=>r.required)
  const unique=(xs,fun)=>{
    const map=new Map();for(const r of xs)map.set(r.id,Math.max(map.get(r.id)??-Infinity,fun(r)))
    return [...map.values()]
  }
  const current=(r)=>r.self+r.support+s.effects[r.index]
  const delta=(r)=>r.rates[i]
  const competitor=(r)=>max(r.rates.slice(i+1))
  const c=g.items[0]?.cost||0
  const f={
    base:Math.log1p(opts.base)/10,budget:Number.isFinite(budget)?budget/150:2,remaining:remaining/150,
    ceCost:s.cost/150,reserve:ctx.reserve(s.used)/150,used:s.used/6,cap:cap/6,groups:groups.length/20,index:i/Math.max(1,groups.length),
    available:Math.min(cap,g.items.length)/6,groupCost:c/20,groupCostShare:c/Math.max(1,remaining),
    groupFlat:g.features[7],prefixFlat:s.flat/Math.max(1,opts.base),minimumOwn:(opts.minimumOwn||1)/6,
    required:ctx.required.size/6,fixed:Object.keys(opts.fixedPositions||{}).length/6,empty:(opts.emptyPositions||[]).length/6,
    frontRequired:Object.values(opts.requiredSeats||{}).filter(x=>x==='front').length/3,
    backRequired:Object.values(opts.requiredSeats||{}).filter(x=>x==='back').length/3,
    hasNoSupport:Number(ctx.layouts.some(l=>!l.p)),hasFrontSupport:Number(ctx.layouts.some(l=>l.p>0&&l.p<=3)),
    hasBackSupport:Number(ctx.layouts.some(l=>l.p>3)),layouts:ctx.layouts.length/3,
    inventory:Math.log1p(ctx.identities)/7,forms:Math.log1p(rows.length)/7,live:live.length/Math.max(1,rows.length),
    affordable:cheap.length/Math.max(1,live.length),groupHits:live.filter(r=>delta(r)>0).length/Math.max(1,live.length),
    requiredHits:req.filter(r=>delta(r)>0).length/Math.max(1,req.length),
    coverageOverlap:live.filter(r=>delta(r)>0&&s.effects[r.index]>0).length/Math.max(1,live.length),
    remainingCeCapacity:groups.slice(i+1).reduce((n,x)=>n+Math.min(cap,x.items.length),0)/30,
    nextCost:mean(groups.slice(i+1).map(x=>x.items[0].cost))/20,
    cheapestCost:Math.min(...rows.map(r=>r.cost))/20,
    requiredCost:ctx.reserve(ctx.required.size)/150,
  }
  for(const [name,xs] of Object.entries({
    delta:unique(live,delta).map(x=>x/1000), affordableDelta:unique(cheap,delta).map(x=>x/1000),
    current:unique(live,current).map(x=>x/1000), competitor:unique(live,competitor).map(x=>x/1000),
    synergy:unique(cheap,r=>(1+current(r)/1000)*delta(r)/1000),
    self:unique(live,r=>r.self).map(x=>x/1000),aura:unique(rows,r=>r.aura).map(x=>x/1000),
    costs:unique(rows,r=>-r.cost).map(x=>-x/20),
  })){
    f[name+'Mean']=mean(xs);f[name+'Max']=max(xs);f[name+'Top']=mean(ordered(xs).slice(-cap));
    f[name+'Q25']=q(xs,.25);f[name+'Q75']=q(xs,.75)
  }
  return { names:Object.keys(f), x:Object.values(f) }
}
export function legalCounts(ctx,i,counts) {
  const s=prefixState(ctx,counts),out=[];let cost=s.cost
  for(let k=0;k<=Math.min(ctx.cap-s.used,ctx.groups[i].items.length);k++) {
    if(k)cost+=ctx.groups[i].items[k-1].cost
    if(cost+ctx.reserve(s.used+k)<=ctx.budget)out.push(k)
  }
  return out
}
export function inferConfig(model,x) {
  let values=x
  for(const [index,layer] of model.layers.entries()) {
    values=layer.w.map((row,j)=>row.reduce((s,w,k)=>s+w*values[k],layer.b[j]))
    if(index<model.layers.length-1)values=values.map(x=>Math.max(0,x))
  }
  return values
}
export function validConditionedModel(model) {
  if(model?.format!=='fgo-conditioned-count-policy'||model.featureVersion!==2||!Array.isArray(model.features)||model.features.length!==75||new Set(model.features).size!==75||!Array.isArray(model.layers)||model.layers.length!==3)return false
  let size=75
  for(const layer of model.layers) {
    if(!Array.isArray(layer.w)||!layer.w.length||layer.w.length>128||!Array.isArray(layer.b)||layer.b.length!==layer.w.length||!layer.b.every(Number.isFinite)||!layer.w.every(r=>Array.isArray(r)&&r.length===size&&r.every(Number.isFinite)))return false
    size=layer.w.length
  }
  return size===7
}
export function proposeConfigs(ctx,model,{width=32,top=8}={}) {
  if(!validConditionedModel(model))throw Error('Invalid conditioned model')
  let beam=[{counts:[],logp:0}]
  for(let i=0;i<ctx.groups.length;i++) {
    const next=[]
    for(const state of beam) {
      const {x,names}=configFeatures(ctx,i,state.counts)
      if(names.join('|')!==model.features.join('|'))throw Error('Conditioned feature version mismatch')
      const scores=inferConfig(model,x),legal=legalCounts(ctx,i,state.counts)
      if(!legal.length)continue
      const hi=Math.max(...legal.map(k=>scores[k])),sum=legal.reduce((n,k)=>n+Math.exp(scores[k]-hi),0)
      for(const k of legal)next.push({counts:[...state.counts,k],logp:state.logp+scores[k]-hi-Math.log(sum)})
    }
    beam=next.sort((a,b)=>b.logp-a.logp).slice(0,width)
  }
  return beam.slice(0,top).map(s=>s.counts)
}
export function countConfigDomain(ctx) {
  const memo=new Map()
  const count=(i,used,cost)=>{
    if(i===ctx.groups.length)return 1
    const key=i+':'+used+':'+cost
    if(memo.has(key))return memo.get(key)
    let result=0,nextCost=cost
    for(let k=0;k<=Math.min(ctx.cap-used,ctx.groups[i].items.length);k++) {
      if(k)nextCost+=ctx.groups[i].items[k-1].cost
      if(nextCost+ctx.reserve(used+k)<=ctx.budget)result+=count(i+1,used+k,nextCost)
    }
    memo.set(key,result);return result
  }
  return count(0,0,0)
}
export function proposeIndependentConfigs(ctx,model,{width=128,top=32}={}) {
  // Matched-budget control: the old per-group model, with the same legality
  // masks, beam width, proposal count and exact completion as the new policy.
  let beam=[{counts:[],loss:0}]
  for(let i=0;i<ctx.groups.length;i++) {
    const g=ctx.groups[i],target=predictPriority(model.heads.equipment,g.features)*Math.min(ctx.cap,g.items.length),next=[]
    for(const state of beam)for(const k of legalCounts(ctx,i,state.counts))next.push({counts:[...state.counts,k],loss:state.loss+(k-target)**2})
    beam=next.sort((a,b)=>a.loss-b.loss).slice(0,width)
  }
  return beam.slice(0,top).map(s=>s.counts)
}
