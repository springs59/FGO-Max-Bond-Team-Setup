import {pickCeSkill,ceMatchesServant} from '../atlas.js'
import {getEffectiveBondBonus} from '../bond/bonus.js'

export function positiveBondUpper(catalog,quest,servantId){
 const b=getEffectiveBondBonus({servantId,catalog,quest}),cached=catalog?._scoreLookup?.[servantId]
 const positive=target=>(b.sources||[]).filter(s=>(s.target==='ptFull')===target).reduce((n,s)=>n+Math.max(0,s.rate||0),0)
 // Drop every negative source separately. If a negative window expires
 // during a query, it must not turn a previously computed ceiling too low.
 return {self:Math.ceil(Math.max(0,b.totalSecondLayer,cached?.totalSecondLayer||0,positive(false))*1000),
  party:Math.ceil(Math.max(0,b.party,cached?.party||0,positive(true))*1000)}
}

export function scoreUpperValue(base,teapot,r,position,share,rate,flat,aura,weighted=true){
 if(r.maxed||!weighted)return 0
 const first=1000+(position<=3?200:0)+share,second=1000+rate+(r.upperSelf??r.self??0)+aura-(r.ownAura||0)
 if(![base,first,second,flat].every(Number.isSafeInteger)||first<0||second<0||flat<0)return Infinity
 const product=base*first
 if(Number.isSafeInteger(product)){
  const value=Math.floor(product/1000)*second
  if(Number.isSafeInteger(value))return (Math.floor(value/1000)+flat)*(teapot?2:1)
 }
 const value=((BigInt(base)*BigInt(first)/1000n)*BigInt(second)/1000n+BigInt(flat))*(teapot?2n:1n)
 return value<=BigInt(Number.MAX_SAFE_INTEGER)?Number(value):Infinity
}

// Query-owned effect tables survive the exploratory, optimizing and collecting
// passes. They contain no search nodes, stock counters or archived teams.
const caches=new WeakMap()
export function exactPartyEffect(f){
 const amounts=[f.rate||0,f.followerRate??f.rate??0,f.add||0]
 return amounts.every(n=>Number.isSafeInteger(n)&&n>=0)&&(f.target==='ptFull'||amounts.every(n=>n===0))&&
  (!(f.add||0)||!f.tvals?.length&&!f.andTvals?.length)
}

// Automatic equipment is for bond gain, never for filling unused COST.
// Explicit equipment pins (including zero-gain bond equipment) remain legal.
export function trimScoreEquipment(d){
 const ownPins=new Set([...d.pinCes.map(p=>p.ceId),...d.pins.filter(p=>!p.support).flatMap(p=>[p.ceId,p.ceBondId,p.ceRewardId])].filter(Boolean))
 const supportPins=new Set([d.lockSupportCeId,...d.pins.filter(p=>p.support).flatMap(p=>[p.ceId,p.ceRewardId]),...(d.supportPins||[]).flatMap(p=>[p.ceId,p.ceRewardId])].filter(Boolean))
 const active=(ce,support)=>((pickCeSkill(ce,support?ce.supportMlb!==false:ce.accountMlb!==false)?.funcs)||[])
  .some(f=>!f.eventId&&(!support||f.applySupport!==0&&f.target==='ptFull')&&((f.rate||0)||(support?(f.followerRate||0):0)||(f.add||0)))
 return {...d,ownCes:d.ownCes.filter(c=>ownPins.has(c.id)||active(c,false)),supportCes:d.supportCes.filter(c=>supportPins.has(c.id)||active(c,true))}
}

// An ordinary effect with no recipient in this particular party can be left
// empty too. Do not use upper effects to discard wearer/negative/conditional
// flat effects: those still require exact settlement in the general solver.
export function usefulScoreEquipment(effect,picked,base,index=x=>x.i){
 return !effect?.ordinary||picked.some(x=>!x.r.maxed&&(effect.flat>0||base>0&&effect.rates[index(x)]>0))
}
export function createScoreEffects(d){
 const source=d.guidanceSource||d
 let cache=caches.get(source)
 if(!cache){cache={rows:source.rows,indices:new Map(source.rows.map((r,i)=>[r.svt.id+':'+r.form.key,i])),own:new Map(),support:new Map()};caches.set(source,cache)}
 const indices=d.rows.map(r=>cache.indices.get(r.svt.id+':'+r.form.key)),local=[new Map(),new Map()]
 return (ce,support=false)=>{
  if(!ce)return null
  const mlb=support?ce.supportMlb!==false:ce.accountMlb!==false,key=ce.id+':'+Number(mlb),out=local[Number(support)]
  if(out.has(key))return out.get(key)
  const table=support?cache.support:cache.own
  let e=table.get(key)
  if(!e){
   const funcs=(pickCeSkill(ce,mlb)?.funcs||[]).filter(f=>!f.eventId&&(!support||f.applySupport!==0&&f.target==='ptFull'))
   e={flat:funcs.reduce((n,f)=>n+Math.max(0,f.add||0),0),
    // Relax a wearer-only effect to apply to every compatible recipient;
    // ignore flat-effect conditions upwards. Exact leaves remain separate.
    rates:cache.rows.map(r=>funcs.reduce((n,f)=>n+(ceMatchesServant(f,r.form.traitIds||[])?Math.max(0,support?(f.followerRate??f.rate??0):(f.rate||0)):0),0)),
    ordinary:funcs.every(exactPartyEffect)}
   table.set(key,e)
  }
  const value=d===source?e:{...e,rates:indices.map(i=>e.rates[i])};out.set(key,value);return value
 }
}

// At most n fields can apply effects. A physical copy is counted at most
// left times; identity, pin and COST restrictions may be relaxed upwards.
export function availableEffectUpper(types,n,value,accept=()=>true){
 const top=[]
 if(n<=0)return 0
 for(const c of types){
  if(!c.left||!accept(c))continue
  const v=value(c)
  for(let copy=0;copy<Math.min(n,c.left);copy++){
   let i=0;while(i<top.length&&top[i]>=v)i++
   if(i<n){top.splice(i,0,v);if(top.length>n)top.pop()}
  }
 }
 return top.reduce((n,v)=>n+v,0)
}

// A support has at most two effect-bearing fields. During objective proof,
// two representatives per exact effect profile realize every attainable
// pair, including the all-different CE identity restriction. The collecting
// pass retains the original catalog and every physical identity.
export function optimizationSupportChoices(cards,effect,protectedIds=[]){
 const groups=new Map(),out=[],protectedSet=new Set(protectedIds.filter(Boolean))
 for(const c of cards){
  const e=effect(c,true)
  if(!e?.ordinary||protectedSet.has(c.id)){out.push(c);continue}
  const key=JSON.stringify([e.flat,e.rates]),group=groups.get(key)||[]
  if(group.length<2){group.push(c);out.push(c);groups.set(key,group)}
 }
 return out
}
