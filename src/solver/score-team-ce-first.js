import {createScoreEffects,scoreUpperValue,optimizationSupportChoices} from './score-team-effects.js'
import {compileScoreEquivalence} from './score-team-equivalence.js'
import {createScoreTeamGuidance} from './score-team-guidance.js'

// This is an objective-proof engine, not a result collector. Complete ties
// always restart the original enumerator; no top-F identity reduction reaches
// that phase. Every published improvement is a literal, exactly hydrated team.
const LIMITS={combinations:25000,cells:2000000,states:250000,auraUnits:12,frontier:2000,paretoCells:5000000}
const gcd=(a,b)=>b?gcd(b,a%b):a
const bits=n=>{let count=0;for(;n;n&=n-1)count++;return count}
const blank=p=>({p,f:0,s:0,g:0,svt:0,art:'',ce:0,mlb:true,bond:0,reward:0})
const ge=(a,b)=>a.flat>=b.flat&&a.rates.every((v,i)=>v>=b.rates[i])

function supportChoices(d,effect){
 const pool=optimizationSupportChoices(d.supportCes,effect),counts=new Map(),groups=new Map()
 for(const c of d.supportCes)counts.set(c.id,(counts.get(c.id)||0)+1)
 const cards=[null,...pool.filter(c=>{const e=effect(c,true);return e.flat||e.rates.some(Boolean)})]
 if(cards.length*(d.grand?cards.length:1)*d.rows.length>LIMITS.cells)return null
 for(let a=0;a<cards.length;a++)for(let b=0;b<(d.grand?cards.length:1);b++){
  if(d.grand&&b<a)continue
  const normal=cards[a],reward=d.grand?cards[b]:null
  if(normal&&reward&&normal.id===reward.id&&counts.get(normal.id)<2)continue
  const x=effect(normal,true),y=effect(reward,true),flat=(x?.flat||0)+(y?.flat||0)
  const rates=d.rows.map((_,i)=>(x?.rates[i]||0)+(y?.rates[i]||0)),key=JSON.stringify([flat,rates])
  if(!groups.has(key))groups.set(key,{normal,reward,flat,rates})
 }
 const result=[];let comparisons=0
 for(const x of groups.values()){
  const dominates=(a,b)=>{comparisons+=d.rows.length;return ge(a,b)}
  const dominated=result.some(y=>dominates(y,x))
  if(comparisons>LIMITS.paretoCells)return null
  if(dominated)continue
  for(let i=result.length-1;i>=0;i--)if(dominates(x,result[i]))result.splice(i,1)
  result.push(x)
  if(result.length>LIMITS.frontier||comparisons>LIMITS.paretoCells)return null
 }
 return result
}

function ownGroups(d,effect){
 const groups=new Map()
 for(const c of d.ownCes){
  const e=effect(c)
  // An unpinned zero-effect CE can only consume stock/COST. Optional bond
  // slots likewise never improve the objective and are restored by collection.
  if(!e.flat&&!e.rates.some(Boolean))continue
  const key=JSON.stringify([c.cost||0,e.flat,e.rates])
  if(!groups.has(key))groups.set(key,{cost:c.cost||0,...e,copies:[]})
  groups.get(key).copies.push(c)
 }
 return [...groups.values()]
}

function casesFor(d){
 const cases=[],seen=new Set(),grandIds=new Set(d.grandIds)
 for(const support of d.layouts){
  if(d.pins.some(p=>p.position===support&&(p.svtId||p.empty&&!p.reserved&&!p.support)))continue
  const positions=[1,2,3,4,5,6].filter(p=>p!==support&&!d.pins.some(pin=>pin.position===p&&pin.empty&&!pin.reserved))
  const grands=d.grand?(d.grandPosition?[d.grandPosition]:positions.filter(p=>p<=3)):[0]
  for(const grand of grands){
   if(d.grand&&!positions.includes(grand))continue
   const choices=positions.map(p=>{
    const pin=d.pins.find(x=>x.position===p&&!x.support)
    return d.rows.flatMap((r,i)=>{
     if(pin?.svtId&&r.svt.id!==pin.svtId||pin?.formKey&&r.form.key!==pin.formKey||
      d.fixedPositions[r.svt.id]&&d.fixedPositions[r.svt.id]!==p||p===grand&&grandIds.size&&!grandIds.has(r.svt.id))return []
     return [{r,i}]
    })
   })
   const mandatory=positions.reduce((mask,p,j)=>mask|((p===grand||d.pins.some(pin=>pin.position===p&&pin.svtId))?1<<j:0),0)
   const signature=JSON.stringify([support?Number(support<=3):-1,positions.map((p,j)=>[Number(p<=3),Number(p===grand),Number(Boolean(mandatory&(1<<j))),choices[j].map(x=>x.i)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))])
   if(seen.has(signature))continue
   seen.add(signature);cases.push({support,grand,positions,choices,mandatory})
  }
 }
 return cases
}

