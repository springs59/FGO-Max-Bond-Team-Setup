import {pickCeSkill,ceMatchesServant} from '../atlas.js'

// These bounds relax availability and identity constraints upwards. A bound
// may admit impossible teams; it must never exclude a reachable equal score.
export function ordinaryScoreDomain(d) {
  const valid=(ce,mlb)=>(pickCeSkill(ce,mlb)?.funcs||[]).every(f=>f.eventId||f.target==='ptFull'&&
    (f.rate||0)>=0&&(f.followerRate??f.rate??0)>=0&&(f.add||0)>=0&&
    (!(f.add||0)||!f.tvals?.length&&!f.andTvals?.length))
  return !d.grand&&!d.systemSupport&&d.ownCes.every(c=>valid(c,c.accountMlb!==false))&&d.supportCes.every(c=>valid(c,true))
}
const blank=p=>({p,f:0,s:0,g:0,svt:0,art:'',ce:0,mlb:true,bond:0,reward:0})
const funcs=(ce,mlb,support=false)=>(pickCeSkill(ce,mlb)?.funcs||[]).filter(f=>!f.eventId&&(!support||f.applySupport!==0))
// A wearer-only effect is relaxed to apply to each candidate recipient. This
// deliberately overestimates; exact live settlement decides every such leaf.
const rateUpper=(ce,form,support,mlb)=>funcs(ce,mlb,support).reduce((n,f)=>n+(ceMatchesServant(f,form.traitIds||[])?Math.max(0,support?(f.followerRate??f.rate??0):(f.rate||0)):0),0)
const flatUpper=(ce,mlb,support=false)=>funcs(ce,mlb,support).reduce((n,f)=>n+Math.max(0,f.add||0),0)
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

