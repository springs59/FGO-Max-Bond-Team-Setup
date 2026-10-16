const avg=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length)
const maximum=a=>a.length?Math.max(...a):0
export const POLICY_NAMES=['original','effect-per-cost','cheap-groups','zero-first','balanced-counts']
export function rootFeatures(c){
  const {equipment:g,vectors:v,rows,contributions,base,costLimit,cap,required,requiredSeats,fixedPositions,empty,seats,allSupportAlternatives}=c
  const sum=g.map(x=>avg(x.rates)/1000),cost=g.map(x=>x.items[0].cost),stock=g.map(x=>x.items.length),coverage=g.map(x=>x.rates.filter(r=>r>0).length/Math.max(1,v.length)),rc=rows.map(x=>x.cost),a=[...contributions.values()]
  const f={groups:g.length/10,vectors:Math.log1p(v.length)/6,forms:Math.log1p(rows.length)/7,identities:Math.log1p(contributions.size)/7,
    base:Math.log1p(base)/10,budget:costLimit==null?2:costLimit/150,cap:cap/6,stock:stock.reduce((a,b)=>a+b,0)/30,
    meanStock:avg(stock)/6,maxStock:maximum(stock)/6,meanCost:avg(cost)/15,maxCost:maximum(cost)/15,
    memberCost:avg(rc)/20,minMemberCost:Math.min(...rc)/20,maxMemberCost:maximum(rc)/20,
    meanRate:avg(sum),maxRate:maximum(sum),rateSpread:Math.sqrt(avg(sum.map(x=>(x-avg(sum))**2))),
    coverage:avg(coverage),coverageSpread:Math.sqrt(avg(coverage.map(x=>(x-avg(coverage))**2))),
    meanSelf:avg(v.map(x=>x.self))/1000,maxSelf:maximum(v.map(x=>x.self))/1000,
    maxed:v.filter(x=>x.maxed).length/v.length,meanAura:avg(a)/1000,maxAura:maximum(a)/1000,auraKinds:new Set(a).size/10,
    required:required.size/6,fixed:Object.keys(fixedPositions).length/6,empty:empty.size/6,
    seatRules:Object.keys(requiredSeats).length/6,frontSupport:Number(seats.some(l=>l.position>0&&l.position<=3)),
    noSupport:Number(seats.some(l=>!l.position)),layouts:seats.length/3,flatGroups:g.filter(x=>x.flat).length/Math.max(1,g.length),allTargets:Number(allSupportAlternatives),
  }
  return {features:Object.keys(f),x:Object.values(f)}
}
export function reorderGroups(c,policy){
  if(!policy)return
  const score=g=>g.rates.reduce((n,r,i)=>n+(c.vectors[i].maxed?0:r),0)+g.flat*1000/Math.max(1,c.base)*c.vectors.length
  const indexed=c.equipment.map((g,i)=>({g,i}))
  if(policy===1)indexed.sort((a,b)=>score(b.g)/(1+b.g.items[0].cost)-score(a.g)/(1+a.g.items[0].cost)||a.i-b.i)
  if(policy===2)indexed.sort((a,b)=>a.g.items[0].cost-b.g.items[0].cost||score(b.g)-score(a.g)||a.i-b.i)
  if(policy===4)indexed.sort((a,b)=>b.g.rates.filter(Boolean).length-a.g.rates.filter(Boolean).length||score(b.g)/(1+b.g.items[0].cost)-score(a.g)/(1+a.g.items[0].cost)||a.i-b.i)
  c.equipment.splice(0,c.equipment.length,...indexed.map(x=>x.g))
}
export function countOrder(policy,maxCount,remaining,cost,budget,g){
  if(policy===3)return Array.from({length:maxCount+1},(_,j)=>j)
  if(policy!==4)return null
  const target=Math.min(maxCount,Math.max(0,Math.round(remaining/2)),budget==null?maxCount:Math.floor(Math.max(0,budget-cost)/(g.items[0].cost||1)))
  return Array.from({length:maxCount+1},(_,j)=>j).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)||b-a)
}
export function predictRoot(model,x){
  const h=model.w1.map((row,j)=>Math.tanh(row.reduce((s,w,i)=>s+w*x[i],model.b1[j])))
  return model.w2.map((row,j)=>row.reduce((s,w,i)=>s+w*h[i],model.b2[j]))
}
export function decideRoot(c,model,gate){
  // The cheap gate executes before feature extraction or neural inference.
  if(!model||!gate?.enabled||c.equipment.length<gate.minGroups)return {policy:0,reason:'cheap-or-unqualified'}
  const {x,features}=rootFeatures(c)
  if(model.features.join('|')!==features.join('|'))return {policy:0,reason:'unsupported-features'}
  const p=predictRoot(model,x),policy=p.slice(0,5).indexOf(Math.min(...p.slice(0,5)))
  const gain=p[0]-p[policy]
  return policy&&gain>=gate.logGain&&p[0]>=gate.minLogWork?{policy,reason:'predicted-benefit',gain}:{policy:0,reason:'no-proven-benefit'}
}
