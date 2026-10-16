import { applyRate } from '../src/bond.js'
import { ceMilliLive } from '../src/solver/solver-index.js'
import { servantCost } from '../src/servant-cost.js'
import { pickCeSkill } from '../src/atlas.js'

// This view retains the ORIGINAL domain, not the cost-minimal representatives
// used to prove a score. It creates no file, DAG, list, or global count. Nothing
// is enumerated until the consumer requests the next matching physical team.
export function createTieView(opts,targetScore){
 if(!Number.isFinite(targetScore))throw Error('A verified target score is required')
 return {targetScore,completeDescription:true,materialized:false,
  *[Symbol.iterator](){
   const required=new Set(opts.requiredIds||[]),empty=new Set(opts.emptyPositions||[])
   const seenSupport=new Set(),supportChoices=[null,...opts.supportCes].filter(c=>{const key=c?c.id+':true':'none';if(seenSupport.has(key))return false;seenSupport.add(key);return true})
   const stock=new Map()
   for(const c of opts.ownCes){const key=c.id+':'+(c.accountMlb!==false);if(!stock.has(key))stock.set(key,{ce:c,count:0});stock.get(key).count++}
   for(const supportPosition of opts.layouts||[6,3]){
    if(empty.has(supportPosition))continue
    const positions=[1,2,3,4,5,6].filter(p=>p!==supportPosition&&!empty.has(p))
    if(Object.values(opts.fixedPositions||{}).some(p=>!positions.includes(p)))continue
    const supportPool=supportPosition?supportChoices.filter(c=>!opts.requireSupportEquipment||c!==null):[null],used=new Set(),selected=[]
    function* members(i,cost){
     if(opts.costLimit!=null&&cost>opts.costLimit)return
     if(i===positions.length){
      if(selected.length<(opts.minimumOwn||1)||!selected.some(r=>r.position<=3)||[...required].some(id=>!used.has(id)))return
      for(const supportCe of supportPool)yield* equipment(0,cost,[],supportCe)
      return
     }
     const position=positions[i],fixed=Object.entries(opts.fixedPositions||{}).find(([,p])=>p===position)
     if(!fixed)yield* members(i+1,cost)
     for(const svt of opts.servants){
      if(used.has(svt.id)||fixed&&String(svt.id)!==fixed[0]||opts.fixedPositions?.[svt.id]&&opts.fixedPositions[svt.id]!==position)continue
      const seat=opts.requiredSeats?.[svt.id]
      if(seat==='front'&&position>3||seat==='back'&&position<=3)continue
      used.add(svt.id)
      for(const form of opts.formsOf(svt)){
       selected.push({svt,form,position});yield* members(i+1,cost+servantCost(svt,form));selected.pop()
      }
      used.delete(svt.id)
     }
    }
    function* equipment(i,cost,worn,supportCe){
     if(opts.costLimit!=null&&cost>opts.costLimit)return
     if(i<selected.length){
      worn.push(null);yield* equipment(i+1,cost,worn,supportCe);worn.pop()
      for(const group of stock.values())if(group.count){group.count--;worn.push(group.ce);yield* equipment(i+1,cost+group.ce.cost,worn,supportCe);worn.pop();group.count++}
      return
     }
     const aura=selected.reduce((n,r)=>n+(opts.stateOf(r.svt).aura||0)+Math.round((opts.bonuses?.[r.svt.id]?.party||0)*1000),0)
     const ownCes=worn.filter(Boolean),flat=ownCes.reduce((n,c)=>n+(pickCeSkill(c,c.accountMlb!==false).funcs[0].add||0),0)+(supportCe&&pickCeSkill(supportCe,true).funcs[0].applySupport!==0?(pickCeSkill(supportCe,true).funcs[0].add||0):0)
     const score=selected.reduce((n,r)=>{
      const state=opts.stateOf(r.svt);if(state.maxed)return n
      const front=(r.position<=3?200:0)+(supportPosition>0&&supportPosition<=3?40:0)
      const second=ownCes.reduce((s,c)=>s+ceMilliLive(c,r.form,false,c.accountMlb!==false),0)+(supportCe?ceMilliLive(supportCe,r.form,true,true):0)+Math.round((opts.bonuses?.[r.svt.id]?.totalSecondLayer||0)*1000)+aura-(state.aura||0)
      return n+applyRate(applyRate(opts.base,front),second)+flat
     },0)
     if(score!==targetScore)return
     const slots=Array.from({length:6},(_,i)=>({p:i+1,f:0,s:0,svt:0,art:'',ce:0}))
     selected.forEach((r,j)=>{slots[r.position-1]={p:r.position,f:1,s:0,svt:r.svt.id,art:r.form.key==='default'?'':r.form.key,ce:worn[j]?.id||0,mlb:worn[j]?.accountMlb!==false}})
     if(supportPosition)slots[supportPosition-1]={p:supportPosition,f:1,s:1,svt:0,art:'',ce:supportCe?.id||0,mlb:true}
     yield {slots,score,cost}
    }
    yield* members(0,0)
   }
  },
 }
}
