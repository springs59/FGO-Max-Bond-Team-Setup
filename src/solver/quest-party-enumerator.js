import {pickCeSkill,ceMatchesServant} from '../atlas.js'
import {partyRowAllowed,partyRuleSatisfied,traitMatches,validatePartyConstraints} from '../quest-party-constraints.js'
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
 const upperEnabled=d.safeOrdinaryUpper===true
 const positive=(ce,mlb,support,row)=> (pickCeSkill(ce,mlb)?.funcs||[]).filter(f=>!f.eventId&&(!support||f.applySupport!==0)).reduce((a,f)=>{
  a.rate+=ceMatchesServant(f,row.form.traitIds||[])?Math.max(0,support?(f.followerRate??f.rate??0):(f.rate||0)):0;a.flat+=Math.max(0,f.add||0);return a
 },{rate:0,flat:0})
 const auraMax=[...new Map(d.rows.map(r=>[r.svt.id,r.contribution])).values()].sort((a,b)=>b-a).slice(0,6).reduce((n,v)=>n+Math.max(0,v),0)
 for(const external of d.externalLayoutFactory()){
  const friend=external.find(s=>s.friend),positions=[1,2,3,4,5,6].filter(p=>!external.some(s=>s.position===p))
  const min=Math.max(rules.ownMin,rules.totalMin-external.length,normalCount,required.size),max=Math.min(rules.ownMax,rules.totalMax-external.length,positions.length)
  if(min>max){reject();continue}
  const slots=Array.from({length:6},(_,i)=>blank(i+1)),picked=[],used=new Set()
  for(const s of external)Object.assign(slots[s.position-1],{f:1,s:1,svt:s.svtId,ce:s.support?.equips?.[0]?.ceId||0,mlb:s.support?.equips?.[0]?.ceMlb!==false})
  const externalValues=external.map(s=>({...s,traitIds:s.traitIds||[]}))
  const forcedGrand=d.pins.filter(pin=>pin.ceBondId||pin.ceRewardId),activeSeats=rules.grandPositions.length?rules.grandPositions:d.grandPosition?[d.grandPosition]:[1,2,3]
  const forcedClasses=forcedGrand.map(pin=>d.rows.find(r=>r.svt.id===pin.svtId)?.svt.className)
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
  const upper=new Map()
  if(upperEnabled){
   const supportCards=[...(friend?d.supportCes:[]),...external.flatMap(s=>(s.support?.equips||[]).map(e=>({...e.ce,supportMlb:e.ceMlb})))],share=external.filter(s=>s.position<=3).length*40
   for(const r of d.rows){
    let rate=auraMax,flat=0
    for(const ce of d.ownCes){const e=positive(ce,ce.accountMlb!==false,false,r);rate+=e.rate;flat+=e.flat}
    for(const ce of supportCards){const e=positive(ce,ce.supportMlb!==false,true,r);rate+=e.rate;flat+=e.flat}
    const weighted=d.optimizeBy!=='prefer'||d.preferIds.includes(r.svt.id)
    for(const p of positions){
     const value=((BigInt(d.base)*BigInt(1000+(p<=3?200:0)+share)/1000n)*BigInt(1000+rate)/1000n+BigInt(flat))*(d.teapot?2n:1n)
     upper.set(r.svt.id+':'+r.form.key+':'+p,r.maxed||!weighted?0:value<=BigInt(Number.MAX_SAFE_INTEGER)?Number(value):Infinity)
    }
   }
  }
  if(!state.checkpointOnly)for(let j=0;j<positions.length;j++){
   const priority=r=>upperEnabled?upper.get(r.svt.id+':'+r.form.key+':'+positions[j]):
    (!r.maxed&&(d.optimizeBy!=='prefer'||d.preferIds.includes(r.svt.id))?Math.max(0,d.base)*(1000+r.self):0)+Math.max(0,r.contribution)*Math.max(0,d.base)*6
   choices[j].sort((a,b)=>priority(b)-priority(a))
  }
  function values(){return [...externalValues,...picked.map(x=>({...identity(x.r),position:x.p,filled:true}))]}
  function* emitEquipment(grandSeats){
   if(rules.grandRules.some(rule=>{const n=picked.filter(x=>grandSeats.includes(x.p)&&traitMatches(identity(x.r),rule.values)).length;return n<rule.min||n>rule.max}))return
   const fields=picked.map(x=>({p:x.p,field:'ce',pin:boundPins.get(x.r.svt.id)||0,free:false}))
   for(const x of picked){const s=slots[x.p-1],pin=d.pins.find(p=>p.position===x.p);s.g=Number(grandSeats.includes(x.p))
    if((pin?.ceBondId||pin?.ceRewardId)&&!s.g)return
    if(s.g)fields.push({p:x.p,field:'reward',pin:pin?.ceRewardId||0,free:true},{p:x.p,field:'bond',pin:pin?.ceBondId||0,free:true})
   }
   const friendPin=d.supportPins.find(p=>p.position===friend?.position),friendLock=Number(friendPin?.ceId)||d.lockSupportCeId
   const supportGrand=friend&&(rules.grandPositions.length?rules.grandPositions.includes(friend.position):d.grand)
   const priority=(c,support=false)=>c?picked.reduce((n,{r})=>{
    if(r.maxed||d.optimizeBy==='prefer'&&!d.preferIds.includes(r.svt.id))return n
    const e=positive(c,support?c.supportMlb!==false:c.accountMlb!==false,support,r)
    return n+Math.max(0,d.base)*e.rate/1000+e.flat
   },0):0
   const rankedTypes=state.checkpointOnly?types:types.slice().sort((a,b)=>priority(b)-priority(a)||(a.cost||0)-(b.cost||0))
   const rankedSupport=state.checkpointOnly?d.supportCes:d.supportCes.slice().sort((a,b)=>priority(b,true)-priority(a,true))
   function* supportEquipment(cost){
    const normal=friend?(friendLock?d.supportCes.filter(c=>c.id===friendLock):(state.checkpointOnly?[null,...rankedSupport]:[...rankedSupport,null])):[null],seen=new Set()
    for(const ce of normal){
     const key=ce?ce.id+':'+(ce.supportMlb!==false):'0';if(seen.has(key))continue;seen.add(key)
     const reward=friend&&supportGrand?(state.checkpointOnly?[null,...rankedSupport]:[...rankedSupport,null]):[null]
     for(const extra of reward){
      if(extra&&ce&&ce.id===extra.id&&d.supportCes.filter(c=>c.id===ce.id).length<2)continue
      if(friendPin?.ceRewardId&&friendPin.ceRewardId!==extra?.id)continue
      if(friend)Object.assign(slots[friend.position-1],{g:Number(supportGrand),ce:ce?.id||0,mlb:ce?.supportMlb!==false,reward:extra?.id||0,rewardMlb:extra?.supportMlb!==false})
      if(d.pinCes.some(pin=>!slots.some(s=>s.f&&!s.s&&s.ce===pin.ceId&&(!pin.svtId||s.svt===pin.svtId))))continue
      stats.evaluated++;if(stats.evaluated%128===0)yield {type:'tick'}
      yield {type:'team',packed:{external:external.map(s=>({p:s.position,...(s.friend?{friend:1}:{npc:s.support.id})})),cost,slots:slots.map(s=>({...s}))},score:null}
     }
    }
   }
   function* equipment(j,cost){
    stats.nodes++;if(stats.nodes%tickEvery===0)yield {type:'tick'}
    if(d.costLimit!=null&&cost>d.costLimit){stats.budgetPruned++;return}
    const needed=new Map(),normal=new Map()
    for(const f of fields.slice(j))if(f.pin){needed.set(f.pin,(needed.get(f.pin)||0)+1);if(!f.free)normal.set(f.pin,(normal.get(f.pin)||0)+1)}
    for(const id of unbound)if(!fields.slice(0,j).some(f=>f.field==='ce'&&slots[f.p-1].ce===id)&&!normal.has(id)){normal.set(id,1);needed.set(id,(needed.get(id)||0)+1)}
    if([...normal.values()].reduce((n,v)=>n+v,0)>fields.slice(j).filter(f=>f.field==='ce').length){reject();return}
    let reserve=0
    for(const [id,n] of needed){const available=types.filter(c=>c.id===id&&c.left);if(available.reduce((n,c)=>n+c.left,0)<n){reject();return}reserve+=(normal.get(id)||0)*Math.min(...available.map(c=>c.cost||0))}
    if(d.costLimit!=null&&cost+reserve>d.costLimit){stats.budgetPruned++;return}
    if(j===fields.length){yield* supportEquipment(cost);return}
    const f=fields[j],s=slots[f.p-1],original=s[f.field],mlbField=f.field==='ce'?'mlb':f.field+'Mlb',originalMlb=s[mlbField]
    function* empty(){if(!f.pin){s[f.field]=0;s[mlbField]=true;yield* equipment(j+1,cost)}}
    if(state.checkpointOnly)yield* empty()
    for(const c of rankedTypes)if(c.left&&(!f.pin||c.id===f.pin)&&(f.field!=='bond'||f.pin||Number(c.bondEquipOwner)===s.svt)){
     c.left--;s[f.field]=c.id;s[f.field==='ce'?'mlb':f.field+'Mlb']=c.accountMlb!==false
     yield* equipment(j+1,cost+(f.free?0:c.cost||0));c.left++
    }
    if(!state.checkpointOnly)yield* empty()
    s[f.field]=original;s[mlbField]=originalMlb
   }
   yield* equipment(0,picked.reduce((n,x)=>n+x.r.cost,0))
  }
  function* grands(){
   const allowed=rules.grandPositions.length?rules.grandPositions:d.grandPosition?[d.grandPosition]:[1,2,3]
   const eligible=picked.filter(x=>d.grand&&allowed.includes(x.p)&&grandEligible(x.r.svt.id))
   if(d.grandRequired){for(const x of eligible)yield* emitEquipment([x.p]);return}
   function* select(at,seats,classes){
    if(at===eligible.length){
     yield* emitEquipment(seats);return
    }
    const x=eligible[at],cls=x.r.svt.className
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
    const bound=picked.reduce((n,x)=>n+upper.get(x.r.svt.id+':'+x.r.form.key+':'+x.p),0)+suffix.reduce((n,rs,j)=>n+Math.max(0,...rs.filter(r=>!used.has(r.svt.id)).map(r=>upper.get(r.svt.id+':'+r.form.key+':'+positions[at+j]))),0)
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