function* loadouts(d,effect,stats){
 const groups=ownGroups(d,effect),support=d.layouts.some(Boolean)?supportChoices(d,effect):[{normal:null,reward:null,flat:0,rates:d.rows.map(()=>0)}]
 if(!support)return null
 const selected=[],counts=groups.map(()=>0),frontier=[]
 const cap=Math.max(...d.layouts.map(s=>6-Number(Boolean(s))))
 let combinations=0,work=0,comparisons=0,overflow=false
 const dominates=(a,b)=>{comparisons+=d.rows.length;return a.cost<=b.cost&&a.normal.length<=b.normal.length&&ge(a,b)}
 function* visit(start,cost){
  const rewards=d.grand?[-1,...groups.map((_,i)=>i)]:[-1]
  for(const reward of rewards){
   if(reward>=0&&counts[reward]>=groups[reward].copies.length)continue
   for(const friend of support){
    if(++work%128===0)yield {type:'tick'}
    if(++combinations>LIMITS.combinations){overflow=true;return}
    const own=reward<0?selected:[...selected,reward]
    const rates=friend.rates.map((v,i)=>v+own.reduce((n,g)=>n+groups[g].rates[i],0))
    const flat=friend.flat+own.reduce((n,g)=>n+groups[g].flat,0)
    const candidate={normal:[...selected],reward,friend,cost,rates,flat}
    // Complete, stock-feasible loadouts can dominate one another without
    // assuming extra replacement copies. Fewer normal CEs need no more seats.
    const dominated=frontier.some(x=>dominates(x,candidate))
    if(comparisons>LIMITS.paretoCells){overflow=true;return}
    if(dominated){stats.ceFirstLoadoutsPruned++;continue}
    for(let i=frontier.length-1;i>=0;i--)if(dominates(candidate,frontier[i])){frontier.splice(i,1);stats.ceFirstLoadoutsPruned++}
    frontier.push(candidate)
    if(!Number.isSafeInteger(cost)||comparisons>LIMITS.paretoCells||frontier.length>LIMITS.frontier||frontier.length*d.rows.length>LIMITS.cells){overflow=true;return}
   }
  }
  if(selected.length===cap)return
  for(let i=start;i<groups.length;i++){
   const g=groups[i]
   if(counts[i]===g.copies.length||d.costLimit!=null&&cost+g.cost>d.costLimit)continue
   counts[i]++;selected.push(i);yield* visit(i,cost+g.cost);selected.pop();counts[i]--
   if(overflow)return
  }
 }
 yield* visit(0,0)
 stats.ceFirstCombinations+=combinations;stats.ceFirstLoadouts+=frontier.length
 return overflow?null:{groups,frontier}
}

function score(d,loadout,r,i,p,support,aura){
 return scoreUpperValue(d.base,d.teapot,r,p,support&&support<=3?40:0,loadout.rates[i],loadout.flat,aura,d.optimizeBy!=='prefer'||d.preferIds.includes(r.svt.id))
}

