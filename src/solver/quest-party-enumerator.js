import {partyRowAllowed,partyRuleSatisfied,traitMatches,validatePartyConstraints} from '../quest-party-constraints.js'
import {createScoreTeamGuidance} from './score-team-guidance.js'
import {classBucketOf} from './common.js'
import {createScoreEffects,availableEffectUpper,scoreUpperValue,optimizationSupportChoices,usefulScoreEquipment} from './score-team-effects.js'
const blank=p=>({p,f:0,s:0,g:0,svt:0,art:'',ce:0,mlb:true,bond:0,reward:0})
// General physical domain for count/trait/guest/Grand phase restrictions.
// Required-seat propagation and inventory/COST reservations precede scoring.
export function* enumerateQuestPartyTeams(d,state){
 const belowTarget=upper=>state.phase==='optimizing'?upper<=state.bestScore:upper<state.bestScore
 const stats=state.stats,tickEvery=state.checkpointOnly?16:256,rules=d.partyConstraints,required=new Set(d.requiredIds),grandIds=new Set(d.grandIds)
 const grandEligible=id=>grandIds.has(id)||!d.grandIdsKnown&&!grandIds.size
 const identity=row=>({svtId:row.svt.id,traitIds:row.form.traitIds,isSupport:false,grandCapable:grandEligible(row.svt.id)})
 const eligibleGrandIds=new Set(d.rows.filter(r=>grandEligible(r.svt.id)).map(r=>r.svt.id))
 if(d.grandRequired&&eligibleGrandIds.size===1)required.add([...eligibleGrandIds][0])
 const reject=()=>{stats.constraintPruned=(stats.constraintPruned||0)+1}
 if(d.grandRequired&&!eligibleGrandIds.size){reject();return}
 const types=[]
 for(const ce of d.ownCes){let t=types.find(t=>t.id===ce.id&&t.accountMlb===ce.accountMlb);if(!t){t={...ce,left:0};types.push(t)}t.left++}
 const boundPins=new Map(),unbound=new Set()
 for(const pin of [...d.pinCes,...d.pins.filter(p=>p.svtId&&p.ceId)]){
  if(!pin.ceId)continue
  if(!pin.svtId){unbound.add(pin.ceId);continue}
  if(boundPins.has(pin.svtId)&&boundPins.get(pin.svtId)!==pin.ceId){reject();return}
  boundPins.set(pin.svtId,pin.ceId)
 }
 const needs=new Map()
 for(const id of boundPins.values())needs.set(id,(needs.get(id)||0)+1)
 for(const id of unbound)needs.set(id,Math.max(1,needs.get(id)||0))
 const normalCount=[...needs.values()].reduce((n,v)=>n+v,0)
 for(const pin of d.pins)for(const id of [pin.ceBondId,pin.ceRewardId])if(id)needs.set(id,(needs.get(id)||0)+1)
 if([...needs].some(([id,n])=>types.filter(t=>t.id===id).reduce((n,t)=>n+t.left,0)<n)){reject();return}
 const upperEnabled=!state.checkpointOnly&&(d.safeOrdinaryUpper===true||Boolean(d.passiveUpperFor))
 const effects=createScoreEffects(d),rowIndex=new Map(d.rows.map((r,i)=>[r,i]))
 const guidance=state.checkpointOnly?null:createScoreTeamGuidance(d,{effectFor:effects})
 if(guidance)yield* guidance.prepare()
 if(guidance?.ai)(state.queryState||state).ai=guidance.ai
 const auraMax=[...new Map(d.rows.map(r=>[r.svt.id,r.upperContribution??r.contribution])).values()].sort((a,b)=>b-a).slice(0,6).reduce((n,v)=>n+Math.max(0,v),0)
 if(upperEnabled)for(const c of types)c.effect=effects(c)
 const supportPool=upperEnabled&&state.phase==='optimizing'?optimizationSupportChoices(d.supportCes,effects,
  [d.lockSupportCeId,...d.supportPins.flatMap(p=>[p.ceId,p.ceRewardId])]):d.supportCes
 for(const external of d.externalLayoutFactory()){
  const friend=external.find(s=>s.friend),positions=[1,2,3,4,5,6].filter(p=>!external.some(s=>s.position===p))
  const min=Math.max(rules.ownMin,rules.totalMin-external.length,normalCount,required.size),max=Math.min(rules.ownMax,rules.totalMax-external.length,positions.length)
  if(min>max){reject();continue}
  const slots=Array.from({length:6},(_,i)=>blank(i+1)),picked=[],used=new Set()
  for(const s of external)Object.assign(slots[s.position-1],{f:1,s:1,svt:s.svtId,ce:s.support?.equips?.[0]?.ceId||0,mlb:s.support?.equips?.[0]?.ceMlb!==false})
  const externalValues=external.map(s=>({...s,traitIds:s.traitIds||[]}))
  const forcedGrand=d.pins.filter(pin=>pin.ceBondId||pin.ceRewardId)
  // Only phase metadata or a selected seat restricts Grand placement.
  // Unspecified placement includes every own seat, including the rear.
  const activeSeats=(rules.grandPositions.length?rules.grandPositions:positions)
   .filter(p=>!d.grandRequired||!d.grandPosition||p===d.grandPosition)
  const forcedClasses=forcedGrand.map(pin=>classBucketOf(d.rows.find(r=>r.svt.id===pin.svtId)?.svt.className))
  if(forcedGrand.some(pin=>!d.grand||!activeSeats.includes(pin.position)||!eligibleGrandIds.has(pin.svtId)||external.some(s=>s.position===pin.position))||d.grandRequired&&forcedGrand.length>1||new Set(forcedClasses).size<forcedClasses.length){reject();continue}
  if(d.grandRequired&&d.grandPosition&&external.some(s=>s.position===d.grandPosition)){reject();continue}
  const activeRules=rules.seatRules.filter(r=>r.kind==='required'&&!partyRuleSatisfied(r,externalValues))
  const choices=positions.map(p=>{
   const pin=d.pins.find(x=>x.position===p)
   if(pin?.empty)return []
   return d.rows.filter(r=>(!d.grandRequired||!d.grandPosition||p!==d.grandPosition||!grandIds.size||grandIds.has(r.svt.id))&&(!pin?.svtId||r.svt.id===pin.svtId)&&(!pin?.formKey||pin.formKey===r.form.key)&&(!d.fixedPositions[r.svt.id]||d.fixedPositions[r.svt.id]===p)&&partyRowAllowed(identity(r),p,rules)&&
    !rules.unique.some(v=>traitMatches(identity(r),[v])&&externalValues.some(s=>traitMatches(s,[v])))&&
    activeRules.filter(rule=>rule.seats.length===1&&rule.seats[0]===p).every(rule=>partyRuleSatisfied(rule,[{...identity(r),position:p}])))
    .sort((a,b)=>Number(required.has(b.svt.id))-Number(required.has(a.svt.id))||activeRules.filter(rule=>partyRuleSatisfied(rule,[{...identity(b),position:p}])).length-activeRules.filter(rule=>partyRuleSatisfied(rule,[{...identity(a),position:p}])).length||a.cost-b.cost||a.svt.id-b.svt.id)
  })
  const cheapest=new Map()
  for(const r of choices.flat())cheapest.set(r.svt.id,Math.min(cheapest.get(r.svt.id)??Infinity,r.cost))
  if(cheapest.size<min||[...required].some(id=>!cheapest.has(id))||activeRules.some(rule=>!choices.some((rs,j)=>rs.some(r=>partyRuleSatisfied(rule,[{...identity(r),position:positions[j]}]))))){reject();continue}
  const normalCost=[...boundPins.values(),...[...unbound].filter(id=>![...boundPins.values()].includes(id))].reduce((n,id)=>n+Math.min(...types.filter(t=>t.id===id).map(t=>t.cost||0)),0)
  const cheapestOptional=[...cheapest].filter(([id])=>!required.has(id)).map(([,c])=>c).sort((a,b)=>a-b)
  if(d.costLimit!=null&&normalCost+[...required].reduce((n,id)=>n+cheapest.get(id),0)+cheapestOptional.slice(0,Math.max(0,min-required.size)).reduce((n,c)=>n+c,0)>d.costLimit){stats.budgetPruned++;continue}
  const friendGrand=friend&&(rules.grandPositions.length?rules.grandPositions.includes(friend.position):d.grand)
  const supportCount=friend?1+Number(Boolean(friendGrand)):0
  const supportTypes=upperEnabled&&friend?d.supportCes.map(c=>({...c,left:1,effect:effects(c,true)})):[]
  const fixedEffects=upperEnabled?external.flatMap(s=>(s.support?.equips||[]).map(eq=>effects({...eq.ce,supportMlb:eq.ceMlb},true))):[]
  const fixedRates=d.rows.map((r,i)=>fixedEffects.reduce((n,e)=>n+(e?.rates[i]||0),0))
  const fixedFlat=fixedEffects.reduce((n,e)=>n+(e?.flat||0),0)
  const externalAura=external.reduce((n,s)=>n+(d.passiveUpperFor?.(s.svtId||0).party||0),0)
  const share=external.filter(s=>s.position<=3).length*40
  const supportRates=d.rows.map((r,i)=>availableEffectUpper(supportTypes,supportCount,c=>c.effect.rates[i]))
  const supportFlat=availableEffectUpper(supportTypes,supportCount,c=>c.effect.flat)
  const recipientUpper=(r,p,rate,flat,aura)=>scoreUpperValue(d.base,d.teapot,r,p,share,rate,flat,aura+externalAura,d.optimizeBy!=='prefer'||d.preferIds.includes(r.svt.id))
  const upper=new Map()
  if(upperEnabled){
   const effectCount=max+(d.grand?Math.min(max,d.grandRequired?1:rules.grandPositions.length||max):0)
   const flat=availableEffectUpper(types,effectCount,c=>c.effect.flat)+fixedFlat+supportFlat
   for(const r of d.rows){
    const i=rowIndex.get(r),rate=availableEffectUpper(types,effectCount,c=>c.effect.rates[i])+fixedRates[i]+supportRates[i]
    for(const p of positions){
     upper.set(r.svt.id+':'+r.form.key+':'+p,recipientUpper(r,p,rate,flat,auraMax))
    }
   }
  }
  if(!state.checkpointOnly)for(let j=0;j<positions.length;j++){
   const priority=r=>upperEnabled&&!(state.guidanceOnly&&guidance?.wantsAI)?upper.get(r.svt.id+':'+r.form.key+':'+positions[j]):
    guidance.member(r,positions.length)
   choices[j].sort((a,b)=>priority(b)-priority(a)||(guidance?.wantsAI?guidance.member(b,positions.length)-guidance.member(a,positions.length):0))
  }
  const suffixPotential=Array.from({length:positions.length+1},()=>new Map())
  if(upperEnabled)for(let j=positions.length-1;j>=0;j--){
   suffixPotential[j]=new Map(suffixPotential[j+1])
   for(const r of choices[j]){
    const value=upper.get(r.svt.id+':'+r.form.key+':'+positions[j])
    suffixPotential[j].set(r.svt.id,Math.max(suffixPotential[j].get(r.svt.id)||0,value))
   }
  }
  function values(){return [...externalValues,...picked.map(x=>({...identity(x.r),position:x.p,filled:true}))]}
  function* emitEquipment(grandSeats){
   let guidedNodes=0,guidedTeams=0
   if(rules.grandRules.some(rule=>{const n=picked.filter(x=>grandSeats.includes(x.p)&&traitMatches(identity(x.r),rule.values)).length;return n<rule.min||n>rule.max}))return
   const fields=picked.map(x=>({p:x.p,field:'ce',pin:boundPins.get(x.r.svt.id)||0,free:false}))
   for(const x of picked){const s=slots[x.p-1],pin=d.pins.find(p=>p.position===x.p);s.g=Number(grandSeats.includes(x.p))
    if((pin?.ceBondId||pin?.ceRewardId)&&!s.g)return
    if(s.g)fields.push({p:x.p,field:'reward',pin:pin?.ceRewardId||0,free:true},{p:x.p,field:'bond',pin:pin?.ceBondId||0,free:true})
   }
   const friendPin=d.supportPins.find(p=>p.position===friend?.position),friendLock=Number(friendPin?.ceId)||d.lockSupportCeId
   const supportGrand=friend&&(rules.grandPositions.length?rules.grandPositions.includes(friend.position):d.grand)
   const aura=picked.reduce((n,x)=>n+(x.r.upperContribution??x.r.contribution),0)
   const knownRates=new Float64Array(picked.length)
   let knownFlat=0,nonOrdinary=0
   const proofSymmetry=upperEnabled&&state.phase==='optimizing'&&!state.guidanceOnly&&types.every(c=>c.effect.ordinary)
   const assignedTypes=new Int32Array(fields.length).fill(-1),typeIndex=new Map(types.map((c,i)=>[c,i]))
   const rankedTypes=state.checkpointOnly?types:guidance.rank(types,picked)
   const rankedSupport=friend?(state.checkpointOnly?supportPool:guidance.rank(supportPool,picked,true)):[]
   function* supportEquipment(cost){
    const normal=friend?(friendLock?d.supportCes.filter(c=>c.id===friendLock):(state.checkpointOnly?[null,...rankedSupport]:[...rankedSupport,null])):[null],seen=new Set()
    for(const ce of normal){
     if(ce&&!friendLock&&!usefulScoreEquipment(effects(ce,true),picked,d.base,x=>rowIndex.get(x.r)))continue
     const key=ce?ce.id+':'+(ce.supportMlb!==false):'0';if(seen.has(key))continue;seen.add(key)
     const reward=friend&&supportGrand?(state.checkpointOnly?[null,...rankedSupport]:[...rankedSupport,null]):[null]
     for(const extra of reward){
      if(extra&&!friendPin?.ceRewardId&&!usefulScoreEquipment(effects(extra,true),picked,d.base,x=>rowIndex.get(x.r)))continue
      if(state.guidanceOnly&&guidedTeams>=8)return
      if(extra&&ce&&ce.id===extra.id&&d.supportCes.filter(c=>c.id===ce.id).length<2)continue
      if(friendPin?.ceRewardId&&friendPin.ceRewardId!==extra?.id)continue
      const normalEffect=upperEnabled?effects(ce,true):null,extraEffect=upperEnabled?effects(extra,true):null
      const ceiling=upperEnabled?picked.reduce((n,{r,p},at)=>{
       const i=rowIndex.get(r)
       return n+recipientUpper(r,p,knownRates[at]+fixedRates[i]+(normalEffect?.rates[i]||0)+(extraEffect?.rates[i]||0),knownFlat+fixedFlat+(normalEffect?.flat||0)+(extraEffect?.flat||0),aura)
      },0):Infinity
      if(friend)Object.assign(slots[friend.position-1],{g:Number(supportGrand),ce:ce?.id||0,mlb:ce?.supportMlb!==false,reward:extra?.id||0,rewardMlb:extra?.supportMlb!==false})
      if(d.pinCes.some(pin=>!slots.some(s=>s.f&&!s.s&&s.ce===pin.ceId&&(!pin.svtId||s.svt===pin.svtId))))continue
      const exact=upperEnabled&&d.safeOrdinaryUpper===true&&!nonOrdinary&&fixedEffects.every(e=>!e||e.ordinary)&&(!normalEffect||normalEffect.ordinary)&&(!extraEffect||extraEffect.ordinary)
      if(state.useBounds!==false&&(!state.collectSettled||!exact)&&belowTarget(ceiling)){stats.scorePruned++;if(stats.scorePruned%4096===0)yield {type:'tick'};continue}
      stats.evaluated++;if(stats.evaluated%128===0)yield {type:'tick'}
      guidedTeams++
      yield {type:'team',packed:{external:external.map(s=>({p:s.position,...(s.friend?{friend:1}:{npc:s.support.id})})),cost,slots:slots.map(s=>({...s}))},score:exact?ceiling:null}
     }
    }
   }
   function* equipment(j,cost){
    if(state.guidanceOnly&&(++guidedNodes>128||guidedTeams>=8))return
    stats.nodes++;if(stats.nodes%tickEvery===0)yield {type:'tick'}
    if(d.costLimit!=null&&cost>d.costLimit){stats.budgetPruned++;return}
    const needed=new Map(),normal=new Map()
    for(const f of fields.slice(j))if(f.pin){needed.set(f.pin,(needed.get(f.pin)||0)+1);if(!f.free)normal.set(f.pin,(normal.get(f.pin)||0)+1)}
    for(const id of unbound)if(!fields.slice(0,j).some(f=>f.field==='ce'&&slots[f.p-1].ce===id)&&!normal.has(id)){normal.set(id,1);needed.set(id,(needed.get(id)||0)+1)}
    if([...normal.values()].reduce((n,v)=>n+v,0)>fields.slice(j).filter(f=>f.field==='ce').length){reject();return}
    let reserve=0
    for(const [id,n] of needed){const available=types.filter(c=>c.id===id&&c.left);if(available.reduce((n,c)=>n+c.left,0)<n){reject();return}reserve+=(normal.get(id)||0)*Math.min(...available.map(c=>c.cost||0))}
    if(d.costLimit!=null&&cost+reserve>d.costLimit){stats.budgetPruned++;return}
    if(state.collectSettled&&!friend&&j===fields.length&&upperEnabled&&d.safeOrdinaryUpper===true&&!nonOrdinary&&fixedEffects.every(e=>!e||e.ordinary)){yield* supportEquipment(cost);return}
    if(upperEnabled&&state.useBounds!==false&&Number.isFinite(state.bestScore)){
     const remaining=fields.slice(j),free=remaining.some(f=>f.field==='reward'),n=remaining.filter(f=>f.field!=='bond').length
     const accept=c=>free||d.costLimit==null||(c.cost||0)<=d.costLimit-cost
     const flat=knownFlat+availableEffectUpper(types,n,c=>c.effect.flat,accept)+fixedFlat+supportFlat
     const ceiling=picked.reduce((sum,{r,p},at)=>{
      const i=rowIndex.get(r),rate=knownRates[at]+availableEffectUpper(types,n,c=>c.effect.rates[i],accept)+fixedRates[i]+supportRates[i]
      return sum+recipientUpper(r,p,rate,flat,aura)
     },0)
     if(belowTarget(ceiling)){stats.scorePruned++;return}
    }
    if(j===fields.length){yield* supportEquipment(cost);return}
    const f=fields[j],s=slots[f.p-1],original=s[f.field],mlbField=f.field==='ce'?'mlb':f.field+'Mlb',originalMlb=s[mlbField]
    let proofPrevious=-1
    if(proofSymmetry&&f.field==='ce'&&!f.pin)for(let k=j-1;k>=0;k--)if(fields[k].field==='ce'&&!fields[k].pin){proofPrevious=k;break}
    function* empty(){if(!f.pin&&(proofPrevious<0||assignedTypes[proofPrevious]<0)){s[f.field]=0;s[mlbField]=true;assignedTypes[j]=-1;yield* equipment(j+1,cost)}}
    if(state.checkpointOnly)yield* empty()
    // Optional bond equipment cannot improve bond gain.
    for(const c of f.field==='bond'&&!f.pin?[]:rankedTypes)if(c.left&&(!f.pin||c.id===f.pin)&&(f.field!=='bond'||f.pin||Number(c.bondEquipOwner)===s.svt)){
     if(!f.pin&&!usefulScoreEquipment(c.effect,picked,d.base,x=>rowIndex.get(x.r))&&
       !(f.field==='ce'&&unbound.has(c.id)&&![...boundPins.values()].includes(c.id)&&!fields.slice(0,j).some(f=>f.field==='ce'&&slots[f.p-1].ce===c.id)))continue
     if(proofPrevious>=0&&typeIndex.get(c)<assignedTypes[proofPrevious])continue
     c.left--;s[f.field]=c.id;s[f.field==='ce'?'mlb':f.field+'Mlb']=c.accountMlb!==false
     assignedTypes[j]=typeIndex.get(c)
     if(upperEnabled&&f.field!=='bond'){knownFlat+=c.effect.flat;nonOrdinary+=Number(!c.effect.ordinary);for(let at=0;at<picked.length;at++)knownRates[at]+=c.effect.rates[rowIndex.get(picked[at].r)]}
     yield* equipment(j+1,cost+(f.free?0:c.cost||0));c.left++
     if(upperEnabled&&f.field!=='bond'){knownFlat-=c.effect.flat;nonOrdinary-=Number(!c.effect.ordinary);for(let at=0;at<picked.length;at++)knownRates[at]-=c.effect.rates[rowIndex.get(picked[at].r)]}
    }
    if(!state.checkpointOnly)yield* empty()
    s[f.field]=original;s[mlbField]=originalMlb
   }
   yield* equipment(0,picked.reduce((n,x)=>n+x.r.cost,0))
  }
  function* grands(){
   const eligible=picked.filter(x=>d.grand&&activeSeats.includes(x.p)&&grandEligible(x.r.svt.id))
   if(d.grandRequired){for(const x of eligible)yield* emitEquipment([x.p]);return}
   function* select(at,seats,classes){
    if(at===eligible.length){
     yield* emitEquipment(seats);return
    }
    const x=eligible[at],cls=classBucketOf(x.r.svt.className)
    if(state.checkpointOnly)yield* select(at+1,seats,classes)
    if(!classes.has(cls))yield* select(at+1,[...seats,x.p],new Set([...classes,cls]))
    if(!state.checkpointOnly)yield* select(at+1,seats,classes)
   }
   yield* select(0,[],new Set())
  }
  function* members(at,cost){
   stats.nodes++;if(stats.nodes%tickEvery===0)yield {type:'tick'}
   if(d.costLimit!=null&&cost+normalCost>d.costLimit){stats.budgetPruned++;return}
   const remaining=positions.length-at,missing=[...required].filter(id=>!used.has(id))
   if(picked.length>max||picked.length+remaining<min||missing.length>remaining){reject();return}
   const suffix=choices.slice(at),available=new Set(suffix.flat().filter(r=>!used.has(r.svt.id)).map(r=>r.svt.id))
   if(picked.length+available.size<min||missing.some(id=>!available.has(id))){reject();return}
   const current=values()
   if(activeRules.some(rule=>!partyRuleSatisfied(rule,current)&&!suffix.some((rs,j)=>rs.some(r=>!used.has(r.svt.id)&&partyRuleSatisfied(rule,[{...identity(r),position:positions[at+j]}]))))){reject();return}
   if(upperEnabled&&state.useBounds!==false&&Number.isFinite(state.bestScore)){
    const possible=[...suffixPotential[at]].filter(([id])=>!used.has(id)).map(([,v])=>v).sort((a,b)=>b-a)
    const identities=possible.slice(0,max-picked.length).reduce((n,v)=>n+v,0)
    const seats=suffix.reduce((n,rs,j)=>n+Math.max(0,...rs.filter(r=>!used.has(r.svt.id)).map(r=>upper.get(r.svt.id+':'+r.form.key+':'+positions[at+j]))),0)
    const bound=picked.reduce((n,x)=>n+upper.get(x.r.svt.id+':'+x.r.form.key+':'+x.p),0)+Math.min(identities,seats)
    if(belowTarget(bound)){stats.scorePruned++;return}
   }
   if(at===positions.length){if(validatePartyConstraints(current,rules,{pendingGrand:true}))yield* grands();return}
   const p=positions[at],s=slots[p-1],pin=d.pins.find(x=>x.position===p)
   if(picked.length<max)for(const r of choices[at])if(!used.has(r.svt.id)&&!rules.unique.some(v=>traitMatches(identity(r),[v])&&current.some(s=>traitMatches(s,[v])))){
    Object.assign(s,{f:1,svt:r.svt.id,art:r.form.key==='default'?'':r.form.key});picked.push({r,p});used.add(r.svt.id)
    yield* members(at+1,cost+r.cost);used.delete(r.svt.id);picked.pop()
   }
   Object.assign(s,blank(p))
   if(!pin?.svtId&&!pin?.ceId&&!pin?.ceBondId&&!pin?.ceRewardId)yield* members(at+1,cost)
  }
  yield* members(0,0)
 }
}