// All physical identities, unlocked forms, positions and CE/MLB assignments
// remain distinct. Identical copies of the same CE are indistinguishable.
// Yield control tokens as well as teams, so a sparse search stays cancellable.
export function* enumerateScoreTeams(d,state) {
  const fast=!d.grand&&!d.systemSupport&&d.arithmeticBounds!==false,rows=d.rows,cap=6-(d.layouts[0]?1:0)
  const counters=state.stats
  const types=quantities(d.ownCes),ownEffects=new Map(),supportEffects=new Map()
  function effect(c,support=false){
    if(!c||!fast)return null
    const mlb=support?c.supportMlb!==false:c.accountMlb!==false,key=c.id+':'+Number(mlb),map=support?supportEffects:ownEffects
    if(!map.has(key))map.set(key,{rates:rows.map(r=>rateUpper(c,r.form,support,mlb)),flat:flatUpper(c,mlb,support),
      ordinary:ordinaryScoreDomain({grand:false,systemSupport:null,ownCes:support?[]:[c],supportCes:support?[c]:[]})})
    return map.get(key)
  }
  let prepared=0
  for(const c of types){c.effect=effect(c);if(++prepared%32===0)yield {type:'tick'}}
  const ownCopies=d.ownCes.map(c=>effect(c)),supportChoices=[]
  for(const c of d.supportCes){supportChoices.push({ce:c,effect:effect(c,true)});if(++prepared%32===0)yield {type:'tick'}}
  const supportFlatMax=fast?Math.max(0,...supportChoices.map(x=>x.effect.flat)):0
  const maxAura=[...new Map(rows.map(r=>[r.svt.id,r.contribution])).values()].sort((a,b)=>b-a).slice(0,cap).reduce((a,b)=>a+b,0)
  const maxOwn=[],maxSupport=[]
  for(let i=0;i<rows.length;i++){
    maxOwn.push(fast?largestSum(ownCopies.map(e=>e.rates[i]),cap):0)
    maxSupport.push(fast?Math.max(0,...supportChoices.map(x=>x.effect.rates[i])):0)
    if(i%32===31)yield {type:'tick'}
  }
  const maxFlat=fast?ownCopies.map(e=>e.flat).sort((a,b)=>b-a).slice(0,cap).reduce((a,b)=>a+b,0)+supportFlatMax:0
  const zeroScore=fast&&d.base===0&&maxFlat===0
  const monotone=[...d.ownCes,...d.supportCes].every(c=>[false,true].every(mlb=>funcs(c,mlb).every(f=>(f.rate||0)>=0&&(f.followerRate??f.rate??0)>=0&&(f.add||0)>=0)))
  const weights=rows.map(r=>d.optimizeBy!=='prefer'||d.preferIds.includes(r.svt.id)?1:0)
  function reward(r,index,p,support,rate,flat,aura){
    if(r.maxed||!weights[index])return 0
    const front=p<=3?200:0,share=support&&support<=3?40:0
    return (exactRate(exactRate(d.base,front+share),rate+r.self+aura-r.ownAura)+flat)*(d.teapot?2:1)
  }
  for(const supportPosition of d.layouts){
    if(d.pins.some(pin=>pin.position===supportPosition&&(pin.svtId||pin.empty&&!pin.reserved&&!pin.support)))continue
    const positions=[1,2,3,4,5,6].filter(p=>p!==supportPosition)
    const slots=Array.from({length:6},(_,i)=>blank(i+1)),used=new Set(),picked=[]
    if(supportPosition)slots[supportPosition-1]={...blank(supportPosition),f:1,s:1,g:Number(d.grand)}
    const choices=positions.map(p=>{
      const pin=d.pins.find(x=>x.position===p&&!x.support)
      if(pin?.empty&&!pin.reserved)return []
      return rows.map((r,i)=>({r,i})).filter(({r})=>(!pin?.svtId||r.svt.id===pin.svtId)&&(!pin?.formKey||r.form.key===pin.formKey)&&
        (!d.fixedPositions[r.svt.id]||d.fixedPositions[r.svt.id]===p))
    })
    const optimistic=choices.map((list,j)=>new Map(list.map(({r,i})=>[i,fast?reward(r,i,positions[j],supportPosition,maxOwn[i]+(supportPosition?maxSupport[i]:0),maxFlat,maxAura):Infinity])))
    const ranked=choices.map((list,j)=>list.slice().sort((a,b)=>optimistic[j].get(b.i)-optimistic[j].get(a.i)))
    function bound(step){
      if(!fast)return Infinity
      let total=0
      for(const x of picked)total+=reward(x.r,x.i,x.p,supportPosition,maxOwn[x.i]+(supportPosition?maxSupport[x.i]:0),maxFlat,maxAura)
      for(let j=step;j<positions.length;j++){
        let best=0
        for(const {r,i} of ranked[j])if(!used.has(r.svt.id)){best=optimistic[j].get(i);break}
        total+=best
      }
      return total
    }
    function* equip(){
      const own=picked.map(x=>slots[x.p-1])
      const aura=picked.reduce((n,x)=>n+x.r.contribution,0)
      let constantScore=zeroScore?0:null
      if(fast&&monotone&&!zeroScore){
        const minimum=picked.reduce((n,{r,i,p})=>n+reward(r,i,p,supportPosition,0,0,aura),0)
        const maximum=picked.reduce((n,{r,i,p})=>n+reward(r,i,p,supportPosition,maxOwn[i]+(supportPosition?maxSupport[i]:0),maxFlat,aura),0)
        if(minimum===maximum)constantScore=minimum
      }
      if(state.useBounds!==false&&constantScore!=null&&constantScore<state.bestScore){counters.scorePruned++;return}
      const grands=d.grand?(d.grandPosition?[d.grandPosition]:own.filter(s=>s.p<=3).map(s=>s.p)):[0]
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
        const knownRates=new Float64Array(picked.length)
        let knownFlat=0,nonOrdinary=0
        function equipmentUpper(j,cost){
          if(!fast)return Infinity
          const left=fields.length-j
          const available=types.filter(c=>c.left&&(d.costLimit==null||(c.cost||0)<=d.costLimit-cost))
          const flat=knownFlat+left*Math.max(0,...available.map(c=>c.effect.flat))+(supportPosition?supportFlatMax:0)
          return picked.reduce((n,{r,i,p},at)=>{
            const rate=knownRates[at]+left*Math.max(0,...available.map(c=>c.effect.rates[i]))+(supportPosition?maxSupport[i]:0)
            return n+reward(r,i,p,supportPosition,rate,flat,aura)
          },0)
        }
        function* ownEquipment(j,cost){
          counters.nodes++
          if(counters.nodes%512===0)yield {type:'tick'}
          if(d.costLimit!=null&&cost>d.costLimit){counters.budgetPruned++;return}
          if(state.useBounds!==false&&constantScore==null&&equipmentUpper(j,cost)<state.bestScore){counters.scorePruned++;return}
          if(j===fields.length){yield* supports(cost);return}
          const {slot,field,pin,free}=fields[j]
          const original=slot[field],originalMlb=slot.mlb
          if(!pin){slot[field]=0;yield* ownEquipment(j+1,cost)}
          for(const c of types){
            if(!c.left||pin&&c.id!==pin)continue
            if(field==='bond'&&!pin&&Number(c.bondEquipOwner)!==slot.svt)continue
            c.left--;slot[field]=c.id
            if(field==='ce')slot.mlb=c.accountMlb!==false
            else if(field==='reward')slot.rewardMlb=c.accountMlb!==false
            else slot.bondMlb=c.accountMlb!==false
            if(fast){knownFlat+=c.effect.flat;nonOrdinary+=Number(!c.effect.ordinary);for(let at=0;at<picked.length;at++)knownRates[at]+=c.effect.rates[picked[at].i]}
            yield* ownEquipment(j+1,cost+(free?0:c.cost||0))
            if(fast){knownFlat-=c.effect.flat;nonOrdinary-=Number(!c.effect.ordinary);for(let at=0;at<picked.length;at++)knownRates[at]-=c.effect.rates[picked[at].i]}
            c.left++
          }
          slot[field]=original;slot.mlb=originalMlb
        }
        function* supports(cost){
          const support=slots[supportPosition-1]
          const options=supportPosition?(d.lockSupportCeId?d.supportCes.filter(c=>c.id===d.lockSupportCeId):[null,...d.supportCes]):[null]
          const seen=new Set()
          for(const ce of options){
            const key=ce?`${ce.id}:${ce.supportMlb!==false}`:'0'
            if(seen.has(key))continue;seen.add(key)
            if(support){support.ce=ce?.id||0;support.mlb=ce?.supportMlb!==false}
            const rewards=d.grand&&supportPosition?[null,...d.supportCes]:[null]
            for(const extra of rewards){
              if(extra&&ce&&extra.id===ce.id&&d.supportCes.filter(c=>c.id===ce.id).length<2)continue
              if(support){support.reward=extra?.id||0;support.rewardMlb=true}
              const pin=d.pins.find(x=>x.position===supportPosition&&x.support)
              if(pin?.ceRewardId&&pin.ceRewardId!==(extra?.id||0))continue
              // Fast exact arithmetic rejects losing leaves before hydration.
              let score=constantScore
              const supEffect=effect(ce,true)
              if(score==null&&fast&&!nonOrdinary&&(!supEffect||supEffect.ordinary)){
                const flat=knownFlat+(supEffect?.flat||0)
                score=picked.reduce((n,{r,i,p},at)=>n+reward(r,i,p,supportPosition,knownRates[at]+(supEffect?.rates[i]||0),flat,aura),0)
              }
              counters.evaluated++
              if(counters.evaluated%128===0)yield {type:'tick'}
              // A physically evaluated lower-score team is incidental, never
              // a reason to visit an otherwise prunable branch.
              const packed={slots:slots.map(s=>({...s})),cost}
              if(d.pinCes.some(pin=>!slots.some(s=>s.f&&!s.s&&s.ce===Number(pin.ceId)&&(!pin.svtId||s.svt===pin.svtId))))continue
              if(score!=null)packed.score=score
              yield {type:'team',packed,score}
            }
          }
        }
        yield* ownEquipment(0,picked.reduce((n,x)=>n+x.r.cost,0))
      }
    }
    function* members(step,spent){
      counters.nodes++
      if(counters.nodes%512===0)yield {type:'tick'}
      if(d.costLimit!=null&&spent>d.costLimit){counters.budgetPruned++;return}
      if(d.requiredIds.some(id=>!used.has(id)&&!choices.slice(step).some(list=>list.some(x=>x.r.svt.id===id))))return
      if(state.useBounds!==false&&(!zeroScore||state.bestScore>0)&&bound(step)<state.bestScore){counters.scorePruned++;return}
      if(step===positions.length){
        if(picked.length<d.minimumOwn||!picked.length||!slots.slice(0,3).some(s=>s.f))return
        yield* equip();return
      }
      const p=positions[step],slot=slots[p-1],pin=d.pins.find(x=>x.position===p&&!x.support)
      for(const {r,i} of ranked[step]){
        if(used.has(r.svt.id))continue
        used.add(r.svt.id);Object.assign(slot,{f:1,svt:r.svt.id,art:r.form.key==='default'?'':r.form.key})
        picked.push({r,i,p});yield* members(step+1,spent+r.cost);picked.pop();used.delete(r.svt.id)
      }
      Object.assign(slot,blank(p))
      if(!pin?.svtId&&!pin?.ceId&&!pin?.ceBondId&&!pin?.ceRewardId)yield* members(step+1,spent)
    }
    yield* members(0,0)
  }
}