function* auraBounds(d,layout,loadout,unit,maxTarget,stats){
 const F=layout.positions.length,minimum=Math.max(d.minimumOwn,loadout.normal.length),bounds=[]
 for(let target=0;target<=maxTarget;target++){
  // Relax identities and COST, but retain the number of aura providers.
  // Otherwise a capped Bond-15 provider can be counted as both a provider
  // and an extra earning servant, leaving a very loose upper bound.
  const width=target+1
  let dp=new Float64Array((F+1)*width).fill(-Infinity);dp[0]=0
  const preferred=d.optimizeBy==='prefer'?new Map():null
  for(let j=0;j<F;j++){
   const byAura=new Map()
   for(const {r,i} of layout.choices[j]){
    stats.ceFirstBoundWork++
    if(stats.ceFirstBoundWork%8192===0)yield {type:'tick'}
    const units=unit?r.contribution/unit:0
    if(units>target)continue
    const value=score(d,loadout,r,i,layout.positions[j],layout.support,target*unit)
    if(preferred)for(const physical of r.equivalentRows||[r])if(d.preferIds.includes(physical.svt.id))preferred.set(physical.svt.id,Math.max(preferred.get(physical.svt.id)||0,value))
    if(!byAura.has(units)||value>byAura.get(units))byAura.set(units,value)
   }
   const next=layout.mandatory&(1<<j)?new Float64Array(dp.length).fill(-Infinity):dp.slice()
   for(let n=0;n<=j;n++)for(let used=0;used<=target;used++){
    const value=dp[n*width+used];if(value===-Infinity)continue
    for(const [units,gain] of byAura)if(used+units<=target){const index=(n+1)*width+used+units;next[index]=Math.max(next[index],value+gain)}
   }
   dp=next
  }
  let upper=-Infinity
  for(let n=minimum;n<=F;n++)upper=Math.max(upper,dp[n*width+target])
  // A preferred identity can earn at only one position. Taking its best
  // possible position independently is another safe, often tighter ceiling.
  if(preferred)upper=Math.min(upper,[...preferred.values()].reduce((n,v)=>n+v,0))
  bounds.push(upper)
 }
 return bounds
}

function* solveMembers(d,layout,loadout,unit,target,stats,priorities){
 const {positions,choices,mandatory}=layout,F=positions.length,required=new Set([...d.requiredIds,...d.pins.map(p=>p.svtId).filter(Boolean)])
 const minimum=Math.max(d.minimumOwn,loadout.normal.length),aura=target*unit
 const byId=new Map()
 let work=0
 for(let j=0;j<F;j++){
  const byCost=new Map()
  for(const {r,i} of choices[j]){
   if(++work%256===0)yield {type:'tick'}
   const units=unit?r.contribution/unit:0
   if(units>target)continue
   const value=score(d,loadout,r,i,positions[j],layout.support,aura)
   if(!Number.isSafeInteger(value))return {fallback:'unsafe-score'}
   const key=r.cost+':'+units
   if(!byCost.has(key))byCost.set(key,new Map())
   const map=byCost.get(key),ids=new Set()
   for(const physical of r.equivalentRows||[r]){
    const id=physical.svt.id
    if(ids.has(id))continue
    ids.add(id)
    const previous=map.get(id)
    const priority=priorities[i]
    if(!previous||value>previous.value||value===previous.value&&priority>previous.priority)map.set(id,{id,physical,r,value,priority,cost:r.cost,units,j})
    // Protected/required IDs never share an equivalence pool with another ID.
    if(ids.size===F)break
   }
  }
  for(const map of byCost.values()){
   const ordered=[...map.values()].sort((a,b)=>b.value-a.value||b.priority-a.priority||a.id-b.id),keep=new Set(ordered.slice(0,F))
   for(const x of ordered)if(required.has(x.id))keep.add(x)
   for(const x of keep){if(!byId.has(x.id))byId.set(x.id,[]);byId.get(x.id).push(x)}
  }
 }
 if([...required].some(id=>!byId.has(id)))return null
 const maximum=choices.reduce((n,list)=>n+Math.max(0,...list.map(x=>x.r.cost)),0)
 const budget=Math.min(d.costLimit==null?maximum:d.costLimit-loadout.cost,maximum)
 if(budget<0||F<minimum)return null
 const width=budget+1,layer=width*(target+1),size=(1<<F)*layer
 if(!Number.isSafeInteger(size)||size>LIMITS.states)return {fallback:'state-limit'}
 const values=new Float64Array(size).fill(-Infinity),paths=new Array(size),stamp=new Int32Array(size),active=Array.from({length:1<<F},()=>[])
 values[0]=0;active[0].push(0)
 let iteration=0
 const ids=[...byId].sort((a,b)=>Number(required.has(b[0]))-Number(required.has(a[0])))
 for(const [id,options] of ids){
  iteration++;const must=required.has(id)
  // A transition always adds a position bit. Descending masks therefore
  // enforce 0/1 servant identity use without keeping a full DP layer per ID.
  for(let mask=(1<<F)-1;mask>=0;mask--){
   for(const index of active[mask]){
    const value=values[index]
    if(value===-Infinity)continue
    const cost=index%width,used=Math.floor(index%layer/width)
    for(const choice of options){
     stats.ceFirstDpTransitions++;stats.nodes++
     if(++work%4096===0)yield {type:'tick'}
     const bit=1<<choice.j,nextCost=cost+choice.cost,nextAura=used+choice.units
     if(mask&bit||nextCost>budget||nextAura>target)continue
     const next=(mask|bit)*layer+nextAura*width+nextCost,candidate=value+choice.value
     if(!Number.isSafeInteger(candidate))return {fallback:'unsafe-score'}
     if(must&&stamp[next]!==iteration||candidate>values[next]){
      if(values[next]===-Infinity)active[mask|bit].push(next)
      values[next]=candidate;paths[next]={previous:paths[index],choice};stamp[next]=iteration
     }
    }
   }
  }
  if(must)for(const list of active)for(let at=list.length-1;at>=0;at--)if(stamp[list[at]]!==iteration){values[list[at]]=-Infinity;paths[list[at]]=undefined;list.splice(at,1)}
 }
 let best=-Infinity,path=null,cost=0
 for(let mask=0;mask<active.length;mask++){
  if((mask&mandatory)!==mandatory||bits(mask)<minimum)continue
  for(const index of active[mask])if(Math.floor(index%layer/width)===target&&values[index]>best){best=values[index];path=paths[index];cost=index%width}
 }
 stats.ceFirstDpStates+=active.reduce((n,list)=>n+list.length,0)
 if(best===-Infinity)return null
 const picked=[];for(;path;path=path.previous)picked.push(path.choice)
 return {score:best,picked,cost:cost+loadout.cost}
}

