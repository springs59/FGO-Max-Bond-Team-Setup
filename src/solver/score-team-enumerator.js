import {pickCeSkill} from '../atlas.js'
import {compileScoreEquivalence} from './score-team-equivalence.js'
import {createScoreTeamGuidance} from './score-team-guidance.js'
import {createScoreEffects,availableEffectUpper,optimizationSupportChoices,exactPartyEffect,usefulScoreEquipment} from './score-team-effects.js'

// These bounds relax availability and identity constraints upwards. A bound
// may admit impossible teams; it must never exclude a reachable equal score.
export function ordinaryScoreDomain(d) {
  return !d.grand&&equivalentScoreDomain(d)
}
export function equivalentScoreDomain(d){
 const valid=(ce,mlb,support=false)=>(pickCeSkill(ce,mlb)?.funcs||[]).every(f=>f.eventId||support&&(f.applySupport===0||f.target!=='ptFull')||exactPartyEffect(f))
 return !d.systemSupport&&d.ownCes.every(c=>valid(c,c.accountMlb!==false))&&d.supportCes.every(c=>valid(c,c.supportMlb!==false,true))
}
const blank=p=>({p,f:0,s:0,g:0,svt:0,art:'',ce:0,mlb:true,bond:0,reward:0})
const funcs=(ce,mlb,support=false)=>(pickCeSkill(ce,mlb)?.funcs||[]).filter(f=>!f.eventId&&(!support||f.applySupport!==0&&f.target==='ptFull'))
// A wearer-only effect is relaxed to apply to each candidate recipient. This
// deliberately overestimates; exact live settlement decides every such leaf.
function exactRate(base,milli){
  if(!Number.isSafeInteger(base)||!Number.isSafeInteger(milli))return Infinity
  const product=base*(1000+milli)
  if(Number.isSafeInteger(product))return Math.floor(product/1000)
  const value=BigInt(base)*BigInt(1000+milli)/1000n
  return value<=BigInt(Number.MAX_SAFE_INTEGER)?Number(value):Infinity
}
const ceKey=c=>`${c.id}:${c.accountMlb!==false?1:0}`
function quantities(ces) {
  const m=new Map()
  for(const ce of ces){const key=ceKey(ce);if(!m.has(key))m.set(key,{...ce,left:0});m.get(key).left++}
  return [...m.values()]
}
function largestSum(values,n){
  const kept=[]
  for(const value of values){
    let i=0;while(i<kept.length&&kept[i]>=value)i++
    if(i<n){kept.splice(i,0,value);if(kept.length>n)kept.pop()}
  }
  return kept.reduce((a,b)=>a+b,0)
}

