import {pickCeSkill,ceMatchesServant} from '../atlas.js'
import {searchFeatures} from './ai-search.js'
const domainGuidance=new WeakMap()

// Guidance changes visitation order only. These estimates are deliberately
// separate from the proved arithmetic bounds and from exact live settlement.
export function createScoreTeamGuidance(d,{effectFor}={}){
  const source=d.guidanceSource||d
  if(!effectFor&&domainGuidance.has(source))return domainGuidance.get(source)
  const own=new Map(),support=new Map(),rowIndex=new Map()
  const friendAllowed=d.partyConstraints?!d.partyConstraints.noSupport&&d.partyConstraints.supportPolicy!=='system':d.layouts.some(Boolean)
  const supportCards=friendAllowed?d.supportCes:[]
  d.rows.forEach((r,i)=>{rowIndex.set(r,i);for(const physical of r.equivalentRows||[])rowIndex.set(physical,i)})
  const weighted=r=>!r.maxed&&(d.optimizeBy!=='prefer'||d.preferIds.includes(r.svt.id))
  function effect(c,isSupport=false){
    if(effectFor)return effectFor(c,isSupport)
    const cache=isSupport?support:own
    const mlb=isSupport?c.supportMlb!==false:c.accountMlb!==false
    const key=c.id+':'+Number(mlb)
    if(cache.has(key))return cache.get(key)
    const fs=(pickCeSkill(c,mlb)?.funcs||[]).filter(f=>!f.eventId&&(!isSupport||f.applySupport!==0))
    const flat=fs.reduce((n,f)=>n+Math.max(0,f.add||0),0)
    const rates=d.rows.map(r=>fs.reduce((n,f)=>n+(ceMatchesServant(f,r.form.traitIds||[])?Math.max(0,isSupport?(f.followerRate??f.rate??0):(f.rate||0)):0),0))
    const value={rates,flat};cache.set(key,value);return value
  }
  const memberScores=new Map()
  let ai=null
  const memberFeatures=new Map(),wantsAI=Boolean(d.guidanceAI&&(d.grand||d.systemSupport||d.partyConstraints||d.arithmeticBounds===false))
  function member(r,cap){
    const key=rowIndex.get(r)+':'+cap
    if(!memberScores.has(key)){
      const i=rowIndex.get(r),ownRate=d.ownCes.map(c=>effect(c).rates[i]).sort((a,b)=>b-a).slice(0,cap+(d.grand?1:0)).reduce((n,v)=>n+v,0)
      const supportRate=supportCards.reduce((n,c)=>Math.max(n,effect(c,true).rates[i]),0)*(d.grand?2:1)
      memberScores.set(key,weighted(r)?Math.max(0,d.base)*(1000+r.self+ownRate+supportRate)/1000:0)
    }
    // A capped aura provider earns nothing itself. Do not rank an entire
    // party of capped providers ahead of the recipients needed to earn bond.
    const estimate=memberScores.get(key)+Math.max(0,d.base)*Math.max(0,r.contribution)*Math.max(0,cap-1)/2000
    const policy=ai?.score('servant',memberFeatures.get(rowIndex.get(r)))
    return policy==null?estimate:estimate*(0.95+0.1*policy)
  }
  function rank(cards,picked,isSupport=false){
    return cards.map(c=>({c,score:picked.reduce((n,{r})=>{
      if(!weighted(r))return n
      const e=effect(c,isSupport),i=rowIndex.get(r)
      return n+Math.max(0,d.base)*e.rates[i]/1000+e.flat
    },0)})).sort((a,b)=>b.score-a.score||(a.c.cost||0)-(b.c.cost||0)).map(x=>x.c)
  }
  let prepared=false
  function* prepare(){
    if(prepared)return
    let n=0
    for(const [cards,isSupport] of [[d.ownCes,false],[supportCards,true]])for(const c of cards){effect(c,isSupport);if(++n%32===0)yield {type:'tick'}}
    if(wantsAI){
      const cap=d.partyConstraints?.ownMax||6,servantFeatures=[],equipmentFeatures=[]
      for(let i=0;i<d.rows.length;i++){
        const r=d.rows[i],f=searchFeatures({rates:d.ownCes.map(c=>effect(c).rates[i]),cost:r.cost,live:Number(!r.maxed),self:r.self,party:r.contribution,
          base:d.base,budget:d.costLimit,cap,preferred:d.preferIds.includes(r.svt.id)})
        servantFeatures.push(f);memberFeatures.set(i,f);if(++n%32===0)yield {type:'tick'}
      }
      for(const c of d.ownCes){const e=effect(c);equipmentFeatures.push(searchFeatures({rates:e.rates,cost:c.cost,flat:e.flat,base:d.base,budget:d.costLimit,cap}));if(++n%32===0)yield {type:'tick'}}
      ai=d.guidanceAI({equipmentFeatures,servantFeatures,queryContext:{costLimit:d.costLimit,minimumOwn:d.minimumOwn,requiredIds:d.requiredIds,
        fixedPositions:d.fixedPositions,emptyPositions:d.pins.filter(p=>p.empty).map(p=>p.position),layouts:d.layouts,identitiesCount:new Set(d.rows.map(r=>r.svt.id)).size}})
    }
    prepared=true
  }
  const result={member,rank,prepare,get ai(){return ai?.stats||null},wantsAI}
  if(!effectFor)domainGuidance.set(source,result)
  return result
}