function packedTeam(layout,loadout,groups,solution){
 const slots=Array.from({length:6},(_,i)=>blank(i+1))
 for(const x of solution.picked){const p=layout.positions[x.j];Object.assign(slots[p-1],{f:1,svt:x.id,art:x.physical.form.key==='default'?'':x.physical.form.key,g:Number(p===layout.grand)})}
 const used=groups.map(()=>0),take=g=>groups[g].copies[used[g]++]
 const own=slots.filter(s=>s.f)
 loadout.normal.forEach((g,i)=>{const c=take(g);own[i].ce=c.id;own[i].mlb=c.accountMlb!==false})
 if(loadout.reward>=0){const c=take(loadout.reward),slot=slots[layout.grand-1];slot.reward=c.id;slot.rewardMlb=c.accountMlb!==false}
 if(layout.support){const {normal,reward}=loadout.friend;Object.assign(slots[layout.support-1],{f:1,s:1,g:Number(Boolean(layout.grand)),ce:normal?.id||0,mlb:normal?.supportMlb!==false,reward:reward?.id||0,rewardMlb:reward?.supportMlb!==false})}
 return {cost:solution.cost,slots}
}

export function* proveScoreTeamsCeFirst(source,state,{force=false}={}){
 const stats=state.stats,began=performance.now()
 const fallback=reason=>{stats.ceFirstFallback=reason;return false}
 if(source.partyConstraints||source.systemSupport)return fallback('quest-rules')
 if(source.arithmeticBounds===false||source.rows.some(r=>(r.upperSelf??r.self)!==r.self||(r.upperContribution??r.contribution)!==r.contribution))return fallback('live-effects')
 if(source.pinCes.length||source.lockSupportCeId||source.pins.some(p=>p.ceId||p.ceBondId||p.ceRewardId||p.support))return fallback('equipment-pins')
 if(source.rows.some(r=>![r.cost,r.contribution,r.ownAura,r.self].every(v=>Number.isSafeInteger(v)&&v>=0))||source.ownCes.some(c=>!Number.isSafeInteger(c.cost||0)||(c.cost||0)<0))return fallback('numeric-domain')
 if(source.costLimit!=null&&(!Number.isSafeInteger(source.costLimit)||source.costLimit<0))return fallback('numeric-domain')
 const originalEffects=createScoreEffects(source)
 if(source.ownCes.some(c=>!originalEffects(c).ordinary)||source.supportCes.some(c=>!originalEffects(c,true).ordinary))return fallback('wearer-or-conditional-flat')
 // Small literal domains already prove their maximum cheaply. Avoid paying
 // for loadout preparation/DP there; tests may force the engine independently.
 if(!force&&new Set(source.rows.map(r=>r.svt.id)).size<=12&&source.ownCes.length<=4&&source.supportCes.length<=16)return fallback('small-domain')
 const d=compileScoreEquivalence(source,{ordinary:true,grand:source.grand,effectsFor:originalEffects}),effect=createScoreEffects(d)
 const guidance=createScoreTeamGuidance(d,{effectFor:effect})
 const priorities=d.rows.map(()=>0)
 if(guidance.wantsAI){
  yield* guidance.prepare();if(guidance.ai)state.ai=guidance.ai
  const raw=d.rows.map(r=>guidance.member(r,6)),scale=Math.max(1,...raw)
  raw.forEach((v,i)=>{priorities[i]=v/scale});stats.ceFirstAIRanked=guidance.ai?.ranked||0
 }
 const unit=d.rows.reduce((n,r)=>gcd(n,r.contribution),0),maxContribution=Math.max(0,...d.rows.map(r=>r.contribution))
 const cases=casesFor(d)
 if(unit&&6*maxContribution/unit>LIMITS.auraUnits)return fallback('aura-dimension')
 for(const name of ['ceFirstCombinations','ceFirstLoadouts','ceFirstLoadoutsPruned','ceFirstDpStates','ceFirstDpTransitions','ceFirstEvaluated','ceFirstBoundWork'])stats[name]??=0
 const prepared=yield* loadouts(d,effect,stats)
 if(!prepared)return fallback('combination-limit')
 for(const layout of cases){
  const maximumAura=layout.positions.length*maxContribution,maxTarget=unit?maximumAura/unit:0
  const ordered=[]
  for(const loadout of prepared.frontier){
   const bounds=yield* auraBounds(d,layout,loadout,unit,maxTarget,stats),upper=Math.max(...bounds)
   if(upper===-Infinity)continue
   if(!Number.isSafeInteger(upper))return fallback('unsafe-score')
   const priority=loadout.rates.reduce((n,v,i)=>n+v*priorities[i],0)
   ordered.push({loadout,upper,bounds,priority})
   if(ordered.length%128===0)yield {type:'tick'}
  }
  ordered.sort((a,b)=>b.upper-a.upper||b.priority-a.priority||a.loadout.cost-b.loadout.cost)
  for(const {loadout,upper,bounds} of ordered){
   if(upper<=state.bestScore){stats.scorePruned++;continue}
   const targets=bounds.map((targetUpper,target)=>({target,targetUpper})).sort((a,b)=>b.targetUpper-a.targetUpper)
   for(const {target,targetUpper} of targets){
    if(targetUpper<=state.bestScore){stats.scorePruned++;continue}
    const solution=yield* solveMembers(d,layout,loadout,unit,target,stats,priorities)
    if(solution?.fallback)return fallback(solution.fallback)
    stats.ceFirstEvaluated++
    if(!solution||solution.score<=state.bestScore)continue
    const packed=packedTeam(layout,loadout,prepared.groups,solution),plan=source.hydrate(packed)
    const exact=plan&&(source.optimizeBy==='prefer'?plan.preferBond:plan.total)
    if(!plan?.ok||exact!==solution.score)return fallback('witness-mismatch')
    stats.evaluated++
    yield {type:'team',packed,score:exact,proofOnly:true}
   }
  }
 }
 stats.ceFirstProofs=(stats.ceFirstProofs||0)+1;stats.ceFirstProofMs=(stats.ceFirstProofMs||0)+performance.now()-began
 return true
}