// Search reversible member/seat families only when CE effects are exact.
// Grand equipment retains literal stock identities; campaigns, NPCs and
// wearer-only effects use physical search. No equal-score family is discarded.
// Yield control tokens as well as teams, so a sparse search stays cancellable.
export function* enumerateScoreTeams(d,state) {
  const checkpoint=state.checkpointOnly===true,tickEvery=checkpoint?16:512
  const sourceEffects=createScoreEffects(d)
  const compact=state.compact!==false&&d.arithmeticBounds!==false&&equivalentScoreDomain(d)
  if(compact)d=compileScoreEquivalence(d,{ordinary:true,grand:d.grand,effectsFor:sourceEffects})

  const catalog=compact?d.equivalenceCatalog:null
  const seatGroup=p=>catalog?.seatGroups.findIndex(g=>g.includes(p))??p
  const previousSeat=(positions,at)=>positions.slice(0,at).reverse().find(p=>seatGroup(p)===seatGroup(positions[at]))
  const supportAura=d.passiveUpperFor?.(d.systemSupport?.svtId||0).party||0
  const exact=!checkpoint&&!d.systemSupport&&!supportAura&&d.arithmeticBounds!==false&&d.rows.every(r=>(r.upperSelf??r.self)===r.self&&(r.upperContribution??r.contribution)===r.contribution)
  const fast=!checkpoint&&(d.arithmeticBounds!==false&&!d.systemSupport||Boolean(d.passiveUpperFor)),rows=d.rows,cap=6-(d.layouts[0]?1:0)
  const belowTarget=upper=>state.phase==='optimizing'?upper<=state.bestScore:upper<state.bestScore
  const counters=state.stats
  const reject=()=>{counters.constraintPruned=(counters.constraintPruned||0)+1}
  // Count actual normal-equipment demands, rather than UI pin records: a
  // slot pin is also present in pinCes, and repeated identical pins share
  // one wearer. Extra Grand fields consume separate copies but no COST.
  const normalBySvt=new Map(),unbound=new Set(),normalNeeded=new Map(),extraNeeded=new Map()
  for(const pin of [...d.pinCes,...d.pins.filter(p=>!p.support&&p.svtId).map(p=>({svtId:p.svtId,ceId:p.ceId}))])if(pin.ceId){
    if(!pin.svtId){unbound.add(pin.ceId);continue}
    if(normalBySvt.has(pin.svtId)&&normalBySvt.get(pin.svtId)!==pin.ceId){reject();return}
    normalBySvt.set(pin.svtId,pin.ceId)
  }
  for(const id of normalBySvt.values())normalNeeded.set(id,(normalNeeded.get(id)||0)+1)
  for(const id of unbound)normalNeeded.set(id,Math.max(1,normalNeeded.get(id)||0))
  for(const pin of d.pins.filter(p=>!p.support))for(const id of [pin.ceBondId,pin.ceRewardId])if(id)extraNeeded.set(id,(extraNeeded.get(id)||0)+1)
  const stock=new Map(),ceCosts=new Map()
  for(const c of d.ownCes){stock.set(c.id,(stock.get(c.id)||0)+1);ceCosts.set(c.id,Math.min(ceCosts.get(c.id)??Infinity,c.cost||0))}
  if([...new Set([...normalNeeded.keys(),...extraNeeded.keys()])].some(id=>(normalNeeded.get(id)||0)+(extraNeeded.get(id)||0)>(stock.get(id)||0))){reject();return}
  const normalCount=[...normalNeeded.values()].reduce((n,v)=>n+v,0)
  const forcedNormalCost=[...normalNeeded].reduce((n,[id,count])=>n+count*ceCosts.get(id),0)
  const grandIds=new Set(d.grandIds),canGrand=id=>grandIds.has(id)||!d.grandIdsKnown&&!grandIds.size
  const types=d.ownTypes||quantities(d.ownCes),cachedEffects=compact?createScoreEffects(d):sourceEffects
  const effect=(c,support=false)=>fast?cachedEffects(c,support):null
  const guidance=checkpoint?null:createScoreTeamGuidance(d,{effectFor:fast?effect:undefined})
  if(guidance&&(!fast||guidance.wantsAI))yield* guidance.prepare()
  if(guidance?.ai)(state.queryState||state).ai=guidance.ai
  let prepared=0
  if(!checkpoint)for(const c of types){c.effect=effect(c);if(++prepared%32===0)yield {type:'tick'}}
  const ownCopies=checkpoint?[]:d.ownCes.map(c=>effect(c)),supportChoices=[]
  if(!checkpoint)for(const c of d.supportCes){supportChoices.push({ce:c,effect:effect(c,true)});if(++prepared%32===0)yield {type:'tick'}}
  const supportCount=d.grand?2:1,ownEffectCount=cap+Number(d.grand)
  const supportFlatMax=fast?largestSum(supportChoices.map(x=>x.effect.flat),supportCount):0
  const maxAura=checkpoint?0:[...new Map(rows.flatMap(r=>r.equivalentRows||[r]).map(r=>[r.svt.id,r.upperContribution??r.contribution])).values()].sort((a,b)=>b-a).slice(0,cap).reduce((a,b)=>a+b,0)
  const maxOwn=[],maxSupport=[]
  for(let i=0;!checkpoint&&i<rows.length;i++){
    maxOwn.push(fast?largestSum(ownCopies.map(e=>e.rates[i]),ownEffectCount):0)
    maxSupport.push(fast?largestSum(supportChoices.map(x=>x.effect.rates[i]),supportCount):0)
    if(i%32===31)yield {type:'tick'}
  }
  const maxFlat=fast?largestSum(ownCopies.map(e=>e.flat),ownEffectCount)+supportFlatMax:0
  const supportCopies=new Map()
  for(const c of d.supportCes)supportCopies.set(c.id,(supportCopies.get(c.id)||0)+1)
  const supportPool=!checkpoint&&fast&&state.phase==='optimizing'?optimizationSupportChoices(d.supportCes,effect,
    [d.lockSupportCeId,...d.pins.filter(p=>p.support).flatMap(p=>[p.ceId,p.ceRewardId])]):d.supportCes
  const boundSupportChoices=fast&&state.phase==='optimizing'?supportPool.map(ce=>({ce,effect:effect(ce,true)})):supportChoices
  const monotone=[...d.ownCes,...d.supportCes].every(c=>[false,true].every(mlb=>funcs(c,mlb).every(f=>(f.rate||0)>=0&&(f.followerRate??f.rate??0)>=0&&(f.add||0)>=0)))
  const zeroScore=exact&&d.base===0&&maxFlat===0&&monotone
  const weights=rows.map(r=>d.optimizeBy!=='prefer'||d.preferIds.includes(r.svt.id)?1:0)
  function reward(r,index,p,support,rate,flat,aura){
    if(r.maxed||!weights[index])return 0
    const front=p<=3?200:0,share=support&&support<=3?40:0
    return (exactRate(exactRate(d.base,front+share),rate+(r.upperSelf??r.self)+aura-r.ownAura+(support?supportAura:0))+flat)*(d.teapot?2:1)
  }
  const seenLayouts=new Set()
  for(const supportPosition of d.layouts){
    const layoutKey=supportPosition?seatGroup(supportPosition):-1
    if(compact&&seenLayouts.has(layoutKey))continue
    seenLayouts.add(layoutKey)
    if(d.grand&&d.grandPosition&&d.grandPosition===supportPosition){reject();continue}
    if(d.pins.some(pin=>pin.position===supportPosition&&(pin.svtId||pin.empty&&!pin.reserved&&!pin.support)))continue
    if(supportPosition){
      const pin=d.pins.find(pin=>pin.position===supportPosition&&pin.support)
      if(d.lockSupportCeId&&!d.supportCes.some(c=>c.id===d.lockSupportCeId)||pin?.ceRewardId&&
        (!d.grand||!d.supportCes.some(c=>c.id===pin.ceRewardId)||pin.ceRewardId===d.lockSupportCeId&&d.supportCes.filter(c=>c.id===pin.ceRewardId).length<2)){reject();continue}
    }
    const positions=[1,2,3,4,5,6].filter(p=>p!==supportPosition)
    const slots=Array.from({length:6},(_,i)=>({...blank(i+1),...(compact?{rg:-1,cg:-1}:{})})),used=new Set(),picked=[]
    if(supportPosition)Object.assign(slots[supportPosition-1],{f:1,s:1,g:Number(d.grand)})
    const choices=positions.map(p=>{
      const pin=d.pins.find(x=>x.position===p&&!x.support)
      if(pin?.empty&&!pin.reserved)return []
      return rows.map((r,i)=>({r,i})).filter(({r})=>(!pin?.svtId||r.svt.id===pin.svtId)&&(!pin?.formKey||r.form.key===pin.formKey)&&
        (!d.fixedPositions[r.svt.id]||d.fixedPositions[r.svt.id]===p))
    })
    const extraSeats=d.pins.filter(pin=>pin.position!==supportPosition&&(pin.ceBondId||pin.ceRewardId)).map(pin=>pin.position)
    const grandSeats=d.grand?(d.grandPosition?[d.grandPosition]:positions).filter(p=>
      positions.includes(p)&&extraSeats.every(extra=>extra===p)&&choices[positions.indexOf(p)].some(({r})=>canGrand(r.svt.id))):[]
    if(d.grand&&!grandSeats.length||!d.grand&&extraSeats.length){reject();continue}
    if(grandSeats.length===1){
      const at=positions.indexOf(grandSeats[0]);choices[at]=choices[at].filter(({r})=>canGrand(r.svt.id))
    }
    const suffixIds=Array.from({length:positions.length+1},()=>new Set()),cheapest=new Map()
    for(let at=positions.length-1;at>=0;at--){
      suffixIds[at]=new Set(suffixIds[at+1])
      for(const {r} of choices[at])for(const physical of r.equivalentRows||[r]){
        const id=physical.svt.id;suffixIds[at].add(id)
        cheapest.set(id,Math.min(cheapest.get(id)??Infinity,physical.cost))
      }
    }
    const minimumOwn=Math.max(d.minimumOwn,normalCount),required=new Set(d.requiredIds)
    if(minimumOwn>positions.length||suffixIds[0].size<minimumOwn||[...required].some(id=>!suffixIds[0].has(id))){reject();continue}
    const requiredCost=[...required].reduce((n,id)=>n+cheapest.get(id),0)
    const optionalCosts=[...cheapest].filter(([id])=>!required.has(id)).map(([,cost])=>cost).sort((a,b)=>a-b)
    const minimumCost=forcedNormalCost+requiredCost+optionalCosts.slice(0,Math.max(0,minimumOwn-required.size)).reduce((n,c)=>n+c,0)
    if(d.costLimit!=null&&minimumCost>d.costLimit){counters.budgetPruned++;continue}
    const optimistic=choices.map((list,j)=>new Map(list.map(({r,i})=>[i,fast?reward(r,i,positions[j],supportPosition,maxOwn[i]+(supportPosition?maxSupport[i]:0),maxFlat,maxAura):Infinity])))
    const suffixPotential=Array.from({length:positions.length+1},()=>new Map())
    if(fast)for(let j=positions.length-1;j>=0;j--){
      suffixPotential[j]=new Map(suffixPotential[j+1])
      for(const {r,i} of choices[j])for(const physical of r.equivalentRows||[r]){
        const id=physical.svt.id,value=optimistic[j].get(i)
        suffixPotential[j].set(id,Math.max(suffixPotential[j].get(id)||0,value))
      }
    }
    const priority=r=>guidance.member(r,cap)
    const ranked=choices.map((list,j)=>list.slice().sort((a,b)=>checkpoint?
      Number(d.requiredIds.includes(b.r.svt.id))-Number(d.requiredIds.includes(a.r.svt.id))||a.r.cost-b.r.cost:
      (fast&&!state.guidanceOnly?optimistic[j].get(b.i)-optimistic[j].get(a.i):
        priority(b.r)-priority(a.r))||(guidance?.wantsAI?priority(b.r)-priority(a.r):0)||a.r.cost-b.r.cost))
    function bound(step){
      if(!fast)return Infinity
      let total=0,seatBound=0
      for(const x of picked)total+=reward(x.r,x.i,x.p,supportPosition,maxOwn[x.i]+(supportPosition?maxSupport[x.i]:0),maxFlat,maxAura)
      for(let j=step;j<positions.length;j++){
        let best=0
        for(const {r,i} of ranked[j])if(r.equivalentRows?r.equivalentRows.some(x=>!used.has(x.svt.id)):!used.has(r.svt.id)){best=optimistic[j].get(i);break}
        seatBound+=best
      }
      const identityBound=largestSum([...suffixPotential[step]].filter(([id])=>!used.has(id)).map(([,v])=>v),positions.length-step)
      return total+Math.min(seatBound,identityBound)
    }
    function* equip(){
      let guidedNodes=0,guidedTeams=0
      const own=picked.map(x=>slots[x.p-1])
      const aura=picked.reduce((n,x)=>n+(x.r.upperContribution??x.r.contribution),0)
      let constantScore=zeroScore?0:null
      if(exact&&monotone&&!zeroScore){
        const minimum=picked.reduce((n,{r,i,p})=>n+reward(r,i,p,supportPosition,0,0,aura),0)
        const maximum=picked.reduce((n,{r,i,p})=>n+reward(r,i,p,supportPosition,maxOwn[i]+(supportPosition?maxSupport[i]:0),maxFlat,aura),0)
        if(minimum===maximum)constantScore=minimum
      }
      if(state.useBounds!==false&&constantScore!=null&&belowTarget(constantScore)){counters.scorePruned++;return}
      const grandRoles=new Set()
      const grands=d.grand?grandSeats.filter(p=>{
        if(!compact)return true
        const key=seatGroup(p)+':'+slots[p-1].rg
        if(grandRoles.has(key))return false
        grandRoles.add(key);return true
      }):[0]
      grandLoop: for(const grandPosition of grands){
        if(d.grand&&(!own.some(s=>s.p===grandPosition)||d.grandIds.length&&!d.grandIds.includes(slots[grandPosition-1].svt)))continue
        for(const s of own)s.g=Number(s.p===grandPosition&&d.grand)
        const extras=[]
        for(const s of own){
          const pin=d.pins.find(x=>x.position===s.p)
          s.bond=pin?.ceBondId||0
          if(s.g)extras.push({slot:s,field:'reward',free:true,pin:pin?.ceRewardId||0})
          if(s.g)extras.push({slot:s,field:'bond',free:true,pin:pin?.ceBondId||0})
          else if(pin?.ceRewardId||pin?.ceBondId)continue grandLoop
        }
        const fields=own.map(s=>({slot:s,field:'ce',pin:d.pins.find(x=>x.position===s.p)?.ceId||d.pinCes.find(x=>x.svtId===s.svt)?.ceId||0})).concat(extras)
        // For party-wide CEs, moving a normal CE between unlocked wearers
        // changes neither reward nor COST. Prove one canonical assignment;
        // phase 2 still enumerates/restores every actual optimal assignment.
        const proofSymmetry=exact&&state.phase==='optimizing'&&!state.guidanceOnly&&types.every(c=>c.effect.ordinary)
        const assignedTypes=new Int32Array(fields.length).fill(-1),typeIndex=new Map(types.map((c,i)=>[c,i]))
        const knownRates=new Float64Array(picked.length)
        let knownFlat=0,nonOrdinary=0
        function equipmentUpper(j,cost){
          if(!fast)return Infinity
          const remaining=fields.slice(j),left=remaining.filter(f=>f.field!=='bond').length
          // Reward equipment is free. A high-COST CE must remain eligible
          // for that field even when no normal-equipment budget is left.
          const free=remaining.some(f=>f.field==='reward')
          const accept=c=>free||d.costLimit==null||(c.cost||0)<=d.costLimit-cost
          const flat=knownFlat+availableEffectUpper(types,left,c=>c.effect.flat,accept)+(supportPosition?supportFlatMax:0)
          return picked.reduce((n,{r,i,p},at)=>{
            const rate=knownRates[at]+availableEffectUpper(types,left,c=>c.effect.rates[i],accept)+(supportPosition?maxSupport[i]:0)
            return n+reward(r,i,p,supportPosition,rate,flat,aura)
          },0)
        }
        const rankedTypes=checkpoint?types:guidance.rank(types,picked)
        const rankedSupport=supportPosition?(checkpoint?supportPool:guidance.rank(supportPool,picked,true)):[]
        function* ownEquipment(j,cost){
          if(state.guidanceOnly&&(++guidedNodes>128||guidedTeams>=8))return
          counters.nodes++
          if(counters.nodes%tickEvery===0)yield {type:'tick'}
          if(d.costLimit!=null&&cost>d.costLimit){counters.budgetPruned++;return}
          // Optional equipment must leave both copies and COST for every
          // later forced field. Otherwise a dead prefix can expand heavily.
          if(normalBySvt.size||unbound.size||extraNeeded.size){
            const needed=new Map(),normal=new Map()
            for(const f of fields.slice(j))if(f.pin){needed.set(f.pin,(needed.get(f.pin)||0)+1);if(!f.free)normal.set(f.pin,(normal.get(f.pin)||0)+1)}
            for(const id of unbound)if(!own.some(s=>s.ce===id&&fields.findIndex(f=>f.slot===s&&f.field==='ce')<j)&&!normal.has(id)){
              needed.set(id,(needed.get(id)||0)+1);normal.set(id,1)
            }
            if([...normal.values()].reduce((n,v)=>n+v,0)>fields.slice(j).filter(f=>f.field==='ce').length){reject();return}
            let reservedCost=0
            for(const [id,n] of needed){
              const available=types.filter(c=>c.id===id&&c.left)
              if(available.reduce((count,c)=>count+c.left,0)<n){reject();return}
              if(normal.has(id))reservedCost+=normal.get(id)*Math.min(...available.map(c=>c.cost||0))
            }
            if(d.costLimit!=null&&cost+reservedCost>d.costLimit){counters.budgetPruned++;return}
          }
          if(state.collectSettled&&!supportPosition&&j===fields.length){yield* supports(cost);return}
          if(state.useBounds!==false&&constantScore==null&&belowTarget(equipmentUpper(j,cost))){counters.scorePruned++;return}
          if(j===fields.length){yield* supports(cost);return}
          const {slot,field,pin,free}=fields[j]
          const mlbField=field==='ce'?'mlb':field+'Mlb',original=slot[field],originalMlb=slot[mlbField]
          const previous=compact&&field==='ce'?fields.slice(0,j).reverse().find(f=>f.field==='ce'&&f.slot.rg===slot.rg&&f.slot.g===slot.g&&seatGroup(f.slot.p)===seatGroup(slot.p))?.slot:null
          let proofPrevious=-1
          if(proofSymmetry&&field==='ce'&&!pin)for(let k=j-1;k>=0;k--)if(fields[k].field==='ce'&&!fields[k].pin){proofPrevious=k;break}
          function* empty(){if(!pin&&(!previous||previous.cg<0)&&(proofPrevious<0||assignedTypes[proofPrevious]<0)){slot[field]=0;slot[mlbField]=true;assignedTypes[j]=-1;if(compact&&field==='ce')slot.cg=-1;yield* ownEquipment(j+1,cost)}}
          if(checkpoint)yield* empty()
          // Zero-gain equipment is represented by an empty slot in every
          // phase. Explicit pins continue to consume the required copies.
          for(const c of field==='bond'&&!pin?[]:rankedTypes){
            if(!c.left||pin&&c.id!==pin||previous&&c.equivalentGroup<previous.cg)continue
            if(!pin&&!usefulScoreEquipment(cachedEffects(c),picked,d.base)&&
              !(field==='ce'&&unbound.has(c.id)&&![...normalBySvt.values()].includes(c.id)&&!fields.slice(0,j).some(f=>f.field==='ce'&&f.slot.ce===c.id)))continue
            if(proofPrevious>=0&&typeIndex.get(c)<assignedTypes[proofPrevious])continue
            if(field==='bond'&&!pin&&Number(c.bondEquipOwner)!==slot.svt)continue
            const variant=c.equivalentCopies?.find(v=>v.left>0)
            if(variant)variant.left--
            c.left--;slot[field]=variant?.id??c.id
            assignedTypes[j]=typeIndex.get(c)
            if(field==='ce'){slot.mlb=variant?.mlb??(c.accountMlb!==false);if(compact)slot.cg=c.equivalentGroup}
            else if(field==='reward')slot.rewardMlb=variant?.mlb??(c.accountMlb!==false)
            else slot.bondMlb=variant?.mlb??(c.accountMlb!==false)
            if(fast&&field!=='bond'){knownFlat+=c.effect.flat;nonOrdinary+=Number(!c.effect.ordinary);for(let at=0;at<picked.length;at++)knownRates[at]+=c.effect.rates[picked[at].i]}
            yield* ownEquipment(j+1,cost+(free?0:c.cost||0))
            if(fast&&field!=='bond'){knownFlat-=c.effect.flat;nonOrdinary-=Number(!c.effect.ordinary);for(let at=0;at<picked.length;at++)knownRates[at]-=c.effect.rates[picked[at].i]}
            c.left++;if(variant)variant.left++
          }
          if(!checkpoint)yield* empty()
          slot[field]=original;slot[mlbField]=originalMlb
        }
        function* supports(cost){
          const support=slots[supportPosition-1]
          const options=supportPosition?(d.lockSupportCeId?d.supportCes.filter(c=>c.id===d.lockSupportCeId):(checkpoint?[null,...rankedSupport]:[...rankedSupport,null])):[null]
          const seen=new Set()
          for(const ce of options){
            if(ce&&!d.lockSupportCeId&&!usefulScoreEquipment(cachedEffects(ce,true),picked,d.base))continue
            const key=ce?`${ce.id}:${ce.supportMlb!==false}`:'0'
            if(seen.has(key))continue;seen.add(key)
            if(support){support.ce=ce?.id||0;support.mlb=ce?.supportMlb!==false;if(compact)support.cg=ce?.equivalentGroup??-1}
            const supEffect=effect(ce,true)
            const rewardChoices=d.grand?boundSupportChoices.filter(x=>!ce||x.ce.id!==ce.id||supportCopies.get(ce.id)>=2):[]
            const rewardFlatMax=fast&&d.grand?Math.max(0,...rewardChoices.map(x=>x.effect.flat)):0
            const supportUpper=constantScore??(fast?picked.reduce((n,{r,i,p},at)=>n+reward(r,i,p,supportPosition,knownRates[at]+(supEffect?.rates[i]||0)+(d.grand?Math.max(0,...rewardChoices.map(x=>x.effect.rates[i])):0),knownFlat+(supEffect?.flat||0)+rewardFlatMax,aura),0):Infinity)
            if(state.useBounds!==false&&(!state.collectSettled||d.grand)&&belowTarget(supportUpper)){counters.scorePruned++;if(counters.scorePruned%4096===0)yield {type:'tick'};continue}
            const rewards=d.grand&&supportPosition?(checkpoint?[null,...rankedSupport]:[...rankedSupport,null]):[null]
            for(const extra of rewards){
              if(extra&&!d.pins.some(p=>p.position===supportPosition&&p.support&&p.ceRewardId===extra.id)&&!usefulScoreEquipment(cachedEffects(extra,true),picked,d.base))continue
              if(state.guidanceOnly&&guidedTeams>=8)return
              if(extra&&ce&&extra.id===ce.id&&supportCopies.get(ce.id)<2)continue
              if(support){support.reward=extra?.id||0;support.rewardMlb=extra?.supportMlb!==false}
              const pin=d.pins.find(x=>x.position===supportPosition&&x.support)
              if(pin?.ceRewardId&&pin.ceRewardId!==(extra?.id||0))continue
              // Fast exact arithmetic rejects losing leaves before hydration.
              let score=constantScore
              const extraEffect=effect(extra,true)
              const leafUpper=constantScore??(fast?picked.reduce((n,{r,i,p},at)=>n+reward(r,i,p,supportPosition,knownRates[at]+(supEffect?.rates[i]||0)+(extraEffect?.rates[i]||0),knownFlat+(supEffect?.flat||0)+(extraEffect?.flat||0),aura),0):Infinity)
              if(score==null&&exact&&!nonOrdinary&&(!supEffect||supEffect.ordinary)&&(!extraEffect||extraEffect.ordinary))score=leafUpper
              if(state.useBounds!==false&&(!state.collectSettled||score==null)&&belowTarget(leafUpper)){counters.scorePruned++;if(counters.scorePruned%4096===0)yield {type:'tick'};continue}
              counters.evaluated++
              if(counters.evaluated%128===0)yield {type:'tick'}
              // A physically evaluated lower-score team is incidental, never
              // a reason to visit an otherwise prunable branch.
              const packed={slots:slots.map(s=>({...s})),cost,...(compact?{equivalence:1}:{})}
              if(d.pinCes.some(pin=>!slots.some(s=>s.f&&!s.s&&s.ce===Number(pin.ceId)&&(!pin.svtId||s.svt===pin.svtId))))continue
              if(score!=null)packed.score=score
              guidedTeams++
              yield {type:'team',packed,score}
            }
          }
        }
        yield* ownEquipment(0,picked.reduce((n,x)=>n+x.r.cost,0))
      }
    }
    function* members(step,spent){
      counters.nodes++
      if(counters.nodes%tickEvery===0)yield {type:'tick'}
      if(d.costLimit!=null&&spent>d.costLimit){counters.budgetPruned++;return}
      const missing=d.requiredIds.filter(id=>!used.has(id))
      if(missing.length>positions.length-step||missing.some(id=>!suffixIds[step].has(id))){reject();return}
      if(picked.length<minimumOwn&&picked.length+Math.min(choices.slice(step).filter(list=>list.length).length,suffixIds[step].size-[...used].filter(id=>suffixIds[step].has(id)).length)<minimumOwn){reject();return}
      if(d.costLimit!=null&&spent+forcedNormalCost+missing.reduce((n,id)=>n+cheapest.get(id),0)>d.costLimit){counters.budgetPruned++;return}
      if(d.grand&&!grandSeats.some(p=>{
        const at=positions.indexOf(p)
        return at<step?slots[p-1].f&&canGrand(slots[p-1].svt):choices[at].some(({r})=>(r.equivalentRows||[r]).some(v=>!used.has(v.svt.id)&&canGrand(v.svt.id)))
      })){reject();return}
      if(state.useBounds!==false&&(!zeroScore||state.bestScore>0||state.phase==='optimizing')&&belowTarget(bound(step))){counters.scorePruned++;return}
      if(step===positions.length){
        if(picked.length<minimumOwn||!picked.length||!slots.slice(0,3).some(s=>s.f))return
        yield* equip();return
      }
      const p=positions[step],slot=slots[p-1],pin=d.pins.find(x=>x.position===p&&!x.support)
      const prev=compact?previousSeat(positions,step):null
      for(const {r:representative,i} of ranked[step]){
        if(prev!=null&&i<slots[prev-1].rg)continue
        const r=representative.equivalentRows?.find(row=>!used.has(row.svt.id))||representative
        if(used.has(r.svt.id))continue
        if(compact)slot.rg=i
        used.add(r.svt.id);Object.assign(slot,{f:1,svt:r.svt.id,art:r.form.key==='default'?'':r.form.key})
        picked.push({r,i,p});yield* members(step+1,spent+r.cost);picked.pop();used.delete(r.svt.id)
      }
      Object.assign(slot,blank(p));if(compact){slot.rg=-1;slot.cg=-1}
      if((prev==null||slots[prev-1].rg<0)&&!pin?.svtId&&!pin?.ceId&&!pin?.ceBondId&&!pin?.ceRewardId)yield* members(step+1,spent)
    }
    yield* members(0,0)
  }
}

